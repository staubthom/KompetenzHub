import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { ROLES_KEY } from './decorators';
import type { RequestContext } from '../common/request-context';

/**
 * Prüft, ob der eingeloggte Nutzer mind. eine der per @Roles() geforderten
 * Rollen im aktiven Tenant besitzt. 401 wenn nicht eingeloggt, 403 bei
 * fehlender Rolle (RFC-7807 via ProblemExceptionFilter).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: RequestContext }>();
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException('Authentifizierung erforderlich.');
    }

    const allowed = user.roles.some((r) => required.includes(r));
    if (!allowed) {
      throw new ForbiddenException(
        `Fehlende Berechtigung. Erforderlich: ${required.join(' oder ')}.`,
      );
    }
    return true;
  }
}
