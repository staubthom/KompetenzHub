import { AsyncLocalStorage } from 'node:async_hooks';
import { Role } from '@prisma/client';

/**
 * Pro-Request abgeleiteter Sicherheitskontext (aus dem JWT).
 * Wird via AsyncLocalStorage durch die gesamte Request-Verarbeitung getragen,
 * damit z. B. die Prisma-Scoping-Schicht den aktiven Tenant kennt.
 */
export interface RequestContext {
  userId: string;
  tenantId: string;
  roles: Role[];
  locale: string;
  /**
   * Der aus der Subdomain (bzw. X-Tenant-Slug) aufgelöste Tenant der Anfrage.
   * Wird von der TenantMiddleware gesetzt – noch bevor das JWT geprüft ist.
   * Der JwtAuthGuard verlangt anschliessend, dass `payload.tid` hiermit
   * übereinstimmt (verhindert die Nutzung eines Tokens auf fremder Subdomain).
   */
  resolvedTenantId?: string;
  /** Client-IP der Anfrage (fürs Audit-Log). */
  ip?: string;
  /** User-Agent der Anfrage (fürs Audit-Log). */
  userAgent?: string;
}

export const requestContextStore = new AsyncLocalStorage<RequestContext>();

/** Liefert den aktuellen Request-Kontext oder undefined (z. B. System-Tasks). */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStore.getStore();
}

/** Liefert die aktive tenantId oder undefined, wenn kein Kontext gesetzt ist. */
export function getCurrentTenantId(): string | undefined {
  return requestContextStore.getStore()?.tenantId;
}
