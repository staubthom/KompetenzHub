import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LearningPathsController } from './learning-paths.controller';
import { LearningPathsService } from './learning-paths.service';

@Module({
  controllers: [LearningPathsController],
  providers: [LearningPathsService, PrismaService],
})
export class LearningPathsModule {}
