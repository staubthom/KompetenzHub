import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { MatrixIoController } from './matrix-io.controller';
import { MatrixIoService } from './matrix-io.service';

@Module({
  controllers: [MatrixIoController],
  providers: [MatrixIoService, PrismaService, S3Service],
})
export class MatrixIoModule {}
