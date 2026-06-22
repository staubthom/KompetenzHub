import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type FieldStatus = 'OPEN' | 'SUBMITTED' | 'GRADED' | 'REJECTED';

@Injectable()
export class LearningPathsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Lehrperson: CRUD ──────────────────────────────────────────

  async list(matrixId: string, tenantId: string) {
    await this.assertMatrixAccess(matrixId, tenantId);
    const paths = await this.prisma.learningPath.findMany({
      where: { matrixId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      include: { steps: { orderBy: { sortOrder: 'asc' }, include: { field: true } } },
    });
    return paths.map((p) => this.toPathView(p));
  }

  async create(
    matrixId: string,
    tenantId: string,
    name: string,
    fieldIds: string[],
    isActive: boolean,
  ) {
    await this.assertMatrixAccess(matrixId, tenantId);
    const cleanName = (name ?? '').trim();
    if (!cleanName) throw new BadRequestException('Name ist erforderlich.');
    await this.assertFieldsInMatrix(matrixId, fieldIds);

    const path = await this.prisma.learningPath.create({
      data: {
        matrixId,
        name: cleanName,
        steps: { create: fieldIds.map((fieldId, i) => ({ fieldId, sortOrder: i + 1 })) },
      },
    });
    if (isActive) await this.activate(path.id, matrixId);
    return this.getOne(path.id, tenantId);
  }

  async update(
    pathId: string,
    tenantId: string,
    data: { name?: string; fieldIds?: string[]; isActive?: boolean },
  ) {
    const path = await this.loadPath(pathId, tenantId);

    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      if (!cleanName) throw new BadRequestException('Name ist erforderlich.');
      await this.prisma.learningPath.update({ where: { id: pathId }, data: { name: cleanName } });
    }

    if (Array.isArray(data.fieldIds)) {
      await this.assertFieldsInMatrix(path.matrixId, data.fieldIds);
      await this.prisma.learningPathStep.deleteMany({ where: { pathId } });
      await this.prisma.learningPathStep.createMany({
        data: data.fieldIds.map((fieldId, i) => ({ pathId, fieldId, sortOrder: i + 1 })),
      });
    }

    if (data.isActive !== undefined) {
      if (data.isActive) await this.activate(pathId, path.matrixId);
      else
        await this.prisma.learningPath.update({ where: { id: pathId }, data: { isActive: false } });
    }

    return this.getOne(pathId, tenantId);
  }

  async remove(pathId: string, tenantId: string) {
    await this.loadPath(pathId, tenantId);
    await this.prisma.learningPath.delete({ where: { id: pathId } });
  }

  async getOne(pathId: string, tenantId: string) {
    await this.loadPath(pathId, tenantId);
    const path = await this.prisma.learningPath.findUnique({
      where: { id: pathId },
      include: { steps: { orderBy: { sortOrder: 'asc' }, include: { field: true } } },
    });
    return path ? this.toPathView(path) : null;
  }

  // ── Lernende/Lehrperson: aktiver Pfad mit Status & nächstem Schritt ─

  async getActiveForModule(moduleId: string, tenantId: string, userId: string, roles: Role[]) {
    const matrix = await this.prisma.competenceMatrix.findFirst({
      where: { moduleId, module: { tenantId } },
      select: { id: true, module: { select: { number: true, title: true } } },
    });
    if (!matrix) throw new NotFoundException('Matrix nicht gefunden.');

    const path = await this.prisma.learningPath.findFirst({
      where: { matrixId: matrix.id, isActive: true },
      include: {
        steps: {
          orderBy: { sortOrder: 'asc' },
          include: { field: { include: { band: true, descriptor: true } } },
        },
      },
    });
    if (!path) return { module: matrix.module, path: null };

    // Status je Feld aus den Einreichungen der/des Lernenden ableiten.
    const isTeacher = roles.includes(Role.TEACHER) || roles.includes(Role.ADMIN);
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { userId, class: { moduleId, tenantId } },
      select: { id: true },
    });

    const fieldIds = path.steps.map((s) => s.fieldId);
    const statusByField = await this.statusByField(fieldIds, tenantId, userId, isTeacher);

    const steps = path.steps.map((s) => ({
      id: s.id,
      fieldId: s.fieldId,
      code: s.field.code,
      level: s.field.level,
      bandCode: s.field.band.code,
      descriptor: (s.field.descriptor?.text as Record<string, string> | undefined) ?? null,
      status: statusByField.get(s.fieldId) ?? ('OPEN' as FieldStatus),
    }));

    // Empfohlener nächster Schritt: erster offener/zurückgewiesener; sonst erster eingereichter.
    const actionable = steps.find((s) => s.status === 'REJECTED' || s.status === 'OPEN');
    const pending = steps.find((s) => s.status === 'SUBMITTED');
    const nextStepId = actionable?.id ?? pending?.id ?? null;

    const doneCount = steps.filter((s) => s.status === 'GRADED').length;

    return {
      module: matrix.module,
      path: {
        id: path.id,
        name: path.name,
        steps: steps.map((s) => ({ ...s, isNext: s.id === nextStepId })),
        doneCount,
        total: steps.length,
        hasEnrollment: !!enrollment || isTeacher,
      },
    };
  }

  // ── Helfer ────────────────────────────────────────────────────

  /** Aggregierter Feld-Status aus den letzten Einreichungen je sichtbarem Nachweis. */
  private async statusByField(
    fieldIds: string[],
    tenantId: string,
    userId: string,
    isTeacher: boolean,
  ): Promise<Map<string, FieldStatus>> {
    const result = new Map<string, FieldStatus>();
    if (fieldIds.length === 0) return result;

    const evidences = await this.prisma.competenceEvidence.findMany({
      where: {
        tenantId,
        isVisible: true,
        fields: { some: { fieldId: { in: fieldIds } } },
      },
      select: {
        fields: { select: { fieldId: true } },
        submissions: isTeacher
          ? false
          : {
              where: { enrollment: { userId } },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { status: true },
            },
      },
    });

    // Pro Feld die „beste"/relevanteste Statusmeldung bestimmen.
    const collect = new Map<string, SubmissionStatus[]>();
    for (const ev of evidences) {
      const last = isTeacher ? undefined : ev.submissions?.[0]?.status;
      for (const f of ev.fields) {
        if (!fieldIds.includes(f.fieldId)) continue;
        const arr = collect.get(f.fieldId) ?? [];
        if (last) arr.push(last);
        collect.set(f.fieldId, arr);
      }
    }

    for (const fieldId of fieldIds) {
      const statuses = collect.get(fieldId) ?? [];
      result.set(fieldId, this.aggregate(statuses));
    }
    return result;
  }

  private aggregate(statuses: SubmissionStatus[]): FieldStatus {
    if (statuses.includes(SubmissionStatus.REJECTED)) return 'REJECTED';
    if (statuses.includes(SubmissionStatus.SUBMITTED)) return 'SUBMITTED';
    if (statuses.length > 0 && statuses.every((s) => s === SubmissionStatus.GRADED))
      return 'GRADED';
    return 'OPEN';
  }

  private async activate(pathId: string, matrixId: string) {
    await this.prisma.$transaction([
      this.prisma.learningPath.updateMany({ where: { matrixId }, data: { isActive: false } }),
      this.prisma.learningPath.update({ where: { id: pathId }, data: { isActive: true } }),
    ]);
  }

  private async assertFieldsInMatrix(matrixId: string, fieldIds: string[]) {
    if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
      throw new BadRequestException('Mindestens ein Schritt (Kompetenzfeld) ist erforderlich.');
    }
    const count = await this.prisma.competenceField.count({
      where: { id: { in: fieldIds }, band: { matrixId } },
    });
    if (count !== new Set(fieldIds).size) {
      throw new BadRequestException('Ein oder mehrere Felder gehören nicht zu dieser Matrix.');
    }
  }

  private async assertMatrixAccess(matrixId: string, tenantId: string) {
    const matrix = await this.prisma.competenceMatrix.findFirst({
      where: { id: matrixId, module: { tenantId } },
      select: { id: true },
    });
    if (!matrix) throw new NotFoundException('Matrix nicht gefunden.');
    return matrix;
  }

  private async loadPath(pathId: string, tenantId: string) {
    const path = await this.prisma.learningPath.findFirst({
      where: { id: pathId, matrix: { module: { tenantId } } },
      select: { id: true, matrixId: true },
    });
    if (!path) throw new NotFoundException('Lernpfad nicht gefunden.');
    return path;
  }

  private toPathView(p: {
    id: string;
    name: string;
    isActive: boolean;
    steps: {
      id: string;
      fieldId: string;
      sortOrder: number;
      field: { code: string; level: string };
    }[];
  }) {
    return {
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      steps: p.steps.map((s) => ({
        id: s.id,
        fieldId: s.fieldId,
        code: s.field.code,
        level: s.field.level,
        sortOrder: s.sortOrder,
      })),
    };
  }
}
