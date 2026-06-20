import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { ConnectivityService } from './health/connectivity.service';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [],
  controllers: [HealthController],
  providers: [PrismaService, ConnectivityService],
})
export class AppModule {}
