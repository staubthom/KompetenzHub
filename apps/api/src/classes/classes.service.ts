import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClassStatus, EnrollmentStatus, MembershipStatus, Role } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateClassDto {
  name: string;
  moduleId?: string;
  year?: number;
  schoolYear?: string;
}

export interface UpdateClassDto {
  name?: string;
  moduleId?: string | null;
  year?: number;
  schoolYear?: string;
  status?: ClassStatus;
}

// Beitrittscode-Alphabet ohne verwechselbare Zeichen (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Klassen der Lehrperson – eigene UND als Co-Leitung geführte (Admins: alle).
   * Standard: ohne archivierte.
   */
  async list(tenantId: string, userId: string, roles: Role[], archived = false) {
    const isAdmin = roles.includes(Role.ADMIN);
    const classes = await this.prisma.class.findMany({
      where: {
        tenantId,
        ...(isAdmin ? {} : { OR: [{ ownerId: userId }, { coTeachers: { some: { userId } } }] }),
        status: archived ? ClassStatus.ARCHIVED : ClassStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        status: true,
        year: true,
        schoolYear: true,
        createdAt: true,
        ownerId: true,
        module: { select: { id: true, number: true, title: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    // Markiere, ob die Lehrperson nur Co-Leitung ist (nicht Besitzerin).
    return classes.map(({ ownerId, ...c }) => ({ ...c, isCoLeader: ownerId !== userId }));
  }

  /** Aktive Klassenmitgliedschaften einer/eines Lernenden inkl. Modul. */
  async listMine(tenantId: string, userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, status: EnrollmentStatus.ACTIVE, class: { tenantId } },
      select: {
        id: true,
        joinedAt: true,
        class: {
          select: {
            id: true,
            name: true,
            status: true,
            module: { select: { id: true, number: true, title: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    return enrollments.map((e) => ({
      enrollmentId: e.id,
      joinedAt: e.joinedAt,
      class: e.class,
    }));
  }

  async findOne(id: string, tenantId: string, userId: string, roles: Role[]) {
    const cls = await this.assertAccess(id, tenantId, userId, roles);
    const activeCode = await this.prisma.joinCode.findFirst({
      where: { classId: id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return { ...cls, activeJoinCode: activeCode };
  }

  async create(dto: CreateClassDto, tenantId: string, ownerId: string) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('"name" ist erforderlich.');

    if (dto.moduleId) await this.assertModuleInTenant(dto.moduleId, tenantId);

    return this.prisma.class.create({
      data: {
        // tenantId wird durch die Scoping-Middleware ergänzt
        ownerId,
        name,
        moduleId: dto.moduleId ?? null,
        year: dto.year,
        schoolYear: dto.schoolYear,
      } as never,
      select: {
        id: true,
        name: true,
        status: true,
        module: { select: { id: true, number: true, title: true } },
      },
    });
  }

  async update(id: string, dto: UpdateClassDto, tenantId: string, userId: string, roles: Role[]) {
    const cls = await this.assertAccess(id, tenantId, userId, roles);
    if (cls.status === ClassStatus.ARCHIVED) {
      throw new ConflictException('Archivierter Modulanlass ist read-only.');
    }
    if (dto.moduleId) await this.assertModuleInTenant(dto.moduleId, tenantId);

    return this.prisma.class.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.moduleId !== undefined && { moduleId: dto.moduleId }),
        ...(dto.year !== undefined && { year: dto.year }),
        ...(dto.schoolYear !== undefined && { schoolYear: dto.schoolYear }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      select: {
        id: true,
        name: true,
        status: true,
        module: { select: { id: true, number: true, title: true } },
      },
    });
  }

  async remove(id: string, tenantId: string, userId: string, roles: Role[]) {
    // Löschen nur durch die besitzende Lehrperson (oder Admin).
    // Auch archivierte Modulanlässe dürfen gelöscht werden.
    await this.assertOwnerOnly(id, tenantId, userId, roles);
    await this.prisma.class.delete({ where: { id } });
  }

  /** FA-103: Modulanlass archivieren (read-only, aus Standardlisten ausgeblendet). */
  async archive(id: string, tenantId: string, userId: string, roles: Role[]) {
    await this.assertAccess(id, tenantId, userId, roles);
    return this.prisma.class.update({
      where: { id },
      data: { status: ClassStatus.ARCHIVED },
      select: { id: true, name: true, status: true },
    });
  }

  /** FA-103: Archivierten Modulanlass wiederherstellen. */
  async restore(id: string, tenantId: string, userId: string, roles: Role[]) {
    await this.assertAccess(id, tenantId, userId, roles);
    return this.prisma.class.update({
      where: { id },
      data: { status: ClassStatus.ACTIVE },
      select: { id: true, name: true, status: true },
    });
  }

  // ── Beitrittscode (FA-23) ─────────────────────────────────────

  /** Generiert einen neuen Code und deaktiviert den vorherigen (Erneuern). */
  async generateJoinCode(
    id: string,
    tenantId: string,
    userId: string,
    roles: Role[],
    expiresAt?: Date,
  ) {
    const cls = await this.assertAccess(id, tenantId, userId, roles);
    if (cls.status === ClassStatus.ARCHIVED) {
      throw new ConflictException('Archivierter Modulanlass ist read-only.');
    }
    await this.prisma.joinCode.updateMany({
      where: { classId: id, isActive: true },
      data: { isActive: false },
    });
    const code = await this.uniqueCode();
    return this.prisma.joinCode.create({
      data: { classId: id, code, expiresAt: expiresAt ?? null },
    });
  }

  /** Lernende:r tritt per Code bei (idempotent). */
  async joinByCode(code: string, tenantId: string, userId: string) {
    const trimmed = code?.trim().toUpperCase();
    if (!trimmed) throw new BadRequestException('Kein Code angegeben.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    const displayName = user?.displayName ?? 'Unbekannt';

    const joinCode = await this.prisma.joinCode.findUnique({ where: { code: trimmed } });
    if (!joinCode || !joinCode.isActive) {
      throw new BadRequestException('Ungültiger Beitrittscode.');
    }
    if (joinCode.expiresAt && joinCode.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Beitrittscode ist abgelaufen.');
    }

    // Klasse tenant-gescoped laden (verhindert Cross-Tenant-Beitritt)
    const cls = await this.prisma.class.findFirst({
      where: { id: joinCode.classId, tenantId, status: ClassStatus.ACTIVE },
      select: { id: true, name: true },
    });
    if (!cls) throw new BadRequestException('Klasse nicht verfügbar.');

    // Idempotent: bestehende Einschreibung wiederverwenden/reaktivieren
    const enrollment = await this.prisma.enrollment.upsert({
      where: { classId_userId: { classId: cls.id, userId } },
      update: { status: EnrollmentStatus.ACTIVE },
      create: { classId: cls.id, userId, displayName, status: EnrollmentStatus.ACTIVE },
    });

    return { enrollment, class: cls };
  }

  // ── Mitglieder (FA-25) ────────────────────────────────────────

  async listMembers(id: string, tenantId: string, userId: string, roles: Role[]) {
    await this.assertAccess(id, tenantId, userId, roles);
    return this.prisma.enrollment.findMany({
      where: { classId: id },
      select: {
        id: true,
        displayName: true,
        status: true,
        joinedAt: true,
        userId: true,
        user: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async removeMember(
    id: string,
    memberUserId: string,
    tenantId: string,
    userId: string,
    roles: Role[],
  ) {
    const cls = await this.assertAccess(id, tenantId, userId, roles);
    if (cls.status === ClassStatus.ARCHIVED) {
      throw new ConflictException('Archivierter Modulanlass ist read-only.');
    }
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { classId: id, userId: memberUserId },
    });
    if (!enrollment) throw new NotFoundException('Mitglied nicht gefunden.');
    await this.prisma.enrollment.delete({ where: { id: enrollment.id } });
  }

  // ── Co-Leitung / Co-Teaching ──────────────────────────────────

  /** Listet die Co-Leitungen eines Modulanlasses (Besitzerin & Co-Leitung dürfen sehen). */
  async listCoTeachers(id: string, tenantId: string, userId: string, roles: Role[]) {
    await this.assertAccess(id, tenantId, userId, roles);
    const rows = await this.prisma.classTeacher.findMany({
      where: { classId: id },
      select: {
        userId: true,
        createdAt: true,
        user: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      userId: r.userId,
      email: r.user.email,
      displayName: r.user.displayName,
      avatarUrl: r.user.avatarUrl,
      since: r.createdAt,
    }));
  }

  /** Fügt eine Lehrperson per E-Mail als Co-Leitung hinzu (nur Besitzerin/Admin). */
  async addCoTeacher(
    id: string,
    emailRaw: string,
    tenantId: string,
    userId: string,
    roles: Role[],
  ) {
    const cls = await this.assertOwnerOnly(id, tenantId, userId, roles);
    const email = emailRaw?.trim().toLowerCase();
    if (!email) throw new BadRequestException('E-Mail-Adresse erforderlich.');

    // Zielperson muss im Tenant existieren und Lehrperson/Admin sein.
    // E-Mail case-insensitiv (Konten können gemischte Schreibweise haben).
    const target = await this.prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        memberships: {
          some: {
            tenantId,
            status: MembershipStatus.ACTIVE,
            role: { in: [Role.TEACHER, Role.ADMIN] },
          },
        },
      },
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });
    if (!target) {
      throw new NotFoundException('Keine Lehrperson mit dieser E-Mail in der Schule gefunden.');
    }
    if (target.id === cls.ownerId) {
      throw new ConflictException('Diese Person ist bereits die besitzende Lehrperson.');
    }

    await this.prisma.classTeacher.upsert({
      where: { classId_userId: { classId: id, userId: target.id } },
      update: {},
      create: { classId: id, userId: target.id, addedById: userId },
    });
    return {
      userId: target.id,
      email: target.email,
      displayName: target.displayName,
      avatarUrl: target.avatarUrl,
    };
  }

  /** Entfernt eine Co-Leitung (nur Besitzerin/Admin). */
  async removeCoTeacher(
    id: string,
    coUserId: string,
    tenantId: string,
    userId: string,
    roles: Role[],
  ) {
    await this.assertOwnerOnly(id, tenantId, userId, roles);
    await this.prisma.classTeacher.deleteMany({ where: { classId: id, userId: coUserId } });
  }

  // ── Helfer ────────────────────────────────────────────────────

  /** Besitzerin ODER Co-Leitung ODER Admin – operativer Zugriff auf den Modulanlass. */
  private async assertAccess(id: string, tenantId: string, userId: string, roles: Role[]) {
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        status: true,
        year: true,
        schoolYear: true,
        createdAt: true,
        module: { select: { id: true, number: true, title: true } },
        _count: { select: { enrollments: true } },
        coTeachers: { where: { userId }, select: { userId: true } },
      },
    });
    if (!cls) throw new NotFoundException('Klasse nicht gefunden.');
    const hasAccess =
      cls.ownerId === userId || cls.coTeachers.length > 0 || roles.includes(Role.ADMIN);
    if (!hasAccess) {
      throw new ForbiddenException(
        'Nur die Lehrperson oder Co-Leitung des Modulanlasses hat Zugriff.',
      );
    }
    const { coTeachers: _ct, ...rest } = cls;
    return rest;
  }

  /** Nur die besitzende Lehrperson ODER Admin (Löschen, Co-Leitung verwalten). */
  private async assertOwnerOnly(id: string, tenantId: string, userId: string, roles: Role[]) {
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        status: true,
        year: true,
        schoolYear: true,
        createdAt: true,
        module: { select: { id: true, number: true, title: true } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!cls) throw new NotFoundException('Klasse nicht gefunden.');
    if (cls.ownerId !== userId && !roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Nur die besitzende Lehrperson der Klasse hat Zugriff.');
    }
    return cls;
  }

  private async assertModuleInTenant(moduleId: string, tenantId: string) {
    const module = await this.prisma.module.findFirst({ where: { id: moduleId, tenantId } });
    if (!module) throw new BadRequestException('Modul nicht gefunden.');
  }

  private async uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      }
      const exists = await this.prisma.joinCode.findUnique({ where: { code } });
      if (!exists) return code;
    }
    throw new BadRequestException('Konnte keinen eindeutigen Code erzeugen.');
  }
}
