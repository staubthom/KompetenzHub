import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { AiModule } from '../ai/ai.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [AiModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, PrismaService, S3Service],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
