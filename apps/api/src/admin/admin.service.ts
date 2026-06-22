import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus, MembershipStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ROLE_RANK: Record<Role, number> = { ADMIN: 3, TEACHER: 2, LEARNER: 1 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  constructor(private readonly prisma: PrismaService) {}

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
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Schule nicht gefunden.');
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const providers = (settings.authProviders ?? {}) as Record<string, boolean>;
    return {
      schoolName: tenant.name,
      authProviders: {
        microsoft: providers.microsoft !== false,
        google: providers.google !== false,
      },
      devLoginEnabled: (process.env.DEV_LOGIN_ENABLED ?? 'true') === 'true',
      adminEmailsConfigured: (process.env.ADMIN_EMAILS ?? '').trim().length > 0,
    };
  }

  async updateSettings(
    tenantId: string,
    dto: { schoolName?: string; authProviders?: { microsoft?: boolean; google?: boolean } },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Schule nicht gefunden.');
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const current = (settings.authProviders ?? {}) as Record<string, boolean>;
    const next = {
      microsoft: dto.authProviders?.microsoft ?? current.microsoft !== false,
      google: dto.authProviders?.google ?? current.google !== false,
    };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: dto.schoolName?.trim() || tenant.name,
        settings: { ...settings, authProviders: next },
      },
    });
    return this.getSettings(tenantId);
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
