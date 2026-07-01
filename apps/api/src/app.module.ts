import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TenantMiddleware } from './common/tenant.middleware';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HealthController } from './health/health.controller';
import { ConnectivityService } from './health/connectivity.service';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { ModulesModule } from './modules/modules.module';
import { MatrixModule } from './matrix/matrix.module';
import { ClassesModule } from './classes/classes.module';
import { EvidenceModule } from './evidence/evidence.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AiModule } from './ai/ai.module';
import { ExpertTalkModule } from './expert-talk/expert-talk.module';
import { LearningPathsModule } from './learning-paths/learning-paths.module';
import { MatrixIoModule } from './matrix-io/matrix-io.module';
import { ClassArchiveModule } from './class-archive/class-archive.module';
import { AdminModule } from './admin/admin.module';
import { BrandingModule } from './branding/branding.module';
import { MailModule } from './mail/mail.module';
import { PluginsCoreModule } from './plugins/plugins.module';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [
    // Rate Limiting pro IP. Grosszügig, da ganze Klassen hinter einer
    // Schul-IP (NAT) arbeiten können; über ENV tunebar.
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60_000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 300),
      },
    ]),
    // Cron-Scheduler (Tages-Digest um 04:00). Global registriert.
    ScheduleModule.forRoot(),
    // Global: stellt MailService/DigestService bereit (vor Modulen, die sie nutzen).
    MailModule,
    AuthModule,
    PlatformModule,
    AdminModule,
    BrandingModule,
    ModulesModule,
    MatrixModule,
    ClassesModule,
    EvidenceModule,
    SubmissionsModule,
    DashboardModule,
    AiModule,
    ExpertTalkModule,
    LearningPathsModule,
    MatrixIoModule,
    ClassArchiveModule,
    // Bewusst zuletzt: Kern-Routen behalten Vorrang beim Routing-Matching,
    // bevor der spätere Plugin-Dispatcher greift (siehe planung/Planung_Plugin.md §20).
    PluginsCoreModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    ConnectivityService,
    // Reihenfolge wichtig: zuerst Rate Limiting, dann Authentifizierung
    // (setzt req.user), danach Rollenprüfung.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Tenant-Auflösung für alle Routen – ausser Health (muss auch ohne
    // gültige Subdomain, z. B. beim internen Container-Check, erreichbar sein).
    consumer
      .apply(TenantMiddleware)
      .exclude({ path: 'health', method: RequestMethod.ALL })
      .forRoutes('*');
  }
}
