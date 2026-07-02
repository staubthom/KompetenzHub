import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AchievedLevel,
  EnrollmentStatus,
  EvidenceType,
  Prisma,
  Role,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { StorageObjectsService } from '../storage/storage-objects.service';
import { SubmissionsService } from '../submissions/submissions.service';

interface UploadConfig {
  allowedFileTypes?: string[];
  maxFileSizeMb?: number;
  allowFile?: boolean;
  allowLink?: boolean;
  allowText?: boolean;
  allowScreenshot?: boolean;
  /** Einreichungsart Screencast (FA): Bildschirm-Video inkl. Audio im Browser aufnehmen. */
  allowScreencast?: boolean;
  /** Einfügen (Paste) im Text-Feld erlauben (Default: nein). */
  allowPaste?: boolean;
  /** Einreichungsart Fachgespräch/Präsentation (FA-80): KI-Übung im Abgabe-Dialog. */
  allowExpertTalk?: boolean;
  /**
   * Einreichungsart „von Lehrperson angefügt": die lernende Person kann selbst
   * nichts einreichen – die Lehrperson lädt im Kompetenzraster pro lernender
   * Person eine Datei hoch und trägt Punkte ein (z. B. Scan eines Tests).
   */
  allowTeacherAttached?: boolean;
  /** Vom Lehrer angehängte Datei zum Download. */
  attachmentKey?: string;
  attachmentName?: string;
}

interface SubmissionFile {
  key: string;
  name: string;
  kind: 'file' | 'screenshot' | 'screencast';
}

