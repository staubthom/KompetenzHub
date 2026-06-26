import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { PluginLifecycleService } from './plugin-lifecycle.service';

interface ConfigDto {
  config?: Record<string, unknown>;
}

/**
 * Schuladmin-Verwaltung der Plugins (§17 P4): Liste + Enable/Disable/Konfig/Uninstall
 * pro Tenant. Nur ADMIN. Liegt unter /api/v1/admin/plugins (kollidiert nicht mit dem
 * generischen Dispatcher unter /api/v1/plugins).
 */
@Controller('admin/plugins')
@Roles(Role.ADMIN)
export class PluginAdminController {
  constructor(private readonly lifecycle: PluginLifecycleService) {}

  @Get()
  list(@CurrentUser() user: RequestContext) {
    return this.lifecycle.listForTenant(user.tenantId);
  }

  @Post(':id/enable')
  @HttpCode(200)
  enable(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.lifecycle.enable(id, user.tenantId, user.userId);
  }

  @Post(':id/disable')
  @HttpCode(200)
  disable(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.lifecycle.disable(id, user.tenantId, user.userId);
  }

  @Patch(':id/config')
  configure(@Param('id') id: string, @Body() dto: ConfigDto, @CurrentUser() user: RequestContext) {
    const config = (dto.config ?? {}) as Prisma.InputJsonValue;
    return this.lifecycle.configure(id, user.tenantId, user.userId, config);
  }

  @Post(':id/uninstall')
  @HttpCode(200)
  uninstall(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.lifecycle.uninstall(id, user.tenantId, user.userId);
  }
}
