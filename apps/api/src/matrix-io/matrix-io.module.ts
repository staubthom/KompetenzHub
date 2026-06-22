import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatrixIoController } from './matrix-io.controller';
import { MatrixIoService } from './matrix-io.service';

@Module({
  controllers: [MatrixIoController],
  providers: [MatrixIoService, PrismaService],
})
export class MatrixIoModule {}
