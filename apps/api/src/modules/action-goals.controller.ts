import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class ActionGoalsController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /modules/:moduleId/action-goals */
  @Get('modules/:moduleId/action-goals')
  @Roles(Role.TEACHER, Role.ADMIN, Role.LEARNER)
  async list(@Param('moduleId') moduleId: string, @CurrentUser() user: RequestContext) {
    await this.assertModuleAccess(moduleId, user.tenantId);
    return this.prisma.actionGoal.findMany({
      where: { moduleId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** POST /modules/:moduleId/action-goals */
  @Post('modules/:moduleId/action-goals')
  @Roles(Role.TEACHER, Role.ADMIN)
  async create(
    @Param('moduleId') moduleId: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: RequestContext,
  ) {
    await this.assertModuleAccess(moduleId, user.tenantId);
    const code = String(dto.code ?? '').trim();
    if (!code) throw new BadRequestException('"code" ist erforderlich.');

    const last = await this.prisma.actionGoal.findFirst({
      where: { moduleId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? 0) + 1;

    return this.prisma.actionGoal.create({
      data: {
        moduleId,
        code,
        text: (dto.text ?? {}) as Prisma.InputJsonValue,
        sortOrder,
      },
    });
  }

  /** PATCH /action-goals/:id */
  @Patch('action-goals/:id')
  @Roles(Role.TEACHER, Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: RequestContext,
  ) {
    const goal = await this.prisma.actionGoal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundException('Handlungsziel nicht gefunden.');
    await this.assertModuleAccess(goal.moduleId, user.tenantId);

    return this.prisma.actionGoal.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: String(dto.code).trim() }),
        ...(dto.text !== undefined && { text: dto.text as Prisma.InputJsonValue }),
        ...(dto.sortOrder !== undefined && { sortOrder: Number(dto.sortOrder) }),
      },
    });
  }

  /** DELETE /action-goals/:id */
  @Delete('action-goals/:id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  async remove(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    const goal = await this.prisma.actionGoal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundException('Handlungsziel nicht gefunden.');
    await this.assertModuleAccess(goal.moduleId, user.tenantId);
    await this.prisma.actionGoal.delete({ where: { id } });
  }

  private async assertModuleAccess(moduleId: string, tenantId: string) {
    const module = await this.prisma.module.findFirst({
      where: { id: moduleId, tenantId },
    });
    if (!module) throw new NotFoundException('Modul nicht gefunden.');
  }
}
