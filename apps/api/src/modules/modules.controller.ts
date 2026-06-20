import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';

interface CreateModuleDto {
  number: string;
  title?: Record<string, string>;
}

/**
 * Demo-/Fundament-Controller für Sprint 1: zeigt RBAC (@Roles) und
 * automatisches Tenant-Scoping (PrismaService-Middleware) in Aktion.
 * Wird in Sprint 2 zum vollwertigen Matrix-Editor-Endpoint ausgebaut.
 */
@Controller('modules')
export class ModulesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liste der Module – automatisch auf den aktiven Tenant gescoped. */
  @Get()
  @Roles(Role.TEACHER, Role.ADMIN, Role.LEARNER)
  async list(): Promise<unknown> {
    return this.prisma.module.findMany({
      select: { id: true, number: true, title: true, status: true },
      orderBy: { number: 'asc' },
    });
  }

  /** Modul anlegen – nur Lehrperson/Admin; tenantId wird automatisch gesetzt. */
  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  async create(
    @Body() dto: CreateModuleDto,
    @CurrentUser() user: RequestContext,
  ): Promise<unknown> {
    const number = dto.number?.trim();
    if (!number) {
      throw new BadRequestException('Feld "number" ist erforderlich.');
    }
    return this.prisma.module.create({
      data: {
        // tenantId wird durch die Scoping-Middleware ergänzt
        number,
        title: dto.title ?? { de: `Modul ${number}` },

        ownerId: user.userId,
      } as never,
      select: { id: true, number: true, title: true, status: true },
    });
  }
}
