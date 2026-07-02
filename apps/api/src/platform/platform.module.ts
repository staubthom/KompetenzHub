import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { StorageObjectsService } from '../storage/storage-objects.service';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { SuperAdminGuard } from './super-admin.guard';

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, SuperAdminGuard, PrismaService, S3Service, StorageObjectsService],
})
export class PlatformModule {}
