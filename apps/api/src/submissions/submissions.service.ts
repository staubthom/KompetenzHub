import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AchievedLevel,
  EvaluationChangeType,
  Prisma,
  Role,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { AiService } from '../ai/ai.service';

export interface EvaluateDto {
  points?: number;
  level?: AchievedLevel;
  feedback?: string;
}

interface AssessmentReasoning {
  criterion: string;
  comment: string;
}

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly ai: AiService,
  ) {}

  /** Liste der Einreichungen – nur eigene Modulanlässe (Admin: alle), filterbar. */
  async list(
    tenantId: string,
    userId: string,
    roles: Role[],
    filter: { status?: SubmissionStatus; classId?: string; evidenceId?: string },
  ) {
    const isAdmin = roles.includes(Role.ADMIN);
    const subs = await this.prisma.submission.findMany({
      where: {
        evidence: { tenantId },
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.evidenceId ? { evidenceId: filter.evidenceId } : {}),
        // Lehrperson sieht nur Einreichungen aus eigenen oder co-geleiteten Modulanlässen.
        enrollment: {
          ...(filter.classId ? { classId: filter.classId } : {}),
          ...(isAdmin
            ? {}
            : {
                class: { OR: [{ ownerId: userId }, { coTeachers: { some: { userId } } }] },
              }),
        },
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        points: true,
        evidence: { select: { id: true, title: true, maxPoints: true, dueAt: true } },
        enrollment: {
          select: {
            id: true,
            displayName: true,
            class: { select: { id: true, name: true } },
            user: { select: { displayName: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
    // Aktueller Anzeigename der Person hat Vorrang vor dem Beitritts-Schnappschuss.
    return subs.map((s) => ({
      ...s,
      enrollment: {
        ...s.enrollment,
        displayName: s.enrollment.user?.displayName ?? s.enrollment.displayName,
      },
    }));
  }

  /** Detail einer Einreichung inkl. Download-Link, Bewertung & Historie. */
  async detail(id: string, tenantId: string, userId: string, roles: Role[]) {
    const sub = await this.prisma.submission.findFirst({
      where: { id, evidence: { tenantId } },
      include: {
        evidence: {
          select: { id: true, title: true, instructions: true, maxPoints: true, dueAt: true },
        },
        enrollment: {
          select: {
            userId: true,
            displayName: true,
            user: { select: { displayName: true } },
            class: {
              select: {
                id: true,
                name: true,
                ownerId: true,
                coTeachers: { where: { userId }, select: { userId: true } },
              },
            },
          },
        },
        evaluation: true,
        history: {
          orderBy: { createdAt: 'desc' },
          include: { changedBy: { select: { displayName: true } } },
        },
      },
    });
    if (!sub) throw new NotFoundException('Einreichung nicht gefunden.');

    // Zugriff: Admin; ODER Lehrperson (Besitz/Co-Leitung); ODER einreichende:r Lernende:r.
    const isAdmin = roles.includes(Role.ADMIN);
    const isTeacher =
      roles.includes(Role.TEACHER) && this.teacherHasClass(sub.enrollment.class, userId);
    const isOwner = sub.enrollment.userId === userId;
    if (!isAdmin && !isTeacher && !isOwner) {
      throw new ForbiddenException('Kein Zugriff auf diese Einreichung.');
    }

    // Bild-URLs in den Aufgaben-Instruktionen für die Anzeige presignen.
    (sub.evidence as { instructions?: unknown }).instructions = await this.s3.presignHtmlForRead(
      sub.evidence.instructions,
    );

    let fileUrl: string | null = null;
    if (sub.fileKey) {
      fileUrl = await this.s3.presignDownload(sub.fileKey);
    }

    // Mehrere Dateien/Screenshots aus content.files mit Download-Links versehen.
    const content = (sub.content ?? {}) as {
      files?: { key: string; name: string; kind: string }[];
    };
    const files = await Promise.all(
      (content.files ?? []).map(async (f) => ({
        name: f.name,
        kind: f.kind,
        url: await this.s3.presignDownload(f.key),
      })),
    );

    // Aktueller Anzeigename der Person hat Vorrang vor dem Beitritts-Schnappschuss.
    const enrollment = {
      ...sub.enrollment,
      displayName: sub.enrollment.user?.displayName ?? sub.enrollment.displayName,
    };
    return { ...sub, enrollment, fileUrl, files };
  }

  /** Bewerten (FA-60): Punkte/Level/Feedback, Status → graded, Historie. */
  async evaluate(id: string, dto: EvaluateDto, tenantId: string, userId: string, roles: Role[]) {
    const sub = await this.loadInTenant(id, tenantId, userId, roles);

    if (dto.points !== undefined && dto.points !== null) {
      if (dto.points < 0)
        throw new UnprocessableEntityException('Punkte dürfen nicht negativ sein.');
      const max = sub.evidence.maxPoints ? Number(sub.evidence.maxPoints) : null;
      if (max !== null && dto.points > max) {
        throw new UnprocessableEntityException(`Punkte überschreiten das Maximum (${max}).`);
      }
    }

    const existing = await this.prisma.evaluation.findUnique({ where: { submissionId: id } });
    const feedback = dto.feedback ?? existing?.feedback ?? '';

    const evaluation = await this.prisma.evaluation.upsert({
      where: { submissionId: id },
      create: {
        submissionId: id,
        evaluatorId: userId,
        achievedLevel: dto.level ?? null,
        points: dto.points ?? null,
        feedback,
        rejectionReason: null,
      },
      update: {
        evaluatorId: userId,
        achievedLevel: dto.level ?? null,
        points: dto.points ?? null,
        feedback,
        rejectionReason: null,
      },
    });

    await this.prisma.submission.update({
      where: { id },
      data: { status: SubmissionStatus.GRADED, points: dto.points ?? null },
    });

    await this.prisma.evaluationHistory.create({
      data: {
        submissionId: id,
        changedById: userId,
        changeType: existing ? EvaluationChangeType.UPDATED : EvaluationChangeType.CREATED,
        achievedLevel: dto.level ?? null,
        points: dto.points ?? null,
        feedback,
      },
    });

    await this.audit(tenantId, userId, 'submission.grade', id, {
      points: dto.points ?? null,
      level: dto.level ?? null,
    });

    return evaluation;
  }

  /** Zurückweisen (FA-62): Pflicht-Begründung, Status → rejected, Historie. */
  async reject(id: string, reason: string, tenantId: string, userId: string, roles: Role[]) {
    const trimmed = reason?.trim();
    if (!trimmed) throw new UnprocessableEntityException('Begründung ist erforderlich.');
    await this.loadInTenant(id, tenantId, userId, roles);

    const evaluation = await this.prisma.evaluation.upsert({
      where: { submissionId: id },
      create: {
        submissionId: id,
        evaluatorId: userId,
        feedback: '',
        rejectionReason: trimmed,
      },
      update: { evaluatorId: userId, rejectionReason: trimmed },
    });

    await this.prisma.submission.update({
      where: { id },
      data: { status: SubmissionStatus.REJECTED },
    });

    await this.prisma.evaluationHistory.create({
      data: {
        submissionId: id,
        changedById: userId,
        changeType: EvaluationChangeType.REJECTED,
        feedback: trimmed,
      },
    });

    await this.audit(tenantId, userId, 'submission.reject', id, { reason: trimmed });
    return evaluation;
  }

  /** Bewertungshistorie (FA-65). */
  async history(id: string, tenantId: string, userId: string, roles: Role[]) {
    const sub = await this.prisma.submission.findFirst({
      where: { id, evidence: { tenantId } },
      select: {
        enrollment: {
          select: {
            userId: true,
            class: {
              select: {
                ownerId: true,
                coTeachers: { where: { userId }, select: { userId: true } },
              },
            },
          },
        },
      },
    });
    if (!sub) throw new NotFoundException('Einreichung nicht gefunden.');
    const isAdmin = roles.includes(Role.ADMIN);
    const isTeacher =
      roles.includes(Role.TEACHER) && this.teacherHasClass(sub.enrollment.class, userId);
    if (!isAdmin && !isTeacher && sub.enrollment.userId !== userId) {
      throw new ForbiddenException('Kein Zugriff.');
    }
    return this.prisma.evaluationHistory.findMany({
      where: { submissionId: id },
      orderBy: { createdAt: 'desc' },
      include: { changedBy: { select: { displayName: true } } },
    });
  }

  // ── KI-Unterstützung (FA-70 Bewertungsvorschlag, FA-72 Feedback) ─

  /**
   * FA-70: Erzeugt einen KI-Bewertungsvorschlag (Punkte/Level/Feedback + Begründung
   * je Kriterium) und speichert ihn. Reiner Vorschlag – keine automatische Bewertung.
   */
  async generateAssessment(id: string, tenantId: string, userId: string, roles: Role[]) {
    await this.detailGuard(id, tenantId, userId, roles, true);
    const ctx = await this.loadAiContext(id, tenantId);
    const maxPoints = ctx.maxPoints;

    const system =
      'Du bist eine wohlwollende, faire Lehrperson an einer Schweizer Berufsfachschule. ' +
      'Bewerte den eingereichten Kompetenznachweis anhand von Aufgabe und Bewertungsraster. ' +
      'Du machst NUR einen Vorschlag – die endgültige Bewertung trifft immer die Lehrperson. ' +
      'Antworte AUSSCHLIESSLICH als JSON-Objekt mit den Feldern: ' +
      '"suggestedPoints" (Zahl' +
      (maxPoints != null ? `, 0 bis ${maxPoints}` : '') +
      '), "suggestedLevel" (einer von "NOT_MET","BEGINNER","INTERMEDIATE","ADVANCED"), ' +
      '"feedback" (konstruktiver Text für die lernende Person), ' +
      '"reasoning" (Array aus {"criterion": string, "comment": string}).';

    const stub = {
      suggestedPoints: maxPoints != null ? Math.round(maxPoints * 0.7 * 100) / 100 : null,
      suggestedLevel: 'INTERMEDIATE',
      feedback:
        '[KI-Vorschlag] Die Einreichung erfüllt die wesentlichen Anforderungen. ' +
        'Achte beim nächsten Mal auf eine ausführlichere Begründung deiner Lösung.',
      reasoning: [
        { criterion: 'Vollständigkeit', comment: 'Die Kernpunkte der Aufgabe sind abgedeckt.' },
        { criterion: 'Nachvollziehbarkeit', comment: 'Die Argumentation ist überwiegend klar.' },
      ],
    };

    const raw = await this.ai.chat(tenantId, userId, {
      system,
      user: this.buildAssessmentPrompt(ctx),
      stub,
    });
    const parsed = this.parseJson(raw);

    const suggestedLevel = this.coerceLevel(parsed.suggestedLevel);
    let suggestedPoints =
      typeof parsed.suggestedPoints === 'number' && Number.isFinite(parsed.suggestedPoints)
        ? parsed.suggestedPoints
        : null;
    if (suggestedPoints != null) {
      if (suggestedPoints < 0) suggestedPoints = 0;
      if (maxPoints != null && suggestedPoints > maxPoints) suggestedPoints = maxPoints;
    }
    const feedback = typeof parsed.feedback === 'string' ? parsed.feedback : '';
    const reasoning = this.coerceReasoning(parsed.reasoning);
    const model = await this.ai.modelName(tenantId, userId);

    const saved = await this.prisma.aiAssessment.create({
      data: {
        submissionId: id,
        createdById: userId,
        suggestedPoints,
        suggestedLevel,
        feedback,
        reasoning: reasoning as unknown as Prisma.InputJsonValue,
        model,
      },
    });

    await this.audit(tenantId, userId, 'submission.ai-assessment', id, { model });
    return this.toAssessmentView(saved);
  }

  /** Letzter gespeicherter KI-Vorschlag zu einer Einreichung (oder null). */
  async getAssessment(id: string, tenantId: string, userId: string, roles: Role[]) {
    await this.detailGuard(id, tenantId, userId, roles, true);
    const latest = await this.prisma.aiAssessment.findFirst({
      where: { submissionId: id },
      orderBy: { createdAt: 'desc' },
    });
    return latest ? this.toAssessmentView(latest) : null;
  }

  /**
   * FA-72: Erzeugt einen editierbaren KI-Feedback-Entwurf (wird nicht als Bewertung
   * gespeichert; die Lehrperson übernimmt/überarbeitet ihn beim Bewerten).
   */
  async generateFeedback(id: string, tenantId: string, userId: string, roles: Role[]) {
    await this.detailGuard(id, tenantId, userId, roles, true);
    const ctx = await this.loadAiContext(id, tenantId);
    const system =
      'Du bist eine wohlwollende Lehrperson an einer Schweizer Berufsfachschule. ' +
      'Formuliere einen konstruktiven, wertschätzenden Feedback-Entwurf zur Einreichung, ' +
      'mit Bezug auf Aufgabe und Bewertungsraster. Es ist ein Entwurf, keine Bewertung. ' +
      'Antworte AUSSCHLIESSLICH als JSON-Objekt mit dem Feld "feedback" (string).';
    const stub = {
      feedback:
        '[KI-Entwurf] Gut gemacht! Deine Lösung zeigt, dass du die Aufgabe verstanden hast. ' +
        'Begründe deine Entscheidungen das nächste Mal noch etwas ausführlicher.',
    };
    const raw = await this.ai.chat(tenantId, userId, {
      system,
      user: this.buildAssessmentPrompt(ctx),
      stub,
    });
    const parsed = this.parseJson(raw);
    const feedback = typeof parsed.feedback === 'string' ? parsed.feedback : '';
    await this.audit(tenantId, userId, 'submission.ai-feedback', id, {});
    return { feedback };
  }

  // ── Helfer ────────────────────────────────────────────────────

  /** Lehrperson hat Zugriff, wenn sie Besitzerin ODER Co-Leitung der Klasse ist. */
  private teacherHasClass(
    cls: { ownerId: string; coTeachers: { userId: string }[] },
    userId: string,
  ): boolean {
    return cls.ownerId === userId || cls.coTeachers.length > 0;
  }

  private async loadInTenant(id: string, tenantId: string, userId: string, roles: Role[]) {
    const sub = await this.prisma.submission.findFirst({
      where: { id, evidence: { tenantId } },
      include: {
        evidence: { select: { maxPoints: true } },
        enrollment: {
          select: {
            class: {
              select: {
                ownerId: true,
                status: true,
                coTeachers: { where: { userId }, select: { userId: true } },
              },
            },
          },
        },
      },
    });
    if (!sub) throw new NotFoundException('Einreichung nicht gefunden.');
    const isAdmin = roles.includes(Role.ADMIN);
    const isTeacher =
      roles.includes(Role.TEACHER) && this.teacherHasClass(sub.enrollment.class, userId);
    if (!isAdmin && !isTeacher) {
      throw new ForbiddenException('Kein Zugriff auf diese Einreichung.');
    }
    if (sub.enrollment.class.status === 'ARCHIVED') {
      throw new ConflictException(
        'Archivierter Modulanlass ist read-only – keine Bewertung möglich.',
      );
    }
    return sub;
  }

  private async audit(
    tenantId: string,
    userId: string,
    action: string,
    entityId: string,
    detail: Record<string, unknown>,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { tenantId, userId, action, detail: detail as Prisma.InputJsonValue },
      });
    } catch {
      // Audit-Fehler nicht fatal
    }
  }

  // ── KI-Helfer ─────────────────────────────────────────────────

  /** Prüft Zugriff (Tenant + Lehrperson/Admin oder Eigentümer). */
  private async detailGuard(
    id: string,
    tenantId: string,
    userId: string,
    roles: Role[],
    teacherOnly = false,
  ) {
    const sub = await this.prisma.submission.findFirst({
      where: { id, evidence: { tenantId } },
      select: {
        enrollment: {
          select: {
            userId: true,
            class: {
              select: {
                ownerId: true,
                coTeachers: { where: { userId }, select: { userId: true } },
              },
            },
          },
        },
      },
    });
    if (!sub) throw new NotFoundException('Einreichung nicht gefunden.');
    const isAdmin = roles.includes(Role.ADMIN);
    const isTeacher =
      roles.includes(Role.TEACHER) && this.teacherHasClass(sub.enrollment.class, userId);
    if (teacherOnly && !isAdmin && !isTeacher) throw new ForbiddenException('Kein Zugriff.');
    if (!isAdmin && !isTeacher && sub.enrollment.userId !== userId) {
      throw new ForbiddenException('Kein Zugriff.');
    }
  }

  /** Lädt Aufgabe, Bewertungsraster (Deskriptoren) und Einreichungsinhalt für die KI. */
  private async loadAiContext(id: string, tenantId: string) {
    const sub = await this.prisma.submission.findFirst({
      where: { id, evidence: { tenantId } },
      include: {
        evidence: {
          select: {
            title: true,
            instructions: true,
            maxPoints: true,
            fields: {
              select: {
                field: {
                  select: {
                    code: true,
                    level: true,
                    descriptor: { select: { text: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!sub) throw new NotFoundException('Einreichung nicht gefunden.');

    const content = (sub.content ?? {}) as {
      text?: string;
      link?: string;
      files?: { name: string; kind: string }[];
    };
    const rubric = sub.evidence.fields.map((ef) => ({
      code: ef.field.code,
      level: ef.field.level,
      descriptor: this.de(ef.field.descriptor?.text),
    }));

    return {
      title: this.de(sub.evidence.title),
      instructions: this.stripHtml(this.de(sub.evidence.instructions)),
      maxPoints: sub.evidence.maxPoints != null ? Number(sub.evidence.maxPoints) : null,
      rubric,
      text: content.text ?? '',
      link: content.link ?? '',
      files: content.files ?? [],
    };
  }

  private buildAssessmentPrompt(ctx: Awaited<ReturnType<typeof this.loadAiContext>>): string {
    const lines: string[] = [];
    lines.push(`AUFGABE: ${ctx.title || '(ohne Titel)'}`);
    if (ctx.instructions) lines.push(`AUFGABENSTELLUNG: ${ctx.instructions}`);
    if (ctx.maxPoints != null) lines.push(`MAXIMALE PUNKTE: ${ctx.maxPoints}`);
    if (ctx.rubric.length > 0) {
      lines.push('BEWERTUNGSRASTER (Kompetenz-Deskriptoren):');
      for (const r of ctx.rubric) {
        lines.push(`- [${r.code} · ${r.level}] ${r.descriptor || '(kein Deskriptor)'}`);
      }
    }
    lines.push('EINREICHUNG:');
    if (ctx.text) lines.push(`Text: ${ctx.text}`);
    if (ctx.link) lines.push(`Link: ${ctx.link}`);
    if (ctx.files.length > 0) {
      lines.push(`Dateien: ${ctx.files.map((f) => `${f.name} (${f.kind})`).join(', ')}`);
    }
    if (!ctx.text && !ctx.link && ctx.files.length === 0) {
      lines.push('(keine textuellen Inhalte – nur Anhänge oder leer)');
    }
    return lines.join('\n');
  }

  private de(json: unknown): string {
    if (json && typeof json === 'object') {
      const rec = json as Record<string, unknown>;
      const v = rec.de ?? Object.values(rec)[0];
      return typeof v === 'string' ? v : '';
    }
    return typeof json === 'string' ? json : '';
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseJson(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Manche Modelle umrahmen JSON mit Text/Codeblöcken – ersten {...}-Block extrahieren.
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as Record<string, unknown>;
        } catch {
          /* fällt unten durch */
        }
      }
      throw new UnprocessableEntityException('KI-Antwort konnte nicht verarbeitet werden.');
    }
  }

  private coerceLevel(value: unknown): AchievedLevel | null {
    if (typeof value !== 'string') return null;
    const upper = value.toUpperCase();
    return (Object.values(AchievedLevel) as string[]).includes(upper)
      ? (upper as AchievedLevel)
      : null;
  }

  private coerceReasoning(value: unknown): AssessmentReasoning[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((r) => {
        const rec = (r ?? {}) as Record<string, unknown>;
        return {
          criterion: typeof rec.criterion === 'string' ? rec.criterion : '',
          comment: typeof rec.comment === 'string' ? rec.comment : '',
        };
      })
      .filter((r) => r.criterion || r.comment);
  }

  private toAssessmentView(a: {
    id: string;
    suggestedPoints: Prisma.Decimal | null;
    suggestedLevel: AchievedLevel | null;
    feedback: string;
    reasoning: Prisma.JsonValue;
    model: string | null;
    createdAt: Date;
  }) {
    return {
      id: a.id,
      suggestedPoints: a.suggestedPoints != null ? Number(a.suggestedPoints) : null,
      suggestedLevel: a.suggestedLevel,
      feedback: a.feedback,
      reasoning: this.coerceReasoning(a.reasoning),
      model: a.model,
      createdAt: a.createdAt.toISOString(),
    };
  }
}
