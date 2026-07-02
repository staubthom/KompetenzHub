import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
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

  /** Eigener Speicherverbrauch der aktuellen Lehrperson/Person inkl. Quota. */
  @Get('my-usage')
  @Roles(Role.TEACHER, Role.ADMIN)
  async myUsage(
    @CurrentUser() user: RequestContext,
  ): Promise<{ bytes: number; quotaBytes: number | null }> {
    const [bytes, quotaBytes] = await Promise.all([
      this.storage.usageForTeacher(user.tenantId, user.userId),
      this.storage.teacherQuota(user.tenantId, user.userId),
    ]);
    return { bytes, quotaBytes };
  }

  /** Schul-Übersicht (nur Schuladmin): Gesamt + Schulquota + je Lehrperson. */
  @Get('school')
  @Roles(Role.ADMIN)
  school(@CurrentUser() user: RequestContext) {
    return this.storage.schoolUsage(user.tenantId);
  }

  /**
   * Persönliche Speicherquota einer Lehrperson setzen (nur Schuladmin).
   * `quotaBytes: null` hebt die Begrenzung auf. Die Summe aller LP-Quotas darf
   * die Schulquota bewusst übersteigen (Overcommit) – daher keine Kreuzprüfung.
   */
  @Patch('teachers/:userId/quota')
  @Roles(Role.ADMIN)
  async setTeacherQuota(
    @Param('userId') userId: string,
    @Body() dto: { quotaBytes?: number | null },
    @CurrentUser() user: RequestContext,
  ): Promise<{ ok: true }> {
    const q = dto?.quotaBytes;
    if (q !== null && q !== undefined && (typeof q !== 'number' || !Number.isFinite(q) || q < 0)) {
      throw new BadRequestException('quotaBytes muss null oder eine Zahl ≥ 0 sein.');
    }
    await this.storage.setTeacherQuota(user.tenantId, userId, q ?? null);
    return { ok: true };
  }

  /** Verwaiste Rich-Text-Bilder der eigenen Schule aufräumen (nur Schuladmin). */
  @Post('gc')
  @HttpCode(200)
  @Roles(Role.ADMIN)
  gc(@CurrentUser() user: RequestContext) {
    return this.gcService.runForTenant(user.tenantId);
  }
}
