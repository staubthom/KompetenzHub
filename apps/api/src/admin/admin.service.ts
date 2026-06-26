import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus, Locale, MembershipStatus, Prisma, Role } from '@prisma/client';
import AdmZip from 'adm-zip';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectivityService } from '../health/connectivity.service';
import { S3Service } from '../storage/s3.service';

const ROLE_RANK: Record<Role, number> = { ADMIN: 3, TEACHER: 2, LEARNER: 1 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const LOCALES = ['de', 'fr', 'it', 'en'];
const DEFAULT_PRIMARY = '#1d4ed8';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: Role;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: Date;
}

/** Verwaltung von Personen, Einladungen und Schul-Einstellungen (Schuladmin). */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectivity: ConnectivityService,
    private readonly s3: S3Service,
  ) {}

  // ── Personen ────────────────────────────────────────────────
  async listUsers(tenantId: string): Promise<AdminUser[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    // Pro User aggregieren: höchste Rolle, aktiv wenn mind. eine Membership aktiv.
    const byUser = new Map<string, AdminUser>();
    for (const m of memberships) {
      const existing = byUser.get(m.userId);
      const isActive = m.status === MembershipStatus.ACTIVE;
      if (!existing) {
        byUser.set(m.userId, {
          id: m.user.id,
          email: m.user.email,
          displayName: m.user.displayName,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          status: isActive ? 'ACTIVE' : 'DISABLED',
          createdAt: m.user.createdAt,
        });
      } else {
        if (ROLE_RANK[m.role] > ROLE_RANK[existing.role]) existing.role = m.role;
        if (isActive) existing.status = 'ACTIVE';
      }
    }
    return [...byUser.values()].sort(
      (a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.displayName.localeCompare(b.displayName),
    );
  }

  async setUserRole(
    tenantId: string,
    actingUserId: string,
    targetUserId: string,
    role: Role,
  ): Promise<AdminUser> {
    await this.ensureMember(tenantId, targetUserId);
    // Letzte/n Admin nicht degradieren.
    if (role !== Role.ADMIN) {
      await this.guardLastAdmin(tenantId, targetUserId);
    }
    // Genau eine aktive Membership der gewünschten Rolle, andere entfernen.
    await this.prisma.membership.deleteMany({
      where: { tenantId, userId: targetUserId, role: { not: role } },
    });
    await this.prisma.membership.upsert({
      where: { tenantId_userId_role: { tenantId, userId: targetUserId, role } },
      update: { status: MembershipStatus.ACTIVE },
      create: { tenantId, userId: targetUserId, role, status: MembershipStatus.ACTIVE },
    });
    return this.getUser(tenantId, targetUserId);
  }

  async updateUser(
    tenantId: string,
    targetUserId: string,
    data: { displayName?: string },
  ): Promise<AdminUser> {
    await this.ensureMember(tenantId, targetUserId);
    const name = data.displayName?.trim();
    if (name !== undefined) {
      if (!name) throw new BadRequestException('Name darf nicht leer sein.');
      await this.prisma.user.update({ where: { id: targetUserId }, data: { displayName: name } });
    }
    return this.getUser(tenantId, targetUserId);
  }

  async setUserStatus(
    tenantId: string,
    actingUserId: string,
    targetUserId: string,
    active: boolean,
  ): Promise<AdminUser> {
    await this.ensureMember(tenantId, targetUserId);
    if (!active) {
      if (targetUserId === actingUserId) {
        throw new BadRequestException('Das eigene Konto kann nicht deaktiviert werden.');
      }
      await this.guardLastAdmin(tenantId, targetUserId);
    }
    await this.prisma.membership.updateMany({
      where: { tenantId, userId: targetUserId },
      data: { status: active ? MembershipStatus.ACTIVE : MembershipStatus.DISABLED },
    });
    return this.getUser(tenantId, targetUserId);
  }

  async removeUser(tenantId: string, actingUserId: string, targetUserId: string): Promise<void> {
    await this.ensureMember(tenantId, targetUserId);
    if (targetUserId === actingUserId) {
      throw new BadRequestException('Das eigene Konto kann nicht entfernt werden.');
    }
    await this.guardLastAdmin(tenantId, targetUserId);
    // Nur Zugang zur Schule entziehen (Memberships); das User-Konto bleibt erhalten,
    // da es ggf. Module/Klassen besitzt.
    await this.prisma.membership.deleteMany({ where: { tenantId, userId: targetUserId } });
  }

  // ── Einladungen ─────────────────────────────────────────────
  async listInvitations(tenantId: string) {
    return this.prisma.invitation.findMany({
      where: { tenantId, status: InvitationStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInvitation(tenantId: string, invitedById: string, emailRaw: string, role: Role) {
    const email = emailRaw.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      throw new BadRequestException('Bitte eine gültige E-Mail-Adresse angeben.');
    }
    if (role === Role.LEARNER) {
      throw new BadRequestException('Lernende benötigen keine Einladung.');
    }
    // Ist die Person bereits aktives Mitglied?
    const member = await this.prisma.membership.findFirst({
      where: { tenantId, user: { email } },
    });
    if (member) {
      throw new ConflictException('Diese Person ist bereits in der Schule. Rolle direkt ändern.');
    }
    return this.prisma.invitation.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: { role, status: InvitationStatus.PENDING, invitedById, acceptedAt: null },
      create: { tenantId, email, role, status: InvitationStatus.PENDING, invitedById },
    });
  }

  async revokeInvitation(tenantId: string, id: string): Promise<void> {
    const inv = await this.prisma.invitation.findFirst({ where: { id, tenantId } });
    if (!inv) throw new NotFoundException('Einladung nicht gefunden.');
    await this.prisma.invitation.delete({ where: { id } });
  }

  // ── Schul-Einstellungen / Auth-Provider ─────────────────────
  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { branding: true },
    });
    if (!tenant) throw new NotFoundException('Schule nicht gefunden.');
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const providers = (settings.authProviders ?? {}) as Record<string, boolean>;
    return {
      schoolName: tenant.name,
      logoUrl: tenant.branding?.logoLightKey ?? null,
      primaryColor: tenant.branding?.primaryColor ?? DEFAULT_PRIMARY,
      defaultLocale: typeof settings.defaultLocale === 'string' ? settings.defaultLocale : 'de',
      authProviders: {
        microsoft: providers.microsoft !== false,
        google: providers.google !== false,
        github: providers.github !== false,
      },
      devLoginEnabled: (process.env.DEV_LOGIN_ENABLED ?? 'true') === 'true',
      adminEmailsConfigured: (process.env.ADMIN_EMAILS ?? '').trim().length > 0,
    };
  }

  async updateSettings(
    tenantId: string,
    dto: {
      schoolName?: string;
      authProviders?: { microsoft?: boolean; google?: boolean; github?: boolean };
      logoUrl?: string | null;
      primaryColor?: string;
      defaultLocale?: string;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Schule nicht gefunden.');
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const current = (settings.authProviders ?? {}) as Record<string, boolean>;
    const next = {
      microsoft: dto.authProviders?.microsoft ?? current.microsoft !== false,
      google: dto.authProviders?.google ?? current.google !== false,
      github: dto.authProviders?.github ?? current.github !== false,
    };
    if (dto.primaryColor !== undefined && !HEX_RE.test(dto.primaryColor)) {
      throw new BadRequestException('Ungültiger Farbwert (Hex, z. B. #2563eb).');
    }
    if (dto.defaultLocale !== undefined && !LOCALES.includes(dto.defaultLocale)) {
      throw new BadRequestException('Ungültige Sprache.');
    }
    const nextSettings: Record<string, unknown> = { ...settings, authProviders: next };
    if (dto.defaultLocale !== undefined) nextSettings.defaultLocale = dto.defaultLocale;
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: dto.schoolName?.trim() || tenant.name,
        settings: nextSettings as Prisma.InputJsonValue,
      },
    });
    // Logo / Primärfarbe (undefined = unverändert) in TenantBranding ablegen.
    if (dto.logoUrl !== undefined || dto.primaryColor !== undefined) {
      const logo = dto.logoUrl?.trim() || null;
      await this.prisma.tenantBranding.upsert({
        where: { tenantId },
        update: {
          ...(dto.logoUrl !== undefined ? { logoLightKey: logo } : {}),
          ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor } : {}),
        },
        create: {
          tenantId,
          logoLightKey: dto.logoUrl !== undefined ? logo : null,
          primaryColor: dto.primaryColor ?? DEFAULT_PRIMARY,
        },
      });
    }
    return this.getSettings(tenantId);
  }

  /** Default-Sprache des Mandanten (für neue User beim ersten Login). */
  async defaultLocale(tenantId: string): Promise<Locale> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
    const loc = settings.defaultLocale;
    return typeof loc === 'string' && LOCALES.includes(loc) ? (loc as Locale) : Locale.de;
  }

  // ── Übersicht / Kennzahlen (leicht) ─────────────────────────
  async overview(tenantId: string) {
    const [users, pendingInvites, modules, classes] = await Promise.all([
      this.listUsers(tenantId),
      this.prisma.invitation.count({ where: { tenantId, status: InvitationStatus.PENDING } }),
      this.prisma.module.count({ where: { tenantId } }),
      this.prisma.class.count({ where: { tenantId } }),
    ]);
    return {
      admins: users.filter((u) => u.role === Role.ADMIN).length,
      teachers: users.filter((u) => u.role === Role.TEACHER).length,
      learners: users.filter((u) => u.role === Role.LEARNER).length,
      disabled: users.filter((u) => u.status === 'DISABLED').length,
      pendingInvites,
      modules,
      classes,
    };
  }

  // ── Betrieb & Gesundheit ────────────────────────────────────
  async ops(tenantId: string) {
    const since7 = new Date(Date.now() - 7 * 86400_000);
    const since30 = new Date(Date.now() - 30 * 86400_000);
    const [
      dbUp,
      redisUp,
      s3Up,
      users,
      modules,
      classes,
      evidences,
      submissions,
      logins7,
      logins30,
      storageBytes,
    ] = await Promise.all([
      this.prisma.isHealthy(),
      this.connectivity.isRedisReachable(),
      this.connectivity.isS3Reachable(),
      this.listUsers(tenantId),
      this.prisma.module.count({ where: { tenantId } }),
      this.prisma.class.count({ where: { tenantId } }),
      this.prisma.competenceEvidence.count({ where: { tenantId } }),
      this.prisma.submission.count({ where: { enrollment: { class: { tenantId } } } }),
      this.prisma.auditLog.count({
        where: { tenantId, action: 'auth.login', createdAt: { gte: since7 } },
      }),
      this.prisma.auditLog.count({
        where: { tenantId, action: 'auth.login', createdAt: { gte: since30 } },
      }),
      this.s3.totalSize().catch(() => null),
    ]);
    return {
      health: {
        status: dbUp && redisUp && s3Up ? 'ok' : 'degraded',
        db: dbUp ? 'up' : 'down',
        redis: redisUp ? 'up' : 'down',
        s3: s3Up ? 'up' : 'down',
        version: process.env.npm_package_version ?? '0.0.0',
      },
      usage: {
        users: users.length,
        teachers: users.filter((u) => u.role === Role.TEACHER).length,
        learners: users.filter((u) => u.role === Role.LEARNER).length,
        modules,
        classes,
        evidences,
        submissions,
        storageBytes,
        logins7,
        logins30,
      },
    };
  }

  // ── Audit-Log ───────────────────────────────────────────────
  async audit(tenantId: string, limit = 100) {
    const rows = await this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean) as string[])];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      detail: r.detail,
      createdAt: r.createdAt,
      ip: r.ip,
      userAgent: r.userAgent,
      user: r.userId ? (byId.get(r.userId) ?? null) : null,
    }));
  }

  // ── Backup (Voll-Export: DB-Daten + Dateien als ZIP) ────────
  async backupZip(tenantId: string): Promise<{ buffer: Buffer; filename: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { branding: true },
    });
    if (!tenant) throw new NotFoundException('Schule nicht gefunden.');

    // Tenant-bezogene Daten einsammeln (vollständige Relationen).
    const [memberships, invitations, modules, classes, submissions, auditLog] = await Promise.all([
      this.prisma.membership.findMany({ where: { tenantId }, include: { user: true } }),
      this.prisma.invitation.findMany({ where: { tenantId } }),
      this.prisma.module.findMany({
        where: { tenantId },
        include: {
          actionGoals: true,
          matrix: {
            include: {
              bands: { include: { actionGoals: true, fields: { include: { descriptor: true } } } },
            },
          },
          evidences: { include: { fields: true } },
        },
      }),
      this.prisma.class.findMany({
        where: { tenantId },
        include: { enrollments: true, joinCodes: true },
      }),
      this.prisma.submission.findMany({
        where: { enrollment: { class: { tenantId } } },
        include: { evaluation: true, history: true },
      }),
      this.prisma.auditLog.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
    ]);

    const data = {
      schemaVersion: 1,
      kind: 'tenant-backup',
      exportedAt: new Date().toISOString(),
      tenant: {
        id: tenant.id,
        name: tenant.name,
        settings: tenant.settings,
        branding: tenant.branding,
      },
      users: memberships.map((m) => m.user),
      memberships: memberships.map(({ user: _u, ...m }) => m),
      invitations,
      modules,
      classes,
      submissions,
      auditLog,
    };

    const zip = new AdmZip();
    zip.addFile('backup.json', Buffer.from(JSON.stringify(data, null, 2), 'utf8'));

    // Alle Objekte aus dem Bucket beilegen (Logos, RTE-Bilder, Anhänge, Belege).
    try {
      const keys = await this.s3.listAllKeys();
      for (const key of keys) {
        try {
          const bytes = await this.s3.getBytes(key);
          zip.addFile(`files/${key}`, bytes);
        } catch {
          // einzelne fehlende Objekte überspringen
        }
      }
    } catch {
      // Objektspeicher nicht erreichbar – Backup enthält dann nur die DB-Daten.
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return { buffer: zip.toBuffer(), filename: `kompetenzhub-backup-${stamp}.zip` };
  }

  // ── Helpers ─────────────────────────────────────────────────
  private async ensureMember(tenantId: string, userId: string): Promise<void> {
    const count = await this.prisma.membership.count({ where: { tenantId, userId } });
    if (count === 0) throw new NotFoundException('Person nicht in dieser Schule gefunden.');
  }

  /** Verhindert, dass die letzte aktive ADMIN-Mitgliedschaft entfernt/degradiert wird. */
  private async guardLastAdmin(tenantId: string, targetUserId: string): Promise<void> {
    const isAdmin = await this.prisma.membership.findFirst({
      where: { tenantId, userId: targetUserId, role: Role.ADMIN, status: MembershipStatus.ACTIVE },
    });
    if (!isAdmin) return;
    const adminCount = await this.prisma.membership.count({
      where: { tenantId, role: Role.ADMIN, status: MembershipStatus.ACTIVE },
    });
    if (adminCount <= 1) {
      throw new ForbiddenException('Die letzte aktive Schuladmin kann nicht entfernt werden.');
    }
  }

  private async getUser(tenantId: string, userId: string): Promise<AdminUser> {
    const users = await this.listUsers(tenantId);
    const found = users.find((u) => u.id === userId);
    if (!found) throw new NotFoundException('Person nicht gefunden.');
    return found;
  }
}
