import type { ComponentType } from 'react';
import type { PluginWebContext } from '@kompetenzhub/plugin-contracts';

/** Props, die jede Plugin-Seite/jedes Widget/jede Aktion erhält. */
export interface PluginComponentProps {
  ctx: PluginWebContext;
}
export type PluginComponent = ComponentType<PluginComponentProps>;

export interface PluginWebModule {
  /** Route ("/", "/auswertung") → Seitenkomponente. */
  pages: Record<string, PluginComponent>;
  /** Slot-Name → Widget-Komponenten. */
  widgets: Record<string, PluginComponent[]>;
  /**
   * Komponentenname → Komponente. Für Action-/Tab-Beiträge, bei denen das Manifest
   * pro Eintrag einen `component`-Namen referenziert (Label/Icon kommen aus dem Manifest).
   */
  components?: Record<string, PluginComponent>;
  /** Locale → flache Übersetzungstabelle (plugin.<id>.<key>). */
  translations: Record<string, Record<string, string>>;
}
