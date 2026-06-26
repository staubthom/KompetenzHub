'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { getUser } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { pluginsApi, type PluginContribution } from '../lib/api';
import { pluginWebRegistry, pluginT } from './registry';
import { buildPluginWebContext } from './context';

export interface PluginTabDescriptor {
  /** Stabile ID (pluginId:component) für Tab-State/Keys. */
  id: string;
  label: string;
  icon?: string;
  /** Rendert den Tab-Inhalt (Plugin-Komponente mit Slot-Kontext). */
  render: () => ReactNode;
}

/**
 * Liefert die zusätzlichen Tabs aktiver Plugins für einen benannten Tab-Slot. Der Host
 * (Kern-Seite mit Tab-Leiste) ergänzt damit seine eigenen Tabs. Label/Icon stammen aus
 * dem Manifest (i18n via plugin.<id>.*); der Tab-Inhalt kommt komplett vom Plugin.
 */
export function usePluginTabs(
  name: string,
  context: Record<string, unknown>,
): PluginTabDescriptor[] {
  const { locale } = useI18n();
  const [contribs, setContribs] = useState<PluginContribution[]>([]);

  useEffect(() => {
    let cancelled = false;
    pluginsApi
      .contributions()
      .then((r) => {
        if (!cancelled) setContribs(r.plugins);
      })
      .catch(() => {
        /* Ohne Plugins keine zusätzlichen Tabs */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const user = getUser();
  if (!user) return [];

  const tabs: PluginTabDescriptor[] = [];
  for (const c of contribs) {
    for (const tdef of c.tabs.filter((x) => x.slot === name)) {
      const Comp = pluginWebRegistry[c.pluginId]?.components?.[tdef.component];
      if (!Comp) continue;
      const ctx = buildPluginWebContext(c.pluginId, user, locale, { name, context });
      tabs.push({
        id: `${c.pluginId}:${tdef.component}`,
        label: pluginT(c.pluginId, locale, tdef.labelKey, tdef.labelKey),
        icon: tdef.icon,
        render: () => <Comp ctx={ctx} />,
      });
    }
  }
  return tabs;
}
