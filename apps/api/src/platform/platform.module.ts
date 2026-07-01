import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { SuperAdminGuard } from './super-admin.guard';

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, SuperAdminGuard, PrismaService],
})
export class PlatformModule {}
