import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './decorators';
import { TokenService } from './token.service';
import { requestContextStore, type RequestContext } from '../common/request-context';

/**
 * Globaler Guard: validiert das Bearer-JWT (oder Cookie), baut den
 * RequestContext auf und macht ihn via AsyncLocalStorage verfügbar.
 * Mit @Public() markierte Routen werden durchgelassen.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('Kein Authentifizierungs-Token vorhanden.');
    }

    const payload = this.tokens.verify(token);
    if (!payload) {
      throw new UnauthorizedException('Token ungueltig oder abgelaufen.');
    }

    const ctx: RequestContext = {
      userId: payload.sub,
      tenantId: payload.tid,
      roles: payload.roles,
      locale: payload.locale,
      ip: req.ip ?? req.socket?.remoteAddress ?? undefined,
      userAgent: req.headers['user-agent']?.slice(0, 400),
    };
    // Für Param-Decorator @CurrentUser und Controller verfügbar machen
    (req as Request & { user?: RequestContext }).user = ctx;
    // Für AsyncLocalStorage-basiertes Tenant-Scoping: den per Middleware
    // eröffneten Store mutieren (überlebt asynchrone Pipes), sonst neu setzen.
    const store = requestContextStore.getStore();
    if (store) Object.assign(store, ctx);
    else requestContextStore.enterWith(ctx);
    return true;
  }

  private extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }
    const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.['kh_token'];
    return cookie ?? null;
  }
}
