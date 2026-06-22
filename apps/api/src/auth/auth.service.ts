import { Injectable, Logger } from '@nestjs/common';
import { AuthProvider, Locale, MembershipStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';

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
  async loginWithProfile(profile: ExternalProfile): Promise<AuthResult> {
    const tenantId = await this.ensureDefaultTenant();

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

    const role = profile.desiredRole ?? Role.LEARNER;
    await this.prisma.membership.upsert({
      where: { tenantId_userId_role: { tenantId, userId: user.id, role } },
      update: { status: MembershipStatus.ACTIVE },
      create: { tenantId, userId: user.id, role, status: MembershipStatus.ACTIVE },
    });

    const roles = await this.rolesFor(user.id, tenantId);

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
