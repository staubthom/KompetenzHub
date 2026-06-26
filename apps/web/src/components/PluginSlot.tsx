'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { getUser } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { pluginsApi, type PluginContribution } from '../lib/api';
import { pluginWebRegistry } from '../plugins/registry';
import { buildPluginWebContext } from '../plugins/context';

/**
 * Rendert alle Widgets aktiver Plugins für einen benannten Slot (§10.3). Nur
 * deklarierte Slot-Namen sind sinnvoll; der Server liefert nur aktivierte +
 * rollen-erlaubte Beiträge.
 */
export default function PluginSlot({ name }: { name: string }) {
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
        /* Slot bleibt leer, wenn Plugins nicht ladbar sind */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const user = getUser();
  if (!user) return null;

  const items: ReactNode[] = [];
  for (const c of contribs) {
    if (!c.widgets.some((w) => w.slot === name)) continue;
    const widgets = pluginWebRegistry[c.pluginId]?.widgets[name] ?? [];
    const ctx = buildPluginWebContext(c.pluginId, user, locale);
    widgets.forEach((Widget, i) => {
      items.push(<Widget key={`${c.pluginId}-${name}-${i}`} ctx={ctx} />);
    });
  }

  return <>{items}</>;
}
