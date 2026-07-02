import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { StorageObjectsService } from '../storage/storage-objects.service';
import { ClassArchiveController } from './class-archive.controller';
import { ClassArchiveService } from './class-archive.service';

@Module({
  controllers: [ClassArchiveController],
  providers: [ClassArchiveService, PrismaService, S3Service, StorageObjectsService],
})
export class ClassArchiveModule {}
