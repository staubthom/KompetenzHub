'use client';

import { useCallback, useEffect, useState } from 'react';
import RichTextEditor from './RichTextEditor';
import TrashIcon from './TrashIcon';
import { evidence, type Evidence } from '../lib/api';

interface Draft {
  title: string;
  instructions: string;
  isVisible: boolean;
  dueAt: string;
  allowFile: boolean;
  allowLink: boolean;
  allowText: boolean;
  allowedFileTypes: string;
  maxFileSizeMb: string;
  maxPoints: string;
}

function emptyDraft(): Draft {
  return {
    title: '',
    instructions: '',
    isVisible: true,
    dueAt: '',
    allowFile: true,
    allowLink: true,
    allowText: true,
    allowedFileTypes: 'pdf, png, jpg',
    maxFileSizeMb: '10',
    maxPoints: '',
  };
}

export default function FieldEvidenceModal({
  moduleId,
  fieldId,
  fieldLabel,
  onClose,
  onChanged,
}: {
  moduleId: string;
  fieldId: string;
  fieldLabel: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [list, setList] = useState<Evidence[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const all = await evidence.list(moduleId);
      setList(all.filter((e) => e.fields.some((f) => f.fieldId === fieldId)));
    } catch (e: unknown) {
      setError(String(e));
    }
  }, [moduleId, fieldId]);

  useEffect(() => {
    void load();
  }, [load]);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    setError(err.body?.title ?? String(e));
  }

  function startCreate() {
    setEditId(null);
    setDraft(emptyDraft());
  }

  function startEdit(ev: Evidence) {
    setEditId(ev.id);
    setDraft({
      title: ev.title?.de ?? '',
      instructions: ev.instructions?.de ?? '',
      isVisible: ev.isVisible,
      dueAt: ev.dueAt ? ev.dueAt.slice(0, 16) : '',
      allowFile: ev.config.allowFile !== false,
      allowLink: ev.config.allowLink !== false,
      allowText: ev.config.allowText !== false,
      allowedFileTypes: (ev.config.allowedFileTypes ?? []).join(', '),
      maxFileSizeMb: String(ev.config.maxFileSizeMb ?? 10),
      maxPoints: ev.maxPoints ?? '',
    });
  }

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) {
      setError('Titel ist erforderlich.');
      return;
    }
    const payload = {
      title: { de: draft.title.trim() },
      instructions: { de: draft.instructions },
      isVisible: draft.isVisible,
      dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
      maxPoints: draft.maxPoints ? Number(draft.maxPoints) : undefined,
      config: {
        allowFile: draft.allowFile,
        allowLink: draft.allowLink,
        allowText: draft.allowText,
        allowedFileTypes: draft.allowedFileTypes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        maxFileSizeMb: draft.maxFileSizeMb ? Number(draft.maxFileSizeMb) : undefined,
      },
    };
    try {
      if (editId) {
        await evidence.update(editId, payload);
      } else {
        await evidence.create({ ...payload, moduleId, fieldIds: [fieldId] });
      }
      setDraft(null);
      setEditId(null);
      await load();
      onChanged();
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function toggleVisible(ev: Evidence) {
    try {
      await evidence.update(ev.id, { isVisible: !ev.isVisible });
      await load();
      onChanged();
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function remove(id: string) {
    if (!confirm('Nachweis löschen?')) return;
    try {
      await evidence.remove(id);
      await load();
      onChanged();
    } catch (e: unknown) {
      showError(e);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Kompetenznachweise · {fieldLabel}</h2>
          <button className="btn-icon" title="Schliessen" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="modal-body">
          {!draft && (
            <>
              {!list ? (
                <div className="loading">Lade …</div>
              ) : list.length === 0 ? (
                <div className="empty">
                  <p>Noch kein Nachweis für diese Kompetenz.</p>
                </div>
              ) : (
                <ul className="hz-list">
                  {list.map((ev) => (
                    <li key={ev.id} className="hz-item">
                      <div style={{ flex: 1 }}>
                        <strong>{ev.title?.de}</strong>
                        <div className="kh-muted" style={{ fontSize: 12 }}>
                          {ev._count?.submissions ?? 0} Einreichung(en)
                          {ev.dueAt &&
                            ` · fällig ${new Date(ev.dueAt).toLocaleDateString('de-CH')}`}
                        </div>
                      </div>
                      <button
                        className={`badge ${ev.isVisible ? 'b-published' : 'b-archived'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={() => {
                          void toggleVisible(ev);
                        }}
                      >
                        {ev.isVisible ? 'sichtbar' : 'verborgen'}
                      </button>
                      <button className="btn sm" onClick={() => startEdit(ev)}>
                        Bearbeiten
                      </button>
                      <button
                        className="btn-icon"
                        title="Löschen"
                        onClick={() => {
                          void remove(ev.id);
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ marginTop: 14 }}>
                <button className="btn primary" onClick={startCreate}>
                  + Neuer Nachweis
                </button>
              </div>
            </>
          )}

          {draft && (
            <div className="form" style={{ padding: 0 }}>
              <label>
                Titel *
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="z. B. Dockerfile erstellen"
                />
              </label>

              <div>
                <div className="field-label">Beschreibung (Rich-Text)</div>
                <RichTextEditor
                  value={draft.instructions}
                  onChange={(html) => setDraft({ ...draft, instructions: html })}
                  placeholder="Aufgabenstellung … (Links, Bilder, Videos möglich)"
                />
              </div>

              <div>
                <div className="field-label">Einreichungsarten für Lernende</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <label className="goal-check">
                    <input
                      type="checkbox"
                      checked={draft.allowFile}
                      onChange={(e) => setDraft({ ...draft, allowFile: e.target.checked })}
                    />
                    Datei
                  </label>
                  <label className="goal-check">
                    <input
                      type="checkbox"
                      checked={draft.allowLink}
                      onChange={(e) => setDraft({ ...draft, allowLink: e.target.checked })}
                    />
                    Link
                  </label>
                  <label className="goal-check">
                    <input
                      type="checkbox"
                      checked={draft.allowText}
                      onChange={(e) => setDraft({ ...draft, allowText: e.target.checked })}
                    />
                    Text
                  </label>
                </div>
              </div>

              {draft.allowFile && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label style={{ flex: 1, minWidth: 180 }}>
                    Erlaubte Dateitypen
                    <input
                      value={draft.allowedFileTypes}
                      onChange={(e) => setDraft({ ...draft, allowedFileTypes: e.target.value })}
                      placeholder="pdf, png, jpg"
                    />
                  </label>
                  <label style={{ width: 140 }}>
                    Max. Grösse (MB)
                    <input
                      type="number"
                      value={draft.maxFileSizeMb}
                      onChange={(e) => setDraft({ ...draft, maxFileSizeMb: e.target.value })}
                    />
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ width: 120 }}>
                  Max. Punkte
                  <input
                    type="number"
                    value={draft.maxPoints}
                    onChange={(e) => setDraft({ ...draft, maxPoints: e.target.value })}
                  />
                </label>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  Fällig bis
                  <input
                    type="datetime-local"
                    value={draft.dueAt}
                    onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })}
                  />
                </label>
                <label className="goal-check" style={{ fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={draft.isVisible}
                    onChange={(e) => setDraft({ ...draft, isVisible: e.target.checked })}
                  />
                  Sichtbar für Lernende
                </label>
              </div>

              <div className="form-actions">
                <button
                  className="btn"
                  onClick={() => {
                    setDraft(null);
                    setEditId(null);
                    setError('');
                  }}
                >
                  Abbrechen
                </button>
                <button
                  className="btn primary"
                  onClick={() => {
                    void save();
                  }}
                >
                  {editId ? 'Speichern' : 'Nachweis anlegen'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
