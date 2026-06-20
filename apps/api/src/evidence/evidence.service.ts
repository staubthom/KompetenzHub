import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EnrollmentStatus, EvidenceType, Prisma, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';

interface QuizOption {
  id: string;
  text: string;
}
interface QuizQuestion {
  id: string;
  text: string;
  type: 'single' | 'multiple';
  options: QuizOption[];
  correct: string[];
  points: number;
}
interface UploadConfig {
  allowedFileTypes?: string[];
  maxFileSizeMb?: number;
}

export interface CreateEvidenceDto {
  moduleId: string;
  type: EvidenceType;
  title: Record<string, string>;
  instructions?: Record<string, string>;
  maxPoints?: number;
  targetLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  isVisible?: boolean;
  availableFrom?: string;
  dueAt?: string;
  config?: Record<string, unknown>;
  fieldIds?: string[];
}

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  // ── Lehrer-CRUD (FA-30/32/36/40) ──────────────────────────────

  async list(tenantId: string, moduleId?: string) {
    return this.prisma.competenceEvidence.findMany({
      where: { tenantId, ...(moduleId ? { moduleId } : {}) },
      include: { fields: true, _count: { select: { submissions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForTeacher(id: string, tenantId: string) {
    const ev = await this.prisma.competenceEvidence.findFirst({
      where: { id, tenantId },
      include: { fields: true },
    });
    if (!ev) throw new NotFoundException('Nachweis nicht gefunden.');
    return ev;
  }

  async create(dto: CreateEvidenceDto, tenantId: string) {
    if (!dto.title?.de) throw new BadRequestException('"title.de" ist erforderlich.');
    if (!dto.type) throw new BadRequestException('"type" ist erforderlich.');
    const module = await this.prisma.module.findFirst({ where: { id: dto.moduleId, tenantId } });
    if (!module) throw new BadRequestException('Modul nicht gefunden.');

    if (dto.type === EvidenceType.QUIZ) this.validateQuizConfig(dto.config);

    const maxPoints = this.resolveMaxPoints(dto.type, dto.maxPoints, dto.config);

    const ev = await this.prisma.competenceEvidence.create({
      data: {
        // tenantId via Scoping-Middleware
        moduleId: dto.moduleId,
        type: dto.type,
        title: dto.title as Prisma.InputJsonValue,
        instructions: (dto.instructions ?? {}) as Prisma.InputJsonValue,
        maxPoints,
        targetLevel: dto.targetLevel,
        isVisible: dto.isVisible ?? false,
        availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      } as never,
      include: { fields: true },
    });

    if (dto.fieldIds?.length) await this.setFields(ev.id, dto.fieldIds, tenantId);
    return this.findOneForTeacher(ev.id, tenantId);
  }

  async update(id: string, dto: Partial<CreateEvidenceDto>, tenantId: string) {
    const ev = await this.findOneForTeacher(id, tenantId);
    if (dto.config !== undefined && ev.type === EvidenceType.QUIZ) {
      this.validateQuizConfig(dto.config);
    }
    const data: Prisma.CompetenceEvidenceUpdateInput = {
      ...(dto.title && { title: dto.title as Prisma.InputJsonValue }),
      ...(dto.instructions !== undefined && {
        instructions: dto.instructions as Prisma.InputJsonValue,
      }),
      ...(dto.targetLevel !== undefined && { targetLevel: dto.targetLevel }),
      ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
      ...(dto.availableFrom !== undefined && {
        availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
      }),
      ...(dto.dueAt !== undefined && { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }),
      ...(dto.config !== undefined && { config: dto.config as Prisma.InputJsonValue }),
    };
    if (dto.maxPoints !== undefined || dto.config !== undefined) {
      data.maxPoints = this.resolveMaxPoints(
        ev.type,
        dto.maxPoints ?? (ev.maxPoints ? Number(ev.maxPoints) : undefined),
        dto.config ?? (ev.config as Record<string, unknown>),
      );
    }

    await this.prisma.competenceEvidence.update({ where: { id }, data });
    if (dto.fieldIds) await this.setFields(id, dto.fieldIds, tenantId);
    return this.findOneForTeacher(id, tenantId);
  }

  async remove(id: string, tenantId: string) {
    await this.findOneForTeacher(id, tenantId);
    await this.prisma.competenceEvidence.delete({ where: { id } });
  }

  /** Kompetenzfeld-Zuordnung setzen (n:m), validiert Tenant-Zugehörigkeit. */
  async setFields(id: string, fieldIds: string[], tenantId: string) {
    await this.findOneForTeacher(id, tenantId);
    // Nur Felder des aktiven Tenants zulassen
    const valid = await this.prisma.competenceField.findMany({
      where: { id: { in: fieldIds }, band: { matrix: { module: { tenantId } } } },
      select: { id: true },
    });
    await this.prisma.evidenceField.deleteMany({ where: { evidenceId: id } });
    if (valid.length) {
      await this.prisma.evidenceField.createMany({
        data: valid.map((f) => ({ evidenceId: id, fieldId: f.id })),
        skipDuplicates: true,
      });
    }
    return this.findOneForTeacher(id, tenantId);
  }

  // ── Lernenden-Sicht (FA-36 Sichtbarkeit) ──────────────────────

  /** Sichtbare Nachweise für Lernende (ohne Lösungen), inkl. Fälligkeitsstatus. */
  async listForStudent(tenantId: string, userId: string, type?: EvidenceType) {
    const now = new Date();
    const evidences = await this.prisma.competenceEvidence.findMany({
      where: {
        tenantId,
        isVisible: true,
        ...(type ? { type } : {}),
        module: {
          classes: { some: { enrollments: { some: { userId, status: EnrollmentStatus.ACTIVE } } } },
        },
      },
      include: { fields: true },
      orderBy: { createdAt: 'desc' },
    });
    return evidences
      .filter((e) => !e.availableFrom || e.availableFrom <= now)
      .map((e) => this.toStudentView(e, now));
  }

  async getForStudent(id: string, tenantId: string, userId: string) {
    const ev = await this.prisma.competenceEvidence.findFirst({
      where: {
        id,
        tenantId,
        isVisible: true,
        module: {
          classes: { some: { enrollments: { some: { userId, status: EnrollmentStatus.ACTIVE } } } },
        },
      },
      include: { fields: true },
    });
    if (!ev) throw new NotFoundException('Nachweis nicht verfügbar.');
    const now = new Date();
    if (ev.availableFrom && ev.availableFrom > now) {
      throw new ForbiddenException('Nachweis ist noch nicht freigeschaltet.');
    }
    return this.toStudentView(ev, now);
  }

  // ── Quiz-Auswertung (FA-32) ───────────────────────────────────

  /** Bewertet die Quiz-Antworten serverseitig und speichert die Einreichung. */
  async gradeQuiz(id: string, tenantId: string, userId: string, answers: Record<string, string[]>) {
    const ev = await this.prisma.competenceEvidence.findFirst({
      where: { id, tenantId, isVisible: true },
    });
    if (!ev) throw new NotFoundException('Quiz nicht verfügbar.');
    if (ev.type !== EvidenceType.QUIZ) throw new BadRequestException('Kein Quiz.');

    const enrollment = await this.resolveEnrollment(ev.moduleId, tenantId, userId);
    const questions = this.questions(ev.config as Record<string, unknown>);

    let achieved = 0;
    let max = 0;
    for (const q of questions) {
      max += q.points;
      const given = new Set(answers?.[q.id] ?? []);
      const correct = new Set(q.correct);
      const exact = given.size === correct.size && [...given].every((g) => correct.has(g));
      if (exact) achieved += q.points;
    }

    const submission = await this.prisma.submission.create({
      data: {
        evidenceId: id,
        enrollmentId: enrollment.id,
        status: SubmissionStatus.GRADED,
        content: { answers } as Prisma.InputJsonValue,
        points: achieved,
        submittedAt: new Date(),
      },
    });

    return { submissionId: submission.id, points: achieved, maxPoints: max };
  }

  // ── Upload (FA-30) ────────────────────────────────────────────

  /** Presigned-URL für den direkten Upload anfordern (validiert Typ & Grösse). */
  async requestUpload(
    id: string,
    tenantId: string,
    userId: string,
    fileName: string,
    contentType: string,
    sizeBytes: number,
  ) {
    const ev = await this.prisma.competenceEvidence.findFirst({
      where: { id, tenantId, isVisible: true },
    });
    if (!ev) throw new NotFoundException('Nachweis nicht verfügbar.');
    if (ev.type !== EvidenceType.FILE_UPLOAD)
      throw new BadRequestException('Kein Upload-Nachweis.');
    await this.resolveEnrollment(ev.moduleId, tenantId, userId);

    const cfg = (ev.config ?? {}) as UploadConfig;
    this.validateFile(cfg, fileName, sizeBytes);

    const key = this.s3.buildKey(`evidence/${id}`, fileName);
    const url = await this.s3.presignUpload(key, contentType || 'application/octet-stream');
    return { uploadUrl: url, key };
  }

  /** Upload bestätigen → Einreichung anlegen (status submitted). */
  async confirmUpload(id: string, tenantId: string, userId: string, key: string, fileName: string) {
    const ev = await this.prisma.competenceEvidence.findFirst({
      where: { id, tenantId, isVisible: true },
    });
    if (!ev) throw new NotFoundException('Nachweis nicht verfügbar.');
    const enrollment = await this.resolveEnrollment(ev.moduleId, tenantId, userId);

    const submission = await this.prisma.submission.create({
      data: {
        evidenceId: id,
        enrollmentId: enrollment.id,
        status: SubmissionStatus.SUBMITTED,
        fileKey: key,
        fileName,
        submittedAt: new Date(),
      },
    });
    return { submissionId: submission.id, status: submission.status };
  }

  // ── Helfer ────────────────────────────────────────────────────

  private async resolveEnrollment(moduleId: string, tenantId: string, userId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId,
        status: EnrollmentStatus.ACTIVE,
        class: { moduleId, tenantId },
      },
    });
    if (!enrollment) {
      throw new ForbiddenException('Keine aktive Klassenmitgliedschaft für diesen Nachweis.');
    }
    return enrollment;
  }

  private questions(config: Record<string, unknown>): QuizQuestion[] {
    const qs = (config?.questions ?? []) as QuizQuestion[];
    return Array.isArray(qs) ? qs : [];
  }

  private resolveMaxPoints(
    type: EvidenceType,
    maxPoints: number | undefined,
    config: Record<string, unknown> | undefined,
  ): number | null {
    if (type === EvidenceType.QUIZ) {
      const sum = this.questions(config ?? {}).reduce((s, q) => s + (Number(q.points) || 0), 0);
      return sum > 0 ? sum : (maxPoints ?? null);
    }
    return maxPoints ?? null;
  }

  private validateQuizConfig(config: Record<string, unknown> | undefined) {
    const qs = this.questions(config ?? {});
    if (qs.length === 0) throw new BadRequestException('Quiz braucht mindestens eine Frage.');
    for (const q of qs) {
      if (!q.id || !q.text) throw new BadRequestException('Jede Frage braucht id und text.');
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new BadRequestException('Jede Frage braucht mindestens zwei Optionen.');
      }
      if (!Array.isArray(q.correct) || q.correct.length === 0) {
        throw new BadRequestException('Jede Frage braucht mindestens eine korrekte Antwort.');
      }
    }
  }

  private validateFile(cfg: UploadConfig, fileName: string, sizeBytes: number) {
    const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
    if (cfg.allowedFileTypes?.length) {
      const allowed = cfg.allowedFileTypes.map((t) => t.toLowerCase().replace(/^\./, ''));
      if (!allowed.includes(ext)) {
        throw new UnprocessableEntityException(
          `Dateityp .${ext} nicht erlaubt. Erlaubt: ${allowed.join(', ')}.`,
        );
      }
    }
    if (cfg.maxFileSizeMb && sizeBytes > cfg.maxFileSizeMb * 1024 * 1024) {
      throw new UnprocessableEntityException(`Datei zu gross (max. ${cfg.maxFileSizeMb} MB).`);
    }
  }

  /** Entfernt korrekte Antworten aus der Quiz-Config und ergänzt Status. */
  private toStudentView(
    ev: {
      id: string;
      type: EvidenceType;
      title: unknown;
      instructions: unknown;
      maxPoints: unknown;
      targetLevel: unknown;
      dueAt: Date | null;
      config: unknown;
      fields: unknown;
    },
    now: Date,
  ) {
    const base = {
      id: ev.id,
      type: ev.type,
      title: ev.title,
      instructions: ev.instructions,
      maxPoints: ev.maxPoints,
      targetLevel: ev.targetLevel,
      dueAt: ev.dueAt,
      isOverdue: !!ev.dueAt && ev.dueAt < now,
      fields: ev.fields,
    };
    if (ev.type === EvidenceType.QUIZ) {
      const qs = this.questions(ev.config as Record<string, unknown>).map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        points: q.points,
        options: q.options, // ohne "correct"
      }));
      return { ...base, config: { questions: qs } };
    }
    return { ...base, config: ev.config };
  }
}
