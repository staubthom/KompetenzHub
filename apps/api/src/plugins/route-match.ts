import type { ApiRouteContribution } from '@kompetenzhub/plugin-contracts';

export interface RouteMatch {
  route: ApiRouteContribution;
  params: Record<string, string>;
}

/** Vergleicht ein Routen-Pattern ("/sessions/:id/marks") mit einem konkreten Pfad. */
function matchPath(pattern: string, path: string): Record<string, string> | null {
  const pParts = pattern.split('/').filter(Boolean);
  const sParts = path.split('/').filter(Boolean);
  if (pParts.length !== sParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pParts.length; i++) {
    const p = pParts[i];
    const s = sParts[i];
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(s);
    } else if (p !== s) {
      return null;
    }
  }
  return params;
}

/**
 * Findet die erste deklarierte apiRoute, die zu Methode + Sub-Pfad passt, und extrahiert
 * die Pfad-Parameter. Reine Funktion → unabhängig testbar.
 */
export function matchRoute(
  routes: ApiRouteContribution[],
  method: string,
  subPath: string,
): RouteMatch | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchPath(route.path, subPath);
    if (params) return { route, params };
  }
  return null;
}
