// Öffentliche Registry-Fassade. Die eigentliche Plugin→Komponenten-Zuordnung wird
// AUTOMATISCH aus den Plugin-Manifesten generiert (siehe registry.generated.ts +
// scripts/generate-plugin-registry.mjs). Diese Datei wird NICHT pro Plugin angepasst.

import { pluginWebRegistry } from './registry.generated';

export type { PluginComponentProps, PluginComponent, PluginWebModule } from './registry-types';
export { pluginWebRegistry };

/** Übersetzt einen Plugin-Schlüssel aus den gebündelten Plugin-Translations. */
export function pluginT(pluginId: string, locale: string, key: string, fallback?: string): string {
  const tr = pluginWebRegistry[pluginId]?.translations;
  return tr?.[locale]?.[key] ?? tr?.de?.[key] ?? fallback ?? key;
}
