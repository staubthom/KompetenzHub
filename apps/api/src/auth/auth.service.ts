import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  AuthProvider,
  InvitationStatus,
  Locale,
  MailTemplateType,
  MembershipStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { MailService } from '../mail/mail.service';
import { MailTemplateService } from '../mail/mail-template.service';
import { localeKey, webUrl } from '../mail/mail.templates';

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
    notifyDigest: boolean;
    tenantId: string;
    roles: Role[];
  };
}

export interface PublicLoginOptions {
  authProviders: {
    microsoft: boolean;
    google: boolean;
    github: boolean;
  };
}

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';
const MICROSOFT_CLIENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasConfiguredValue(value: string | undefined): boolean {
  const normalized = value?.trim();
  if (!normalized) return false;
  return !['noch-zu-setzen', 'noch-zu-setze', 'todo', 'changeme'].includes(
    normalized.toLowerCase(),
  );
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly templates: MailTemplateService,
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
    opts: { bypassGate?: boolean; ip?: string; userAgent?: string } = {},
  ): Promise<AuthResult> {
    const tenantId = await this.ensureDefaultTenant();

    // Auth-Provider, die die Schuladmin deaktiviert hat, werden abgewiesen
    // (Dev-Login umgeht dies).
    if (!opts.bypassGate && !(await this.isProviderEnabled(tenantId, profile.provider))) {
      await this.audit(tenantId, null, 'auth.denied', { provider: profile.provider });
      throw new UnauthorizedException('Dieser Anmelde-Anbieter ist deaktiviert.');
    }

    // Neue Konten erben die Default-Sprache der Schule (Schuladmin-Einstellung).
    const fallbackLocale = profile.locale ?? (await this.tenantDefaultLocale(tenantId));
    const user = await this.prisma.user.upsert({
      where: {
        authProvider_externalId: {
          authProvider: profile.provider,
          externalId: profile.externalId,
        },
      },
      update: {
        // displayName wird bewusst NICHT überschrieben: der/die Nutzer:in kann den
        // Anzeigenamen selbst in den Einstellungen pflegen (sonst würde er bei jedem
        // Login durch den Namen des Identity-Providers zurückgesetzt).
        email: profile.email,
        avatarUrl: profile.avatarUrl,
      },
      create: {
        email: profile.email,
        displayName: profile.displayName,
        authProvider: profile.provider,
        externalId: profile.externalId,
        avatarUrl: profile.avatarUrl,
        locale: fallbackLocale,
      },
    });

    await this.applyAccessGate(tenantId, user.id, profile, opts.bypassGate ?? false);

    const roles = await this.rolesFor(user.id, tenantId);
    // Zugang gesperrt: Konto existiert, hat aber keine aktive Rolle mehr.
    if (roles.length === 0) {
      await this.audit(tenantId, user.id, 'auth.denied', { reason: 'disabled' });
      throw new UnauthorizedException('Dieses Konto ist deaktiviert. Bitte an die Schuladmin.');
    }

    // Anmeldung von neuem Gerät/IP erkennen (vor dem Schreiben des neuen
    // Login-Eintrags, damit dieser nicht mitzählt).
    const isNewDevice = await this.isNewDevice(user.id, opts.ip);
    await this.audit(tenantId, user.id, 'auth.login', { provider: profile.provider }, opts);
    if (isNewDevice) {
      await this.sendSecurityAlert(tenantId, user, opts);
    }

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
        notifyDigest: user.notifyDigest,
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
      notifyDigest: user.notifyDigest,
      tenantId,
      roles,
    };
  }

  /** FA-10: Spracheinstellung + Anzeigemodus pro User speichern (überlebt Logout). */
  async updatePreferences(
    userId: string,
    tenantId: string,
    prefs: { locale?: string; theme?: string; displayName?: string; notifyDigest?: boolean },
  ): Promise<AuthResult['user'] | null> {
    const data: { locale?: Locale; theme?: string; displayName?: string; notifyDigest?: boolean } =
      {};
    if (prefs.locale && ['de', 'fr', 'it', 'en'].includes(prefs.locale)) {
      data.locale = prefs.locale as Locale;
    }
    if (prefs.theme && ['light', 'dark', 'gray'].includes(prefs.theme)) {
      data.theme = prefs.theme;
    }
    if (typeof prefs.notifyDigest === 'boolean') {
      data.notifyDigest = prefs.notifyDigest;
    }
    // Anzeigename selbst pflegen (FA): nicht-leer, getrimmt, max. 120 Zeichen.
    if (prefs.displayName !== undefined) {
      const name = prefs.displayName.trim().slice(0, 120);
      if (name) data.displayName = name;
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.user.update({ where: { id: userId }, data });
      // Den denormalisierten Anzeigenamen-Schnappschuss der Einschreibungen mitziehen,
      // damit Lehrpersonen (Heatmap, Mitgliederliste, Bewerten) überall den aktuellen
      // Namen sehen – auch in Stellen, die den Schnappschuss direkt lesen/exportieren.
      if (data.displayName) {
        await this.prisma.enrollment.updateMany({
          where: { userId },
          data: { displayName: data.displayName },
        });
      }
    }
    return this.me(userId, tenantId);
  }

  async logout(tenantId: string, userId: string): Promise<void> {
    await this.audit(tenantId, userId, 'auth.logout', {});
  }

  /** Oeffentliche Login-Optionen fuer die Login-Seite. */
  async loginOptions(): Promise<PublicLoginOptions> {
    const tenantId = await this.ensureDefaultTenant();
    return {
      authProviders: {
        microsoft:
          this.isProviderConfigured(AuthProvider.MICROSOFT) &&
          (await this.isProviderEnabled(tenantId, AuthProvider.MICROSOFT)),
        google:
          this.isProviderConfigured(AuthProvider.GOOGLE) &&
          (await this.isProviderEnabled(tenantId, AuthProvider.GOOGLE)),
        github:
          this.isProviderConfigured(AuthProvider.GITHUB) &&
          (await this.isProviderEnabled(tenantId, AuthProvider.GITHUB)),
      },
    };
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
      // Dev-Login ist autoritativ: genau die gewählte Rolle (andere entfernen),
      // damit Tests deterministisch sind.
      const role = profile.desiredRole ?? Role.LEARNER;
      await this.prisma.membership.deleteMany({ where: { tenantId, userId, role: { not: role } } });
      await this.grantRole(tenantId, userId, role);
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

  /** Default-Sprache der Schule (Schuladmin-Einstellung; Fallback de). */
  private async tenantDefaultLocale(tenantId: string): Promise<Locale> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
    const loc = settings.defaultLocale;
    return typeof loc === 'string' && ['de', 'fr', 'it', 'en'].includes(loc)
      ? (loc as Locale)
      : Locale.de;
  }

  /** Ob ein Auth-Provider in den Schul-Einstellungen aktiviert ist (Default: ja). */
  private async isProviderEnabled(tenantId: string, provider: AuthProvider): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
    const providers = (settings.authProviders ?? {}) as Record<string, boolean>;
    const keyByProvider: Record<AuthProvider, string> = {
      [AuthProvider.MICROSOFT]: 'microsoft',
      [AuthProvider.GOOGLE]: 'google',
      [AuthProvider.GITHUB]: 'github',
    };
    const key = keyByProvider[provider];
    return providers[key] !== false;
  }

  private isProviderConfigured(provider: AuthProvider): boolean {
    switch (provider) {
      case AuthProvider.MICROSOFT:
        return (
          hasConfiguredValue(process.env.AUTH_MICROSOFT_CLIENT_SECRET) &&
          MICROSOFT_CLIENT_ID_RE.test(process.env.AUTH_MICROSOFT_CLIENT_ID?.trim() ?? '')
        );
      case AuthProvider.GOOGLE:
        return (
          hasConfiguredValue(process.env.AUTH_GOOGLE_CLIENT_ID) &&
          hasConfiguredValue(process.env.AUTH_GOOGLE_CLIENT_SECRET)
        );
      case AuthProvider.GITHUB:
        return (
          hasConfiguredValue(process.env.AUTH_GITHUB_CLIENT_ID) &&
          hasConfiguredValue(process.env.AUTH_GITHUB_CLIENT_SECRET)
        );
      default:
        return false;
    }
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
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action,
          detail: detail as object,
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(`Audit konnte nicht geschrieben werden: ${String(error)}`);
    }
  }

  /**
   * True, wenn von dieser IP noch nie ein Login erfolgte – aber nur, wenn es
   * überhaupt schon frühere Logins gibt (der allererste Login ist kein „neues
   * Gerät"). Ohne IP-Information wird keine Warnung erzeugt.
   */
  private async isNewDevice(userId: string, ip?: string): Promise<boolean> {
    if (!ip) return false;
    const priorTotal = await this.prisma.auditLog.count({
      where: { userId, action: 'auth.login' },
    });
    if (priorTotal === 0) return false; // erster Login überhaupt
    const priorSameIp = await this.prisma.auditLog.count({
      where: { userId, action: 'auth.login', ip },
    });
    return priorSameIp === 0;
  }

  /** Sicherheits-Hinweis bei Anmeldung von neuem Gerät (Versand ist No-op-fähig). */
  private async sendSecurityAlert(
    tenantId: string,
    user: { email: string; displayName: string; locale: Locale },
    meta: { ip?: string; userAgent?: string },
  ): Promise<void> {
    const k = localeKey(user.locale);
    const time = new Date().toLocaleString(k === 'en' ? 'en-GB' : `${k}-CH`, {
      timeZone: 'Europe/Zurich',
    });
    const mail = await this.templates.compose(
      tenantId,
      MailTemplateType.SECURITY_ALERT,
      user.locale,
      {
        scalars: {
          name: user.displayName,
          ip: meta.ip ?? '–',
          device: meta.userAgent ?? '–',
          time,
        },
        ctaHref: `${webUrl()}/lernende/einstellungen`,
      },
    );
    await this.mail.send({ to: user.email, ...mail });
  }
}
