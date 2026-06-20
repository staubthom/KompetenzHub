import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatrixController } from './matrix.controller';
import { FieldsController } from './fields.controller';

@Module({
  controllers: [MatrixController, FieldsController],
  providers: [PrismaService],
})
export class MatrixModule {}
