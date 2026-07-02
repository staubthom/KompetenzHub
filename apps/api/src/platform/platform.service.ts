import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus, MembershipStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { StorageObjectsService } from '../storage/storage-objects.service';
import { TenantMiddleware } from '../common/tenant.middleware';
import { defaultTenantSlug } from '../common/tenant-resolution';

/** Erlaubtes Slug-Format: Kleinbuchstaben/Ziffern/Bindestrich, 2–32 Zeichen. */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$/;
const RESERVED_SLUGS = new Set(['www', 'api', 'app', 'admin', 'static', 'assets', 'default']);

export interface CreateTenantInput {
  slug: string;
  name: string;
  adminEmail?: string;
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly storageObjects: StorageObjectsService,
  ) {}

  /** Alle Mandanten mit Kennzahlen (für die Plattform-Übersicht). */
  async listTenants() {
    const [tenants, storageTotals] = await Promise.all([
      this.prisma.tenant.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          slug: true,
          name: true,
          active: true,
          quotaBytes: true,
          createdAt: true,
          _count: { select: { users: true, modules: true, classes: true } },
        },
      }),
      // Speicherverbrauch pro Schule aus der Objekt-Buchhaltung (ohne S3-Scan).
      this.prisma.storageObject.groupBy({ by: ['tenantId'], _sum: { sizeBytes: true } }),
    ]);
    const bytesByTenant = new Map(storageTotals.map((s) => [s.tenantId, s._sum.sizeBytes ?? 0]));
    return tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      active: t.active,
      createdAt: t.createdAt.toISOString(),
      memberships: t._count.users,
      modules: t._count.modules,
      classes: t._count.classes,
      storageBytes: bytesByTenant.get(t.id) ?? 0,
      quotaBytes: t.quotaBytes != null ? Number(t.quotaBytes) : null,
    }));
  }

  /** Speicherverbrauch einer Schule je verantwortlicher Lehrperson (mit Namen). */
  async storageByTeacher(tenantId: string) {
    await this.requireTenant(tenantId);
    return this.storageObjects.schoolUsage(tenantId);
  }

  async createTenant(input: CreateTenantInput) {
    const slug = input.slug?.trim().toLowerCase();
    const name = input.name?.trim();
    if (!slug || !SLUG_RE.test(slug)) {
      throw new BadRequestException('Ungültiger Slug (nur a–z, 0–9, Bindestrich; 2–32 Zeichen).');
    }
    if (RESERVED_SLUGS.has(slug)) {
      throw new BadRequestException(`Der Slug "${slug}" ist reserviert.`);
    }
    if (!name) throw new BadRequestException('Name ist erforderlich.');

    const exists = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (exists) throw new ConflictException(`Slug "${slug}" ist bereits vergeben.`);

    const tenant = await this.prisma.tenant.create({
      data: {
        slug,
        name,
        branding: { create: { displayName: name } },
      },
      select: { id: true, slug: true, name: true, active: true, createdAt: true },
    });

    // Optional: erste Schuladmin-Person einladen. Sie wird beim ersten Login der
    // passenden E-Mail automatisch zur ADMIN-Rolle befördert (applyAccessGate).
    const adminEmail = input.adminEmail?.trim().toLowerCase();
    if (adminEmail) {
      await this.prisma.invitation.create({
        data: {
          tenantId: tenant.id,
          email: adminEmail,
          role: Role.ADMIN,
          status: InvitationStatus.PENDING,
        },
      });
    }

    TenantMiddleware.invalidate(slug);
    return { ...tenant, createdAt: tenant.createdAt.toISOString(), adminInvited: !!adminEmail };
  }

  async updateTenant(
    id: string,
    patch: { name?: string; active?: boolean; quotaBytes?: number | null },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, select: { slug: true } });
    if (!tenant) throw new NotFoundException('Mandant nicht gefunden.');

    const data: { name?: string; active?: boolean; quotaBytes?: bigint | null } = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new BadRequestException('Name darf nicht leer sein.');
      data.name = name;
    }
    if (patch.active !== undefined) data.active = patch.active;
    if (patch.quotaBytes !== undefined) {
      data.quotaBytes =
        patch.quotaBytes === null ? null : BigInt(Math.max(0, Math.trunc(patch.quotaBytes)));
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data,
      select: { id: true, slug: true, name: true, active: true, quotaBytes: true },
    });
    // Cache invalidieren, damit (De-)Aktivierung sofort greift.
    TenantMiddleware.invalidate(tenant.slug);
    return {
      ...updated,
      quotaBytes: updated.quotaBytes != null ? Number(updated.quotaBytes) : null,
    };
  }

  /**
   * Löscht einen Mandanten samt aller Daten. FK-gebundene Tabellen kaskadieren
   * über den Tenant-Delete; Tabellen ohne Tenant-FK (Plugins, AiConfig,
   * Fachgespräche, AuditLog, AiAssessment) werden vorher explizit entfernt.
   *
   * Bewusst per $executeRaw in einer Transaktion: Platform-Aktionen laufen im
   * Request-Kontext des EIGENEN Tenants des Super-Admins – die Prisma-Scoping-
   * Schicht würde ein deleteMany sonst auf den falschen Mandanten einschränken.
   * Raw-Queries umgehen den Hook; die DB-seitigen ON DELETE CASCADE greifen.
   */
  async deleteTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (!tenant) throw new NotFoundException('Mandant nicht gefunden.');
    if (tenant.slug === defaultTenantSlug()) {
      throw new BadRequestException('Der Default-Mandant kann nicht gelöscht werden.');
    }

    await this.prisma.$transaction([
      this.prisma
        .$executeRaw`DELETE FROM "AiAssessment" WHERE "submissionId" IN (SELECT s.id FROM "Submission" s JOIN "CompetenceEvidence" ce ON ce.id = s."evidenceId" WHERE ce."tenantId" = ${id})`,
      this.prisma.$executeRaw`DELETE FROM "PluginSecret" WHERE "tenantId" = ${id}`,
      this.prisma.$executeRaw`DELETE FROM "PluginRecord" WHERE "tenantId" = ${id}`,
      this.prisma.$executeRaw`DELETE FROM "PluginTenantActivation" WHERE "tenantId" = ${id}`,
      this.prisma.$executeRaw`DELETE FROM "AiConfig" WHERE "tenantId" = ${id}`,
      this.prisma.$executeRaw`DELETE FROM "ExpertTalkSession" WHERE "tenantId" = ${id}`,
      this.prisma.$executeRaw`DELETE FROM "AuditLog" WHERE "tenantId" = ${id}`,
      this.prisma.$executeRaw`DELETE FROM "Tenant" WHERE "id" = ${id}`,
    ]);

    // Objektspeicher der Schule best-effort aufräumen (mandanten-präfixierte Keys
    // t/<tenantId>/…). Fehler dürfen die Löschung nicht scheitern lassen; verwaiste
    // Objekte könnten sonst dauerhaft bestehen bleiben.
    try {
      await this.s3.deletePrefix(this.s3.tenantPrefix(id));
    } catch {
      /* S3-Cleanup ist optional – DB-Löschung ist bereits erfolgt. */
    }

    TenantMiddleware.invalidate(tenant.slug);
    return { deleted: true };
  }

  // ── Schuladmins eines Mandanten verwalten ──────────────────────────────

  private async requireTenant(id: string): Promise<void> {
    const t = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!t) throw new NotFoundException('Mandant nicht gefunden.');
  }

  /** Aktive Schuladmins + offene Admin-Einladungen eines Mandanten. */
  async listAdmins(tenantId: string) {
    await this.requireTenant(tenantId);
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId, role: Role.ADMIN, status: MembershipStatus.ACTIVE },
      select: { id: true, user: { select: { id: true, email: true, displayName: true } } },
    });
    const pending = await this.prisma.invitation.findMany({
      where: { tenantId, role: Role.ADMIN, status: InvitationStatus.PENDING },
      select: { id: true, email: true },
    });
    return {
      admins: memberships.map((m) => ({
        membershipId: m.id,
        userId: m.user.id,
        email: m.user.email,
        displayName: m.user.displayName,
      })),
      pendingInvites: pending.map((p) => ({ id: p.id, email: p.email })),
    };
  }

  /**
   * Macht eine Person zum Schuladmin: existiert ein Konto, wird sofort eine
   * ADMIN-Mitgliedschaft gesetzt; sonst eine offene Einladung erstellt, die beim
   * ersten Login der E-Mail eingelöst wird.
   */
  async addAdmin(tenantId: string, emailRaw: string) {
    await this.requireTenant(tenantId);
    const email = emailRaw?.trim().toLowerCase();
    if (!email) throw new BadRequestException('E-Mail ist erforderlich.');

    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      await this.prisma.membership.upsert({
        where: { tenantId_userId_role: { tenantId, userId: user.id, role: Role.ADMIN } },
        update: { status: MembershipStatus.ACTIVE },
        create: { tenantId, userId: user.id, role: Role.ADMIN, status: MembershipStatus.ACTIVE },
      });
      return { added: true, invited: false };
    }

    await this.prisma.invitation.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: { role: Role.ADMIN, status: InvitationStatus.PENDING, acceptedAt: null },
      create: { tenantId, email, role: Role.ADMIN, status: InvitationStatus.PENDING },
    });
    return { added: true, invited: true };
  }

  /** Entzieht die Admin-Rolle (Mitgliedschaft) bzw. widerruft eine Admin-Einladung. */
  async removeAdmin(tenantId: string, target: { userId?: string; email?: string }) {
    await this.requireTenant(tenantId);

    if (target.userId) {
      const remaining = await this.prisma.membership.count({
        where: { tenantId, role: Role.ADMIN, status: MembershipStatus.ACTIVE },
      });
      if (remaining <= 1) {
        throw new BadRequestException('Die Schule braucht mindestens eine:n aktive:n Admin.');
      }
      await this.prisma.membership.deleteMany({
        where: { tenantId, userId: target.userId, role: Role.ADMIN },
      });
      return { removed: true };
    }

    const email = target.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException('userId oder email erforderlich.');
    await this.prisma.invitation.deleteMany({
      where: { tenantId, email, role: Role.ADMIN, status: InvitationStatus.PENDING },
    });
    return { removed: true };
  }
}
