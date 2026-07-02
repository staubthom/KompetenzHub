import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CompetenceLevel, EvidenceType, Prisma, Role } from '@prisma/client';
import AdmZip from 'adm-zip';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { StorageObjectsService } from '../storage/storage-objects.service';

const SCHEMA_VERSION = 1;
const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const MANIFEST = 'matrix.json';

type Json = Record<string, unknown>;

interface AssetEntry {
  path: string; // zip-interner Pfad, z. B. "assets/1-bild.png"
  contentType: string;
  kind: 'rte' | 'attachment';
}
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
  instructions: Json; // i18n-HTML, Bild-URLs auf zip-Pfade umgeschrieben
  maxPoints: number | null;
  targetLevel: string | null;
  isVisible: boolean;
  sortOrder: number;
  config: Json; // ohne attachmentKey/attachmentName
  attachment: { path: string; name: string } | null;
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
  assets: AssetEntry[];
  module: { number: string; title: Json; description: Json; profession: string | null };
  actionGoals: { code: string; text: Json; sortOrder: number }[];
  bands: ExportBand[];
  evidences: ExportEvidence[];
  learningPaths: ExportPath[];
}

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

@Injectable()
export class MatrixIoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly storageObjects: StorageObjectsService,
  ) {}

  // ── Export (ZIP) ───────────────────────────────────────────────

  async exportZip(
    matrixId: string,
    tenantId: string,
    userId: string,
    roles: Role[],
  ): Promise<{ buffer: Buffer; filename: string }> {
    const ownerFilter = roles.includes(Role.ADMIN)
      ? {}
      : { OR: [{ ownerId: userId }, { ownerId: null }] };
    const matrix = await this.prisma.competenceMatrix.findFirst({
      where: { id: matrixId, module: { tenantId, ...ownerFilter } },
      include: {
        module: { include: { actionGoals: { orderBy: { sortOrder: 'asc' } } } },
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

    const zip = new AdmZip();
    const assets: AssetEntry[] = [];
    const keyToPath = new Map<string, string>(); // S3-Key → zip-Pfad (Dedup)

    // Lädt ein S3-Objekt einmalig ins ZIP und liefert den zip-internen Pfad.
    const addAsset = async (key: string, kind: 'rte' | 'attachment'): Promise<string | null> => {
      if (keyToPath.has(key)) return keyToPath.get(key)!;
      let bytes: Buffer;
      try {
        bytes = await this.s3.getBytes(key);
      } catch {
        return null; // fehlendes Objekt überspringen statt Export abzubrechen
      }
      const base = key.split('/').pop() ?? 'datei';
      const path = `assets/${assets.length + 1}-${base.replace(/[^\w.-]/g, '_')}`;
      zip.addFile(path, bytes);
      assets.push({ path, contentType: this.contentType(base), kind });
      keyToPath.set(key, path);
      return path;
    };

    const exportEvidences: ExportEvidence[] = [];
    for (const e of evidences) {
      const config = { ...(e.config as Json) };
      const attachmentKey =
        typeof config.attachmentKey === 'string' ? (config.attachmentKey as string) : null;
      const attachmentName =
        typeof config.attachmentName === 'string' ? (config.attachmentName as string) : 'anhang';
      delete config.attachmentKey;
      delete config.attachmentName;

      let attachment: { path: string; name: string } | null = null;
      if (attachmentKey) {
        const path = await addAsset(attachmentKey, 'attachment');
        if (path) attachment = { path, name: attachmentName };
      }

      const instructions = await this.rewriteHtmlForExport(e.instructions as Json, addAsset);

      exportEvidences.push({
        type: e.type,
        title: e.title as Json,
        instructions,
        maxPoints: e.maxPoints != null ? Number(e.maxPoints) : null,
        targetLevel: e.targetLevel,
        isVisible: e.isVisible,
        sortOrder: e.sortOrder,
        config,
        attachment,
        fieldCodes: e.fields.map((ef) => ef.field.code),
      });
    }

    const data: MatrixExport = {
      schemaVersion: SCHEMA_VERSION,
      kind: 'matrix-export',
      exportedAt: new Date().toISOString(),
      assets,
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
      evidences: exportEvidences,
      learningPaths: paths.map((p) => ({
        name: p.name,
        isActive: p.isActive,
        fieldCodes: p.steps.map((s) => s.field.code),
      })),
    };

    zip.addFile(MANIFEST, Buffer.from(JSON.stringify(data, null, 2), 'utf8'));
    return { buffer: zip.toBuffer(), filename: `modul-${matrix.module.number}.zip` };
  }

  /** Ersetzt in i18n-HTML alle Bild-URLs des eigenen Buckets durch zip-interne Pfade. */
  private async rewriteHtmlForExport(
    instructions: Json,
    addAsset: (key: string, kind: 'rte' | 'attachment') => Promise<string | null>,
  ): Promise<Json> {
    const base = this.s3.bucketBaseUrl;
    const out: Json = {};
    for (const [locale, value] of Object.entries(instructions)) {
      if (typeof value !== 'string') {
        out[locale] = value;
        continue;
      }
      let html = value;
      const re = new RegExp(this.escapeRegex(base) + '[^"\'\\s>]+', 'g');
      const urls = Array.from(new Set(html.match(re) ?? []));
      for (const url of urls) {
        const key = url.slice(base.length);
        const path = await addAsset(key, 'rte');
        if (path) html = html.split(url).join(path);
      }
      out[locale] = html;
    }
    return out;
  }

  // ── Import (ZIP) ───────────────────────────────────────────────

  async importZip(tenantId: string, ownerId: string, zipBuffer: Buffer) {
    if (!zipBuffer || zipBuffer.length === 0) {
      throw new BadRequestException('Keine Datei hochgeladen.');
    }
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch {
      throw new BadRequestException('Datei ist kein gültiges ZIP.');
    }
    const manifestEntry = zip.getEntry(MANIFEST);
    if (!manifestEntry) {
      throw new BadRequestException(`Ungültiges Paket: ${MANIFEST} fehlt.`);
    }
    let raw: unknown;
    try {
      raw = JSON.parse(manifestEntry.getData().toString('utf8'));
    } catch {
      throw new BadRequestException(`Ungültiges Paket: ${MANIFEST} ist kein gültiges JSON.`);
    }
    const data = this.validate(raw);

    // Assets aus dem ZIP nach S3 hochladen → Pfad → neuer Key/URL
    const assetMap = new Map<string, { kind: 'rte' | 'attachment'; key: string; url: string }>();
    for (const a of data.assets) {
      const entry = zip.getEntry(a.path);
      if (!entry) continue;
      const bytes = entry.getData();
      const base = a.path.split('/').pop() ?? 'datei';
      const prefix = a.kind === 'rte' ? this.s3.publicPrefix : 'attachments';
      const key = this.s3.tenantKey(tenantId, prefix, base);
      await this.s3.putBytes(key, bytes, a.contentType || this.contentType(base));
      await this.storageObjects.record({
        tenantId,
        key,
        sizeBytes: bytes.length,
        kind: a.kind === 'rte' ? 'rte' : 'attachment',
        uploaderId: ownerId,
      });
      assetMap.set(a.path, { kind: a.kind, key, url: this.s3.publicUrl(key) });
    }

    // Modulnummer/-titel: bei vorhandenem Original neues Modul mit „(Importiert)"
    const baseNumber = data.module.number;
    const taken = await this.numberExists(tenantId, baseNumber);
    const number = taken ? await this.freeNumber(tenantId, baseNumber) : baseNumber;
    const title = taken ? this.appendImported(data.module.title) : data.module.title;

    const module = await this.prisma.module.create({
      data: {
        tenantId,
        ownerId,
        number,
        title: title as Prisma.InputJsonValue,
        description: (data.module.description ?? {}) as Prisma.InputJsonValue,
        profession: data.module.profession ?? null,
      },
      select: { id: true, number: true },
    });
    const matrix = await this.prisma.competenceMatrix.create({
      data: { moduleId: module.id },
      select: { id: true },
    });

    // Handlungsziele
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

    // Bänder + Felder (+ Deskriptoren)
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
            create: b.fields.map((f) => ({ level: f.level as CompetenceLevel, code: f.code })),
          },
        },
        include: { fields: true },
      });
      for (const f of band.fields) fieldIdByCode.set(f.code, f.id);

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

      const links = (b.actionGoalCodes ?? [])
        .map((code) => goalIdByCode.get(code))
        .filter((id): id is string => !!id)
        .map((actionGoalId) => ({ bandId: band.id, actionGoalId }));
      if (links.length > 0) {
        await this.prisma.bandActionGoal.createMany({ data: links, skipDuplicates: true });
      }
    }

    // Nachweise: Asset-Referenzen auf neue S3-Keys/URLs umschreiben
    for (const e of data.evidences) {
      const instructions = this.rewriteHtmlForImport(e.instructions, assetMap);
      const config = { ...(e.config ?? {}) } as Json;
      if (e.attachment) {
        const mapped = assetMap.get(e.attachment.path);
        if (mapped) {
          config.attachmentKey = mapped.key;
          config.attachmentName = e.attachment.name;
        }
      }

      const ev = await this.prisma.competenceEvidence.create({
        data: {
          moduleId: module.id,
          type: (e.type as EvidenceType) ?? EvidenceType.FILE_UPLOAD,
          title: e.title as Prisma.InputJsonValue,
          instructions: instructions as Prisma.InputJsonValue,
          maxPoints: e.maxPoints ?? null,
          targetLevel: (e.targetLevel as CompetenceLevel | null) ?? null,
          isVisible: e.isVisible ?? false,
          sortOrder: e.sortOrder ?? 0,
          config: config as Prisma.InputJsonValue,
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

    // Lernpfade
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

  /** Ersetzt in i18n-HTML die zip-internen Pfade durch die neuen öffentlichen URLs. */
  private rewriteHtmlForImport(
    instructions: Json,
    assetMap: Map<string, { kind: string; key: string; url: string }>,
  ): Json {
    const out: Json = {};
    for (const [locale, value] of Object.entries(instructions)) {
      if (typeof value !== 'string') {
        out[locale] = value;
        continue;
      }
      let html = value;
      for (const [path, mapped] of assetMap) {
        if (mapped.kind === 'rte') html = html.split(path).join(mapped.url);
      }
      out[locale] = html;
    }
    return out;
  }

  // ── Validierung / Helfer ───────────────────────────────────────

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
    const out = raw as MatrixExport;
    out.assets = Array.isArray(out.assets) ? out.assets : [];
    out.actionGoals = Array.isArray(out.actionGoals) ? out.actionGoals : [];
    out.evidences = Array.isArray(out.evidences) ? out.evidences : [];
    out.learningPaths = Array.isArray(out.learningPaths) ? out.learningPaths : [];
    return out;
  }

  private appendImported(title: Json): Json {
    const out: Json = {};
    for (const [k, v] of Object.entries(title)) {
      out[k] = typeof v === 'string' ? `${v} (Importiert)` : v;
    }
    return out;
  }

  private async numberExists(tenantId: string, number: string): Promise<boolean> {
    return !!(await this.prisma.module.findFirst({
      where: { tenantId, number },
      select: { id: true },
    }));
  }

  private async freeNumber(tenantId: string, base: string): Promise<string> {
    let i = 1;
    for (;;) {
      const candidate = i === 1 ? `${base}-2` : `${base}-${i + 1}`;
      if (!(await this.numberExists(tenantId, candidate))) return candidate;
      i++;
    }
  }

  private contentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return CONTENT_TYPES[ext] ?? 'application/octet-stream';
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
