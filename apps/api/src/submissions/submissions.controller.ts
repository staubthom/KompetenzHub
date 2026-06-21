import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role, SubmissionStatus, AchievedLevel } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { SubmissionsService } from './submissions.service';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  /** Bewertungs-Queue / Liste (FA-92-Basis). */
  @Get()
  @Roles(Role.TEACHER, Role.ADMIN)
  list(
    @Query('status') status: SubmissionStatus | undefined,
    @Query('classId') classId: string | undefined,
    @Query('evidenceId') evidenceId: string | undefined,
    @CurrentUser() user: RequestContext,
  ) {
    return this.submissions.list(user.tenantId, { status, classId, evidenceId });
  }

  @Get(':id')
  @Roles(Role.TEACHER, Role.ADMIN, Role.LEARNER)
  detail(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.submissions.detail(id, user.tenantId, user.userId, user.roles);
  }

  @Get(':id/history')
  @Roles(Role.TEACHER, Role.ADMIN, Role.LEARNER)
  history(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.submissions.history(id, user.tenantId, user.userId, user.roles);
  }

  /** Bewerten (FA-60). */
  @Post(':id/evaluation')
  @Roles(Role.TEACHER, Role.ADMIN)
  evaluate(
    @Param('id') id: string,
    @Body() dto: { points?: number; level?: AchievedLevel; feedback?: string },
    @CurrentUser() user: RequestContext,
  ) {
    return this.submissions.evaluate(id, dto, user.tenantId, user.userId);
  }

  /** Zurückweisen (FA-62). */
  @Post(':id/reject')
  @Roles(Role.TEACHER, Role.ADMIN)
  reject(
    @Param('id') id: string,
    @Body() dto: { reason?: string },
    @CurrentUser() user: RequestContext,
  ) {
    return this.submissions.reject(id, dto?.reason ?? '', user.tenantId, user.userId);
  }
}
