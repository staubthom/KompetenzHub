import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { AssetsController } from '../storage/assets.controller';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

@Module({
  controllers: [EvidenceController, AssetsController],
  providers: [EvidenceService, PrismaService, S3Service],
  exports: [EvidenceService],
})
export class EvidenceModule {}
