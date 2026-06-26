'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { getUser } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { pluginsApi, type PluginContribution } from '../lib/api';
import { pluginWebRegistry } from '../plugins/registry';
import { buildPluginWebContext } from '../plugins/context';

/**
 * Rendert die Aktions-Buttons aktiver Plugins für einen benannten Aktions-Slot
 * (z. B. in einer Tabellenzeile/Toolbar). Der Kern übergibt jeder Plugin-Komponente
 * den Zeilen-/Seitenkontext (z. B. `{ enrollmentId, displayName }`) über `ctx.slot`.
 * Der Server liefert nur aktivierte + rollen-erlaubte Beiträge.
 */
export default function PluginActionSlot({
  name,
  context,
}: {
  name: string;
  context: Record<string, unknown>;
}) {
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
    for (const a of c.actions.filter((x) => x.slot === name)) {
      const Comp = pluginWebRegistry[c.pluginId]?.components?.[a.component];
      if (!Comp) continue;
      const ctx = buildPluginWebContext(c.pluginId, user, locale, { name, context });
      items.push(<Comp key={`${c.pluginId}-${a.component}`} ctx={ctx} />);
    }
  }

  return <>{items}</>;
}
