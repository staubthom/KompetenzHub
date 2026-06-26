import { Injectable } from '@nestjs/common';
import type { ApiRouteContribution, PluginRole } from '@kompetenzhub/plugin-contracts';
import { PluginActivationService } from './plugin-activation.service';
import { PluginRegistryService } from './plugin-registry.service';

/**
 * Kapselt die Frage „darf dieser User diese Plugin-Route/dieses Capability nutzen?"
 * (§6). Pilot leitet Capabilities aus Kernrolle + Manifest ab; später additiv um
 * per-User-Grants erweiterbar, ohne die Aufrufer zu ändern.
 */
@Injectable()
export class PluginPermissionResolver {
  constructor(
    private readonly registry: PluginRegistryService,
    private readonly activation: PluginActivationService,
  ) {}

  /** Darf der User (mit seinen Kernrollen) die konkrete Route im Tenant aufrufen? */
  async canAccessRoute(
    roles: string[],
    pluginId: string,
    tenantId: string,
    route: ApiRouteContribution,
  ): Promise<boolean> {
    const manifest = this.registry.get(pluginId);
    if (!manifest) return false;
    if (!manifest.capabilities.includes(route.capability)) return false;
    if (!(await this.activation.isEnabled(pluginId, tenantId))) return false;
    return route.roles.some((r) => roles.includes(r));
  }

  /** Generische Capability-Prüfung (für künftigen @RequireCapability-Guard). */
  async allows(
    roles: string[],
    pluginId: string,
    tenantId: string,
    capability: string,
  ): Promise<boolean> {
    const manifest = this.registry.get(pluginId);
    if (!manifest) return false;
    if (!manifest.capabilities.includes(capability as ApiRouteContribution['capability'])) {
      return false;
    }
    if (!(await this.activation.isEnabled(pluginId, tenantId))) return false;
    const routes = manifest.contributions.apiRoutes ?? [];
    return routes.some(
      (r) =>
        r.capability === capability && r.roles.some((role: PluginRole) => roles.includes(role)),
    );
  }
}
