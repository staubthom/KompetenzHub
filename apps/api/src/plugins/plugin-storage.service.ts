import { ForbiddenException, Injectable } from '@nestjs/common';
import type { ScopedStorage } from '@kompetenzhub/plugin-sdk';
import { S3Service } from '../storage/s3.service';

/**
 * Dateispeicher für Plugins, hart auf den Präfix plugins/<pluginId>/<tenantId>/ begrenzt.
 * Der Präfix wird vom Kern erzwungen; das Plugin kann keine fremden Keys ansprechen.
 */
@Injectable()
export class PluginStorageService {
  constructor(private readonly s3: S3Service) {}

  private base(pluginId: string, tenantId: string): string {
    return `plugins/${pluginId}/${tenantId}/`;
  }

  scoped(pluginId: string, tenantId: string): ScopedStorage {
    const base = this.base(pluginId, tenantId);
    const assertScoped = (key: string): void => {
      if (!key.startsWith(base)) {
        throw new ForbiddenException('Storage-Key liegt ausserhalb des Plugin-Namespace.');
      }
    };
    return {
      presignUpload: async (fileName: string, contentType: string) => {
        // buildKey hängt eine UUID an → Key liegt garantiert unter base.
        const key = this.s3.buildKey(base.slice(0, -1), fileName);
        const uploadUrl = await this.s3.presignUpload(key, contentType);
        return { uploadUrl, key };
      },
      presignDownload: async (key: string) => {
        assertScoped(key);
        return this.s3.presignDownload(key);
      },
      delete: async (key: string) => {
        assertScoped(key);
        await this.s3.deleteKey(key);
      },
    };
  }

  /** Löscht alle Objekte eines Plugins (optional pro Tenant). Für Uninstall. */
  async deleteAll(pluginId: string, tenantId?: string): Promise<number> {
    const prefix = tenantId ? this.base(pluginId, tenantId) : `plugins/${pluginId}/`;
    return this.s3.deletePrefix(prefix);
  }

  /** Anzahl verbleibender Objekte – für die Cleanup-Verifikation (§12). */
  async count(pluginId: string, tenantId?: string): Promise<number> {
    const prefix = tenantId ? this.base(pluginId, tenantId) : `plugins/${pluginId}/`;
    return (await this.s3.listKeys(prefix)).length;
  }
}
