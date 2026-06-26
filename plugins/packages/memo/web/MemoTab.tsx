'use client';

import type { PluginWebContext } from '@kompetenzhub/plugin-contracts';
import MemoPanel from './MemoPanel';

/**
 * Tab-Inhalt für den Slot "teacher.studentMatrix.tabs": zeigt die Notizen der lernenden
 * Person direkt in der Schüler-Matrix-Ansicht. Inhalt kommt komplett vom Plugin.
 */
export default function MemoTab({ ctx }: { ctx: PluginWebContext }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>📝 {ctx.t('plugin.memo.tab', 'Notizen')}</h2>
      </div>
      <div className="panel-body">
        <MemoPanel ctx={ctx} />
      </div>
    </div>
  );
}
