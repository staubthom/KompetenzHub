import type {
  PluginWebContext,
  PluginFetchInit,
  PluginSlotContext,
} from '@kompetenzhub/plugin-contracts';
import type { SessionUser } from '../lib/session';
import { pluginFetch } from '../lib/api';
import { pluginT } from './registry';

/**
 * Baut den gescopten PluginWebContext, den eine Plugin-Seite/-Widget als Prop erhält.
 * apiFetch ruft ausschliesslich Endpunkte des EIGENEN Plugins auf; t() löst Plugin-
 * Übersetzungen auf. Plugins bleiben so von Core-Internas entkoppelt. Für Action-/Tab-/
 * Widget-Slots wird optional der Slot-Kontext (z. B. enrollmentId) mitgegeben.
 */
export function buildPluginWebContext(
  pluginId: string,
  user: SessionUser,
  locale: string,
  slot?: PluginSlotContext,
): PluginWebContext {
  return {
    pluginId,
    locale,
    user: { id: user.id, roles: user.roles },
    slot,
    apiFetch: <T = unknown>(path: string, init?: PluginFetchInit): Promise<T> => {
      const qs = init?.query ? `?${new URLSearchParams(init.query).toString()}` : '';
      const options: RequestInit = { method: init?.method ?? 'GET' };
      if (init?.body !== undefined) options.body = JSON.stringify(init.body);
      return pluginFetch<T>(pluginId, `${path}${qs}`, options);
    },
    t: (key: string, fallback?: string) => pluginT(pluginId, locale, key, fallback),
  };
}
