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
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PlatformService } from './platform.service';
import { SuperAdminGuard } from './super-admin.guard';

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

/**
 * Plattform-Verwaltung: Anlegen/Verwalten von Schulen (Mandanten). Nur für
 * Super-Admins (SUPERADMIN_EMAILS) – tenant-übergreifend.
 */
@Controller('platform/tenants')
@UseGuards(SuperAdminGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

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
