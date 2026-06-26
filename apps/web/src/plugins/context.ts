import type { PluginWebContext, PluginFetchInit } from '@kompetenzhub/plugin-contracts';
import type { SessionUser } from '../lib/session';
import { pluginFetch } from '../lib/api';
import { pluginT } from './registry';

/**
 * Baut den gescopten PluginWebContext, den eine Plugin-Seite/-Widget als Prop erhält.
 * apiFetch ruft ausschliesslich Endpunkte des EIGENEN Plugins auf; t() löst Plugin-
 * Übersetzungen auf. Plugins bleiben so von Core-Internas entkoppelt.
 */
export function buildPluginWebContext(
  pluginId: string,
  user: SessionUser,
  locale: string,
): PluginWebContext {
  return {
    pluginId,
    locale,
    user: { id: user.id, roles: user.roles },
    apiFetch: <T = unknown>(path: string, init?: PluginFetchInit): Promise<T> => {
      const qs = init?.query ? `?${new URLSearchParams(init.query).toString()}` : '';
      const options: RequestInit = { method: init?.method ?? 'GET' };
      if (init?.body !== undefined) options.body = JSON.stringify(init.body);
      return pluginFetch<T>(pluginId, `${path}${qs}`, options);
    },
    t: (key: string, fallback?: string) => pluginT(pluginId, locale, key, fallback),
  };
}
