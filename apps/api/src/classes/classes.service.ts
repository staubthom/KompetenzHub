import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClassStatus, EnrollmentStatus, Role } from '@prisma/client';
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

  /** Klassen der Lehrperson (Admins sehen alle des Tenants). */
  async list(tenantId: string, userId: string, roles: Role[]) {
    const isAdmin = roles.includes(Role.ADMIN);
    return this.prisma.class.findMany({
      where: { tenantId, ...(isAdmin ? {} : { ownerId: userId }) },
      select: {
        id: true,
        name: true,
        status: true,
        year: true,
        schoolYear: true,
        createdAt: true,
        module: { select: { id: true, number: true, title: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
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
    const cls = await this.assertOwner(id, tenantId, userId, roles);
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
    await this.assertOwner(id, tenantId, userId, roles);
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
    await this.assertOwner(id, tenantId, userId, roles);
    await this.prisma.class.delete({ where: { id } });
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
    await this.assertOwner(id, tenantId, userId, roles);
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
    await this.assertOwner(id, tenantId, userId, roles);
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
    await this.assertOwner(id, tenantId, userId, roles);
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { classId: id, userId: memberUserId },
    });
    if (!enrollment) throw new NotFoundException('Mitglied nicht gefunden.');
    await this.prisma.enrollment.delete({ where: { id: enrollment.id } });
  }

  // ── Helfer ────────────────────────────────────────────────────

  private async assertOwner(id: string, tenantId: string, userId: string, roles: Role[]) {
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
      throw new ForbiddenException('Nur die Lehrperson der Klasse hat Zugriff.');
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
