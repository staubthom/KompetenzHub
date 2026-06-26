import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { validateManifest, type PluginManifest } from '@kompetenzhub/plugin-contracts';
import type { PluginServerModule } from '@kompetenzhub/plugin-sdk';

interface PluginEntry {
  manifest: PluginManifest;
  /** Stabiler Hash des Manifests (für Upgrade-Erkennung). */
  hash: string;
  /** Absoluter Pfad des Plugin-Pakets (für das Laden des Server-Bundles). */
  dir: string;
}

/**
 * Plugin-Registry (Modell A): entdeckt beim Boot die mitgelieferten Plugin-Pakete
 * (plugins/packages/<id>/manifest.json), validiert die Manifeste und hält die gültigen
 * im Speicher. Lädt bei Bedarf das kompilierte Server-Bundle eines Plugins (lazy).
 *
 * Server-Bundles werden im Pilot zur Laufzeit per Pfad geladen (dist/server/index.js).
 * Die in §7.1 skizzierte Codegen-Variante (statische Imports, Tree-Shaking) ist eine
 * spätere Optimierung und ändert die öffentlichen Verträge nicht.
 */
@Injectable()
export class PluginRegistryService implements OnModuleInit {
  private readonly logger = new Logger(PluginRegistryService.name);
  private readonly entries = new Map<string, PluginEntry>();
  private readonly serverCache = new Map<string, PluginServerModule>();

  onModuleInit(): void {
    this.discover();
  }

  /** Alle gültig registrierten Manifeste. */
  getAll(): PluginManifest[] {
    return [...this.entries.values()].map((e) => e.manifest);
  }

  /** Manifest eines Plugins oder undefined. */
  get(pluginId: string): PluginManifest | undefined {
    return this.entries.get(pluginId)?.manifest;
  }

  /** Vollständiger Registry-Eintrag (inkl. Hash/Verzeichnis). */
  getEntry(pluginId: string): PluginEntry | undefined {
    return this.entries.get(pluginId);
  }

  /**
   * Lädt (und cacht) das kompilierte Server-Bundle eines Plugins. Erwartet
   * dist/server/index.js mit Default-Export (definePlugin-Ergebnis).
   */
  loadServer(pluginId: string): PluginServerModule {
    const cached = this.serverCache.get(pluginId);
    if (cached) return cached;

    const entry = this.entries.get(pluginId);
    if (!entry) throw new NotFoundException(`Plugin "${pluginId}" nicht registriert.`);

    const serverPath = join(entry.dir, 'dist', 'server', 'index.js');
    if (!existsSync(serverPath)) {
      throw new NotFoundException(
        `Server-Bundle für "${pluginId}" fehlt (${serverPath}). Bitte Plugin bauen.`,
      );
    }
    const mod = require(serverPath) as { default?: PluginServerModule } & PluginServerModule;
    const server = mod.default ?? mod;
    if (!server || typeof server.routes !== 'object') {
      throw new NotFoundException(
        `Server-Bundle für "${pluginId}" hat kein gültiges routes-Objekt.`,
      );
    }
    this.serverCache.set(pluginId, server);
    return server;
  }

  private discover(): void {
    const dir = this.findPackagesDir();
    if (!dir) {
      this.logger.log('Keine Plugin-Pakete gefunden (plugins/packages nicht vorhanden).');
      return;
    }

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgDir = join(dir, entry.name);
      const manifestPath = join(pkgDir, 'manifest.json');
      if (!existsSync(manifestPath)) continue;

      let rawString: string;
      let raw: unknown;
      try {
        rawString = readFileSync(manifestPath, 'utf8');
        raw = JSON.parse(rawString);
      } catch (err) {
        this.logger.warn(`Manifest von "${entry.name}" nicht lesbar: ${String(err)}`);
        continue;
      }

      const result = validateManifest(raw);
      if (!result.ok || !result.manifest) {
        this.logger.warn(
          `Plugin "${entry.name}" ungültig – übersprungen: ${result.errors.join('; ')}`,
        );
        continue;
      }

      const manifest = result.manifest;
      if (this.entries.has(manifest.pluginId)) {
        this.logger.warn(
          `Doppelte pluginId "${manifest.pluginId}" – "${entry.name}" übersprungen.`,
        );
        continue;
      }

      const hash = createHash('sha256').update(rawString).digest('hex');
      this.entries.set(manifest.pluginId, { manifest, hash, dir: pkgDir });
      this.logger.log(`Plugin entdeckt & validiert: ${manifest.pluginId} v${manifest.version}`);
    }

    this.logger.log(`${this.entries.size} Plugin(s) registriert.`);
  }

  /**
   * Findet das Verzeichnis plugins/packages, indem vom aktuellen Arbeitsverzeichnis
   * aus nach oben gewandert wird (robust für dev `nest start` wie für `node dist`).
   */
  private findPackagesDir(): string | null {
    let current = process.cwd();
    for (let i = 0; i < 6; i++) {
      const candidate = join(current, 'plugins', 'packages');
      if (existsSync(candidate)) return candidate;
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return null;
  }
}
