import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { BrandingController } from './branding.controller';

@Module({
  controllers: [BrandingController],
  providers: [PrismaService, S3Service],
})
export class BrandingModule {}
