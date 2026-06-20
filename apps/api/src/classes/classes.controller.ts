import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { ClassesService } from './classes.service';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  // ── FA-20: Klassen-CRUD ───────────────────────────────────────

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN)
  list(@CurrentUser() user: RequestContext) {
    return this.classes.list(user.tenantId, user.userId, user.roles);
  }

  @Get(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.classes.findOne(id, user.tenantId, user.userId, user.roles);
  }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  create(@Body() dto: Record<string, unknown>, @CurrentUser() user: RequestContext) {
    return this.classes.create(dto as never, user.tenantId, user.userId);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: RequestContext,
  ) {
    return this.classes.update(id, dto as never, user.tenantId, user.userId, user.roles);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.classes.remove(id, user.tenantId, user.userId, user.roles);
  }

  // ── FA-23: Beitrittscode ──────────────────────────────────────

  /** Code generieren/erneuern (invalidiert den alten). */
  @Post(':id/join-code')
  @Roles(Role.TEACHER, Role.ADMIN)
  generateCode(
    @Param('id') id: string,
    @Body() dto: { expiresAt?: string },
    @CurrentUser() user: RequestContext,
  ) {
    const expiresAt = dto?.expiresAt ? new Date(dto.expiresAt) : undefined;
    return this.classes.generateJoinCode(id, user.tenantId, user.userId, user.roles, expiresAt);
  }

  /** Lernende:r tritt per Code bei. */
  @Post('join')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  join(@Body() dto: { code?: string }, @CurrentUser() user: RequestContext) {
    return this.classes.joinByCode(dto?.code ?? '', user.tenantId, user.userId);
  }

  // ── FA-25: Mitglieder ─────────────────────────────────────────

  @Get(':id/members')
  @Roles(Role.TEACHER, Role.ADMIN)
  members(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.classes.listMembers(id, user.tenantId, user.userId, user.roles);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  removeMember(
    @Param('id') id: string,
    @Param('userId') memberUserId: string,
    @CurrentUser() user: RequestContext,
  ) {
    return this.classes.removeMember(id, memberUserId, user.tenantId, user.userId, user.roles);
  }
}
