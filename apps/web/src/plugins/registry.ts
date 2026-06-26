import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { PluginWebContext } from '@kompetenzhub/plugin-contracts';
import exampleDe from '@kompetenzhub/plugin-example/i18n/de.json';
import exampleFr from '@kompetenzhub/plugin-example/i18n/fr.json';
import exampleIt from '@kompetenzhub/plugin-example/i18n/it.json';
import exampleEn from '@kompetenzhub/plugin-example/i18n/en.json';

/** Props, die jede Plugin-Seite/jedes Widget erhält. */
export interface PluginComponentProps {
  ctx: PluginWebContext;
}
export type PluginComponent = ComponentType<PluginComponentProps>;

export interface PluginWebModule {
  /** Route ("/", "/auswertung") → Seitenkomponente. */
  pages: Record<string, PluginComponent>;
  /** Slot-Name → Widget-Komponenten. */
  widgets: Record<string, PluginComponent[]>;
  /** Locale → flache Übersetzungstabelle (plugin.<id>.<key>). */
  translations: Record<string, Record<string, string>>;
}

/**
 * Statisch gebündelte Web-Beiträge der Plugins (§10.1). Seiten/Widgets werden über
 * next/dynamic (ssr:false) lazy geladen, damit sie das Core-Bundle nicht aufblähen,
 * auch wenn ein Tenant das Plugin nicht aktiviert hat. Übersetzungen sind klein und
 * werden direkt importiert. (Codegen statt Handpflege ist eine spätere Optimierung.)
 */
export const pluginWebRegistry: Record<string, PluginWebModule> = {
  example: {
    pages: {
      '/': dynamic<PluginComponentProps>(
        () => import('@kompetenzhub/plugin-example/web/ExamplePage'),
        { ssr: false },
      ),
    },
    widgets: {
      'teacher.dashboard': [
        dynamic<PluginComponentProps>(
          () => import('@kompetenzhub/plugin-example/web/ExampleWidget'),
          { ssr: false },
        ),
      ],
    },
    translations: { de: exampleDe, fr: exampleFr, it: exampleIt, en: exampleEn },
  },
};

/** Übersetzt einen Plugin-Schlüssel aus den gebündelten Plugin-Translations. */
export function pluginT(pluginId: string, locale: string, key: string, fallback?: string): string {
  const tr = pluginWebRegistry[pluginId]?.translations;
  return tr?.[locale]?.[key] ?? tr?.de?.[key] ?? fallback ?? key;
}
