'use client';

import { useEffect, useState } from 'react';
import type { PluginWebContext } from '@kompetenzhub/plugin-contracts';

/**
 * Dashboard-Widget (Slot "teacher.dashboard"): zeigt die Anzahl eigener offener
 * To-Do-Notizen als kleine Infobox. Demonstriert eine UI-Injektion (Karte/Box).
 */
export default function MemoDashboardWidget({ ctx }: { ctx: PluginWebContext }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    ctx
      .apiFetch<{ openTodos: number }>('/summary')
      .then((r) => setOpen(r.openTodos))
      .catch(() => setOpen(null));
  }, [ctx]);

  return (
    <div className="card">
      <div className="k">{ctx.t('plugin.memo.widget', 'Offene To-Dos')}</div>
      <div className="v">{open ?? '–'}</div>
      <div className="d">{ctx.t('plugin.memo.widgetHint', 'Deine offenen Notiz-Aufgaben')}</div>
    </div>
  );
}
