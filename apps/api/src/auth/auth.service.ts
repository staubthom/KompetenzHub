import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthProvider, InvitationStatus, Locale, MembershipStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';

/** E-Mail-Adressen, die beim Login automatisch ADMIN-Rechte erhalten (Bootstrap). */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Externes Profil, wie es vom IdP (oder Dev-Login) kommt. */
export interface ExternalProfile {
  provider: AuthProvider;
  externalId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  locale?: Locale;
  /** Gewünschte Default-Rolle beim ersten Login (Dev/JIT). */
  desiredRole?: Role;
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    locale: Locale;
    theme: string;
    tenantId: string;
    roles: Role[];
  };
}

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /** Stellt sicher, dass ein Default-Tenant existiert (MVP: ein aktiver Mandant). */
  async ensureDefaultTenant(): Promise<string> {
    const existing = await this.prisma.tenant.findFirst();
    if (existing) return existing.id;
    const created = await this.prisma.tenant.create({
      data: { id: DEFAULT_TENANT_ID, name: 'KompetenzHub' },
    });
    return created.id;
  }

  /**
   * JIT-Provisionierung: User per (provider, externalId) finden/anlegen,
   * Membership im aktiven Tenant sicherstellen, danach JWT ausstellen.
   */
  async loginWithProfile(
    profile: ExternalProfile,
    opts: { bypassGate?: boolean } = {},
  ): Promise<AuthResult> {
    const tenantId = await this.ensureDefaultTenant();

    // Auth-Provider, die die Schuladmin deaktiviert hat, werden abgewiesen
    // (Dev-Login umgeht dies).
    if (!opts.bypassGate && !(await this.isProviderEnabled(tenantId, profile.provider))) {
      await this.audit(tenantId, null, 'auth.denied', { provider: profile.provider });
      throw new UnauthorizedException('Dieser Anmelde-Anbieter ist deaktiviert.');
    }

    const user = await this.prisma.user.upsert({
      where: {
        authProvider_externalId: {
          authProvider: profile.provider,
          externalId: profile.externalId,
        },
      },
      update: {
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
      create: {
        email: profile.email,
        displayName: profile.displayName,
        authProvider: profile.provider,
        externalId: profile.externalId,
        avatarUrl: profile.avatarUrl,
        locale: profile.locale ?? Locale.de,
      },
    });

    await this.applyAccessGate(tenantId, user.id, profile, opts.bypassGate ?? false);

    const roles = await this.rolesFor(user.id, tenantId);
    // Zugang gesperrt: Konto existiert, hat aber keine aktive Rolle mehr.
    if (roles.length === 0) {
      await this.audit(tenantId, user.id, 'auth.denied', { reason: 'disabled' });
      throw new UnauthorizedException('Dieses Konto ist deaktiviert. Bitte an die Schuladmin.');
    }

    await this.audit(tenantId, user.id, 'auth.login', { provider: profile.provider });

    const token = this.tokens.sign({
      userId: user.id,
      tenantId,
      roles,
      locale: user.locale,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        locale: user.locale,
        theme: user.theme,
        tenantId,
        roles,
      },
    };
  }

  /** Liefert das Profil + aktuelle Rollen für /auth/me. */
  async me(userId: string, tenantId: string): Promise<AuthResult['user'] | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const roles = await this.rolesFor(userId, tenantId);
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      theme: user.theme,
      tenantId,
      roles,
    };
  }

  /** FA-10: Spracheinstellung + Anzeigemodus pro User speichern (überlebt Logout). */
  async updatePreferences(
    userId: string,
    tenantId: string,
    prefs: { locale?: string; theme?: string },
  ): Promise<AuthResult['user'] | null> {
    const data: { locale?: Locale; theme?: string } = {};
    if (prefs.locale && ['de', 'fr', 'it', 'en'].includes(prefs.locale)) {
      data.locale = prefs.locale as Locale;
    }
    if (prefs.theme && ['light', 'dark', 'gray'].includes(prefs.theme)) {
      data.theme = prefs.theme;
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.user.update({ where: { id: userId }, data });
    }
    return this.me(userId, tenantId);
  }

  async logout(tenantId: string, userId: string): Promise<void> {
    await this.audit(tenantId, userId, 'auth.logout', {});
  }

  /**
   * Zugangssteuerung beim Login (Schuladmin-Modell):
   *  1. E-Mail in ADMIN_EMAILS → ADMIN (Bootstrap, immer aktiv).
   *  2. Offene Einladung für die E-Mail → eingeladene Rolle (Einladung eingelöst).
   *  3. Wiederkehrende Person mit bestehender Membership → unverändert lassen
   *     (Rolle/Status liegen in der Hand der Schuladmin – kein Auto-Reaktivieren).
   *  4. Sonst: neue Person → LERNENDE (Standard).
   * `bypassGate` (nur Dev-Login) ehrt stattdessen profile.desiredRole zum Testen.
   */
  private async applyAccessGate(
    tenantId: string,
    userId: string,
    profile: ExternalProfile,
    bypassGate: boolean,
  ): Promise<void> {
    if (bypassGate) {
      await this.grantRole(tenantId, userId, profile.desiredRole ?? Role.LEARNER);
      return;
    }

    const email = profile.email.trim().toLowerCase();

    // 1. ADMIN-Bootstrap per ENV
    if (adminEmails().includes(email)) {
      await this.grantRole(tenantId, userId, Role.ADMIN);
      return;
    }

    // 2. Offene Einladung einlösen
    const invite = await this.prisma.invitation.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (invite && invite.status === InvitationStatus.PENDING) {
      await this.grantRole(tenantId, userId, invite.role);
      await this.prisma.invitation.update({
        where: { id: invite.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
      });
      return;
    }

    // 3. Wiederkehrende Person: bestehende Mitgliedschaften unangetastet lassen.
    const existing = await this.prisma.membership.count({ where: { tenantId, userId } });
    if (existing > 0) return;

    // 4. Neue, nicht eingeladene Person → LERNENDE.
    await this.grantRole(tenantId, userId, Role.LEARNER);
  }

  /** Ob ein Auth-Provider in den Schul-Einstellungen aktiviert ist (Default: ja). */
  private async isProviderEnabled(tenantId: string, provider: AuthProvider): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
    const providers = (settings.authProviders ?? {}) as Record<string, boolean>;
    const key = provider === AuthProvider.MICROSOFT ? 'microsoft' : 'google';
    return providers[key] !== false;
  }

  /** Setzt genau eine aktive Mitgliedschaft mit der gewünschten Rolle (idempotent). */
  private async grantRole(tenantId: string, userId: string, role: Role): Promise<void> {
    await this.prisma.membership.upsert({
      where: { tenantId_userId_role: { tenantId, userId, role } },
      update: { status: MembershipStatus.ACTIVE },
      create: { tenantId, userId, role, status: MembershipStatus.ACTIVE },
    });
  }

  private async rolesFor(userId: string, tenantId: string): Promise<Role[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, tenantId, status: MembershipStatus.ACTIVE },
      select: { role: true },
    });
    return memberships.map((m) => m.role);
  }

  private async audit(
    tenantId: string | null,
    userId: string | null,
    action: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { tenantId, userId, action, detail: detail as object },
      });
    } catch (error) {
      this.logger.warn(`Audit konnte nicht geschrieben werden: ${String(error)}`);
    }
  }
}
