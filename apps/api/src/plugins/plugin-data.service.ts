import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DataStore } from '@kompetenzhub/plugin-sdk';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Implementiert den gescopten KV/Doc-Store (§8 Stufe 1). pluginId + tenantId werden
 * IMMER vom Kern gesetzt (aus dem ServerContext), nie aus Plugin-Eingaben – so kann
 * ein Plugin weder aus seinem Tenant noch aus seinem Namespace ausbrechen.
 */
@Injectable()
export class PluginDataService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liefert einen auf (pluginId, tenantId) festgenagelten DataStore. */
  scoped(pluginId: string, tenantId: string): DataStore {
    return {
      get: async <T = unknown>(collection: string, key: string): Promise<T | null> => {
        const row = await this.prisma.pluginRecord.findUnique({
          where: { pluginId_tenantId_collection_key: { pluginId, tenantId, collection, key } },
        });
        return row ? (row.data as T) : null;
      },
      list: async <T = unknown>(collection: string): Promise<Array<{ key: string; data: T }>> => {
        const rows = await this.prisma.pluginRecord.findMany({
          where: { pluginId, tenantId, collection },
          orderBy: { createdAt: 'asc' },
        });
        return rows.map((r) => ({ key: r.key, data: r.data as T }));
      },
      put: async <T = unknown>(collection: string, key: string, data: T): Promise<void> => {
        const value = data as Prisma.InputJsonValue;
        await this.prisma.pluginRecord.upsert({
          where: { pluginId_tenantId_collection_key: { pluginId, tenantId, collection, key } },
          create: { pluginId, tenantId, collection, key, data: value },
          update: { data: value },
        });
      },
      delete: async (collection: string, key: string): Promise<void> => {
        await this.prisma.pluginRecord.deleteMany({
          where: { pluginId, tenantId, collection, key },
        });
      },
    };
  }

  /** Löscht alle Daten eines Plugins (optional auf einen Tenant beschränkt). Für Uninstall. */
  async purge(pluginId: string, tenantId?: string): Promise<number> {
    const res = await this.prisma.pluginRecord.deleteMany({
      where: { pluginId, ...(tenantId ? { tenantId } : {}) },
    });
    return res.count;
  }

  /** Anzahl verbleibender Datensätze – für die Cleanup-Verifikation (§12). */
  async count(pluginId: string, tenantId?: string): Promise<number> {
    return this.prisma.pluginRecord.count({
      where: { pluginId, ...(tenantId ? { tenantId } : {}) },
    });
  }

  /** Exportiert alle Datensätze (für cleanup-Policy "archive"). */
  async exportAll(pluginId: string, tenantId?: string): Promise<unknown[]> {
    return this.prisma.pluginRecord.findMany({
      where: { pluginId, ...(tenantId ? { tenantId } : {}) },
    });
  }
}
