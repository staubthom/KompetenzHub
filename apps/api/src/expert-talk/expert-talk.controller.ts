import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { ExpertTalkService } from './expert-talk.service';

@Controller('expert-talk')
export class ExpertTalkController {
  constructor(private readonly expertTalk: ExpertTalkService) {}

  // ── FA-80: KI-Fachgespräch (Übungsmodus) ──────────────────────

  /** Ob im Mandanten eine KI aktiv ist (steuert die KI-Übung im Abgabe-Dialog). */
  @Get('available')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  available(@CurrentUser() user: RequestContext) {
    return this.expertTalk.available(user.tenantId);
  }

  /** Eigene Übungs-Gespräche auflisten. */
  @Get('sessions')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  list(@CurrentUser() user: RequestContext) {
    return this.expertTalk.listSessions(user.tenantId, user.userId);
  }

  /** Neues Übungs-Gespräch zu einem Thema starten (KI stellt die erste Frage). */
  @Post('sessions')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  create(@Body() dto: { topic?: string; context?: string }, @CurrentUser() user: RequestContext) {
    return this.expertTalk.createSession(
      user.tenantId,
      user.userId,
      dto?.topic ?? '',
      dto?.context ?? '',
    );
  }

  /** Modul-weites Lerngespräch starten (Kontext = alle Kompetenzen der Matrix). */
  @Post('module-sessions')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  createModule(@Body() dto: { moduleId?: string }, @CurrentUser() user: RequestContext) {
    return this.expertTalk.createModuleSession(user.tenantId, user.userId, dto?.moduleId ?? '');
  }

  /** Gesprächsverlauf abrufen. */
  @Get('sessions/:id')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  get(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.expertTalk.getSession(user.tenantId, user.userId, id);
  }

  /** Antwort senden → KI antwortet (eine Frage/Feedback). */
  @Post('sessions/:id/messages')
  @HttpCode(200)
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  message(
    @Param('id') id: string,
    @Body() dto: { content?: string },
    @CurrentUser() user: RequestContext,
  ) {
    return this.expertTalk.postMessage(user.tenantId, user.userId, id, dto?.content ?? '');
  }

  /** Gespräch abschliessen. */
  @Post('sessions/:id/complete')
  @HttpCode(200)
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  complete(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.expertTalk.complete(user.tenantId, user.userId, id);
  }
}
