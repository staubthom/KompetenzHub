import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectivityService } from '../health/connectivity.service';
import { S3Service } from '../storage/s3.service';
import { StorageObjectsService } from '../storage/storage-objects.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, PrismaService, ConnectivityService, S3Service, StorageObjectsService],
})
export class AdminModule {}
