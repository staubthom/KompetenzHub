import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { AuthProvider, Locale, Role } from '@prisma/client';
import { Request, Response } from 'express';
import { AuthService, ExternalProfile } from './auth.service';
import { TokenService } from './token.service';
import { CurrentUser, Public } from './decorators';
import type { RequestContext } from '../common/request-context';

const DEV_LOGIN_ENABLED = (process.env.DEV_LOGIN_ENABLED ?? 'true') === 'true';
const COOKIE_NAME = 'kh_token';

interface DevLoginDto {
  email?: string;
  displayName?: string;
  role?: Role;
}

interface ExchangeDto {
  provider?: AuthProvider;
  externalId?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  locale?: Locale;
  desiredRole?: Role;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Dev-Login: erzeugt/aktualisiert einen Test-User und stellt ein JWT aus.
   * Nur aktiv, wenn DEV_LOGIN_ENABLED=true (Standard in Entwicklung).
   */
  @Public()
  @Post('dev-login')
  async devLogin(
    @Body() dto: DevLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    if (!DEV_LOGIN_ENABLED) {
      throw new BadRequestException('Dev-Login ist deaktiviert.');
    }
    const email = dto.email?.trim() || 'dev.lehrperson@example.com';
    const role = dto.role ?? Role.TEACHER;
    const profile: ExternalProfile = {
      provider: AuthProvider.MICROSOFT,
      externalId: `dev:${email}`,
      email,
      displayName: dto.displayName?.trim() || email.split('@')[0],
      desiredRole: role,
    };
    // Dev-Login umgeht das Zugangs-Gate, damit Entwickler:innen jede Rolle testen können.
    const result = await this.auth.loginWithProfile(profile, { bypassGate: true });
    this.setCookie(res, result.token);
    return result;
  }

  /**
   * Token-Exchange: das Frontend (NextAuth) übergibt das verifizierte
   * IdP-Profil und erhält ein API-JWT (BFF-Pattern).
   * Schutz: nur mit gültigem AUTH_EXCHANGE_SECRET im Header.
   */
  @Public()
  @Post('exchange')
  async exchange(
    @Body() dto: ExchangeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const secret = process.env.AUTH_EXCHANGE_SECRET;
    if (secret && req.headers['x-auth-exchange'] !== secret) {
      throw new BadRequestException('Ungueltiges Exchange-Secret.');
    }
    if (!dto.provider || !dto.externalId || !dto.email || !dto.displayName) {
      throw new BadRequestException('provider, externalId, email, displayName erforderlich.');
    }
    const result = await this.auth.loginWithProfile({
      provider: dto.provider,
      externalId: dto.externalId,
      email: dto.email,
      displayName: dto.displayName,
      avatarUrl: dto.avatarUrl,
      locale: dto.locale,
      desiredRole: dto.desiredRole,
    });
    this.setCookie(res, result.token);
    return result;
  }

  /** Profil + Rollen des eingeloggten Nutzers. */
  @Get('me')
  async me(@CurrentUser() user: RequestContext): Promise<unknown> {
    const profile = await this.auth.me(user.userId, user.tenantId);
    if (!profile) throw new NotFoundException('Benutzer nicht gefunden.');
    return profile;
  }

  /** FA-10: Sprache/Anzeigemodus des eingeloggten Nutzers speichern. */
  @Patch('me')
  async updateMe(
    @Body() dto: { locale?: string; theme?: string },
    @CurrentUser() user: RequestContext,
  ): Promise<unknown> {
    const profile = await this.auth.updatePreferences(user.userId, user.tenantId, dto ?? {});
    if (!profile) throw new NotFoundException('Benutzer nicht gefunden.');
    return profile;
  }

  /** Beendet die Session (Cookie löschen, Audit). */
  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentUser() user: RequestContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    await this.auth.logout(user.tenantId, user.userId);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  private setCookie(res: Response, token: string): void {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: Number(process.env.JWT_TTL_SECONDS ?? 15 * 60) * 1000,
    });
  }
}
