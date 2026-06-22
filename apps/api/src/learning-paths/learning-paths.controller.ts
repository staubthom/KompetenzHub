import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { LearningPathsService } from './learning-paths.service';

@Controller()
export class LearningPathsController {
  constructor(private readonly paths: LearningPathsService) {}

  // ── FA-84: Lernpfade verwalten (Lehrperson) ───────────────────

  @Get('matrices/:matrixId/paths')
  @Roles(Role.TEACHER, Role.ADMIN)
  list(@Param('matrixId') matrixId: string, @CurrentUser() user: RequestContext) {
    return this.paths.list(matrixId, user.tenantId);
  }

  @Post('matrices/:matrixId/paths')
  @Roles(Role.TEACHER, Role.ADMIN)
  create(
    @Param('matrixId') matrixId: string,
    @Body() dto: { name?: string; fieldIds?: string[]; isActive?: boolean },
    @CurrentUser() user: RequestContext,
  ) {
    return this.paths.create(
      matrixId,
      user.tenantId,
      dto?.name ?? '',
      dto?.fieldIds ?? [],
      dto?.isActive ?? false,
    );
  }

  @Patch('paths/:id')
  @Roles(Role.TEACHER, Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; fieldIds?: string[]; isActive?: boolean },
    @CurrentUser() user: RequestContext,
  ) {
    return this.paths.update(id, user.tenantId, dto ?? {});
  }

  @Delete('paths/:id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.paths.remove(id, user.tenantId);
  }

  // ── Aktiver Pfad mit Status & empfohlenem nächsten Schritt ─────

  @Get('modules/:moduleId/learning-path')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  activeForModule(@Param('moduleId') moduleId: string, @CurrentUser() user: RequestContext) {
    return this.paths.getActiveForModule(moduleId, user.tenantId, user.userId, user.roles);
  }
}
