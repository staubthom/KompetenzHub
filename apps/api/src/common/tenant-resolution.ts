import type { Request } from 'express';

/**
 * Subdomains, die keinen Tenant bezeichnen (Marketing/Infra-Hosts).
 * Treffer → es wird auf den Default-Slug zurückgefallen.
 */
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'app', 'admin', 'static', 'assets']);

/** Default-Slug, wenn aus dem Host keine Subdomain ableitbar ist (z. B. localhost). */
export function defaultTenantSlug(): string {
  return (process.env.DEFAULT_TENANT_SLUG ?? 'default').toLowerCase();
}

/** Basisdomain (z. B. "kompetenzhub.ch"), um die Subdomain sauber abzuschneiden. */
function baseDomain(): string | undefined {
  return process.env.TENANT_BASE_DOMAIN?.trim().toLowerCase() || undefined;
}

/**
 * Leitet den Tenant-Slug aus einem Hostnamen ab.
 * - Mit konfigurierter Basisdomain: alles vor ".basisdomain" (erste Label-Ebene).
 * - Ohne: bei ≥3 Labels die erste Ebene (foo.example.com → "foo").
 * - localhost / IP / apex / reservierte Subdomain → null (→ Default).
 */
export function slugFromHost(hostRaw: string | undefined): string | null {
  const host = (hostRaw ?? '').split(':')[0].trim().toLowerCase();
  if (!host || host === 'localhost' || /^[0-9.]+$/.test(host) || host.endsWith('.localhost')) {
    return null;
  }

  const base = baseDomain();
  let sub: string | undefined;
  if (base && host.endsWith(`.${base}`)) {
    sub = host.slice(0, host.length - base.length - 1).split('.')[0];
  } else if (base && host === base) {
    return null; // apex-Domain ohne Subdomain
  } else {
    const labels = host.split('.');
    if (labels.length >= 3) sub = labels[0];
  }

  if (!sub || RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}

/**
 * Ermittelt den Tenant-Slug einer Anfrage. Priorität:
 *  1. Header `X-Tenant-Slug` (vom Web-BFF gesetzt, u. a. für den internen
 *     /auth/exchange-Aufruf, dessen Host keine Subdomain trägt).
 *  2. Host/`X-Forwarded-Host` (Subdomain).
 *  3. Default-Slug.
 */
export function tenantSlugFromRequest(req: Request): string {
  const headerVal = req.headers['x-tenant-slug'];
  const fromHeader = (Array.isArray(headerVal) ? headerVal[0] : headerVal)?.trim().toLowerCase();
  if (fromHeader) return fromHeader;

  const fwd = req.headers['x-forwarded-host'];
  const hostHeader = (Array.isArray(fwd) ? fwd[0] : fwd) ?? req.headers.host;
  return slugFromHost(hostHeader) ?? defaultTenantSlug();
}
