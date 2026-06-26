import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginActivationService } from './plugin-activation.service';
import { PluginDataService } from './plugin-data.service';
import { PluginSecretService } from './plugin-secret.service';
import { PluginStorageService } from './plugin-storage.service';

/**
 * Operative Lifecycle-Schritte (§12). „Install/Upgrade" sind im Pilot deploy-getrieben:
 * onApplicationBootstrap synchronisiert die PluginInstallation-Zeilen aus der Registry.
 * Die Laufzeit-Aktionen (Enable/Disable/Configure/Uninstall) laufen pro Tenant.
 */
@Injectable()
export class PluginLifecycleService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluginLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PluginRegistryService,
    private readonly activation: PluginActivationService,
    private readonly data: PluginDataService,
    private readonly secrets: PluginSecretService,
    private readonly storage: PluginStorageService,
  ) {}

  /** Beim Boot: Registry → PluginInstallation-Zeilen abgleichen (Install/Upgrade-Erkennung). */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.syncInstallations();
    } catch (err) {
      // Nicht fatal: ohne DB (z. B. lokal ohne Postgres) startet die API trotzdem.
      this.logger.warn(`PluginInstallation-Sync übersprungen: ${String(err)}`);
    }
  }

  private async syncInstallations(): Promise<void> {
    for (const manifest of this.registry.getAll()) {
      const entry = this.registry.getEntry(manifest.pluginId);
      if (!entry) continue;
      await this.prisma.pluginInstallation.upsert({
        where: { pluginId: manifest.pluginId },
        create: {
          pluginId: manifest.pluginId,
          installedVersion: manifest.version,
          manifestHash: entry.hash,
          status: 'INSTALLED',
        },
        update: {
          installedVersion: manifest.version,
          manifestHash: entry.hash,
          status: 'INSTALLED',
          lastError: null,
        },
      });
    }
    this.logger.log(`${this.registry.getAll().length} Plugin-Installation(en) synchronisiert.`);
  }

  /** Übersicht für die Admin-UI: installierte Plugins + Aktivierungsstatus dieses Tenants. */
  async listForTenant(tenantId: string) {
    const installations = await this.prisma.pluginInstallation.findMany({
      orderBy: { pluginId: 'asc' },
    });
    const activations = await this.prisma.pluginTenantActivation.findMany({ where: { tenantId } });
    const actByPlugin = new Map(activations.map((a) => [a.pluginId, a]));

    return installations.map((inst) => {
      const manifest = this.registry.get(inst.pluginId);
      const act = actByPlugin.get(inst.pluginId);
      return {
        pluginId: inst.pluginId,
        displayName: manifest?.displayName ?? inst.pluginId,
        installedVersion: inst.installedVersion,
        installStatus: inst.status,
        enabled: act?.enabled ?? false,
        tenantStatus: act?.status ?? 'DISABLED',
        config: act?.config ?? {},
        configVersion: act?.configVersion ?? 0,
        capabilities: manifest?.capabilities ?? [],
      };
    });
  }

  async enable(pluginId: string, tenantId: string, userId: string) {
    const inst = await this.prisma.pluginInstallation.findUnique({ where: { pluginId } });
    if (!inst) throw new NotFoundException(`Plugin "${pluginId}" ist nicht installiert.`);
    if (inst.status !== 'INSTALLED') {
      throw new ConflictException(`Plugin "${pluginId}" ist nicht aktivierbar (${inst.status}).`);
    }
    const row = await this.prisma.pluginTenantActivation.upsert({
      where: { pluginId_tenantId: { pluginId, tenantId } },
      create: {
        pluginId,
        tenantId,
        enabled: true,
        enabledVersion: inst.installedVersion,
        status: 'ENABLED',
        enabledAt: new Date(),
      },
      update: {
        enabled: true,
        enabledVersion: inst.installedVersion,
        status: 'ENABLED',
        lastError: null,
        enabledAt: new Date(),
      },
    });
    this.activation.invalidate(pluginId, tenantId);
    await this.audit(tenantId, userId, 'plugin.enable', { pluginId });
    return row;
  }

  async disable(pluginId: string, tenantId: string, userId: string) {
    const row = await this.prisma.pluginTenantActivation.upsert({
      where: { pluginId_tenantId: { pluginId, tenantId } },
      create: { pluginId, tenantId, enabled: false, status: 'DISABLED', disabledAt: new Date() },
      update: { enabled: false, status: 'DISABLED', disabledAt: new Date() },
    });
    this.activation.invalidate(pluginId, tenantId);
    await this.audit(tenantId, userId, 'plugin.disable', { pluginId });
    return row;
  }

  async configure(
    pluginId: string,
    tenantId: string,
    userId: string,
    config: Prisma.InputJsonValue,
  ) {
    const existing = await this.prisma.pluginTenantActivation.findUnique({
      where: { pluginId_tenantId: { pluginId, tenantId } },
    });
    const row = await this.prisma.pluginTenantActivation.upsert({
      where: { pluginId_tenantId: { pluginId, tenantId } },
      create: { pluginId, tenantId, config, configVersion: 1 },
      update: { config, configVersion: (existing?.configVersion ?? 0) + 1 },
    });
    this.activation.invalidate(pluginId, tenantId);
    await this.audit(tenantId, userId, 'plugin.configure', { pluginId });
    return row;
  }

  /**
   * Daten-Uninstall pro Tenant. Vorbedingung: Plugin ist deaktiviert. Entfernt Secrets,
   * Storage-Objekte und Datensätze gemäss manifest.cleanup und verifiziert Leere (§12).
   */
  async uninstall(pluginId: string, tenantId: string, userId: string) {
    const manifest = this.registry.get(pluginId);
    if (!manifest) throw new NotFoundException(`Plugin "${pluginId}" nicht registriert.`);

    const act = await this.prisma.pluginTenantActivation.findUnique({
      where: { pluginId_tenantId: { pluginId, tenantId } },
    });
    if (act?.enabled) {
      throw new ConflictException('Plugin muss vor dem Uninstall deaktiviert werden.');
    }

    if (manifest.cleanup.data === 'archive') {
      const exported = await this.data.exportAll(pluginId, tenantId);
      this.logger.log(
        `Archiv-Policy: ${exported.length} Datensätze von "${pluginId}" exportierbar.`,
      );
      // Tatsächliche Archivierung nach S3 folgt; im Pilot wird anschliessend gelöscht.
    }

    const removedSecrets = await this.secrets.deleteAll(pluginId, tenantId);
    const removedStorage =
      manifest.cleanup.storage === 'delete' ? await this.storage.deleteAll(pluginId, tenantId) : 0;
    const removedData = await this.data.purge(pluginId, tenantId);
    if (act) {
      await this.prisma.pluginTenantActivation.delete({ where: { id: act.id } });
    }
    this.activation.invalidate(pluginId, tenantId);

    // Cleanup-Verifikation: nichts darf zurückbleiben.
    const remaining =
      (await this.data.count(pluginId, tenantId)) +
      (await this.secrets.count(pluginId, tenantId)) +
      (manifest.cleanup.storage === 'delete' ? await this.storage.count(pluginId, tenantId) : 0);

    if (remaining > 0) {
      await this.audit(tenantId, userId, 'plugin.uninstall.incomplete', { pluginId, remaining });
      throw new ConflictException(`Uninstall unvollständig: ${remaining} Ressource(n) verblieben.`);
    }

    await this.audit(tenantId, userId, 'plugin.uninstall', {
      pluginId,
      removedSecrets,
      removedStorage,
      removedData,
    });
    return { pluginId, removedSecrets, removedStorage, removedData };
  }

  private async audit(
    tenantId: string,
    userId: string,
    action: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { tenantId, userId, action, detail: detail as Prisma.InputJsonValue },
      });
    } catch {
      // Audit-Fehler nicht fatal
    }
  }
}
