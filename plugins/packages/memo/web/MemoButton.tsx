'use client';

import { useEffect, useState } from 'react';
import type { PluginWebContext } from '@kompetenzhub/plugin-contracts';
import MemoPanel from './MemoPanel';

/**
 * Aktions-Button für den Slot "teacher.classMember.actions": kleines Notiz-Symbol
 * neben dem Namen der lernenden Person. Ein Klick öffnet ein Overlay mit dem Notiz-
 * Panel – ohne die aktuelle Seite zu verlassen. enrollmentId/displayName kommen aus
 * dem Slot-Kontext (ctx.slot.context).
 */
export default function MemoButton({ ctx }: { ctx: PluginWebContext }) {
  const [open, setOpen] = useState(false);
  const displayName = String(ctx.slot?.context.displayName ?? '');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        className="btn-icon"
        title={ctx.t('plugin.memo.action', 'Notizen')}
        aria-label={`${ctx.t('plugin.memo.action', 'Notizen')} – ${displayName}`}
        onClick={() => setOpen(true)}
      >
        📝
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={ctx.t('plugin.memo.action', 'Notizen')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2>
                📝 {ctx.t('plugin.memo.action', 'Notizen')}
                {displayName ? ` · ${displayName}` : ''}
              </h2>
              <button
                className="btn-icon"
                title={ctx.t('plugin.memo.cancel', 'Schliessen')}
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <MemoPanel ctx={ctx} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
