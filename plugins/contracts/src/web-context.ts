// Was eine Plugin-Web-Komponente vom Kern erhält (§10). Framework-light: keine
// React-/Next-Abhängigkeit, damit der Vertrag im framework-freien Paket bleibt.

import type { PluginRole } from './manifest';

export interface PluginFetchInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Wird als JSON-Body gesendet. */
  body?: unknown;
  /** Querystring-Parameter. */
  query?: Record<string, string>;
}

/**
 * Kontext eines Einhäng-Slots (Action/Tab/Widget). Wird vom Kern gefüllt, wenn eine
 * Plugin-Komponente in einen Slot gerendert wird – z. B. die Zeilen-ID einer Tabelle.
 * Für Aktions-/Tab-Slots am Lernenden enthält `context` u. a. `enrollmentId`,
 * `moduleId`, `classId`, `displayName`.
 */
export interface PluginSlotContext {
  name: string;
  context: Record<string, unknown>;
}

export interface PluginWebContext {
  pluginId: string;
  locale: string;
  user: { id: string; roles: PluginRole[] };
  /** Ruft einen Endpunkt des EIGENEN Plugins auf (/plugins/<id><path>) und liefert JSON. */
  apiFetch<T = unknown>(path: string, init?: PluginFetchInit): Promise<T>;
  /** Übersetzt einen plugin.<id>.<key>-Schlüssel (Fallback: fallback ?? key). */
  t(key: string, fallback?: string): string;
  /** Nur in Action-/Tab-/Widget-Slots gesetzt: der vom Kern übergebene Slot-Kontext. */
  slot?: PluginSlotContext;
}
