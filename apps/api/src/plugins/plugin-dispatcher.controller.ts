import { All, Controller, Get, NotFoundException, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginActivationService } from './plugin-activation.service';
import { PluginPermissionResolver } from './plugin-permission-resolver.service';
import { PluginContextFactory } from './plugin-context.factory';
import { matchRoute } from './route-match';

/**
 * Generischer Plugin-Dispatcher. Alle Plugin-Endpunkte liegen unter
 * /api/v1/plugins/:pluginId/… Die konkrete Route stammt aus dem Manifest; Zugriff
 * wird über Aktivierung (Tenant) + Kernrolle + Capability geprüft (§6/§7.1).
 *
 * Hinweis: /plugins/contributions kann nicht mit :pluginId/* kollidieren, da der
 * Wildcard ein Folge-Segment verlangt.
 */
@Controller('plugins')
export class PluginDispatcherController {
  constructor(
    private readonly registry: PluginRegistryService,
    private readonly activation: PluginActivationService,
    private readonly resolver: PluginPermissionResolver,
    private readonly contextFactory: PluginContextFactory,
  ) {}

  /** UI-Beiträge der für diesen User (Tenant + Rolle) aktiven Plugins (§10.2). */
  @Get('contributions')
  async contributions(@CurrentUser() user: RequestContext) {
    const roles = user.roles as string[];
    const inRole = (allowed: string[]): boolean => allowed.some((r) => roles.includes(r));
    const out: Array<{
      pluginId: string;
      nav: unknown[];
      pages: unknown[];
      widgets: unknown[];
    }> = [];

    for (const manifest of this.registry.getAll()) {
      if (!(await this.activation.isEnabled(manifest.pluginId, user.tenantId))) continue;
      const c = manifest.contributions;
      out.push({
        pluginId: manifest.pluginId,
        nav: (c.nav ?? []).filter((n) => inRole(n.roles)),
        pages: (c.pages ?? []).filter((p) => inRole(p.roles)),
        widgets: (c.widgets ?? []).filter((w) => inRole(w.roles)),
      });
    }
    return { plugins: out };
  }

  /** Leitet einen Plugin-Request an den deklarierten Handler weiter. */
  @All(':pluginId/*')
  async dispatch(
    @Param('pluginId') pluginId: string,
    @Req() req: Request,
    @CurrentUser() user: RequestContext,
  ): Promise<unknown> {
    const manifest = this.registry.get(pluginId);
    if (!manifest) throw new NotFoundException('Plugin nicht gefunden.');

    const splat = (req.params as Record<string, string>)['0'] ?? '';
    const subPath = `/${splat}`;
    const match = matchRoute(manifest.contributions.apiRoutes ?? [], req.method, subPath);
    if (!match) throw new NotFoundException('Plugin-Route nicht gefunden.');

    // Aktivierung (Tenant) + Capability-Deklaration + Kernrolle.
    const allowed = await this.resolver.canAccessRoute(
      user.roles as string[],
      pluginId,
      user.tenantId,
      match.route,
    );
    // 404 (nicht 403), damit deaktivierte Plugins nicht enumerierbar sind.
    if (!allowed) throw new NotFoundException('Plugin-Route nicht verfügbar.');

    const server = this.registry.loadServer(pluginId);
    const handler = server.routes[`${match.route.method} ${match.route.path}`];
    if (!handler) throw new NotFoundException('Handler nicht implementiert.');

    const ctx = this.contextFactory.build(pluginId, user);
    return handler(ctx, {
      params: match.params,
      query: req.query as Record<string, string | string[] | undefined>,
      body: req.body,
    });
  }
}
