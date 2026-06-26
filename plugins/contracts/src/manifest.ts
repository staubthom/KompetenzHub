// KompetenzHub Plugin-Verträge – Manifest-Typen (formaler Installationsvertrag).
// Siehe planung/Planung_Plugin.md §5. Framework-frei: keine Nest-/Next-/Prisma-Imports.

/** Aktuelles Manifest-Schema-Format. Erhöhen bei Breaking Changes am Manifest. */
export const MANIFEST_SCHEMA_VERSION = 1 as const;

/** Versionsstand der Plugin-Laufzeit-API (ServerContext). Siehe §13. */
export const PLUGIN_API_VERSION = 1 as const;

/** Kern-Rollen, auf die sich Plugin-Beiträge beziehen dürfen. */
export type PluginRole = 'ADMIN' | 'TEACHER' | 'LEARNER';

/** Capability-String: immer `plugin:<pluginId>:<scope>`, z. B. `plugin:attendance:manage`. */
export type PluginCapability = `plugin:${string}:${string}`;

export interface ApiRouteContribution {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Relativ zu /plugins/:pluginId, beginnt mit "/", z. B. "/sessions/:id". */
  path: string;
  /** Erforderliches Capability – muss in `capabilities` deklariert sein. */
  capability: PluginCapability;
  /** Erlaubte Kernrollen für diese Route. */
  roles: PluginRole[];
}

export interface NavContribution {
  id: string;
  labelKey: string;
  icon: string;
  /** Immer unter /plugins/<pluginId>/… */
  href: string;
  roles: PluginRole[];
}

export interface PageContribution {
  /** Route relativ zum Plugin-Mount, z. B. "/" oder "/auswertung". */
  route: string;
  /** Name der im Web-Bundle registrierten Komponente. */
  component: string;
  roles: PluginRole[];
}

export interface WidgetContribution {
  /** Deklarierter Slot-Name, z. B. "teacher.dashboard". */
  slot: string;
  component: string;
  roles: PluginRole[];
}

export interface PluginManifest {
  schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  /** Global eindeutig, unveränderlich. Regex: ^[a-z][a-z0-9-]{2,40}$ */
  pluginId: string;
  displayName: string;
  /** SemVer des Plugins. */
  version: string;
  publisher: { name: string; contact?: string; url?: string };
  /** SPDX-Lizenzkennung, z. B. "AGPL-3.0-or-later". */
  license: string;
  /** i18n-Kurzbeschreibung {de,fr,it,en}. */
  description: Record<string, string>;

  /** Kompatibilität mit dem Kern (siehe §13). */
  core: { minVersion: string; maxVersion?: string; apiVersion: typeof PLUGIN_API_VERSION };

  /** Angeforderte Rechte – NUR diese sind nutzbar (§6). */
  capabilities: PluginCapability[];

  contributions: {
    apiRoutes?: ApiRouteContribution[];
    nav?: NavContribution[];
    pages?: PageContribution[];
    widgets?: WidgetContribution[];
    adminPages?: PageContribution[];
  };

  /** Datenhaltung. Pilot: nur 'kv'. 'schema' (eigene Tabellen) ab Phase 4. */
  data?: { mode: 'kv' | 'schema'; collections?: string[] };

  /** Erlaubte S3-Prefixe (immer unter plugins/<pluginId>/). */
  storage?: { prefixes: string[] };
  secrets?: { key: string; scope: 'tenant' | 'global'; description: string }[];
  integrations?: { outboundHosts: string[]; description: string }[];
  backgroundJobs?: { key: string; schedule: string; description: string }[];

  /** i18n-Namespaces, immer plugin.<pluginId>.* */
  translations: { namespaces: string[] };
  audit?: { events: string[] };

  /** Deklarativer Cleanup-Plan – Basis der Uninstall-Prüfung (§12). */
  cleanup: {
    data: 'delete' | 'archive';
    storage: 'delete' | 'keep';
    secrets: 'delete';
  };
}
