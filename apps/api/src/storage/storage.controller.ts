import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { StorageObjectsService } from './storage-objects.service';
import { StorageGcService } from './storage-gc.service';

/**
 * Speicherverbrauch-Auskunft (tenant-scoped):
 * - Lehrperson: eigener Verbrauch.
 * - Schuladmin: Gesamt + Aufschlüsselung je Lehrperson der eigenen Schule.
 */
@Controller('storage')
export class StorageController {
  constructor(
    private readonly storage: StorageObjectsService,
    private readonly gcService: StorageGcService,
  ) {}

  /** Eigener Speicherverbrauch der aktuellen Lehrperson/Person. */
  @Get('my-usage')
  @Roles(Role.TEACHER, Role.ADMIN)
  async myUsage(@CurrentUser() user: RequestContext): Promise<{ bytes: number }> {
    return { bytes: await this.storage.usageForTeacher(user.tenantId, user.userId) };
  }

  /** Schul-Übersicht (nur Schuladmin): Gesamt + je Lehrperson. */
  @Get('school')
  @Roles(Role.ADMIN)
  school(@CurrentUser() user: RequestContext) {
    return this.storage.schoolUsage(user.tenantId);
  }

  /** Verwaiste Rich-Text-Bilder der eigenen Schule aufräumen (nur Schuladmin). */
  @Post('gc')
  @HttpCode(200)
  @Roles(Role.ADMIN)
  gc(@CurrentUser() user: RequestContext) {
    return this.gcService.runForTenant(user.tenantId);
  }
}
