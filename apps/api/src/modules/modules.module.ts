import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { ActionGoalsController } from './action-goals.controller';

@Module({
  controllers: [ModulesController, ActionGoalsController],
  providers: [ModulesService, PrismaService],
  exports: [ModulesService],
})
export class ModulesModule {}
