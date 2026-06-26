import { Injectable } from '@nestjs/common';
import type { PluginTenantActivation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Liest den Aktivierungsstatus eines Plugins pro Tenant – mit kleinem In-Memory-Cache,
 * da dies im Request-Pfad (Dispatcher) heiss ist. Lifecycle-Aktionen invalidieren gezielt.
 */
@Injectable()
export class PluginActivationService {
  private readonly cache = new Map<string, PluginTenantActivation | null>();

  constructor(private readonly prisma: PrismaService) {}

  private cacheKey(pluginId: string, tenantId: string): string {
    return `${pluginId}|${tenantId}`;
  }

  async get(pluginId: string, tenantId: string): Promise<PluginTenantActivation | null> {
    const key = this.cacheKey(pluginId, tenantId);
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const row = await this.prisma.pluginTenantActivation.findUnique({
      where: { pluginId_tenantId: { pluginId, tenantId } },
    });
    this.cache.set(key, row);
    return row;
  }

  async isEnabled(pluginId: string, tenantId: string): Promise<boolean> {
    const row = await this.get(pluginId, tenantId);
    return !!row && row.enabled && row.status === 'ENABLED';
  }

  invalidate(pluginId: string, tenantId: string): void {
    this.cache.delete(this.cacheKey(pluginId, tenantId));
  }
}
