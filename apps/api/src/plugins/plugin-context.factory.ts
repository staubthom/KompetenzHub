import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FetchLike, PluginLogger, ServerContext } from '@kompetenzhub/plugin-sdk';
import type { PluginRole } from '@kompetenzhub/plugin-contracts';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginDataService } from './plugin-data.service';
import { PluginSecretService } from './plugin-secret.service';
import { PluginStorageService } from './plugin-storage.service';
import { PluginActivationService } from './plugin-activation.service';
import { PluginCoreService } from './plugin-core.service';

/**
 * Baut den gescopten ServerContext, den ein Plugin-Handler erhält (§7.2). Alle
 * Fähigkeiten sind auf pluginId + tenantId festgenagelt; Netzwerk nur zu deklarierten
 * outboundHosts; Audit/Logger schreiben mit pluginId.
 */
@Injectable()
export class PluginContextFactory {
  private readonly logger = new Logger('Plugin');

  constructor(
    private readonly registry: PluginRegistryService,
    private readonly data: PluginDataService,
    private readonly secrets: PluginSecretService,
    private readonly storage: PluginStorageService,
    private readonly prisma: PrismaService,
    private readonly activation: PluginActivationService,
    private readonly coreFacade: PluginCoreService,
  ) {}

  /**
   * Baut den ServerContext. Async, weil die tenant-spezifische Plugin-Konfiguration
   * (vom Schuladmin gesetzt) geladen wird; sie steht dem Plugin als `ctx.config` zur
   * Verfügung – read-only.
   */
  async build(pluginId: string, user: RequestContext): Promise<ServerContext> {
    const tenantId = user.tenantId;
    const activation = await this.activation.get(pluginId, tenantId);
    const config = (activation?.config ?? {}) as Record<string, unknown>;
    return {
      pluginId,
      tenant: { id: tenantId },
      user: { id: user.userId, roles: user.roles as unknown as PluginRole[], locale: user.locale },
      data: this.data.scoped(pluginId, tenantId),
      secrets: this.secrets.scoped(pluginId, tenantId),
      storage: this.storage.scoped(pluginId, tenantId),
      http: this.makeHttp(pluginId),
      logger: this.makeLogger(pluginId),
      audit: (event, detail) => this.audit(pluginId, tenantId, user.userId, event, detail),
      config,
      core: this.coreFacade.scoped(user, pluginId),
    };
  }

  /** fetch, begrenzt auf die im Manifest deklarierten outboundHosts. */
  private makeHttp(pluginId: string): FetchLike {
    const manifest = this.registry.get(pluginId);
    const hosts = new Set((manifest?.integrations ?? []).flatMap((i) => i.outboundHosts));
    return async (input, init) => {
      const url = new URL(input);
      if (!hosts.has(url.hostname)) {
        throw new ForbiddenException(
          `Outbound zu "${url.hostname}" ist im Manifest nicht deklariert.`,
        );
      }
      return fetch(input, init);
    };
  }

  private makeLogger(pluginId: string): PluginLogger {
    const prefix = `[plugin:${pluginId}]`;
    return {
      info: (m, d) => this.logger.log(`${prefix} ${m}${d ? ` ${JSON.stringify(d)}` : ''}`),
      warn: (m, d) => this.logger.warn(`${prefix} ${m}${d ? ` ${JSON.stringify(d)}` : ''}`),
      error: (m, d) => this.logger.error(`${prefix} ${m}${d ? ` ${JSON.stringify(d)}` : ''}`),
    };
  }

  private async audit(
    pluginId: string,
    tenantId: string,
    userId: string,
    event: string,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: `plugin.${pluginId}.${event}`,
          detail: (detail ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Audit-Fehler nicht fatal
    }
  }
}
