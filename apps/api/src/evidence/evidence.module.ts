import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { StorageObjectsService } from '../storage/storage-objects.service';
import { AssetsController } from '../storage/assets.controller';
import { SubmissionsModule } from '../submissions/submissions.module';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [SubmissionsModule],
  controllers: [EvidenceController, AssetsController],
  providers: [EvidenceService, PrismaService, S3Service, StorageObjectsService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
