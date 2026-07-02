import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PlatformService } from './platform.service';
import { SuperAdminGuard } from './super-admin.guard';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';

class CreateTenantDto {
  @IsString()
  @MaxLength(32)
  slug!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsEmail()
  adminEmail?: string;
}

class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  // Gekaufte Speicherquota der Schule in Bytes. null = unbegrenzt.
  @IsOptional()
  @IsInt()
  @Min(0)
  quotaBytes?: number | null;
}

class AddAdminDto {
  @IsEmail()
  email!: string;
}

/** Client-IP (hinter Proxy: erster X-Forwarded-For-Eintrag) + User-Agent fürs Audit. */
function clientMeta(req: Request): { ip?: string; userAgent?: string } {
  const fwd = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() || req.ip || undefined;
  const ua = req.headers['user-agent'];
  return { ip, userAgent: typeof ua === 'string' ? ua.slice(0, 250) : undefined };
}

/**
 * Plattform-Verwaltung: Anlegen/Verwalten von Schulen (Mandanten). Nur für
 * Super-Admins (SUPERADMIN_EMAILS) – tenant-übergreifend.
 */
@Controller('platform/tenants')
@UseGuards(SuperAdminGuard)
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Superadmin schlüpft in die ADMIN-Rolle einer Schule: erzeugt einen
   * kurzlebigen Handoff-Code, den das Frontend im URL-Fragment an die
   * Ziel-Subdomain übergibt und dort gegen ein Session-JWT tauscht.
   */
  @Post(':id/impersonate')
  @HttpCode(200)
  impersonate(@Param('id') id: string, @CurrentUser() user: RequestContext, @Req() req: Request) {
    return this.auth.issueImpersonationCode(user.userId, id, clientMeta(req));
  }

  @Get()
  list() {
    return this.platform.listTenants();
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.platform.createTenant(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.platform.updateTenant(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.platform.deleteTenant(id);
  }

  // Speicherverbrauch einer Schule je Lehrperson
  @Get(':id/storage')
  storage(@Param('id') id: string) {
    return this.platform.storageByTeacher(id);
  }

  // Schuladmins eines Mandanten verwalten
  @Get(':id/admins')
  listAdmins(@Param('id') id: string) {
    return this.platform.listAdmins(id);
  }

  @Post(':id/admins')
  addAdmin(@Param('id') id: string, @Body() dto: AddAdminDto) {
    return this.platform.addAdmin(id, dto.email);
  }

  @Delete(':id/admins')
  @HttpCode(200)
  removeAdmin(
    @Param('id') id: string,
    @Query('userId') userId?: string,
    @Query('email') email?: string,
  ) {
    return this.platform.removeAdmin(id, { userId, email });
  }
}
