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
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { AdminService } from './admin.service';

interface RoleDto {
  role?: Role;
}
interface StatusDto {
  active?: boolean;
}
interface InviteDto {
  email?: string;
  role?: Role;
}
interface SettingsDto {
  schoolName?: string;
  authProviders?: { microsoft?: boolean; google?: boolean };
  logoUrl?: string | null;
}

/** Schuladmin-Dashboard: Personen, Einladungen, Einstellungen. Nur ADMIN. */
@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview(@CurrentUser() user: RequestContext) {
    return this.admin.overview(user.tenantId);
  }

  // ── Personen ──
  @Get('users')
  users(@CurrentUser() user: RequestContext) {
    return this.admin.listUsers(user.tenantId);
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
}
