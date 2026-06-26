// Server-Einstiegspunkt eines Plugins. Plugin-Autoren definieren ihre Routen
// gegen den gescopten ServerContext – ohne Kenntnis von NestJS.

import type { ServerContext } from './context';

/** Eingehende Anfrage, vom Kern-Dispatcher gefüllt (framework-neutral). */
export interface PluginRequest {
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
  body: unknown;
}

/** Ein Routen-Handler. Rückgabewert wird als JSON serialisiert. */
export type RouteHandler = (ctx: ServerContext, req: PluginRequest) => unknown | Promise<unknown>;

/**
 * Server-Modul eines Plugins. Schlüssel der `routes`-Map: "METHOD /pfad",
 * z. B. "GET /sessions" oder "POST /sessions/:id/marks" – passend zu den im
 * Manifest deklarierten apiRoutes.
 */
export interface PluginServerModule {
  routes: Record<string, RouteHandler>;
}

/** Identitäts-Helfer für Typsicherheit & Autovervollständigung beim Plugin-Autor. */
export function definePlugin(mod: PluginServerModule): PluginServerModule {
  return mod;
}
