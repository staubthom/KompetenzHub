import { Injectable } from '@nestjs/common';
import type { SecretStore } from '@kompetenzhub/plugin-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../ai/crypto.util';

/**
 * Tenant-/global-gescopte Plugin-Secrets. Werte werden mit AES-256-GCM verschlüsselt
 * gespeichert (Wiederverwendung von ai/crypto.util) und nie im Klartext zurückgegeben –
 * ausser dem Plugin-Server-Code zur Laufzeit über SecretStore.get().
 */
@Injectable()
export class PluginSecretService {
  constructor(private readonly prisma: PrismaService) {}

  /** SecretStore für den ServerContext: bevorzugt tenant-spezifische vor globalen Secrets. */
  scoped(pluginId: string, tenantId: string): SecretStore {
    return {
      get: async (key: string): Promise<string | null> => {
        const row = await this.prisma.pluginSecret.findFirst({
          where: { pluginId, key, OR: [{ tenantId }, { tenantId: null }] },
          orderBy: { tenantId: 'desc' }, // non-null (tenant) vor null (global)
        });
        return row ? decryptSecret(row.valueEnc) : null;
      },
    };
  }

  /** Setzt/aktualisiert ein Secret (tenantId null = global). */
  async set(pluginId: string, tenantId: string | null, key: string, value: string): Promise<void> {
    const valueEnc = encryptSecret(value);
    const existing = await this.prisma.pluginSecret.findFirst({
      where: { pluginId, tenantId, key },
    });
    if (existing) {
      await this.prisma.pluginSecret.update({ where: { id: existing.id }, data: { valueEnc } });
    } else {
      await this.prisma.pluginSecret.create({ data: { pluginId, tenantId, key, valueEnc } });
    }
  }

  /** Löscht alle Secrets eines Plugins (optional auf einen Tenant beschränkt). Für Uninstall. */
  async deleteAll(pluginId: string, tenantId?: string): Promise<number> {
    const res = await this.prisma.pluginSecret.deleteMany({
      where: { pluginId, ...(tenantId ? { tenantId } : {}) },
    });
    return res.count;
  }

  /** Anzahl verbleibender Secrets – für die Cleanup-Verifikation (§12). */
  async count(pluginId: string, tenantId?: string): Promise<number> {
    return this.prisma.pluginSecret.count({
      where: { pluginId, ...(tenantId ? { tenantId } : {}) },
    });
  }
}
