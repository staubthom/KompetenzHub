import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  EvaluationChangeType,
  InvitationStatus,
  MailTemplateType,
  Role,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { MailTemplateService } from './mail-template.service';
import {
  DigestData,
  digestHasContent,
  digestSummary,
  localeKey,
  roleLabel,
  webUrl,
  weeklyReportSummary,
} from './mail.templates';

interface TeacherAgg {
  newSubmissions: number;
  pendingTotal: number;
}
interface LearnerItem {
  title: string;
  status: 'GRADED' | 'REJECTED';
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Geplante E-Mail-Läufe:
 *  - Tages-Digest (04:00): gebündelte Abgaben/Bewertungen pro Empfänger:in.
 *  - Wochenbericht (Mo 06:00): Kennzahlen an die Schuladministration.
 *  - Einladungs-Reminder (05:00): offene Einladungen älter als 7 Tage, einmalig.
 *
 * Der Digest verarbeitet pro Mandant das Fenster [DigestState.lastRunAt, jetzt),
 * damit bei einem verpassten Lauf keine Ereignisse verloren gehen.
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly templates: MailTemplateService,
  ) {}

  // ── Tages-Digest ────────────────────────────────────────────────

  @Cron('0 4 * * *', { name: 'daily-digest', timeZone: 'Europe/Zurich' })
  async handleDigestCron(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    let mails = 0;
    for (const t of tenants) mails += await this.runForTenant(t.id);
    this.logger.log(`Tages-Digest: ${tenants.length} Mandant(en), ${mails} Mail(s).`);
  }

  /** Verarbeitet den Tages-Digest für einen Mandanten; gibt die Anzahl Mails zurück. */
  async runForTenant(tenantId: string): Promise<number> {
    const now = new Date();
    const state = await this.prisma.digestState.findUnique({ where: { tenantId } });
    // Ohne bisherigen Lauf: nur die letzten 24 h (kein „Nachholen" der Historie).
    const since = state?.lastRunAt ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const teacherAgg = await this.collectTeacherAgg(tenantId, since);
    const learnerAgg = await this.collectLearnerAgg(tenantId, since);
    const recipientIds = new Set<string>([...teacherAgg.keys(), ...learnerAgg.keys()]);
    let sent = 0;

    if (recipientIds.size > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: [...recipientIds] }, notifyDigest: true },
        select: { id: true, email: true, displayName: true, locale: true },
      });
      for (const u of users) {
        const teacher = teacherAgg.get(u.id);
        const learner = learnerAgg.get(u.id);
        const data: DigestData = {
          teacher: teacher && teacher.newSubmissions > 0 ? teacher : undefined,
          learner: learner && learner.length > 0 ? learner : undefined,
        };
        if (!digestHasContent(data)) continue;
        const k = localeKey(u.locale);
        const mail = await this.templates.compose(tenantId, MailTemplateType.DIGEST, u.locale, {
          scalars: { name: u.displayName },
          blocks: { summary: digestSummary(k, data) },
          ctaHref: webUrl(),
        });
        if (await this.mail.send({ to: u.email, ...mail })) sent++;
      }
    }

    // Fenster-Ende festschreiben – auch ohne Versand, damit gesehene Ereignisse
    // nicht erneut auftauchen.
    await this.prisma.digestState.upsert({
      where: { tenantId },
      update: { lastRunAt: now },
      create: { tenantId, lastRunAt: now },
    });
    return sent;
  }

  // ── Wochenbericht (Schuladministration) ─────────────────────────

  @Cron('0 6 * * 1', { name: 'weekly-report', timeZone: 'Europe/Zurich' })
  async handleWeeklyReportCron(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    let mails = 0;
    for (const t of tenants) mails += await this.runWeeklyReportForTenant(t.id);
    this.logger.log(`Wochenbericht: ${tenants.length} Mandant(en), ${mails} Mail(s).`);
  }

  /** Versendet den Wochenbericht an alle Schuladmins eines Mandanten. */
  async runWeeklyReportForTenant(tenantId: string): Promise<number> {
    const since = new Date(Date.now() - WEEK_MS);
    const [newUsers, pendingInvites, newSubmissions, gradings] = await Promise.all([
      this.prisma.membership.count({ where: { tenantId, createdAt: { gte: since } } }),
      this.prisma.invitation.count({ where: { tenantId, status: InvitationStatus.PENDING } }),
      this.prisma.submission.count({
        where: { evidence: { tenantId }, createdAt: { gte: since } },
      }),
      this.prisma.evaluationHistory.count({
        where: { submission: { evidence: { tenantId } }, createdAt: { gte: since } },
      }),
    ]);

    const admins = await this.prisma.membership.findMany({
      where: { tenantId, role: Role.ADMIN, user: { notifyDigest: true } },
      select: { user: { select: { email: true, locale: true } } },
    });
    if (admins.length === 0) return 0;

    const school = await this.schoolName(tenantId);
    const data = { newUsers, pendingInvites, newSubmissions, gradings };
    let sent = 0;
    for (const a of admins) {
      const k = localeKey(a.user.locale);
      const mail = await this.templates.compose(
        tenantId,
        MailTemplateType.WEEKLY_REPORT,
        a.user.locale,
        {
          scalars: { school },
          blocks: { summary: weeklyReportSummary(k, data) },
          ctaHref: `${webUrl()}/admin`,
        },
      );
      if (await this.mail.send({ to: a.user.email, ...mail })) sent++;
    }
    return sent;
  }

  // ── Einladungs-Erinnerungen ─────────────────────────────────────

  @Cron('0 5 * * *', { name: 'invite-reminders', timeZone: 'Europe/Zurich' })
  async handleInviteReminderCron(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    let mails = 0;
    for (const t of tenants) mails += await this.runInviteRemindersForTenant(t.id);
    this.logger.log(`Einladungs-Reminder: ${tenants.length} Mandant(en), ${mails} Mail(s).`);
  }

  /** Erinnert an offene Einladungen, die älter als 7 Tage sind – einmalig. */
  async runInviteRemindersForTenant(tenantId: string): Promise<number> {
    const cutoff = new Date(Date.now() - WEEK_MS);
    const invites = await this.prisma.invitation.findMany({
      where: {
        tenantId,
        status: InvitationStatus.PENDING,
        remindedAt: null,
        createdAt: { lte: cutoff },
      },
      select: { id: true, email: true, role: true },
    });
    if (invites.length === 0) return 0;

    const school = await this.schoolName(tenantId);
    const locale = await this.tenantLocale(tenantId);
    const k = localeKey(locale);
    let sent = 0;
    for (const inv of invites) {
      const mail = await this.templates.compose(
        tenantId,
        MailTemplateType.INVITE_REMINDER,
        locale,
        {
          scalars: {
            email: inv.email,
            role: roleLabel(k, inv.role),
            school,
            url: webUrl(),
          },
          ctaHref: webUrl(),
        },
      );
      if (await this.mail.send({ to: inv.email, ...mail })) sent++;
      await this.prisma.invitation.update({
        where: { id: inv.id },
        data: { remindedAt: new Date() },
      });
    }
    return sent;
  }

  // ── Aggregation ─────────────────────────────────────────────────

  private async collectTeacherAgg(tenantId: string, since: Date): Promise<Map<string, TeacherAgg>> {
    const open = await this.prisma.submission.findMany({
      where: { evidence: { tenantId }, status: SubmissionStatus.SUBMITTED },
      select: {
        submittedAt: true,
        createdAt: true,
        enrollment: {
          select: {
            class: { select: { ownerId: true, coTeachers: { select: { userId: true } } } },
          },
        },
      },
    });

    const agg = new Map<string, TeacherAgg>();
    const bump = (userId: string, isNew: boolean) => {
      const cur = agg.get(userId) ?? { newSubmissions: 0, pendingTotal: 0 };
      cur.pendingTotal += 1;
      if (isNew) cur.newSubmissions += 1;
      agg.set(userId, cur);
    };

    for (const s of open) {
      const at = s.submittedAt ?? s.createdAt;
      const isNew = at >= since;
      const cls = s.enrollment.class;
      const teacherIds = new Set<string>([cls.ownerId, ...cls.coTeachers.map((c) => c.userId)]);
      for (const id of teacherIds) bump(id, isNew);
    }
    return agg;
  }

  private async collectLearnerAgg(
    tenantId: string,
    since: Date,
  ): Promise<Map<string, LearnerItem[]>> {
    const history = await this.prisma.evaluationHistory.findMany({
      where: {
        createdAt: { gte: since },
        changeType: {
          in: [
            EvaluationChangeType.CREATED,
            EvaluationChangeType.UPDATED,
            EvaluationChangeType.REJECTED,
          ],
        },
        submission: { evidence: { tenantId } },
      },
      select: {
        changeType: true,
        submission: {
          select: {
            evidence: { select: { title: true } },
            enrollment: { select: { userId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const agg = new Map<string, LearnerItem[]>();
    for (const h of history) {
      const userId = h.submission.enrollment.userId;
      if (!userId) continue; // verwaiste Einschreibung ohne Konto
      const title = this.localizedTitle(h.submission.evidence.title);
      const status: LearnerItem['status'] =
        h.changeType === EvaluationChangeType.REJECTED ? 'REJECTED' : 'GRADED';
      const list = agg.get(userId) ?? [];
      list.push({ title, status });
      agg.set(userId, list);
    }
    return agg;
  }

  // ── Helfer ──────────────────────────────────────────────────────

  private async schoolName(tenantId: string): Promise<string> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, branding: { select: { displayName: true } } },
    });
    return t?.branding?.displayName?.trim() || t?.name || 'KompetenzHub';
  }

  private async tenantLocale(tenantId: string): Promise<string> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (t?.settings ?? {}) as Record<string, unknown>;
    return typeof settings.defaultLocale === 'string' ? settings.defaultLocale : 'de';
  }

  /** i18n-Titel (Json {de,fr,…}) auf einen lesbaren String reduzieren. */
  private localizedTitle(json: unknown): string {
    if (json && typeof json === 'object') {
      const rec = json as Record<string, unknown>;
      const v = rec.de ?? Object.values(rec)[0];
      if (typeof v === 'string' && v.trim()) return v;
    }
    if (typeof json === 'string' && json.trim()) return json;
    return '(ohne Titel)';
  }
}
