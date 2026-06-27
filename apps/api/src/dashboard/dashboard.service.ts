import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, Role, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CellStatus = 'OPEN' | 'SUBMITTED' | 'REJECTED' | 'GRADED';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fortschritts-Aggregation für einen Modulanlass (FA-90/91):
   * Lernende × Kompetenzfelder mit Status, plus Kennzahlen.
   */
  async progress(classId: string, tenantId: string, userId: string, roles: Role[]) {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        moduleId: true,
        module: { select: { id: true, number: true, title: true } },
        coTeachers: { where: { userId }, select: { userId: true } },
      },
    });
    if (!cls) throw new NotFoundException('Modulanlass nicht gefunden.');
    const hasAccess =
      cls.ownerId === userId || cls.coTeachers.length > 0 || roles.includes(Role.ADMIN);
    if (!hasAccess) {
      throw new ForbiddenException(
        'Nur die Lehrperson oder Co-Leitung des Modulanlasses hat Zugriff.',
      );
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: EnrollmentStatus.ACTIVE },
      // Aktueller Anzeigename der Person (user.displayName) hat Vorrang vor dem beim
      // Beitritt gespeicherten Schnappschuss (enrollment.displayName).
      select: { id: true, displayName: true, user: { select: { displayName: true } } },
      orderBy: { displayName: 'asc' },
    });

    // Matrixstruktur (Bänder × Felder) + Nachweise je Feld
    const bandsRaw = cls.moduleId
      ? await this.prisma.competenceBand.findMany({
          where: { matrix: { moduleId: cls.moduleId } },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            code: true,
            description: true,
            fields: {
              orderBy: { level: 'asc' },
              select: {
                id: true,
                code: true,
                level: true,
                evidences: { select: { evidenceId: true } },
              },
            },
          },
        })
      : [];

    // Map: fieldId → evidenceIds
    const fieldEvidence = new Map<string, string[]>();
    const allEvidenceIds: string[] = [];
    for (const b of bandsRaw) {
      for (const f of b.fields) {
        const ids = f.evidences.map((e) => e.evidenceId);
        fieldEvidence.set(f.id, ids);
        allEvidenceIds.push(...ids);
      }
    }
    // evidenceId → fieldId(s)
    const evidenceField = new Map<string, string[]>();
    for (const [fieldId, evIds] of fieldEvidence) {
      for (const evId of evIds) {
        const arr = evidenceField.get(evId) ?? [];
        arr.push(fieldId);
        evidenceField.set(evId, arr);
      }
    }

    // Eindeutige Nachweise (Aufgaben) des Moduls mit Titel/Maximalpunkten – Basis
    // für die Punkte-Summen je Lernende:r und den CSV-Export (FA-90).
    const uniqueEvidenceIds = [...new Set(allEvidenceIds)];
    const evidenceMeta = uniqueEvidenceIds.length
      ? await this.prisma.competenceEvidence.findMany({
          where: { id: { in: uniqueEvidenceIds } },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, title: true, maxPoints: true },
        })
      : [];
    const evidences = evidenceMeta.map((e) => ({
      id: e.id,
      title: e.title,
      maxPoints: e.maxPoints != null ? Number(e.maxPoints) : null,
    }));
    // Maximal erreichbare Punkte des gesamten Moduls (über alle Nachweise).
    const moduleMaxPoints = evidences.reduce((sum, e) => sum + (e.maxPoints ?? 0), 0);

    const enrollmentIds = enrollments.map((e) => e.id);
    // Letzte Einreichung je (evidence, enrollment): wir holen alle und reduzieren.
    const subs =
      allEvidenceIds.length && enrollmentIds.length
        ? await this.prisma.submission.findMany({
            where: { evidenceId: { in: allEvidenceIds }, enrollmentId: { in: enrollmentIds } },
            orderBy: { createdAt: 'desc' },
            select: {
              evidenceId: true,
              enrollmentId: true,
              status: true,
              evaluation: { select: { points: true } },
              evidence: { select: { maxPoints: true } },
            },
          })
        : [];

    // pro (enrollment, evidence) nur die neueste behalten
    const latest = new Map<string, (typeof subs)[number]>();
    for (const s of subs) {
      const key = `${s.enrollmentId}|${s.evidenceId}`;
      if (!latest.has(key)) latest.set(key, s); // subs sind desc sortiert → erstes = neuestes
    }

    const rank: Record<CellStatus, number> = { OPEN: 0, REJECTED: 1, SUBMITTED: 2, GRADED: 3 };

    // Grid aufbauen
    const fieldIds = [...fieldEvidence.keys()];
    const students = enrollments.map((en) => {
      const cells: Record<
        string,
        { status: CellStatus; points: number | null; maxPoints: number | null }
      > = {};
      let gradedFields = 0;
      let openCount = 0;
      for (const fieldId of fieldIds) {
        const evIds = fieldEvidence.get(fieldId) ?? [];
        let best: CellStatus = 'OPEN';
        let points: number | null = null;
        let maxPoints: number | null = null;
        for (const evId of evIds) {
          const s = latest.get(`${en.id}|${evId}`);
          const st = (s?.status as CellStatus) ?? 'OPEN';
          if (rank[st] > rank[best]) best = st;
          if (st === 'GRADED' && s?.evaluation?.points != null) {
            points = (points ?? 0) + Number(s.evaluation.points);
            maxPoints =
              (maxPoints ?? 0) + (s.evidence.maxPoints ? Number(s.evidence.maxPoints) : 0);
          }
        }
        // Felder ohne Nachweis bleiben OPEN/leer
        cells[fieldId] = { status: best, points, maxPoints };
        if (best === 'GRADED') gradedFields += 1;
        if (best === 'SUBMITTED') openCount += 1;
      }
      // Erreichte Punkte je Nachweis (nur bewertete) + Summe über das Modul.
      let earnedPoints = 0;
      const evidencePoints: Record<string, number | null> = {};
      for (const evId of uniqueEvidenceIds) {
        const s = latest.get(`${en.id}|${evId}`);
        if (s && s.status === 'GRADED' && s.evaluation?.points != null) {
          const p = Number(s.evaluation.points);
          evidencePoints[evId] = p;
          earnedPoints += p;
        } else {
          evidencePoints[evId] = null;
        }
      }
      const totalFields = fieldIds.length || 1;
      return {
        enrollmentId: en.id,
        displayName: en.user?.displayName ?? en.displayName,
        cells,
        gradedFields,
        toGradeCount: openCount,
        progress: Math.round((gradedFields / totalFields) * 100),
        earnedPoints,
        evidencePoints,
      };
    });

    // Kennzahlen
    let toGrade = 0;
    let graded = 0;
    for (const s of latest.values()) {
      if (s.status === SubmissionStatus.SUBMITTED) toGrade += 1;
      if (s.status === SubmissionStatus.GRADED) graded += 1;
    }
    const avgProgress = students.length
      ? Math.round(students.reduce((sum, s) => sum + s.progress, 0) / students.length)
      : 0;

    // Erfüllungsgrad je Feld (Anteil Lernende mit GRADED)
    const fieldStats = fieldIds.map((fieldId) => {
      let g = 0;
      for (const st of students) if (st.cells[fieldId]?.status === 'GRADED') g += 1;
      return {
        fieldId,
        gradedCount: g,
        percent: students.length ? Math.round((g / students.length) * 100) : 0,
      };
    });

    return {
      class: { id: cls.id, name: cls.name },
      module: cls.module,
      studentCount: enrollments.length,
      toGrade,
      graded,
      avgProgress,
      maxPoints: moduleMaxPoints,
      evidences,
      bands: bandsRaw.map((b) => ({
        id: b.id,
        code: b.code,
        description: b.description,
        fields: b.fields.map((f) => ({
          id: f.id,
          code: f.code,
          level: f.level,
          evidenceCount: (fieldEvidence.get(f.id) ?? []).length,
        })),
      })),
      fieldStats,
      students,
    };
  }
}
