'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PluginWebContext } from '@kompetenzhub/plugin-contracts';
import { TYPE_ICON, typeLabel, type MemoNote } from './MemoPanel';

interface CoreModuleRef {
  moduleId: string;
  number: string;
  title: Record<string, string>;
}

function moduleTitle(m: CoreModuleRef, locale: string): string {
  return m.title[locale] ?? m.title.de ?? Object.values(m.title)[0] ?? m.moduleId;
}

/**
 * Übersichtsseite (nav → /plugins/memo): alle Notizen eines gewählten Modulanlasses,
 * gruppiert nach lernender Person. Erfüllt Anforderung §5 (Gesamtsicht je Modul).
 */
export default function MemoOverviewPage({ ctx }: { ctx: PluginWebContext }) {
  const [modules, setModules] = useState<CoreModuleRef[]>([]);
  const [moduleId, setModuleId] = useState('');
  const [notes, setNotes] = useState<MemoNote[] | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(false);

  useEffect(() => {
    ctx
      .apiFetch<CoreModuleRef[]>('/modules')
      .then((list) => {
        setModules(list);
        if (list[0]) setModuleId(list[0].moduleId);
      })
      .catch(() => setModules([]));
  }, [ctx]);

  const load = useCallback(async () => {
    if (!moduleId) return;
    try {
      setNotes(await ctx.apiFetch<MemoNote[]>('/notes', { query: { moduleId } }));
    } catch {
      setNotes([]);
    }
  }, [ctx, moduleId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleDone(n: MemoNote) {
    await ctx
      .apiFetch(`/notes/${n.id}`, { method: 'PATCH', body: { done: !n.done } })
      .catch(() => {});
    await load();
  }

  const filtered = (notes ?? []).filter((n) => !onlyOpen || (n.type === 'todo' && !n.done));
  const byLearner = new Map<string, MemoNote[]>();
  for (const n of filtered) {
    const arr = byLearner.get(n.learnerName) ?? [];
    arr.push(n);
    byLearner.set(n.learnerName, arr);
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>📝 {ctx.t('plugin.memo.overviewTitle', 'Notizen-Übersicht')}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => setOnlyOpen(e.target.checked)}
            />
            {ctx.t('plugin.memo.onlyOpen', 'Nur offene To-Dos')}
          </label>
          <select
            className="inline-select"
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
          >
            {modules.map((m) => (
              <option key={m.moduleId} value={m.moduleId}>
                {m.number} · {moduleTitle(m, ctx.locale)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="panel-body">
        {modules.length === 0 ? (
          <p className="kh-muted" style={{ margin: 0 }}>
            {ctx.t('plugin.memo.noModules', 'Keine Modulanlässe vorhanden.')}
          </p>
        ) : byLearner.size === 0 ? (
          <p className="kh-muted" style={{ margin: 0 }}>
            {ctx.t('plugin.memo.empty', 'Noch keine Notizen.')}
          </p>
        ) : (
          [...byLearner.entries()].map(([learner, items]) => (
            <div key={learner} style={{ marginBottom: 18 }}>
              <strong>{learner}</strong>
              <ul
                className="hz-list"
                style={{ margin: '6px 0 0', border: '1px solid var(--border)', borderRadius: 8 }}
              >
                {items.map((n) => (
                  <li
                    key={n.id}
                    className="hz-item"
                    style={{ alignItems: 'flex-start', gap: 10, padding: 10 }}
                  >
                    {n.type === 'todo' && (
                      <input
                        type="checkbox"
                        checked={n.done}
                        title={ctx.t('plugin.memo.done', 'Erledigt')}
                        onChange={() => void toggleDone(n)}
                        style={{ marginTop: 3 }}
                      />
                    )}
                    <span style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, opacity: 0.7 }}>
                        {TYPE_ICON[n.type]} {typeLabel(ctx, n.type)}
                      </span>
                      <div
                        style={{
                          whiteSpace: 'pre-wrap',
                          textDecoration: n.type === 'todo' && n.done ? 'line-through' : 'none',
                          opacity: n.type === 'todo' && n.done ? 0.6 : 1,
                        }}
                      >
                        {n.text}
                      </div>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
