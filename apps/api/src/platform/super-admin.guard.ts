import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/request-context';

/** E-Mail-Adressen mit plattformweiten (tenant-übergreifenden) Rechten. */
export function superAdminEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? '')
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Schützt die Plattform-Verwaltung (Tenant-CRUD). Super-Admins sind NICHT über
 * eine Tenant-Rolle definiert, sondern über SUPERADMIN_EMAILS – sie agieren
 * mandantenübergreifend. Die E-Mail wird frisch aus der DB gelesen (das JWT
 * trägt sie nicht).
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: RequestContext }>();
    const user = req.user;
    if (!user) throw new UnauthorizedException('Authentifizierung erforderlich.');

    const allow = superAdminEmails();
    if (allow.length === 0) {
      throw new ForbiddenException('Plattform-Verwaltung ist nicht konfiguriert.');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true },
    });
    const email = dbUser?.email.trim().toLowerCase();
    if (!email || !allow.includes(email)) {
      throw new ForbiddenException('Nur für Plattform-Administrator:innen.');
    }
    return true;
  }
}
