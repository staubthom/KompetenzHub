import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { AiService, type AiConfigInput } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  // ── FA-34: KI-Konfiguration je Lehrperson ─────────────────────

  /** Aktuelle Konfiguration (ohne Klartext-Key). */
  @Get('config')
  @Roles(Role.TEACHER, Role.ADMIN)
  getConfig(@CurrentUser() user: RequestContext) {
    return this.ai.getConfig(user.tenantId, user.userId);
  }

  /** Konfiguration speichern/aktualisieren. */
  @Put('config')
  @Roles(Role.TEACHER, Role.ADMIN)
  saveConfig(@Body() dto: AiConfigInput, @CurrentUser() user: RequestContext) {
    return this.ai.saveConfig(user.tenantId, user.userId, dto ?? {});
  }

  /** Verbindungstest gegen den konfigurierten Endpoint. */
  @Post('config/test')
  @HttpCode(200)
  @Roles(Role.TEACHER, Role.ADMIN)
  test(@Body() dto: AiConfigInput, @CurrentUser() user: RequestContext) {
    return this.ai.testConnection(user.tenantId, user.userId, dto ?? {});
  }

  /** Feature-Gate-Status (configured/enabled) – für KI-Funktionen. */
  @Get('status')
  @Roles(Role.TEACHER, Role.ADMIN)
  status(@CurrentUser() user: RequestContext) {
    return this.ai.getStatus(user.tenantId, user.userId);
  }
}
