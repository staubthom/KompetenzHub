import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { ConnectivityService } from './health/connectivity.service';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { ModulesController } from './modules/modules.controller';

@Module({
  imports: [AuthModule],
  controllers: [HealthController, ModulesController],
  providers: [
    PrismaService,
    ConnectivityService,
    // Reihenfolge wichtig: zuerst Authentifizierung (setzt req.user),
    // danach Rollenprüfung.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
