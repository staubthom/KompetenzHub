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
