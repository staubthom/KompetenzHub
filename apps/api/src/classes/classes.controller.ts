import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { ClassesService } from './classes.service';

class AddCoTeacherDto {
  @IsEmail()
  email!: string;
}

class JoinDto {
  @IsString()
  @MaxLength(12)
  code!: string;
}

@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  // ── FA-20: Klassen-CRUD ───────────────────────────────────────

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN)
  list(@Query('archived') archived: string | undefined, @CurrentUser() user: RequestContext) {
    return this.classes.list(user.tenantId, user.userId, user.roles, archived === 'true');
  }

  /** Eigene Klassenmitgliedschaften der/des Lernenden (inkl. Modul). */
  @Get('mine')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  mine(@CurrentUser() user: RequestContext) {
    return this.classes.listMine(user.tenantId, user.userId);
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

  // ── FA-103: Archivieren / Wiederherstellen ────────────────────

  @Post(':id/archive')
  @Roles(Role.TEACHER, Role.ADMIN)
  archive(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.classes.archive(id, user.tenantId, user.userId, user.roles);
  }

  @Post(':id/restore')
  @Roles(Role.TEACHER, Role.ADMIN)
  restore(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.classes.restore(id, user.tenantId, user.userId, user.roles);
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
  join(@Body() dto: JoinDto, @CurrentUser() user: RequestContext) {
    return this.classes.joinByCode(dto.code, user.tenantId, user.userId);
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

  // ── Co-Leitung / Co-Teaching ──────────────────────────────────

  @Get(':id/co-teachers')
  @Roles(Role.TEACHER, Role.ADMIN)
  coTeachers(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.classes.listCoTeachers(id, user.tenantId, user.userId, user.roles);
  }

  @Post(':id/co-teachers')
  @Roles(Role.TEACHER, Role.ADMIN)
  addCoTeacher(
    @Param('id') id: string,
    @Body() dto: AddCoTeacherDto,
    @CurrentUser() user: RequestContext,
  ) {
    return this.classes.addCoTeacher(id, dto.email, user.tenantId, user.userId, user.roles);
  }

  @Delete(':id/co-teachers/:userId')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  removeCoTeacher(
    @Param('id') id: string,
    @Param('userId') coUserId: string,
    @CurrentUser() user: RequestContext,
  ) {
    return this.classes.removeCoTeacher(id, coUserId, user.tenantId, user.userId, user.roles);
  }
}
