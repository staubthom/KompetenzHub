import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface I18nField {
  de?: string;
  fr?: string;
  it?: string;
  en?: string;
}

export interface CreateModuleDto {
  number: string;
  title: I18nField;
  description?: I18nField;
  profession?: string;
}

export interface UpdateModuleDto {
  title?: I18nField;
  description?: I18nField;
  profession?: string;
  status?: ModuleStatus;
}

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.module.findMany({
      where: { tenantId },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        profession: true,
        status: true,
        createdAt: true,
        _count: { select: { actionGoals: true } },
        matrix: { select: { id: true, status: true, _count: { select: { bands: true } } } },
      },
      orderBy: { number: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const module = await this.prisma.module.findFirst({
      where: { id, tenantId },
      include: {
        actionGoals: { orderBy: { sortOrder: 'asc' } },
        matrix: {
          include: {
            bands: {
              orderBy: { sortOrder: 'asc' },
              include: {
                fields: {
                  orderBy: { level: 'asc' },
                  include: { descriptor: true },
                },
                actionGoals: { include: { actionGoal: true } },
              },
            },
          },
        },
      },
    });
    if (!module) throw new NotFoundException(`Modul ${id} nicht gefunden.`);
    return module;
  }

  async create(dto: CreateModuleDto, tenantId: string, ownerId: string) {
    const number = dto.number?.trim();
    if (!number) throw new BadRequestException('"number" ist erforderlich.');
    if (!dto.title?.de) throw new BadRequestException('"title.de" ist erforderlich.');

    const exists = await this.prisma.module.findFirst({ where: { tenantId, number } });
    if (exists) throw new ConflictException(`Modul ${number} existiert bereits.`);

    const module = await this.prisma.module.create({
      data: {
        tenantId,
        ownerId,
        number,
        title: dto.title as Prisma.InputJsonValue,
        description: (dto.description ?? {}) as Prisma.InputJsonValue,
        profession: dto.profession,
      },
      select: { id: true, number: true, title: true, status: true, createdAt: true },
    });

    // Automatisch leere Matrix anlegen
    await this.prisma.competenceMatrix.create({
      data: { moduleId: module.id },
    });

    return module;
  }

  async update(id: string, dto: UpdateModuleDto, tenantId: string) {
    await this.assertExists(id, tenantId);
    return this.prisma.module.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title as Prisma.InputJsonValue }),
        ...(dto.description !== undefined && {
          description: dto.description as Prisma.InputJsonValue,
        }),
        ...(dto.profession !== undefined && { profession: dto.profession }),
        ...(dto.status && { status: dto.status }),
      },
      select: { id: true, number: true, title: true, status: true, updatedAt: true },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.assertExists(id, tenantId);
    await this.prisma.module.delete({ where: { id } });
  }

  private async assertExists(id: string, tenantId: string) {
    const found = await this.prisma.module.findFirst({ where: { id, tenantId } });
    if (!found) throw new NotFoundException(`Modul ${id} nicht gefunden.`);
    return found;
  }
}
