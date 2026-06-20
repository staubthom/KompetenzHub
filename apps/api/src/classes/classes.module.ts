import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
  controllers: [ClassesController],
  providers: [ClassesService, PrismaService],
  exports: [ClassesService],
})
export class ClassesModule {}
