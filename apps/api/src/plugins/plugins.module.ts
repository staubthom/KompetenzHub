import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginActivationService } from './plugin-activation.service';
import { PluginDataService } from './plugin-data.service';
import { PluginSecretService } from './plugin-secret.service';
import { PluginStorageService } from './plugin-storage.service';
import { PluginPermissionResolver } from './plugin-permission-resolver.service';
import { PluginContextFactory } from './plugin-context.factory';
import { PluginLifecycleService } from './plugin-lifecycle.service';
import { PluginDispatcherController } from './plugin-dispatcher.controller';
import { PluginAdminController } from './plugin-admin.controller';

/**
 * Kern-Modul der Plugin-Plattform: Registry (Discovery + Validierung), gescopte
 * Daten-/Secret-/Storage-Services, Aktivierung, Permission-Resolver, ServerContext-
 * Factory, Lifecycle sowie Dispatcher- und Admin-Controller.
 *
 * Wichtig: in app.module.ts BEWUSST als letztes Modul importieren, damit Kern-Routen
 * Vorrang beim Routing-Matching behalten (siehe planung/Planung_Plugin.md §20).
 */
@Module({
  controllers: [PluginDispatcherController, PluginAdminController],
  providers: [
    PrismaService,
    S3Service,
    PluginRegistryService,
    PluginActivationService,
    PluginDataService,
    PluginSecretService,
    PluginStorageService,
    PluginPermissionResolver,
    PluginContextFactory,
    PluginLifecycleService,
  ],
  exports: [PluginRegistryService],
})
export class PluginsCoreModule {}
