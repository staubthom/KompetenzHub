import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { StorageObjectsService } from '../storage/storage-objects.service';
import { MatrixIoController } from './matrix-io.controller';
import { MatrixIoService } from './matrix-io.service';

@Module({
  controllers: [MatrixIoController],
  providers: [MatrixIoService, PrismaService, S3Service, StorageObjectsService],
})
export class MatrixIoModule {}
