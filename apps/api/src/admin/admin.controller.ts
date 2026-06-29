import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { MailTemplateType, Role } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { AdminService } from './admin.service';
import { DigestService } from '../mail/digest.service';

interface RoleDto {
  role?: Role;
}
interface StatusDto {
  active?: boolean;
}
class InviteDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
interface SettingsDto {
  schoolName?: string;
  authProviders?: { microsoft?: boolean; google?: boolean; github?: boolean };
  logoUrl?: string | null;
  primaryColor?: string;
  defaultLocale?: string;
}
interface UserPatchDto {
  displayName?: string;
}

/** Schuladmin-Dashboard: Personen, Einladungen, Einstellungen. Nur ADMIN. */
@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly digest: DigestService,
  ) {}

  @Get('overview')
  overview(@CurrentUser() user: RequestContext) {
    return this.admin.overview(user.tenantId);
  }

  // ── Personen ──
  @Get('users')
  users(@CurrentUser() user: RequestContext) {
    return this.admin.listUsers(user.tenantId);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() dto: UserPatchDto,
    @CurrentUser() user: RequestContext,
  ) {
    return this.admin.updateUser(user.tenantId, id, { displayName: dto.displayName });
  }

  @Patch('users/:id/role')
  setRole(@Param('id') id: string, @Body() dto: RoleDto, @CurrentUser() user: RequestContext) {
    if (!dto.role || !Object.values(Role).includes(dto.role)) {
      throw new BadRequestException('Gültige Rolle erforderlich.');
    }
    return this.admin.setUserRole(user.tenantId, user.userId, id, dto.role);
  }

  @Patch('users/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: StatusDto, @CurrentUser() user: RequestContext) {
    if (typeof dto.active !== 'boolean') {
      throw new BadRequestException('Feld "active" (boolean) erforderlich.');
    }
    return this.admin.setUserStatus(user.tenantId, user.userId, id, dto.active);
  }

  @Delete('users/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: RequestContext): Promise<void> {
    await this.admin.removeUser(user.tenantId, user.userId, id);
  }

  // ── Einladungen ──
  @Get('invitations')
  invitations(@CurrentUser() user: RequestContext) {
    return this.admin.listInvitations(user.tenantId);
  }

  @Post('invitations')
  invite(@Body() dto: InviteDto, @CurrentUser() user: RequestContext) {
    if (!dto.email) throw new BadRequestException('E-Mail erforderlich.');
    return this.admin.createInvitation(
      user.tenantId,
      user.userId,
      dto.email,
      dto.role ?? Role.TEACHER,
    );
  }

  @Delete('invitations/:id')
  @HttpCode(204)
  async revoke(@Param('id') id: string, @CurrentUser() user: RequestContext): Promise<void> {
    await this.admin.revokeInvitation(user.tenantId, id);
  }

  // ── Einstellungen ──
  @Get('settings')
  settings(@CurrentUser() user: RequestContext) {
    return this.admin.getSettings(user.tenantId);
  }

  @Patch('settings')
  updateSettings(@Body() dto: SettingsDto, @CurrentUser() user: RequestContext) {
    return this.admin.updateSettings(user.tenantId, dto ?? {});
  }

  // ── Betrieb & Gesundheit / Audit / Backup ──
  @Get('ops')
  ops(@CurrentUser() user: RequestContext) {
    return this.admin.ops(user.tenantId);
  }

  @Get('audit')
  audit(@Query('limit') limit: string | undefined, @CurrentUser() user: RequestContext) {
    return this.admin.audit(user.tenantId, limit ? Number(limit) : 100);
  }

  // ── E-Mail-Benachrichtigungen ──
  /** Tages-Digest für die eigene Schule sofort auslösen (statt erst um 04:00). */
  @Post('notifications/digest-run')
  digestRun(@CurrentUser() user: RequestContext) {
    return this.digest.runForTenant(user.tenantId).then((mails) => ({ mails }));
  }

  /** Wochenbericht für die eigene Schule sofort auslösen. */
  @Post('notifications/weekly-report-run')
  weeklyReportRun(@CurrentUser() user: RequestContext) {
    return this.digest.runWeeklyReportForTenant(user.tenantId).then((mails) => ({ mails }));
  }

  /** Einladungs-Erinnerungen für die eigene Schule sofort auslösen. */
  @Post('notifications/invite-reminders-run')
  inviteRemindersRun(@CurrentUser() user: RequestContext) {
    return this.digest.runInviteRemindersForTenant(user.tenantId).then((mails) => ({ mails }));
  }

  // ── E-Mail-Vorlagen ──
  @Get('mail-templates')
  mailTemplates(@CurrentUser() user: RequestContext) {
    return this.admin.listMailTemplates(user.tenantId);
  }

  @Put('mail-templates/:type/:locale')
  updateMailTemplate(
    @Param('type') type: MailTemplateType,
    @Param('locale') locale: string,
    @Body() dto: { subject?: string | null; body?: string | null },
    @CurrentUser() user: RequestContext,
  ) {
    return this.admin.updateMailTemplate(user.tenantId, type, locale, dto ?? {});
  }

  @Delete('mail-templates/:type/:locale')
  @HttpCode(204)
  async resetMailTemplate(
    @Param('type') type: MailTemplateType,
    @Param('locale') locale: string,
    @CurrentUser() user: RequestContext,
  ): Promise<void> {
    await this.admin.resetMailTemplate(user.tenantId, type, locale);
  }

  @Get('backup')
  async backup(@CurrentUser() user: RequestContext, @Res() res: Response): Promise<void> {
    const { buffer, filename } = await this.admin.backupZip(user.tenantId);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }
}
