'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PluginWebContext } from '@kompetenzhub/plugin-contracts';

export type NoteType = 'todo' | 'absence' | 'note';

export interface MemoNote {
  id: string;
  enrollmentId: string;
  moduleId: string | null;
  classId: string;
  learnerName: string;
  authorId: string;
  type: NoteType;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export const TYPE_ICON: Record<NoteType, string> = { todo: '📌', absence: '📅', note: '💬' };
export const NOTE_TYPES: NoteType[] = ['todo', 'absence', 'note'];

export function typeLabel(ctx: PluginWebContext, type: NoteType): string {
  return ctx.t(`plugin.memo.type.${type}`, type);
}

/**
 * Notiz-Panel für eine lernende Person. Wird sowohl im Aktions-Overlay (MemoButton)
 * als auch im Matrix-Tab (MemoTab) verwendet. Alle Daten kommen über ctx.apiFetch aus
 * dem EIGENEN Plugin-Backend; der Server prüft die Berechtigung je Aufruf.
 */
export default function MemoPanel({ ctx }: { ctx: PluginWebContext }) {
  const enrollmentId = String(ctx.slot?.context.enrollmentId ?? '');
  const [notes, setNotes] = useState<MemoNote[] | null>(null);
  const [text, setText] = useState('');
  const [type, setType] = useState<NoteType>('todo');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await ctx.apiFetch<MemoNote[]>('/notes', { query: { enrollmentId } });
      setNotes(list);
    } catch {
      setError(ctx.t('plugin.memo.loadError', 'Notizen konnten nicht geladen werden.'));
    }
  }, [ctx, enrollmentId]);

  useEffect(() => {
    if (enrollmentId) void load();
  }, [load, enrollmentId]);

  function resetForm() {
    setText('');
    setType('todo');
    setEditingId(null);
  }

  async function save() {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      if (editingId) {
        await ctx.apiFetch(`/notes/${editingId}`, { method: 'PATCH', body: { text: value, type } });
      } else {
        await ctx.apiFetch('/notes', { method: 'POST', body: { enrollmentId, type, text: value } });
      }
      resetForm();
      await load();
    } catch {
      setError(ctx.t('plugin.memo.saveError', 'Speichern fehlgeschlagen.'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone(n: MemoNote) {
    try {
      await ctx.apiFetch(`/notes/${n.id}`, { method: 'PATCH', body: { done: !n.done } });
      await load();
    } catch {
      setError(ctx.t('plugin.memo.saveError', 'Speichern fehlgeschlagen.'));
    }
  }

  async function remove(n: MemoNote) {
    if (!confirm(ctx.t('plugin.memo.confirmDelete', 'Notiz wirklich löschen?'))) return;
    try {
      await ctx.apiFetch(`/notes/${n.id}`, { method: 'DELETE' });
      if (editingId === n.id) resetForm();
      await load();
    } catch {
      setError(ctx.t('plugin.memo.saveError', 'Speichern fehlgeschlagen.'));
    }
  }

  function startEdit(n: MemoNote) {
    setEditingId(n.id);
    setText(n.text);
    setType(n.type);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && (
        <div className="sub-status sub-rejected" style={{ margin: 0 }}>
          {error}
        </div>
      )}

      {/* Erfassen / Bearbeiten */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {NOTE_TYPES.map((tp) => (
            <button
              key={tp}
              type="button"
              className={`btn sm${type === tp ? ' primary' : ''}`}
              onClick={() => setType(tp)}
            >
              {TYPE_ICON[tp]} {typeLabel(ctx, tp)}
            </button>
          ))}
        </div>
        <textarea
          className="text-input"
          rows={3}
          placeholder={ctx.t('plugin.memo.placeholder', 'Notiz erfassen …')}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn primary sm"
            disabled={busy || !text.trim()}
            onClick={() => void save()}
          >
            {editingId
              ? ctx.t('plugin.memo.save', 'Speichern')
              : ctx.t('plugin.memo.add', 'Hinzufügen')}
          </button>
          {editingId && (
            <button className="btn sm" onClick={resetForm}>
              {ctx.t('plugin.memo.cancel', 'Abbrechen')}
            </button>
          )}
        </div>
      </div>

      {/* Liste */}
      {!notes ? (
        <p className="kh-muted" style={{ margin: 0 }}>
          …
        </p>
      ) : notes.length === 0 ? (
        <p className="kh-muted" style={{ margin: 0 }}>
          {ctx.t('plugin.memo.empty', 'Noch keine Notizen.')}
        </p>
      ) : (
        <ul
          className="hz-list"
          style={{ margin: 0, border: '1px solid var(--border)', borderRadius: 8 }}
        >
          {notes.map((n) => (
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
                <span className="kh-muted" style={{ fontSize: 11 }}>
                  {new Date(n.updatedAt).toLocaleString()}
                  {n.authorId !== ctx.user.id
                    ? ` · ${ctx.t('plugin.memo.byColleague', 'Co-Leitung')}`
                    : ''}
                </span>
              </span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button
                  className="btn-icon"
                  title={ctx.t('plugin.memo.edit', 'Bearbeiten')}
                  onClick={() => startEdit(n)}
                >
                  ✎
                </button>
                <button
                  className="btn-icon"
                  title={ctx.t('plugin.memo.delete', 'Löschen')}
                  onClick={() => void remove(n)}
                >
                  🗑
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
