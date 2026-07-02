import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from './s3.service';
import { StorageController } from './storage.controller';
import { StorageObjectsService } from './storage-objects.service';
import { StorageGcService } from './storage-gc.service';

@Module({
  controllers: [StorageController],
  providers: [StorageObjectsService, PrismaService, S3Service, StorageGcService],
})
export class StorageModule {}
