import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { getCurrentTenantId, getRequestContext } from '../common/request-context';

/**
 * Modelle mit `tenantId`-Spalte, die automatisch gescoped werden.
 * (User/Membership/AuditLog werden bewusst NICHT hier gescoped, da sie
 * tenant-übergreifend bzw. über Membership aufgelöst werden.)
 */
const TENANT_SCOPED_MODELS = new Set<string>(['Module', 'Class', 'CompetenceEvidence']);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    this.registerTenantScope();
    this.registerAuditEnrichment();
  }

  /**
   * Reichert jeden AuditLog-Eintrag zentral um IP und User-Agent aus dem Request-
   * Kontext an (sofern nicht explizit gesetzt). So müssen die einzelnen Audit-
   * Schreibstellen nichts davon wissen, und neue kommen automatisch dazu.
   */
  private registerAuditEnrichment(): void {
    this.$use(async (params, next) => {
      if (params.model === 'AuditLog' && params.action === 'create') {
        const ctx = getRequestContext();
        if (ctx) {
          params.args = params.args ?? {};
          const data = (params.args.data ?? {}) as Record<string, unknown>;
          if (data.ip == null && ctx.ip) data.ip = ctx.ip;
          if (data.userAgent == null && ctx.userAgent) data.userAgent = ctx.userAgent;
          params.args.data = data;
        }
      }
      return next(params);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Mit der Datenbank verbunden.');
    } catch (error) {
      this.logger.warn(
        `Keine DB-Verbindung beim Start (Health-Endpoint funktioniert trotzdem): ${String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Einfacher Verbindungstest fuer den Health-Check. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Zentrale Tenant-Scoping-Schicht: setzt `tenantId` automatisch in
   * Lese-/Schreibzugriffen auf gescopte Modelle anhand des Request-Kontexts.
   * Verhindert Cross-Tenant-Leaks ohne dass jede Query es manuell setzen muss.
   */
  private registerTenantScope(): void {
    this.$use(async (params, next) => {
      const model = params.model;
      if (!model || !TENANT_SCOPED_MODELS.has(model)) {
        return next(params);
      }
      const tenantId = getCurrentTenantId();
      if (!tenantId) {
        // Ohne Kontext (z. B. Seed/Tasks) nicht scopen.
        return next(params);
      }

      const action = params.action;
      params.args = params.args ?? {};

      switch (action) {
        case 'findFirst':
        case 'findMany':
        case 'count':
        case 'aggregate':
        case 'updateMany':
        case 'deleteMany': {
          params.args.where = this.andTenant(params.args.where, tenantId);
          break;
        }
        case 'findUnique':
        case 'findUniqueOrThrow': {
          // findUnique erlaubt kein beliebiges where → auf findFirst umbiegen
          params.action = 'findFirst';
          params.args.where = this.andTenant(params.args.where, tenantId);
          break;
        }
        case 'create': {
          params.args.data = { ...params.args.data, tenantId };
          break;
        }
        case 'createMany': {
          const data = params.args.data;
          if (Array.isArray(data)) {
            params.args.data = data.map((d: Record<string, unknown>) => ({ ...d, tenantId }));
          } else if (data) {
            params.args.data = { ...data, tenantId };
          }
          break;
        }
        case 'update':
        case 'delete': {
          // Einzel-Update/Delete per eindeutiger ID: zusätzlich Tenant prüfen,
          // indem wir vorab via findFirst die Ownership sicherstellen.
          const delegate = (
            this as unknown as Record<string, { findFirst: (args: unknown) => Promise<unknown> }>
          )[this.delegateName(model)];
          const existing = await delegate.findFirst({
            where: this.andTenant(params.args.where, tenantId),
            select: { id: true },
          });

          if (!existing) {
            // Kein Treffer im aktiven Tenant → wie "nicht gefunden" behandeln.
            throw new Prisma.PrismaClientKnownRequestError('Record not found in tenant scope', {
              code: 'P2025',
              clientVersion: Prisma.prismaVersion.client,
            });
          }
          break;
        }
        default:
          break;
      }

      return next(params);
    });
  }

  private andTenant(
    where: Record<string, unknown> | undefined,
    tenantId: string,
  ): Record<string, unknown> {
    return { ...(where ?? {}), tenantId };
  }

  private delegateName(model: string): string {
    return model.charAt(0).toLowerCase() + model.slice(1);
  }
}
