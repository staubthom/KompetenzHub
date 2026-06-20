import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { RequestContext } from '../common/request-context';

/** Markiert eine Route als öffentlich (kein JWT erforderlich). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Erforderliche Rollen für eine Route (mind. eine muss zutreffen). */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/** Injiziert den aktuellen Auth-Kontext (aus dem JWT) in einen Handler-Parameter. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as RequestContext | undefined;
  },
);
