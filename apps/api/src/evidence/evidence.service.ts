import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EnrollmentStatus, EvidenceType, Prisma, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';

interface UploadConfig {
  allowedFileTypes?: string[];
  maxFileSizeMb?: number;
  allowFile?: boolean;
  allowLink?: boolean;
  allowText?: boolean;
  allowScreenshot?: boolean;
  /** Einfügen (Paste) im Text-Feld erlauben (Default: nein). */
  allowPaste?: boolean;
  /** Einreichungsart Fachgespräch/Präsentation (FA-80): KI-Übung im Abgabe-Dialog. */
  allowExpertTalk?: boolean;
  /** Vom Lehrer angehängte Datei zum Download. */
  attachmentKey?: string;
  attachmentName?: string;
}

interface SubmissionFile {
  key: string;
  name: string;
  kind: 'file' | 'screenshot';
}

export interface CreateEvidenceDto {
  moduleId: string;
  title: Record<string, string>;
  /** Rich-Text-Beschreibung (HTML) als i18n-Feld. */
  instructions?: Record<string, string>;
  maxPoints?: number;
  targetLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  isVisible?: boolean;
  availableFrom?: string;
  dueAt?: string;
  sortOrder?: number;
  config?: UploadConfig;
  fieldIds?: string[];
}

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  // ── Lehrer-CRUD (FA-30/36/40) ─────────────────────────────────

  async list(tenantId: string, moduleId?: string) {
    return this.prisma.competenceEvidence.findMany({
      where: { tenantId, ...(moduleId ? { moduleId } : {}) },
      include: { fields: true, _count: { select: { submissions: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
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
    const module = await this.prisma.module.findFirst({ where: { id: dto.moduleId, tenantId } });
    if (!module) throw new BadRequestException('Modul nicht gefunden.');

    // Nächste Reihenfolge innerhalb des Moduls bestimmen
    const last = await this.prisma.competenceEvidence.findFirst({
      where: { moduleId: dto.moduleId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? 0) + 1;

    const ev = await this.prisma.competenceEvidence.create({
      data: {
        // tenantId via Scoping-Middleware
        moduleId: dto.moduleId,
        type: EvidenceType.FILE_UPLOAD,
        title: dto.title as Prisma.InputJsonValue,
        instructions: (dto.instructions ?? {}) as Prisma.InputJsonValue,
        maxPoints: dto.maxPoints ?? null,
        targetLevel: dto.targetLevel,
        isVisible: dto.isVisible ?? false,
        availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        sortOrder,
        config: this.normalizeConfig(dto.config) as Prisma.InputJsonValue,
      } as never,
      include: { fields: true },
    });

    if (dto.fieldIds?.length) await this.setFields(ev.id, dto.fieldIds, tenantId);
    return this.findOneForTeacher(ev.id, tenantId);
  }

  async update(id: string, dto: Partial<CreateEvidenceDto>, tenantId: string) {
    await this.findOneForTeacher(id, tenantId);
    const data: Prisma.CompetenceEvidenceUpdateInput = {
      ...(dto.title && { title: dto.title as Prisma.InputJsonValue }),
      ...(dto.instructions !== undefined && {
        instructions: dto.instructions as Prisma.InputJsonValue,
      }),
      ...(dto.maxPoints !== undefined && { maxPoints: dto.maxPoints }),
      ...(dto.targetLevel !== undefined && { targetLevel: dto.targetLevel }),
      ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
      ...(dto.availableFrom !== undefined && {
        availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
      }),
      ...(dto.dueAt !== undefined && { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.config !== undefined && {
        config: this.normalizeConfig(dto.config) as Prisma.InputJsonValue,
      }),
    };
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

  async listForStudent(tenantId: string, userId: string) {
    const now = new Date();
    const evidences = await this.prisma.competenceEvidence.findMany({
      where: {
        tenantId,
        isVisible: true,
        module: {
          classes: { some: { enrollments: { some: { userId, status: EnrollmentStatus.ACTIVE } } } },
        },
      },
      include: {
        fields: true,
        submissions: {
          where: { enrollment: { userId } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { evaluation: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const views = evidences
      .filter((e) => !e.availableFrom || e.availableFrom <= now)
      .map((e) => this.toStudentView(e, now));
    await Promise.all(views.map((v) => this.attachDownloadUrl(v)));
    return views;
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
      include: {
        fields: true,
        submissions: {
          where: { enrollment: { userId } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { evaluation: true },
        },
      },
    });
    if (!ev) throw new NotFoundException('Nachweis nicht verfügbar.');
    const now = new Date();
    if (ev.availableFrom && ev.availableFrom > now) {
      throw new ForbiddenException('Nachweis ist noch nicht freigeschaltet.');
    }
    const view = this.toStudentView(ev, now);
    await this.attachDownloadUrl(view);
    return view;
  }

  /** Presigned Download-URL für den Lehrer-Anhang ergänzen. */
  private async attachDownloadUrl(view: { config: unknown; attachmentUrl: string | null }) {
    const cfg = (view.config ?? {}) as UploadConfig;
    if (cfg.attachmentKey) {
      view.attachmentUrl = await this.s3.presignDownload(cfg.attachmentKey);
    }
  }

  // ── Einreichung: Datei / Link / Text (FA-30/50) ───────────────

  /** Presigned-URL für den direkten Upload (Datei oder Screenshot) anfordern. */
  async requestUpload(
    id: string,
    tenantId: string,
    userId: string,
    fileName: string,
    contentType: string,
    sizeBytes: number,
    kind: 'file' | 'screenshot' = 'file',
  ) {
    const ev = await this.loadVisibleEvidence(id, tenantId);
    const enrollment = await this.resolveEnrollment(ev.moduleId, tenantId, userId);
    await this.assertCanSubmit(id, enrollment.id);
    const cfg = (ev.config ?? {}) as UploadConfig;
    if (kind === 'screenshot') {
      if (cfg.allowScreenshot === false || cfg.allowScreenshot === undefined) {
        throw new BadRequestException('Screenshot ist nicht erlaubt.');
      }
      if (cfg.maxFileSizeMb && sizeBytes > cfg.maxFileSizeMb * 1024 * 1024) {
        throw new UnprocessableEntityException(`Bild zu gross (max. ${cfg.maxFileSizeMb} MB).`);
      }
    } else {
      if (cfg.allowFile === false) throw new BadRequestException('Datei-Upload ist nicht erlaubt.');
      this.validateFile(cfg, fileName, sizeBytes);
    }

    const key = this.s3.buildKey(`evidence/${id}`, fileName);
    const url = await this.s3.presignUpload(key, contentType || 'application/octet-stream');
    return { uploadUrl: url, key };
  }

  /** Datei-Upload bestätigen → Einreichung anlegen. */
  async confirmUpload(id: string, tenantId: string, userId: string, key: string, fileName: string) {
    const ev = await this.loadVisibleEvidence(id, tenantId);
    const enrollment = await this.resolveEnrollment(ev.moduleId, tenantId, userId);
    await this.assertCanSubmit(id, enrollment.id);
    const submission = await this.prisma.submission.create({
      data: {
        evidenceId: id,
        enrollmentId: enrollment.id,
        status: SubmissionStatus.SUBMITTED,
        fileKey: key,
        fileName,
        content: { kind: 'file' } as Prisma.InputJsonValue,
        submittedAt: new Date(),
      },
    });
    return { submissionId: submission.id, status: submission.status };
  }

  /** Link- oder Text-Beleg einreichen. */
  async submitContent(
    id: string,
    tenantId: string,
    userId: string,
    payload: { text?: string; link?: string },
  ) {
    const ev = await this.loadVisibleEvidence(id, tenantId);
    const enrollment = await this.resolveEnrollment(ev.moduleId, tenantId, userId);
    const cfg = (ev.config ?? {}) as UploadConfig;

    const text = payload.text?.trim();
    const link = payload.link?.trim();
    if (!text && !link) throw new BadRequestException('Text oder Link erforderlich.');
    await this.assertCanSubmit(id, enrollment.id);
    if (link) {
      if (cfg.allowLink === false) throw new BadRequestException('Links sind nicht erlaubt.');
      if (!/^https?:\/\//i.test(link)) {
        throw new UnprocessableEntityException('Link muss mit http(s):// beginnen.');
      }
    }
    if (text && cfg.allowText === false) throw new BadRequestException('Text ist nicht erlaubt.');

    const submission = await this.prisma.submission.create({
      data: {
        evidenceId: id,
        enrollmentId: enrollment.id,
        status: SubmissionStatus.SUBMITTED,
        content: { kind: link ? 'link' : 'text', text, link } as Prisma.InputJsonValue,
        submittedAt: new Date(),
      },
    });
    return { submissionId: submission.id, status: submission.status };
  }

  /**
   * Zentrale Einreichung: kombiniert Text, Link und Dateien/Screenshots
   * (bereits hochgeladene Keys) zu EINER Einreichung.
   */
  async submit(
    id: string,
    tenantId: string,
    userId: string,
    payload: { text?: string; link?: string; files?: SubmissionFile[] },
  ) {
    const ev = await this.loadVisibleEvidence(id, tenantId);
    const enrollment = await this.resolveEnrollment(ev.moduleId, tenantId, userId);
    const cfg = (ev.config ?? {}) as UploadConfig;

    const text = payload.text?.trim();
    const link = payload.link?.trim();
    const files = Array.isArray(payload.files) ? payload.files : [];

    // Fachgespräch/Präsentation darf auch ohne Text/Link/Datei eingereicht werden
    // (die mündliche Leistung selbst ist der Nachweis).
    const isExpertTalk = cfg.allowExpertTalk === true;
    if (!text && !link && files.length === 0 && !isExpertTalk) {
      throw new BadRequestException('Mindestens Text, Link oder Datei erforderlich.');
    }
    if (text && cfg.allowText === false) throw new BadRequestException('Text ist nicht erlaubt.');
    if (link) {
      if (cfg.allowLink === false) throw new BadRequestException('Links sind nicht erlaubt.');
      if (!/^https?:\/\//i.test(link)) {
        throw new UnprocessableEntityException('Link muss mit http(s):// beginnen.');
      }
    }
    await this.assertCanSubmit(id, enrollment.id);

    const primary = files[0];
    const submission = await this.prisma.submission.create({
      data: {
        evidenceId: id,
        enrollmentId: enrollment.id,
        status: SubmissionStatus.SUBMITTED,
        content: {
          kind: 'multi',
          text,
          link,
          files,
          expertTalk: isExpertTalk,
        } as unknown as Prisma.InputJsonValue,
        fileKey: primary?.key ?? null,
        fileName: primary?.name ?? null,
        submittedAt: new Date(),
      },
    });
    return { submissionId: submission.id, status: submission.status };
  }

  // ── Helfer ────────────────────────────────────────────────────

  private async loadVisibleEvidence(id: string, tenantId: string) {
    const ev = await this.prisma.competenceEvidence.findFirst({
      where: { id, tenantId, isVisible: true },
    });
    if (!ev) throw new NotFoundException('Nachweis nicht verfügbar.');
    return ev;
  }

  private async resolveEnrollment(moduleId: string, tenantId: string, userId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      // Archivierte Modulanlässe sind read-only → keine neuen Einreichungen.
      where: {
        userId,
        status: EnrollmentStatus.ACTIVE,
        class: { moduleId, tenantId, status: 'ACTIVE' },
      },
    });
    if (!enrollment) {
      throw new ForbiddenException('Keine aktive Klassenmitgliedschaft für diesen Nachweis.');
    }
    return enrollment;
  }

  /**
   * Verhindert erneutes Einreichen, solange eine Einreichung offen/bewertet ist.
   * Erlaubt ist eine neue Einreichung nur, wenn es keine gibt oder die letzte
   * zurückgewiesen wurde.
   */
  private async assertCanSubmit(evidenceId: string, enrollmentId: string) {
    const last = await this.prisma.submission.findFirst({
      where: { evidenceId, enrollmentId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    if (last && last.status !== SubmissionStatus.REJECTED) {
      throw new ConflictException(
        'Bereits eingereicht. Eine erneute Einreichung ist erst nach einer Rückweisung möglich.',
      );
    }
  }

  private normalizeConfig(config: UploadConfig | undefined): UploadConfig {
    const cfg = config ?? {};
    return {
      allowedFileTypes: cfg.allowedFileTypes ?? [],
      maxFileSizeMb: cfg.maxFileSizeMb ?? 10,
      // Standard: Datei/Link/Text erlaubt, Screenshot optional
      allowFile: cfg.allowFile ?? true,
      allowLink: cfg.allowLink ?? true,
      allowText: cfg.allowText ?? true,
      allowScreenshot: cfg.allowScreenshot ?? false,
      // Einfügen standardmässig gesperrt (Lernende sollen selbst schreiben)
      allowPaste: cfg.allowPaste ?? false,
      // Fachgespräch/Präsentation optional (KI-Übung im Abgabe-Dialog)
      allowExpertTalk: cfg.allowExpertTalk ?? false,
      ...(cfg.attachmentKey ? { attachmentKey: cfg.attachmentKey } : {}),
      ...(cfg.attachmentName ? { attachmentName: cfg.attachmentName } : {}),
    };
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
      submissions?: {
        id: string;
        status: SubmissionStatus;
        evaluation?: {
          points: unknown;
          achievedLevel: unknown;
          feedback: string;
          rejectionReason: string | null;
        } | null;
      }[];
    },
    now: Date,
  ) {
    const sub = ev.submissions?.[0];
    return {
      id: ev.id,
      type: ev.type,
      title: ev.title,
      instructions: ev.instructions,
      maxPoints: ev.maxPoints,
      targetLevel: ev.targetLevel,
      dueAt: ev.dueAt,
      isOverdue: !!ev.dueAt && ev.dueAt < now,
      config: ev.config,
      fields: ev.fields,
      attachmentUrl: null as string | null,
      lastSubmission: sub
        ? {
            id: sub.id,
            status: sub.status,
            points: sub.evaluation?.points ?? null,
            achievedLevel: sub.evaluation?.achievedLevel ?? null,
            feedback: sub.evaluation?.feedback ?? null,
            rejectionReason: sub.evaluation?.rejectionReason ?? null,
          }
        : null,
    };
  }
}
