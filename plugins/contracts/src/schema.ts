// Laufzeit-Validierung des Plugin-Manifests (zod + semantische Querprüfungen).
// Siehe planung/Planung_Plugin.md §5. Harte Regel: Verstösst ein Beitrag gegen
// Namespace-/Capability-Regeln, ist das Manifest UNGÜLTIG (Plugin wird nicht geladen).

import { z } from 'zod';
import { MANIFEST_SCHEMA_VERSION, PLUGIN_API_VERSION, type PluginManifest } from './manifest';

/** Erlaubte Widget-Slots des Kerns. Nur diese dürfen Plugins bespielen. */
export const KNOWN_WIDGET_SLOTS = ['teacher.dashboard', 'learner.matrix.header'] as const;

const PLUGIN_ID_RE = /^[a-z][a-z0-9-]{2,40}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/;
const CAPABILITY_RE = /^plugin:[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;

const roleEnum = z.enum(['ADMIN', 'TEACHER', 'LEARNER']);

const apiRouteSchema = z.object({
  method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']),
  path: z.string().min(1),
  capability: z.string().regex(CAPABILITY_RE),
  roles: z.array(roleEnum).nonempty(),
});

const navSchema = z.object({
  id: z.string().min(1),
  labelKey: z.string().min(1),
  icon: z.string().min(1),
  href: z.string().min(1),
  roles: z.array(roleEnum).nonempty(),
});

const pageSchema = z.object({
  route: z.string().min(1),
  component: z.string().min(1),
  roles: z.array(roleEnum).nonempty(),
});

const widgetSchema = z.object({
  slot: z.string().min(1),
  component: z.string().min(1),
  roles: z.array(roleEnum).nonempty(),
});

/** Struktur-Schema (Form & Typen). Querbezüge prüft `semanticErrors`. */
export const manifestSchema = z.object({
  schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
  pluginId: z.string().regex(PLUGIN_ID_RE),
  displayName: z.string().min(1),
  version: z.string().regex(SEMVER_RE),
  publisher: z.object({
    name: z.string().min(1),
    contact: z.string().optional(),
    url: z.string().optional(),
  }),
  license: z.string().min(1),
  description: z.record(z.string()),
  core: z.object({
    minVersion: z.string().regex(SEMVER_RE),
    maxVersion: z.string().regex(SEMVER_RE).optional(),
    apiVersion: z.literal(PLUGIN_API_VERSION),
  }),
  capabilities: z.array(z.string().regex(CAPABILITY_RE)),
  contributions: z.object({
    apiRoutes: z.array(apiRouteSchema).optional(),
    nav: z.array(navSchema).optional(),
    pages: z.array(pageSchema).optional(),
    widgets: z.array(widgetSchema).optional(),
    adminPages: z.array(pageSchema).optional(),
  }),
  data: z
    .object({ mode: z.enum(['kv', 'schema']), collections: z.array(z.string()).optional() })
    .optional(),
  storage: z.object({ prefixes: z.array(z.string()) }).optional(),
  secrets: z
    .array(
      z.object({
        key: z.string().min(1),
        scope: z.enum(['tenant', 'global']),
        description: z.string(),
      }),
    )
    .optional(),
  integrations: z
    .array(z.object({ outboundHosts: z.array(z.string()), description: z.string() }))
    .optional(),
  backgroundJobs: z
    .array(z.object({ key: z.string(), schedule: z.string(), description: z.string() }))
    .optional(),
  translations: z.object({ namespaces: z.array(z.string()) }),
  audit: z.object({ events: z.array(z.string()) }).optional(),
  cleanup: z.object({
    data: z.enum(['delete', 'archive']),
    storage: z.enum(['delete', 'keep']),
    secrets: z.literal('delete'),
  }),
});

/**
 * Semantische Querprüfungen, die zod allein nicht ausdrückt (alle pluginId-bezogen).
 * Liefert eine Liste menschenlesbarer Fehler; leer = gültig.
 */
export function semanticErrors(m: PluginManifest): string[] {
  const errors: string[] = [];
  const capPrefix = `plugin:${m.pluginId}:`;
  const declared = new Set(m.capabilities);

  for (const cap of m.capabilities) {
    if (!cap.startsWith(capPrefix)) {
      errors.push(`Capability "${cap}" muss mit "${capPrefix}" beginnen.`);
    }
  }

  for (const r of m.contributions.apiRoutes ?? []) {
    if (!r.path.startsWith('/')) {
      errors.push(`apiRoute path "${r.path}" muss mit "/" beginnen.`);
    }
    if (!declared.has(r.capability)) {
      errors.push(`apiRoute referenziert nicht deklariertes Capability "${r.capability}".`);
    }
  }

  const navPrefix = `/plugins/${m.pluginId}`;
  for (const n of m.contributions.nav ?? []) {
    if (n.href !== navPrefix && !n.href.startsWith(`${navPrefix}/`)) {
      errors.push(`nav href "${n.href}" muss unter "${navPrefix}" liegen.`);
    }
  }

  const knownSlots = new Set<string>(KNOWN_WIDGET_SLOTS);
  for (const w of m.contributions.widgets ?? []) {
    if (!knownSlots.has(w.slot)) {
      errors.push(`widget slot "${w.slot}" ist kein bekannter Kern-Slot.`);
    }
  }

  const nsPrefix = `plugin.${m.pluginId}`;
  for (const ns of m.translations.namespaces) {
    if (ns !== nsPrefix && !ns.startsWith(`${nsPrefix}.`)) {
      errors.push(`translations namespace "${ns}" muss mit "${nsPrefix}" beginnen.`);
    }
  }

  const storagePrefix = `plugins/${m.pluginId}/`;
  for (const p of m.storage?.prefixes ?? []) {
    if (!p.startsWith(storagePrefix)) {
      errors.push(`storage prefix "${p}" muss mit "${storagePrefix}" beginnen.`);
    }
  }

  return errors;
}
