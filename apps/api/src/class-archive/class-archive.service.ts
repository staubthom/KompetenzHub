import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AchievedLevel,
  ClassStatus,
  EnrollmentStatus,
  EvaluationChangeType,
  EvaluationSource,
  EvidenceType,
  ModuleStatus,
  Prisma,
  Role,
  SubmissionStatus,
} from '@prisma/client';
import AdmZip from 'adm-zip';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { StorageObjectsService } from '../storage/storage-objects.service';

const SCHEMA_VERSION = 1;
const MANIFEST = 'class-archive.json';

type Json = Record<string, unknown>;

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain',
};

/**
 * FA-103: Export/Import eines Modulanlasses (Klasse) als ZIP-Archiv – inkl. ALLER
 * Lernenden-Daten (Einreichungen, Zeitstempel, Bewertungen, Feedback, Dateien).
 * Re-Import erzeugt einen read-only (archivierten) Modulanlass – z. B. als Beweis.
 */
@Injectable()
export class ClassArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly storageObjects: StorageObjectsService,
  ) {}

  // ── Export ─────────────────────────────────────────────────────

  async exportZip(
    classId: string,
    tenantId: string,
    userId: string,
    roles: Role[],
  ): Promise<{ buffer: Buffer; filename: string }> {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
      include: { module: { select: { number: true, title: true } } },
    });
    if (!cls) throw new NotFoundException('Modulanlass nicht gefunden.');
    if (cls.ownerId !== userId && !roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Nur die Lehrperson des Modulanlasses hat Zugriff.');
    }

    const evidences = cls.moduleId
      ? await this.prisma.competenceEvidence.findMany({
          where: { moduleId: cls.moduleId, tenantId },
          orderBy: { sortOrder: 'asc' },
        })
      : [];
    const evidenceIndexById = new Map(evidences.map((e, i) => [e.id, i]));

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId },
      orderBy: { joinedAt: 'asc' },
      include: {
        submissions: {
          orderBy: { createdAt: 'asc' },
          include: {
            evaluation: { include: { evaluator: { select: { displayName: true } } } },
            history: {
              orderBy: { createdAt: 'asc' },
              include: { changedBy: { select: { displayName: true } } },
            },
          },
        },
      },
    });

    const zip = new AdmZip();
    const assets: {
      path: string;
      contentType: string;
      kind: 'rte' | 'attachment' | 'submission';
    }[] = [];
    const keyToPath = new Map<string, string>();
    const addAsset = async (
      key: string,
      kind: 'rte' | 'attachment' | 'submission',
    ): Promise<string | null> => {
      if (keyToPath.has(key)) return keyToPath.get(key)!;
      let bytes: Buffer;
      try {
        bytes = await this.s3.getBytes(key);
      } catch {
        return null;
      }
      const base = key.split('/').pop() ?? 'datei';
      const folder = kind === 'submission' ? 'files' : 'assets';
      const path = `${folder}/${assets.length + 1}-${base.replace(/[^\w.-]/g, '_')}`;
      zip.addFile(path, bytes);
      assets.push({ path, contentType: this.contentType(base), kind });
      keyToPath.set(key, path);
      return path;
    };

    // Nachweise (Aufgabenstellung + Anhang + Bild-Assets)
    const exportEvidences = [];
    for (const e of evidences) {
      const config = { ...(e.config as Json) };
      const attKey = typeof config.attachmentKey === 'string' ? config.attachmentKey : null;
      const attName = typeof config.attachmentName === 'string' ? config.attachmentName : 'anhang';
      delete config.attachmentKey;
      delete config.attachmentName;
      let attachment: { path: string; name: string } | null = null;
      if (attKey) {
        const p = await addAsset(attKey, 'attachment');
        if (p) attachment = { path: p, name: attName };
      }
      const instructions = await this.rewriteHtmlForExport(e.instructions as Json, addAsset);
      exportEvidences.push({
        index: evidenceIndexById.get(e.id),
        type: e.type,
        title: e.title as Json,
        instructions,
        maxPoints: e.maxPoints != null ? Number(e.maxPoints) : null,
        config,
        attachment,
      });
    }

    // Einreichungen + Bewertungen + Verlauf
    const exportEnrollments = [];
    for (const en of enrollments) {
      const subs = [];
      for (const s of en.submissions) {
        const content = (s.content ?? {}) as {
          text?: string;
          link?: string;
          expertTalk?: boolean;
          files?: { key: string; name: string; kind: string }[];
        };
        const files = [];
        for (const f of content.files ?? []) {
          const p = await addAsset(f.key, 'submission');
          if (p) files.push({ path: p, name: f.name, kind: f.kind });
        }
        // primärer fileKey (falls ohne content.files)
        let primaryPath: string | null = null;
        if (s.fileKey && !content.files?.some((f) => f.key === s.fileKey)) {
          primaryPath = await addAsset(s.fileKey, 'submission');
        }
        subs.push({
          evidenceIndex: evidenceIndexById.get(s.evidenceId) ?? null,
          status: s.status,
          text: content.text ?? null,
          link: content.link ?? null,
          expertTalk: content.expertTalk ?? false,
          files,
          primaryFile: primaryPath ? { path: primaryPath, name: s.fileName ?? 'datei' } : null,
          points: s.points != null ? Number(s.points) : null,
          submittedAt: s.submittedAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
          evaluation: s.evaluation
            ? {
                points: s.evaluation.points != null ? Number(s.evaluation.points) : null,
                achievedLevel: s.evaluation.achievedLevel,
                feedback: s.evaluation.feedback,
                rejectionReason: s.evaluation.rejectionReason,
                evaluatorName: s.evaluation.evaluator?.displayName ?? null,
                createdAt: s.evaluation.createdAt.toISOString(),
              }
            : null,
          history: s.history.map((h) => ({
            changeType: h.changeType,
            points: h.points != null ? Number(h.points) : null,
            achievedLevel: h.achievedLevel,
            feedback: h.feedback,
            source: h.source,
            changedByName: h.changedBy?.displayName ?? null,
            createdAt: h.createdAt.toISOString(),
          })),
        });
      }
      exportEnrollments.push({
        displayName: en.displayName,
        status: en.status,
        joinedAt: en.joinedAt.toISOString(),
        submissions: subs,
      });
    }

    const data = {
      schemaVersion: SCHEMA_VERSION,
      kind: 'class-archive',
      exportedAt: new Date().toISOString(),
      assets,
      class: {
        name: cls.name,
        year: cls.year,
        schoolYear: cls.schoolYear,
        module: cls.module ? { number: cls.module.number, title: cls.module.title as Json } : null,
      },
      evidences: exportEvidences,
      enrollments: exportEnrollments,
    };

    zip.addFile(MANIFEST, Buffer.from(JSON.stringify(data, null, 2), 'utf8'));
    const safeName = cls.name.replace(/[^\w.-]/g, '_');
    return { buffer: zip.toBuffer(), filename: `modulanlass-${safeName}.zip` };
  }

  private async rewriteHtmlForExport(
    instructions: Json,
    addAsset: (key: string, kind: 'rte' | 'attachment' | 'submission') => Promise<string | null>,
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
      for (const url of Array.from(new Set(html.match(re) ?? []))) {
        const p = await addAsset(url.slice(base.length), 'rte');
        if (p) html = html.split(url).join(p);
      }
      out[locale] = html;
    }
    return out;
  }

  // ── Import ─────────────────────────────────────────────────────

  async importZip(tenantId: string, ownerId: string, zipBuffer: Buffer) {
    if (!zipBuffer?.length) throw new BadRequestException('Keine Datei hochgeladen.');
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch {
      throw new BadRequestException('Datei ist kein gültiges ZIP.');
    }
    const entry = zip.getEntry(MANIFEST);
    if (!entry) throw new BadRequestException(`Ungültiges Paket: ${MANIFEST} fehlt.`);
    let raw: unknown;
    try {
      raw = JSON.parse(entry.getData().toString('utf8'));
    } catch {
      throw new BadRequestException(`Ungültiges Paket: ${MANIFEST} ist kein gültiges JSON.`);
    }
    const data = this.validate(raw);

    // Assets nach S3 hochladen → zip-Pfad → { key, url, kind }
    const assetMap = new Map<string, { key: string; url: string; kind: string }>();
    for (const a of data.assets) {
      const e = zip.getEntry(a.path);
      if (!e) continue;
      const bytes = e.getData();
      const baseName = a.path.split('/').pop() ?? 'datei';
      const prefix =
        a.kind === 'rte'
          ? this.s3.publicPrefix
          : a.kind === 'attachment'
            ? 'attachments'
            : 'evidence';
      const key = this.s3.tenantKey(tenantId, prefix, baseName);
      await this.s3.putBytes(key, bytes, a.contentType || this.contentType(baseName));
      await this.storageObjects.record({
        tenantId,
        key,
        sizeBytes: bytes.length,
        kind: a.kind === 'rte' ? 'rte' : a.kind === 'attachment' ? 'attachment' : 'submission',
        uploaderId: ownerId,
      });
      assetMap.set(a.path, { key, url: this.s3.publicUrl(key), kind: a.kind });
    }

    // Träger-Modul (archiviert → in der Modulliste ausgeblendet) + leere Matrix
    const moduleTitle = (data.class.module?.title as Json) ?? { de: data.class.name };
    const module = await this.prisma.module.create({
      data: {
        tenantId,
        ownerId,
        number: `archiv-${randomUUID().slice(0, 8)}`,
        title: moduleTitle as Prisma.InputJsonValue,
        status: ModuleStatus.ARCHIVED,
      },
      select: { id: true },
    });
    await this.prisma.competenceMatrix.create({ data: { moduleId: module.id } });

    // Nachweise (Aufgaben) neu anlegen, Index → neue ID
    const evidenceIdByIndex = new Map<number, string>();
    for (const ev of data.evidences) {
      const instructions = this.rewriteHtmlForImport(ev.instructions, assetMap);
      const config = { ...(ev.config ?? {}) } as Json;
      if (ev.attachment) {
        const mapped = assetMap.get(ev.attachment.path);
        if (mapped) {
          config.attachmentKey = mapped.key;
          config.attachmentName = ev.attachment.name;
        }
      }
      const created = await this.prisma.competenceEvidence.create({
        data: {
          moduleId: module.id,
          type: (ev.type as EvidenceType) ?? EvidenceType.FILE_UPLOAD,
          title: ev.title as Prisma.InputJsonValue,
          instructions: instructions as Prisma.InputJsonValue,
          maxPoints: ev.maxPoints ?? null,
          isVisible: true,
          sortOrder: (ev.index ?? 0) + 1,
          config: config as Prisma.InputJsonValue,
        } as never,
        select: { id: true },
      });
      if (typeof ev.index === 'number') evidenceIdByIndex.set(ev.index, created.id);
    }

    // Archivierter (read-only) Modulanlass
    const cls = await this.prisma.class.create({
      data: {
        tenantId,
        ownerId,
        name: `${data.class.name} (Importiert)`,
        year: data.class.year ?? null,
        schoolYear: data.class.schoolYear ?? null,
        moduleId: module.id,
        status: ClassStatus.ARCHIVED,
      } as never,
      select: { id: true, name: true },
    });

    // Einschreibungen (ohne User-Verknüpfung) + Einreichungen + Bewertungen
    for (const en of data.enrollments) {
      const enrollment = await this.prisma.enrollment.create({
        data: {
          classId: cls.id,
          userId: null,
          displayName: en.displayName,
          status: (en.status as EnrollmentStatus) ?? EnrollmentStatus.ACTIVE,
          joinedAt: en.joinedAt ? new Date(en.joinedAt) : new Date(),
        },
        select: { id: true },
      });

      for (const s of en.submissions) {
        const evidenceId =
          s.evidenceIndex != null ? evidenceIdByIndex.get(s.evidenceIndex) : undefined;
        if (!evidenceId) continue; // ohne Nachweis keine Einreichung
        const files = (s.files ?? [])
          .map((f) => {
            const mapped = assetMap.get(f.path);
            return mapped ? { key: mapped.key, name: f.name, kind: f.kind } : null;
          })
          .filter((x): x is { key: string; name: string; kind: string } => !!x);
        const primary = s.primaryFile ? assetMap.get(s.primaryFile.path) : undefined;
        const fileKey = primary?.key ?? files[0]?.key ?? null;
        const fileName = s.primaryFile?.name ?? files[0]?.name ?? null;

        const submission = await this.prisma.submission.create({
          data: {
            evidenceId,
            enrollmentId: enrollment.id,
            status: (s.status as SubmissionStatus) ?? SubmissionStatus.SUBMITTED,
            content: {
              kind: 'multi',
              text: s.text ?? undefined,
              link: s.link ?? undefined,
              expertTalk: s.expertTalk ?? false,
              files,
            } as unknown as Prisma.InputJsonValue,
            points: s.points ?? null,
            fileKey,
            fileName,
            submittedAt: s.submittedAt ? new Date(s.submittedAt) : null,
            createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          },
          select: { id: true },
        });

        if (s.evaluation) {
          await this.prisma.evaluation.create({
            data: {
              submissionId: submission.id,
              evaluatorId: ownerId,
              achievedLevel: (s.evaluation.achievedLevel as AchievedLevel | null) ?? null,
              points: s.evaluation.points ?? null,
              feedback: s.evaluation.feedback ?? '',
              rejectionReason: s.evaluation.rejectionReason ?? null,
            },
          });
        }
        for (const h of s.history ?? []) {
          await this.prisma.evaluationHistory.create({
            data: {
              submissionId: submission.id,
              changedById: ownerId,
              changeType: (h.changeType as EvaluationChangeType) ?? EvaluationChangeType.CREATED,
              achievedLevel: (h.achievedLevel as AchievedLevel | null) ?? null,
              points: h.points ?? null,
              feedback: h.feedback ?? null,
              source: (h.source as EvaluationSource) ?? EvaluationSource.TEACHER,
            },
          });
        }
      }
    }

    await this.audit(tenantId, ownerId, cls.id);
    return { classId: cls.id, name: cls.name };
  }

  private rewriteHtmlForImport(
    instructions: Json,
    assetMap: Map<string, { key: string; url: string; kind: string }>,
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

  private validate(raw: unknown): {
    schemaVersion: number;
    assets: { path: string; contentType: string; kind: 'rte' | 'attachment' | 'submission' }[];
    class: {
      name: string;
      year: number | null;
      schoolYear: string | null;
      module: { title: Json } | null;
    };
    evidences: {
      index?: number;
      type?: string;
      title: Json;
      instructions: Json;
      maxPoints: number | null;
      config?: Json;
      attachment?: { path: string; name: string } | null;
    }[];
    enrollments: {
      displayName: string;
      status?: string;
      joinedAt?: string;
      submissions: {
        evidenceIndex: number | null;
        status?: string;
        text?: string | null;
        link?: string | null;
        expertTalk?: boolean;
        files?: { path: string; name: string; kind: string }[];
        primaryFile?: { path: string; name: string } | null;
        points: number | null;
        submittedAt?: string | null;
        createdAt?: string;
        evaluation?: {
          points: number | null;
          achievedLevel: string | null;
          feedback: string | null;
          rejectionReason: string | null;
        } | null;
        history?: {
          changeType?: string;
          points: number | null;
          achievedLevel: string | null;
          feedback: string | null;
          source?: string;
        }[];
      }[];
    }[];
  } {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Ungültige Importdatei: kein JSON-Objekt.');
    }
    const d = raw as Json;
    if (d.schemaVersion !== SCHEMA_VERSION) {
      throw new BadRequestException(
        `Inkompatible Schema-Version (erwartet ${SCHEMA_VERSION}, erhalten ${String(d.schemaVersion)}).`,
      );
    }
    if (d.kind !== 'class-archive') {
      throw new BadRequestException('Ungültige Importdatei: kein Modulanlass-Archiv.');
    }
    const cls = d.class as Json | undefined;
    if (!cls || typeof cls.name !== 'string' || !cls.name.trim()) {
      throw new BadRequestException('Ungültige Importdatei: class.name fehlt.');
    }
    if (!Array.isArray(d.enrollments)) {
      throw new BadRequestException('Ungültige Importdatei: enrollments fehlt.');
    }
    const out = raw as ReturnType<ClassArchiveService['validate']>;
    out.assets = Array.isArray(out.assets) ? out.assets : [];
    out.evidences = Array.isArray(out.evidences) ? out.evidences : [];
    return out;
  }

  private contentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return CONTENT_TYPES[ext] ?? 'application/octet-stream';
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async audit(tenantId: string, userId: string, classId: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'class.archive-import',
          detail: { classId } as Prisma.InputJsonValue,
        },
      });
    } catch {
      /* nicht fatal */
    }
  }
}
