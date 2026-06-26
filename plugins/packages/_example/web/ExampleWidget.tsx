'use client';

import type { PluginWebContext } from '@kompetenzhub/plugin-contracts';

/** Beispiel-Widget für den Dashboard-Slot "teacher.dashboard". */
export default function ExampleWidget({ ctx }: { ctx: PluginWebContext }) {
  return (
    <div className="card">
      <div className="k">{ctx.t('plugin.example.widget', 'Beispiel-Widget')}</div>
      <div className="v">🧩</div>
      <div className="d">{ctx.t('plugin.example.widgetHint', 'Aktives Plugin')}</div>
    </div>
  );
}
