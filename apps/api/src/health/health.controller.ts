import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectivityService } from './connectivity.service';

type ServiceState = 'up' | 'down';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectivity: ConnectivityService,
  ) {}

  @Get()
  async check(): Promise<{
    status: 'ok' | 'degraded';
    service: string;
    db: ServiceState;
    redis: ServiceState;
    s3: ServiceState;
    version: string;
    timestamp: string;
  }> {
    const [dbHealthy, redisHealthy, s3Healthy] = await Promise.all([
      this.prisma.isHealthy(),
      this.connectivity.isRedisReachable(),
      this.connectivity.isS3Reachable(),
    ]);

    const allUp = dbHealthy && redisHealthy && s3Healthy;

    return {
      status: allUp ? 'ok' : 'degraded',
      service: 'kompetenzhub-api',
      db: dbHealthy ? 'up' : 'down',
      redis: redisHealthy ? 'up' : 'down',
      s3: s3Healthy ? 'up' : 'down',
      version: process.env.npm_package_version ?? '0.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
