import { Injectable, Logger, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from './s3.service';

export type StorageObjectKind = 'submission' | 'attachment' | 'rte';

/**
 * Buchhaltung des Objektspeichers: persistiert Grösse und Zuordnung jedes
 * hochgeladenen S3-Objekts, damit der Speicherverbrauch pro Schule/Klasse/
 * Lehrperson ohne teures Scannen des Buckets aggregiert werden kann.
 *
 * Die Buchung erfolgt beim Erzeugen des Objekt-Keys (also wenn feststeht, dass
 * das Objekt in den Speicher geschrieben wird). Fehler beim Buchen dürfen einen
 * Upload nie scheitern lassen – sie werden nur geloggt.
 */
@Injectable()
export class StorageObjectsService {
  private readonly logger = new Logger(StorageObjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  /** Verbucht ein hochgeladenes Objekt (idempotent per Key). */
  async record(input: {
    tenantId: string;
    key: string;
    sizeBytes: number;
    kind: StorageObjectKind;
    classId?: string | null;
    uploaderId?: string | null;
  }): Promise<void> {
    const size = Number.isFinite(input.sizeBytes) ? Math.max(0, Math.trunc(input.sizeBytes)) : 0;
    try {
      await this.prisma.storageObject.upsert({
        where: { key: input.key },
        create: {
          tenantId: input.tenantId,
          key: input.key,
          sizeBytes: size,
          kind: input.kind,
          classId: input.classId ?? null,
          uploaderId: input.uploaderId ?? null,
        },
        update: { sizeBytes: size },
      });
    } catch (e) {
      this.logger.warn(`StorageObject konnte nicht verbucht werden (${input.key}): ${String(e)}`);
    }
  }

  /** Entfernt die Buchung eines Objekts (nach Löschung im Objektspeicher). */
  async remove(key: string): Promise<void> {
    try {
      await this.prisma.storageObject.deleteMany({ where: { key } });
    } catch (e) {
      this.logger.warn(`StorageObject-Buchung (${key}) konnte nicht entfernt werden: ${String(e)}`);
    }
  }

  /** Löscht alle S3-Objekte unter einem Präfix und deren Buchungen (best-effort). */
  async deletePrefix(prefix: string): Promise<number> {
    let n = 0;
    try {
      n = await this.s3.deletePrefix(prefix);
    } catch (e) {
      this.logger.warn(`S3-Präfix (${prefix}) konnte nicht gelöscht werden: ${String(e)}`);
    }
    await this.prisma.storageObject.deleteMany({ where: { key: { startsWith: prefix } } });
    return n;
  }

  /** Löscht einzelne S3-Objekte (nach Key) und deren Buchungen (best-effort). */
  async deleteKeys(keys: string[]): Promise<void> {
    const valid = keys.filter(Boolean);
    for (const key of valid) {
      try {
        await this.s3.deleteKey(key);
      } catch (e) {
        this.logger.warn(`S3-Objekt (${key}) konnte nicht gelöscht werden: ${String(e)}`);
      }
    }
    if (valid.length) {
      await this.prisma.storageObject.deleteMany({ where: { key: { in: valid } } });
    }
  }

  /**
   * Löscht alle Objekte eines Modulanlasses aus dem Objektspeicher und entfernt
   * deren Buchungen (beim Löschen einer Klasse). Best-effort: einzelne S3-Fehler
   * dürfen die Klassenlöschung nicht scheitern lassen. Liefert die Anzahl der
   * gelöschten Objekte.
   */
  async deleteForClass(classId: string): Promise<number> {
    const objects = await this.prisma.storageObject.findMany({
      where: { classId },
      select: { key: true },
    });
    for (const o of objects) {
      try {
        await this.s3.deleteKey(o.key);
      } catch (e) {
        this.logger.warn(`S3-Objekt (${o.key}) konnte nicht gelöscht werden: ${String(e)}`);
      }
    }
    await this.prisma.storageObject.deleteMany({ where: { classId } });
    return objects.length;
  }

  /** Summe der Objektgrössen eines Mandanten in Bytes. */
  async totalForTenant(tenantId: string): Promise<number> {
    const agg = await this.prisma.storageObject.aggregate({
      where: { tenantId },
      _sum: { sizeBytes: true },
    });
    return agg._sum.sizeBytes ?? 0;
  }

  /**
   * Speicherverbrauch je verantwortlicher Lehrperson (Bytes). Einreichungen
   * werden über die Klasse der aktuellen Besitzer-Lehrperson zugeordnet;
   * Anhänge/Bilder der hochladenden Person. So bleibt die Zuordnung auch nach
   * einem Besitzerwechsel korrekt (Join auf `Class.ownerId` zur Abfragezeit).
   */
  async usageByTeacher(tenantId: string): Promise<{ teacherId: string; bytes: number }[]> {
    const rows = await this.prisma.$queryRaw<{ teacherId: string; bytes: bigint }[]>`
      SELECT t."teacherId", SUM(t."sizeBytes")::bigint AS bytes
      FROM (
        SELECT so."sizeBytes", COALESCE(c."ownerId", so."uploaderId") AS "teacherId"
        FROM "StorageObject" so
        LEFT JOIN "Class" c ON c."id" = so."classId"
        WHERE so."tenantId" = ${tenantId}
      ) t
      WHERE t."teacherId" IS NOT NULL
      GROUP BY t."teacherId"
      ORDER BY bytes DESC
    `;
    return rows.map((r) => ({ teacherId: r.teacherId, bytes: Number(r.bytes) }));
  }

  /**
   * Prüft vor einem Upload, ob die gekaufte Schulquota und die persönliche
   * Quota der verantwortlichen Lehrperson die zusätzlichen Bytes noch zulassen.
   * `null` als Quota bedeutet „unbegrenzt". Overcommit ist gewollt: die Summe der
   * LP-Quotas darf die Schulquota übersteigen – geprüft werden beide Grenzen
   * unabhängig gegen den jeweils aktuellen Verbrauch. Wirft 413, wenn eine der
   * beiden Grenzen überschritten würde.
   */
  async assertQuota(input: {
    tenantId: string;
    teacherId?: string | null;
    addBytes: number;
  }): Promise<void> {
    const add = Number.isFinite(input.addBytes) ? Math.max(0, Math.trunc(input.addBytes)) : 0;

    // Schulquota gegen Gesamtverbrauch.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { quotaBytes: true },
    });
    if (tenant?.quotaBytes != null) {
      const total = await this.totalForTenant(input.tenantId);
      if (total + add > Number(tenant.quotaBytes)) {
        throw new PayloadTooLargeException(
          'Der Speicherplatz der Schule ist erschöpft. Bitte wenden Sie sich an Ihre Schuladministration.',
        );
      }
    }

    // Persönliche Quota der verantwortlichen Lehrperson gegen deren Verbrauch.
    if (input.teacherId) {
      const membership = await this.prisma.membership.findFirst({
        where: {
          tenantId: input.tenantId,
          userId: input.teacherId,
          role: Role.TEACHER,
          quotaBytes: { not: null },
        },
        select: { quotaBytes: true },
      });
      if (membership?.quotaBytes != null) {
        const used = await this.usageForTeacher(input.tenantId, input.teacherId);
        if (used + add > Number(membership.quotaBytes)) {
          throw new PayloadTooLargeException(
            'Ihr persönliches Speicherkontingent ist erschöpft. Löschen Sie nicht mehr benötigte Dateien oder wenden Sie sich an Ihre Schuladministration.',
          );
        }
      }
    }
  }

  /**
   * Setzt die persönliche Speicherquota einer Lehrperson (Schuladmin). `null`
   * hebt die Begrenzung auf. Quota liegt auf der TEACHER-Mitgliedschaft.
   */
  async setTeacherQuota(
    tenantId: string,
    userId: string,
    quotaBytes: number | null,
  ): Promise<void> {
    const value = quotaBytes == null ? null : BigInt(Math.max(0, Math.trunc(quotaBytes)));
    const res = await this.prisma.membership.updateMany({
      where: { tenantId, userId, role: Role.TEACHER },
      data: { quotaBytes: value },
    });
    if (res.count === 0) {
      throw new NotFoundException('Keine Lehrer-Mitgliedschaft für diese Person gefunden.');
    }
  }

  /** Persönliche Speicherquota einer Lehrperson (Bytes) oder null = unbegrenzt. */
  async teacherQuota(tenantId: string, userId: string): Promise<number | null> {
    const m = await this.prisma.membership.findFirst({
      where: { tenantId, userId, role: Role.TEACHER, quotaBytes: { not: null } },
      select: { quotaBytes: true },
    });
    return m?.quotaBytes != null ? Number(m.quotaBytes) : null;
  }

  /** Speicherverbrauch des Verantwortlichen für ein einzelnes Konto (Bytes). */
  async usageForTeacher(tenantId: string, userId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ bytes: bigint }[]>`
      SELECT COALESCE(SUM(so."sizeBytes"), 0)::bigint AS bytes
      FROM "StorageObject" so
      LEFT JOIN "Class" c ON c."id" = so."classId"
      WHERE so."tenantId" = ${tenantId}
        AND COALESCE(c."ownerId", so."uploaderId") = ${userId}
    `;
    return Number(rows[0]?.bytes ?? 0);
  }

  /**
   * Schul-Übersicht: Gesamtverbrauch + gekaufte Schulquota + Aufschlüsselung je
   * Lehrperson (Verbrauch und persönliche Quota) inkl. Namen. Es werden alle
   * aktiven Lehrpersonen gelistet – auch solche ohne Verbrauch –, damit der
   * Schuladmin jeder Person eine Quota zuweisen kann. Zusätzlich erscheinen
   * Verantwortliche mit Verbrauch, die (mehr) keine aktive Lehrer-Mitgliedschaft
   * haben (z. B. übernommene Alt-Anlässe), damit kein Verbrauch „verschwindet".
   * Von Plattform (super-admin) und Schuladmin genutzt.
   */
  async schoolUsage(tenantId: string): Promise<{
    total: number;
    quotaBytes: number | null;
    teachers: {
      teacherId: string;
      displayName: string;
      email: string;
      bytes: number;
      quotaBytes: number | null;
    }[];
  }> {
    const [usage, total, tenant, teacherMemberships] = await Promise.all([
      this.usageByTeacher(tenantId),
      this.totalForTenant(tenantId),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { quotaBytes: true } }),
      this.prisma.membership.findMany({
        where: { tenantId, role: Role.TEACHER, status: 'ACTIVE' },
        select: { userId: true, quotaBytes: true },
      }),
    ]);

    const bytesById = new Map(usage.map((u) => [u.teacherId, u.bytes]));
    const quotaById = new Map(teacherMemberships.map((m) => [m.userId, m.quotaBytes]));
    // Vereinigung: alle Lehrpersonen + alle Verantwortlichen mit Verbrauch.
    const ids = new Set<string>([...quotaById.keys(), ...bytesById.keys()]);

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, displayName: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const teachers = [...ids]
      .map((id) => {
        const q = quotaById.get(id);
        return {
          teacherId: id,
          displayName: byId.get(id)?.displayName ?? '—',
          email: byId.get(id)?.email ?? '',
          bytes: bytesById.get(id) ?? 0,
          quotaBytes: q != null ? Number(q) : null,
        };
      })
      .sort((a, b) => b.bytes - a.bytes);

    return {
      total,
      quotaBytes: tenant?.quotaBytes != null ? Number(tenant.quotaBytes) : null,
      teachers,
    };
  }
}
