import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectivityService } from './connectivity.service';
import { Public } from '../auth/decorators';
import { APP_VERSION, GIT_SHA, BUILD_TIME } from '../common/version';

type ServiceState = 'up' | 'down';

@Controller('health')
@Public()
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
    gitSha: string;
    buildTime: string;
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
      version: APP_VERSION,
      gitSha: GIT_SHA,
      buildTime: BUILD_TIME,
      timestamp: new Date().toISOString(),
    };
  }
}
