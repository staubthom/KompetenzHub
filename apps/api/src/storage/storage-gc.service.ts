import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from './s3.service';
import { StorageObjectsService } from './storage-objects.service';

export interface GcResult {
  scanned: number;
  referenced: number;
  deleted: number;
  freedBytes: number;
}

/**
 * Garbage Collection für verwaiste Rich-Text-Bilder (rte/*): Bilder, die in
 * keinem HTML-Feld der Schule mehr referenziert werden (z. B. nach dem Entfernen
 * aus einem Text oder dem Löschen eines Moduls), werden aus dem Objektspeicher
 * und der Buchhaltung entfernt.
 *
 * Sicherheitsnetz: Objekte, die jünger als die Karenzzeit sind, werden NICHT
 * gelöscht – ein Bild kann hochgeladen sein, bevor der Text gespeichert wird.
 */
@Injectable()
export class StorageGcService {
  private readonly logger = new Logger(StorageGcService.name);
  /** Karenzzeit: frisch hochgeladene (noch nicht gespeicherte) Bilder verschonen. */
  private static readonly GRACE_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly storageObjects: StorageObjectsService,
  ) {}

  /** Nächtlicher Lauf über alle Schulen. */
  @Cron('0 3 * * *', { name: 'storage-rte-gc', timeZone: 'Europe/Zurich' })
  async runAll(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true, slug: true } });
    for (const t of tenants) {
      try {
        const r = await this.runForTenant(t.id);
        if (r.deleted > 0) {
          this.logger.log(
            `RTE-GC ${t.slug}: ${r.deleted} verwaiste Bild(er) entfernt (${r.freedBytes} B).`,
          );
        }
      } catch (e) {
        this.logger.warn(`RTE-GC für ${t.slug} fehlgeschlagen: ${String(e)}`);
      }
    }
  }

  /** GC für eine einzelne Schule. */
  async runForTenant(tenantId: string): Promise<GcResult> {
    const rtePrefix = `${this.s3.tenantPrefix(tenantId)}${this.s3.publicPrefix}/`;
    const [objects, referenced] = await Promise.all([
      this.s3.listObjects(rtePrefix),
      this.collectReferencedKeys(tenantId),
    ]);
    const cutoff = Date.now() - StorageGcService.GRACE_MS;
    const orphans = objects.filter(
      (o) => !referenced.has(o.key) && o.lastModified.getTime() < cutoff,
    );
    const freedBytes = orphans.reduce((sum, o) => sum + o.size, 0);
    await this.storageObjects.deleteKeys(orphans.map((o) => o.key));
    return {
      scanned: objects.length,
      referenced: referenced.size,
      deleted: orphans.length,
      freedBytes,
    };
  }

  /**
   * Sammelt alle rte-Objekt-Keys, die in HTML-Feldern der Schule referenziert
   * werden (Modul-/Bänder-/Feld-Beschreibungen, Handlungsziele, Nachweis-
   * Instruktionen) sowie das Schul-Logo.
   */
  private async collectReferencedKeys(tenantId: string): Promise<Set<string>> {
    const base = this.s3.bucketBaseUrl;
    const refs = new Set<string>();
    const [modules, goals, bands, descriptors, evidences, branding] = await Promise.all([
      this.prisma.module.findMany({ where: { tenantId }, select: { description: true } }),
      this.prisma.actionGoal.findMany({ where: { module: { tenantId } }, select: { text: true } }),
      this.prisma.competenceBand.findMany({
        where: { matrix: { module: { tenantId } } },
        select: { description: true },
      }),
      this.prisma.descriptor.findMany({
        where: { field: { band: { matrix: { module: { tenantId } } } } },
        select: { text: true },
      }),
      this.prisma.competenceEvidence.findMany({
        where: { tenantId },
        select: { instructions: true },
      }),
      this.prisma.tenantBranding.findUnique({
        where: { tenantId },
        select: { logoLightKey: true },
      }),
    ]);
    for (const m of modules) this.extractInto(m.description, base, refs);
    for (const g of goals) this.extractInto(g.text, base, refs);
    for (const b of bands) this.extractInto(b.description, base, refs);
    for (const d of descriptors) this.extractInto(d.text, base, refs);
    for (const e of evidences) this.extractInto(e.instructions, base, refs);
    // Schul-Logo (als URL gespeichert) nicht mitlöschen.
    if (branding?.logoLightKey?.startsWith(base)) {
      refs.add(branding.logoLightKey.slice(base.length));
    }
    return refs;
  }

  /** Extrahiert aus einem i18n-JSON-Feld alle Bild-Keys des eigenen Buckets. */
  private extractInto(value: unknown, base: string, into: Set<string>): void {
    if (!value || typeof value !== 'object') return;
    const re = new RegExp(this.escapeRegex(base) + '[^"\'\\s>]+', 'g');
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (typeof v !== 'string') continue;
      for (const url of v.match(re) ?? []) into.add(url.slice(base.length));
    }
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