/** Standard-Obergrenze für Screencast-Videos (MB). */
const SCREENCAST_MAX_MB = 50;

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
    private readonly submissions: SubmissionsService,
    private readonly storageObjects: StorageObjectsService,
  ) {}

  // ── Lehrer-CRUD (FA-30/36/40) ─────────────────────────────────

  async list(tenantId: string, moduleId?: string) {
    const rows = await this.prisma.competenceEvidence.findMany({
      where: { tenantId, ...(moduleId ? { moduleId } : {}) },
      include: { fields: true, _count: { select: { submissions: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    // Bild-URLs in den Instruktionen für die Anzeige/Bearbeitung presignen.
    for (const ev of rows) {
      (ev as { instructions: unknown }).instructions = await this.s3.presignHtmlForRead(
        ev.instructions,
      );
    }
    return rows;
  }

  async findOneForTeacher(id: string, tenantId: string) {
    const ev = await this.prisma.competenceEvidence.findFirst({
      where: { id, tenantId },
      include: { fields: true },
    });
    if (!ev) throw new NotFoundException('Nachweis nicht gefunden.');
    (ev as { instructions: unknown }).instructions = await this.s3.presignHtmlForRead(
      ev.instructions,
    );
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
        instructions: this.s3.normalizeHtmlForWrite(
          dto.instructions ?? {},
        ) as Prisma.InputJsonValue,
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
        instructions: this.s3.normalizeHtmlForWrite(dto.instructions) as Prisma.InputJsonValue,
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
    const ev = await this.findOneForTeacher(id, tenantId);
    await this.prisma.competenceEvidence.delete({ where: { id } });
    // Zugehörige Dateien aus dem Objektspeicher entfernen: alle Einreichungsdateien
    // liegen unter dem Nachweis-Präfix; dazu der optionale Lehrer-Anhang.
    await this.storageObjects.deletePrefix(`t/${tenantId}/evidence/${id}/`);
    const cfg = (ev.config ?? {}) as UploadConfig;
    if (cfg.attachmentKey) await this.storageObjects.deleteKeys([cfg.attachmentKey]);
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

  /** Presigned Download-URL für den Lehrer-Anhang + presignte Bild-URLs in den Instruktionen. */
  private async attachDownloadUrl(view: {
    config: unknown;
    attachmentUrl: string | null;
    instructions?: unknown;
  }) {
    const cfg = (view.config ?? {}) as UploadConfig;
    if (cfg.attachmentKey) {
      view.attachmentUrl = await this.s3.presignDownload(cfg.attachmentKey);
    }
    if (view.instructions !== undefined) {
      view.instructions = await this.s3.presignHtmlForRead(view.instructions);
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
    kind: 'file' | 'screenshot' | 'screencast' = 'file',
  ) {
    const ev = await this.loadVisibleEvidence(id, tenantId);
    const cfg = (ev.config ?? {}) as UploadConfig;
    this.assertStudentMaySubmit(cfg);
    const enrollment = await this.resolveEnrollment(ev.moduleId, tenantId, userId);
    await this.assertCanSubmit(id, enrollment.id);
    if (kind === 'screenshot') {
      if (cfg.allowScreenshot === false || cfg.allowScreenshot === undefined) {
        throw new BadRequestException('Screenshot ist nicht erlaubt.');
      }
      if (cfg.maxFileSizeMb && sizeBytes > cfg.maxFileSizeMb * 1024 * 1024) {
        throw new UnprocessableEntityException(`Bild zu gross (max. ${cfg.maxFileSizeMb} MB).`);
      }
    } else if (kind === 'screencast') {
      if (cfg.allowScreencast === false || cfg.allowScreencast === undefined) {
        throw new BadRequestException('Screencast ist nicht erlaubt.');
      }
      // Screencasts sind Videos und werden schnell gross → eigener, höherer Default
      // (50 MB). Hat die Lehrperson eine grössere Datei-Obergrenze gesetzt, gilt diese.
      const maxMb = Math.max(SCREENCAST_MAX_MB, cfg.maxFileSizeMb ?? 0);
      if (sizeBytes > maxMb * 1024 * 1024) {
        throw new UnprocessableEntityException(`Video zu gross (max. ${maxMb} MB).`);
      }
    } else {
      if (cfg.allowFile === false) throw new BadRequestException('Datei-Upload ist nicht erlaubt.');
      this.validateFile(cfg, fileName, sizeBytes);
    }

    const key = this.s3.tenantKey(tenantId, `evidence/${id}`, fileName);
    const url = await this.s3.presignUpload(key, contentType || 'application/octet-stream');
    // Grösse/Zuordnung verbuchen (für Speicherverbrauch pro Schule/Klasse/Lehrperson).
    await this.storageObjects.record({
      tenantId,
      key,
      sizeBytes,
      kind: 'submission',
      classId: enrollment.classId,
      uploaderId: userId,
    });
    return { uploadUrl: url, key };
  }

  /** Datei-Upload bestätigen → Einreichung anlegen. */
  async confirmUpload(id: string, tenantId: string, userId: string, key: string, fileName: string) {
    const ev = await this.loadVisibleEvidence(id, tenantId);
    this.assertStudentMaySubmit((ev.config ?? {}) as UploadConfig);
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
    const cfg = (ev.config ?? {}) as UploadConfig;
    this.assertStudentMaySubmit(cfg);
    const enrollment = await this.resolveEnrollment(ev.moduleId, tenantId, userId);

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
    const cfg = (ev.config ?? {}) as UploadConfig;
    this.assertStudentMaySubmit(cfg);
    const enrollment = await this.resolveEnrollment(ev.moduleId, tenantId, userId);

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

  // ── Einreichungsart „von Lehrperson angefügt" ─────────────────

  /**
   * Die Lehrperson fügt im Kompetenzraster pro lernender Person eine Datei an
   * und trägt optional Punkte/Level/Feedback ein. Es wird eine Einreichung im
   * Namen der lernenden Person angelegt bzw. aktualisiert (Status „eingereicht");
   * sobald Punkte vergeben werden, wechselt der Status auf „bewertet". Nur für
   * Lehrpersonen mit Zugriff auf den Modulanlass und nur bei Nachweisen vom Typ
   * „von Lehrperson angefügt".
   */
  async teacherAttach(
    evidenceId: string,
    tenantId: string,
    userId: string,
    roles: Role[],
    dto: {
      enrollmentId: string;
      /** Mehrere angefügte Dateien (Storage-Keys + Anzeigenamen). */
      files?: { key: string; name: string }[];
      /** Einzeldatei (Abwärtskompatibilität) – wird wie eine `files`-Liste behandelt. */
      fileKey?: string;
      fileName?: string;
      points?: number;
      level?: AchievedLevel;
      feedback?: string;
    },
  ) {
    const ev = await this.prisma.competenceEvidence.findFirst({
      where: { id: evidenceId, tenantId },
    });
    if (!ev) throw new NotFoundException('Nachweis nicht gefunden.');
    const cfg = (ev.config ?? {}) as UploadConfig;
    if (cfg.allowTeacherAttached !== true) {
      throw new BadRequestException('Dieser Nachweis ist nicht vom Typ „von Lehrperson angefügt".');
    }

    // Zugriff auf den Modulanlass der lernenden Person prüfen (Besitz/Co-Leitung).
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: dto.enrollmentId, class: { moduleId: ev.moduleId, tenantId } },
      select: {
        id: true,
        class: {
          select: {
            status: true,
            ownerId: true,
            coTeachers: { where: { userId }, select: { userId: true } },
          },
        },
      },
    });
    if (!enrollment) {
      throw new NotFoundException('Lernende Person nicht in diesem Modulanlass gefunden.');
    }
    const isAdmin = roles.includes(Role.ADMIN);
    const isClassTeacher =
      enrollment.class.ownerId === userId || enrollment.class.coTeachers.length > 0;
    if (!isAdmin && !isClassTeacher) {
      throw new ForbiddenException('Kein Zugriff auf diesen Modulanlass.');
    }
    if (enrollment.class.status === 'ARCHIVED') {
      throw new ConflictException('Archivierter Modulanlass ist read-only.');
    }

    // Gewünschte Dateiliste bestimmen: `files` (Mehrfach) hat Vorrang, sonst die
    // Einzeldatei (Abwärtskompatibilität). `undefined` = Dateien unverändert lassen.
    const rawFiles = Array.isArray(dto.files)
      ? dto.files
      : dto.fileKey
        ? [{ key: dto.fileKey, name: dto.fileName ?? 'Datei' }]
        : undefined;
    const files = rawFiles
      ?.filter((f) => f?.key)
      .map((f) => ({ key: String(f.key), name: f.name?.trim() || 'Datei', kind: 'file' as const }));
    const fileData =
      files !== undefined
        ? {
            content: { kind: 'teacher', files } as unknown as Prisma.InputJsonValue,
            // fileKey/fileName spiegeln die erste Datei (Einzel-Download/Detailansicht).
            fileKey: files[0]?.key ?? null,
            fileName: files[0]?.name ?? null,
          }
        : null;

    // Bestehende Einreichung dieser Person wiederverwenden, sonst neu anlegen.
    const existing = await this.prisma.submission.findFirst({
      where: { evidenceId, enrollmentId: enrollment.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });

    let submissionId: string;
    if (existing) {
      submissionId = existing.id;
      await this.prisma.submission.update({
        where: { id: existing.id },
        data: {
          // Dateien nur ersetzen, wenn neue übergeben wurden (sonst unverändert lassen).
          ...(fileData ?? {}),
          // Solange nicht bewertet wird, bleibt der Status „eingereicht".
          ...(existing.status === SubmissionStatus.GRADED
            ? {}
            : { status: SubmissionStatus.SUBMITTED }),
          submittedAt: new Date(),
        },
      });
    } else {
      const created = await this.prisma.submission.create({
        data: {
          evidenceId,
          enrollmentId: enrollment.id,
          status: SubmissionStatus.SUBMITTED,
          content:
            fileData?.content ??
            ({ kind: 'teacher', files: [] } as unknown as Prisma.InputJsonValue),
          fileKey: fileData?.fileKey ?? null,
          fileName: fileData?.fileName ?? null,
          submittedAt: new Date(),
        },
      });
      submissionId = created.id;
    }

    // Optional direkt bewerten – nutzt die bestehende Bewertungslogik (inkl. Historie).
    const hasGrade =
      dto.points !== undefined || dto.level !== undefined || (dto.feedback ?? '').length > 0;
    if (hasGrade) {
      await this.submissions.evaluate(
        submissionId,
        { points: dto.points, level: dto.level, feedback: dto.feedback },
        tenantId,
        userId,
        roles,
      );
    }

    const fresh = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { status: true },
    });
    return { submissionId, status: fresh?.status ?? SubmissionStatus.SUBMITTED };
  }

  // ── Helfer ────────────────────────────────────────────────────

  private async loadVisibleEvidence(id: string, tenantId: string) {
    const ev = await this.prisma.competenceEvidence.findFirst({
      where: { id, tenantId, isVisible: true },
    });
    if (!ev) throw new NotFoundException('Nachweis nicht verfügbar.');
    return ev;
  }

  /**
   * Bei der Einreichungsart „von Lehrperson angefügt" darf die lernende Person
   * selbst nichts einreichen – nur die Lehrperson fügt Datei & Punkte an.
   */
  private assertStudentMaySubmit(cfg: UploadConfig) {
    if (cfg.allowTeacherAttached === true) {
      throw new ForbiddenException(
        'Dieser Nachweis wird von der Lehrperson angefügt – eine eigene Einreichung ist nicht möglich.',
      );
    }
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
    const teacherAttached = cfg.allowTeacherAttached === true;
    return {
      allowedFileTypes: cfg.allowedFileTypes ?? [],
      maxFileSizeMb: cfg.maxFileSizeMb ?? 10,
      // „Von Lehrperson angefügt": die lernende Person kann nichts einreichen –
      // alle Einreichungswege werden in diesem Fall hart deaktiviert.
      allowFile: teacherAttached ? false : (cfg.allowFile ?? true),
      allowLink: teacherAttached ? false : (cfg.allowLink ?? true),
      allowText: teacherAttached ? false : (cfg.allowText ?? true),
      allowScreenshot: teacherAttached ? false : (cfg.allowScreenshot ?? false),
      allowScreencast: teacherAttached ? false : (cfg.allowScreencast ?? false),
      // Einfügen standardmässig gesperrt (Lernende sollen selbst schreiben)
      allowPaste: teacherAttached ? false : (cfg.allowPaste ?? false),
      // Fachgespräch/Präsentation optional (KI-Übung im Abgabe-Dialog)
      allowExpertTalk: teacherAttached ? false : (cfg.allowExpertTalk ?? false),
      allowTeacherAttached: teacherAttached,
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
