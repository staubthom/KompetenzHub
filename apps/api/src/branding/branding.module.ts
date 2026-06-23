import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BrandingController } from './branding.controller';

@Module({
  controllers: [BrandingController],
  providers: [PrismaService],
})
export class BrandingModule {}
