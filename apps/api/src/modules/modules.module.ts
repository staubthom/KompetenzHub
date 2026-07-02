import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { StorageObjectsService } from '../storage/storage-objects.service';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { ActionGoalsController } from './action-goals.controller';

@Module({
  controllers: [ModulesController, ActionGoalsController],
  providers: [ModulesService, PrismaService, S3Service, StorageObjectsService],
  exports: [ModulesService],
})
export class ModulesModule {}
