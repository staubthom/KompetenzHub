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
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { AuthProvider, Locale, Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Request, Response } from 'express';
import { AuthService, ExternalProfile, PublicLoginOptions } from './auth.service';
import { TokenService } from './token.service';
import { CurrentUser, Public } from './decorators';
import type { RequestContext } from '../common/request-context';

const COOKIE_NAME = 'kh_token';
const ROOT_ENV_PATH = join(__dirname, '..', '..', '..', '..', '.env');

function refreshRootEnv(): void {
  loadEnv({ path: ROOT_ENV_PATH, override: true });
}

function isDevLoginEnabled(): boolean {
  refreshRootEnv();
  return (process.env.DEV_LOGIN_ENABLED ?? 'true') === 'true';
}

function isAdminLoginVisible(): boolean {
  refreshRootEnv();
  return (process.env.SHOW_ADMIN_LOGIN ?? 'true') === 'true';
}

// Strengeres Rate-Limit für Anmelde-Endpunkte (Brute-Force-Schutz). Pro IP,
// daher grosszügig genug für eine ganze Klasse hinter einer Schul-IP; tunebar.
const AUTH_THROTTLE = {
  default: { ttl: 60_000, limit: Number(process.env.THROTTLE_AUTH_LIMIT ?? 60) },
};

class DevLoginDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

class ExchangeDto {
  @IsEnum(AuthProvider)
  provider!: AuthProvider;

  @IsString()
  @MaxLength(255)
  externalId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(160)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  @IsOptional()
  @IsEnum(Role)
  desiredRole?: Role;
}

class UpdateMeDto {
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  theme?: string;
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
  @Get('options')
  async options(): Promise<
    PublicLoginOptions & { devLoginEnabled: boolean; showAdminLogin: boolean }
  > {
    refreshRootEnv();
    const options = await this.auth.loginOptions();
    return {
      ...options,
      devLoginEnabled: isDevLoginEnabled(),
      showAdminLogin: isAdminLoginVisible(),
    };
  }

  /**
   * Dev-Login: erzeugt/aktualisiert einen Test-User und stellt ein JWT aus.
   * Nur aktiv, wenn DEV_LOGIN_ENABLED=true (Standard in Entwicklung).
   */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('dev-login')
  async devLogin(
    @Body() dto: DevLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    if (!isDevLoginEnabled()) {
      throw new BadRequestException('Dev-Login ist deaktiviert.');
    }
    const email = dto.email?.trim() || 'dev.lehrperson@example.com';
    const role = dto.role ?? Role.TEACHER;
    if (role === Role.ADMIN && !isAdminLoginVisible()) {
      throw new BadRequestException('Admin-Login ist deaktiviert.');
    }
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
  @Throttle(AUTH_THROTTLE)
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
  async updateMe(@Body() dto: UpdateMeDto, @CurrentUser() user: RequestContext): Promise<unknown> {
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
