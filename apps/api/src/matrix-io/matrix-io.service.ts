import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CompetenceLevel, EvidenceType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SCHEMA_VERSION = 1;
const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

type Json = Record<string, unknown>;

interface ExportField {
  level: string;
  code: string;
  descriptor: Json | null;
}
interface ExportBand {
  code: string;
  description: Json;
  weight: number;
  sortOrder: number;
  actionGoalCodes: string[];
  fields: ExportField[];
}
interface ExportEvidence {
  type: string;
  title: Json;
  instructions: Json;
  maxPoints: number | null;
  targetLevel: string | null;
  isVisible: boolean;
  sortOrder: number;
  config: Json;
  fieldCodes: string[];
}
interface ExportPath {
  name: string;
  isActive: boolean;
  fieldCodes: string[];
}
export interface MatrixExport {
  schemaVersion: number;
  kind: 'matrix-export';
  exportedAt: string;
  module: { number: string; title: Json; description: Json; profession: string | null };
  actionGoals: { code: string; text: Json; sortOrder: number }[];
  bands: ExportBand[];
  evidences: ExportEvidence[];
  learningPaths: ExportPath[];
}

@Injectable()
export class MatrixIoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Export ─────────────────────────────────────────────────────

  async exportMatrix(matrixId: string, tenantId: string): Promise<MatrixExport> {
    const matrix = await this.prisma.competenceMatrix.findFirst({
      where: { id: matrixId, module: { tenantId } },
      include: {
        module: {
          include: { actionGoals: { orderBy: { sortOrder: 'asc' } } },
        },
        bands: {
          orderBy: { sortOrder: 'asc' },
          include: {
            fields: { orderBy: { level: 'asc' }, include: { descriptor: true } },
            actionGoals: { include: { actionGoal: { select: { code: true } } } },
          },
        },
      },
    });
    if (!matrix) throw new NotFoundException('Matrix nicht gefunden.');

    const evidences = await this.prisma.competenceEvidence.findMany({
      where: { moduleId: matrix.moduleId, tenantId },
      orderBy: { sortOrder: 'asc' },
      include: { fields: { include: { field: { select: { code: true } } } } },
    });

    const paths = await this.prisma.learningPath.findMany({
      where: { matrixId: matrix.id },
      orderBy: { createdAt: 'asc' },
      include: {
        steps: { orderBy: { sortOrder: 'asc' }, include: { field: { select: { code: true } } } },
      },
    });

    return {
      schemaVersion: SCHEMA_VERSION,
      kind: 'matrix-export',
      exportedAt: new Date().toISOString(),
      module: {
        number: matrix.module.number,
        title: matrix.module.title as Json,
        description: matrix.module.description as Json,
        profession: matrix.module.profession,
      },
      actionGoals: matrix.module.actionGoals.map((g) => ({
        code: g.code,
        text: g.text as Json,
        sortOrder: g.sortOrder,
      })),
      bands: matrix.bands.map((b) => ({
        code: b.code,
        description: b.description as Json,
        weight: Number(b.weight),
        sortOrder: b.sortOrder,
        actionGoalCodes: b.actionGoals.map((ag) => ag.actionGoal.code),
        fields: b.fields.map((f) => ({
          level: f.level,
          code: f.code,
          descriptor: (f.descriptor?.text as Json | undefined) ?? null,
        })),
      })),
      evidences: evidences.map((e) => ({
        type: e.type,
        title: e.title as Json,
        instructions: e.instructions as Json,
        maxPoints: e.maxPoints != null ? Number(e.maxPoints) : null,
        targetLevel: e.targetLevel,
        isVisible: e.isVisible,
        sortOrder: e.sortOrder,
        config: e.config as Json,
        fieldCodes: e.fields.map((ef) => ef.field.code),
      })),
      learningPaths: paths.map((p) => ({
        name: p.name,
        isActive: p.isActive,
        fieldCodes: p.steps.map((s) => s.field.code),
      })),
    };
  }

  // ── Import ─────────────────────────────────────────────────────

  async importMatrix(tenantId: string, ownerId: string, raw: unknown) {
    const data = this.validate(raw);

    const number = await this.freeNumber(tenantId, data.module.number);

    // Modul + leere Matrix
    const module = await this.prisma.module.create({
      data: {
        tenantId,
        ownerId,
        number,
        title: data.module.title as Prisma.InputJsonValue,
        description: (data.module.description ?? {}) as Prisma.InputJsonValue,
        profession: data.module.profession ?? null,
      },
      select: { id: true, number: true },
    });
    const matrix = await this.prisma.competenceMatrix.create({
      data: { moduleId: module.id },
      select: { id: true },
    });

    // Handlungsziele (code → id)
    const goalIdByCode = new Map<string, string>();
    for (const g of data.actionGoals) {
      const created = await this.prisma.actionGoal.create({
        data: {
          moduleId: module.id,
          code: g.code,
          text: (g.text ?? {}) as Prisma.InputJsonValue,
          sortOrder: g.sortOrder ?? 0,
        },
        select: { id: true },
      });
      goalIdByCode.set(g.code, created.id);
    }

    // Bänder + Felder (+ Deskriptoren), fieldCode → id
    const fieldIdByCode = new Map<string, string>();
    for (const b of data.bands) {
      const band = await this.prisma.competenceBand.create({
        data: {
          matrixId: matrix.id,
          code: b.code,
          description: (b.description ?? {}) as Prisma.InputJsonValue,
          weight: b.weight ?? 1.0,
          sortOrder: b.sortOrder ?? 0,
          fields: {
            create: b.fields.map((f) => ({
              level: f.level as CompetenceLevel,
              code: f.code,
            })),
          },
        },
        include: { fields: true },
      });
      for (const f of band.fields) fieldIdByCode.set(f.code, f.id);

      // Deskriptoren
      for (const f of b.fields) {
        if (f.descriptor) {
          const fieldId = fieldIdByCode.get(f.code);
          if (fieldId) {
            await this.prisma.descriptor.create({
              data: { fieldId, text: f.descriptor as Prisma.InputJsonValue },
            });
          }
        }
      }

      // Band ↔ Handlungsziele
      const links = (b.actionGoalCodes ?? [])
        .map((code) => goalIdByCode.get(code))
        .filter((id): id is string => !!id)
        .map((actionGoalId) => ({ bandId: band.id, actionGoalId }));
      if (links.length > 0) {
        await this.prisma.bandActionGoal.createMany({ data: links, skipDuplicates: true });
      }
    }

    // Nachweise (+ Feldzuordnung)
    for (const e of data.evidences) {
      const ev = await this.prisma.competenceEvidence.create({
        data: {
          moduleId: module.id,
          type: (e.type as EvidenceType) ?? EvidenceType.FILE_UPLOAD,
          title: e.title as Prisma.InputJsonValue,
          instructions: (e.instructions ?? {}) as Prisma.InputJsonValue,
          maxPoints: e.maxPoints ?? null,
          targetLevel: (e.targetLevel as CompetenceLevel | null) ?? null,
          isVisible: e.isVisible ?? false,
          sortOrder: e.sortOrder ?? 0,
          config: (e.config ?? {}) as Prisma.InputJsonValue,
        } as never,
        select: { id: true },
      });
      const fieldLinks = (e.fieldCodes ?? [])
        .map((code) => fieldIdByCode.get(code))
        .filter((id): id is string => !!id)
        .map((fieldId) => ({ evidenceId: ev.id, fieldId }));
      if (fieldLinks.length > 0) {
        await this.prisma.evidenceField.createMany({ data: fieldLinks, skipDuplicates: true });
      }
    }

    // Lernpfade (+ Schritte)
    for (const p of data.learningPaths) {
      const stepFieldIds = (p.fieldCodes ?? [])
        .map((code) => fieldIdByCode.get(code))
        .filter((id): id is string => !!id);
      if (stepFieldIds.length === 0) continue;
      await this.prisma.learningPath.create({
        data: {
          matrixId: matrix.id,
          name: p.name,
          isActive: p.isActive ?? false,
          steps: { create: stepFieldIds.map((fieldId, i) => ({ fieldId, sortOrder: i + 1 })) },
        },
      });
    }

    await this.audit(tenantId, ownerId, module.id, number);
    return { moduleId: module.id, matrixId: matrix.id, number };
  }

  // ── Validierung ────────────────────────────────────────────────

  private validate(raw: unknown): MatrixExport {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Ungültige Importdatei: kein JSON-Objekt.');
    }
    const d = raw as Json;
    if (d.schemaVersion !== SCHEMA_VERSION) {
      throw new BadRequestException(
        `Inkompatible Schema-Version (erwartet ${SCHEMA_VERSION}, erhalten ${String(d.schemaVersion)}).`,
      );
    }
    if (d.kind !== 'matrix-export') {
      throw new BadRequestException('Ungültige Importdatei: kein Matrix-Export.');
    }
    const module = d.module as Json | undefined;
    if (!module || typeof module.number !== 'string' || !module.number.trim()) {
      throw new BadRequestException('Ungültige Importdatei: module.number fehlt.');
    }
    const title = module.title as Json | undefined;
    if (!title || typeof title.de !== 'string' || !title.de.trim()) {
      throw new BadRequestException('Ungültige Importdatei: module.title.de fehlt.');
    }
    if (!Array.isArray(d.bands)) {
      throw new BadRequestException('Ungültige Importdatei: bands fehlt.');
    }
    for (const b of d.bands as Json[]) {
      if (!b || typeof b.code !== 'string' || !b.code.trim()) {
        throw new BadRequestException('Ungültige Importdatei: Band ohne code.');
      }
      if (!Array.isArray(b.fields)) {
        throw new BadRequestException(`Ungültige Importdatei: Band ${b.code} ohne fields.`);
      }
      for (const f of b.fields as Json[]) {
        if (!f || typeof f.level !== 'string' || !LEVELS.includes(f.level)) {
          throw new BadRequestException(
            `Ungültige Importdatei: ungültige Gütestufe in Band ${b.code}.`,
          );
        }
        if (typeof f.code !== 'string' || !f.code.trim()) {
          throw new BadRequestException(`Ungültige Importdatei: Feld ohne code in Band ${b.code}.`);
        }
      }
    }
    // Optionale Arrays defensiv normalisieren
    const out = raw as MatrixExport;
    out.actionGoals = Array.isArray(out.actionGoals) ? out.actionGoals : [];
    out.evidences = Array.isArray(out.evidences) ? out.evidences : [];
    out.learningPaths = Array.isArray(out.learningPaths) ? out.learningPaths : [];
    return out;
  }

  /** Findet eine im Tenant freie Modulnummer (Basis, sonst „…-Kopie", „…-Kopie-2", …). */
  private async freeNumber(tenantId: string, base: string): Promise<string> {
    const exists = async (n: string) =>
      !!(await this.prisma.module.findFirst({
        where: { tenantId, number: n },
        select: { id: true },
      }));
    if (!(await exists(base))) return base;
    let i = 1;
    for (;;) {
      const candidate = i === 1 ? `${base}-Kopie` : `${base}-Kopie-${i}`;
      if (!(await exists(candidate))) return candidate;
      i++;
    }
  }

  private async audit(tenantId: string, userId: string, moduleId: string, number: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'matrix.import',
          detail: { moduleId, number } as Prisma.InputJsonValue,
        },
      });
    } catch {
      /* Audit nicht fatal */
    }
  }
}
