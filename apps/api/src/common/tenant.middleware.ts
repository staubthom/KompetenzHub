import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { requestContextStore } from './request-context';
import { defaultTenantSlug, tenantSlugFromRequest } from './tenant-resolution';

/**
 * Löst pro Request den aktiven Tenant aus der Subdomain (bzw. X-Tenant-Slug) auf
 * und legt ihn in den AsyncLocalStorage-Kontext. Läuft nach dem Store-Opener aus
 * main.ts und vor den Guards, damit sowohl der Login (der noch kein JWT hat) als
 * auch das Tenant-Scoping den Mandanten kennen.
 *
 * Unbekannte Subdomain → 404. Der Default-Slug darf hingegen fehlen (Erstlauf mit
 * leerer DB): dann bleibt der Kontext leer und der Auth-Service legt via
 * ensureDefaultTenant() den Default-Mandanten an.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  // Kurzer Slug→id-Cache, damit nicht jede Anfrage die DB trifft.
  private static readonly cache = new Map<string, { id: string; expires: number }>();
  private static readonly TTL_MS = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    // Health muss ohne gültige Subdomain erreichbar bleiben (interne Checks).
    if (req.path === '/health' || req.path.endsWith('/health')) {
      next();
      return;
    }

    const slug = tenantSlugFromRequest(req);
    const tenantId = await this.resolveTenantId(slug);

    if (tenantId) {
      const store = requestContextStore.getStore();
      if (store) {
        store.tenantId = tenantId;
        store.resolvedTenantId = tenantId;
      }
    } else if (slug !== defaultTenantSlug()) {
      // Nur der Default-Slug darf ohne Treffer durchgehen (Bootstrap leere DB).
      throw new NotFoundException(`Unbekannte Schule: "${slug}".`);
    }

    next();
  }

  private async resolveTenantId(slug: string): Promise<string | undefined> {
    const now = Date.now();
    const hit = TenantMiddleware.cache.get(slug);
    if (hit && hit.expires > now) return hit.id;

    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, active: true },
      select: { id: true },
    });
    if (tenant) {
      TenantMiddleware.cache.set(slug, { id: tenant.id, expires: now + TenantMiddleware.TTL_MS });
      return tenant.id;
    }
    return undefined;
  }

  /** Cache-Eintrag invalidieren (nach Tenant-Anlage/-Änderung/-Deaktivierung). */
  static invalidate(slug?: string): void {
    if (slug) TenantMiddleware.cache.delete(slug);
    else TenantMiddleware.cache.clear();
  }
}
