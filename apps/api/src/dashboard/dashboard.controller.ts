import { Controller, Get, Param } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { DashboardService } from './dashboard.service';

@Controller('classes')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Fortschritts-Dashboard eines Modulanlasses (FA-90/91). */
  @Get(':id/progress')
  @Roles(Role.TEACHER, Role.ADMIN)
  progress(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.dashboard.progress(id, user.tenantId, user.userId, user.roles);
  }
}
