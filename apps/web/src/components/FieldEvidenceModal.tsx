'use client';

import { useCallback, useEffect, useState } from 'react';
import RichTextEditor from './RichTextEditor';
import TrashIcon from './TrashIcon';
import { useToast } from './ToastProvider';
import { evidence, uploadRichTextImage, uploadAttachment, type Evidence } from '../lib/api';

interface Draft {
  title: string;
  instructions: string;
  isVisible: boolean;
  dueAt: string;
  allowFile: boolean;
  allowLink: boolean;
  allowText: boolean;
  allowScreenshot: boolean;
  allowPaste: boolean;
  allowedFileTypes: string;
  maxFileSizeMb: string;
  maxPoints: string;
  attachmentKey: string;
  attachmentName: string;
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
    allowScreenshot: false,
    allowPaste: false,
    allowedFileTypes: 'pdf, png, jpg',
    maxFileSizeMb: '10',
    maxPoints: '',
    attachmentKey: '',
    attachmentName: '',
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
  const toast = useToast();
  const [list, setList] = useState<Evidence[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [attBusy, setAttBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await evidence.list(moduleId);
      setList(all.filter((e) => e.fields.some((f) => f.fieldId === fieldId)));
    } catch {
      toast.error('Nachweise konnten nicht geladen werden.');
    }
  }, [moduleId, fieldId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Komplexes Modal: schliesst NICHT beim Klick daneben, aber via Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    toast.error(err.body?.title ?? 'Aktion fehlgeschlagen.');
  }

  async function uploadTeacherAttachment(file: File) {
    if (!draft) return;
    setAttBusy(true);
    try {
      const { key, name } = await uploadAttachment(file);
      setDraft({ ...draft, attachmentKey: key, attachmentName: name });
      toast.success(`Anhang „${name}" hochgeladen.`);
    } catch (e: unknown) {
      showError(e);
    } finally {
      setAttBusy(false);
    }
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
      allowScreenshot: ev.config.allowScreenshot === true,
      allowPaste: ev.config.allowPaste === true,
      allowedFileTypes: (ev.config.allowedFileTypes ?? []).join(', '),
      maxFileSizeMb: String(ev.config.maxFileSizeMb ?? 10),
      maxPoints: ev.maxPoints ?? '',
      attachmentKey: ev.config.attachmentKey ?? '',
      attachmentName: ev.config.attachmentName ?? '',
    });
  }

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast.error('Titel ist erforderlich.');
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
        allowScreenshot: draft.allowScreenshot,
        allowPaste: draft.allowPaste,
        allowedFileTypes: draft.allowedFileTypes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        maxFileSizeMb: draft.maxFileSizeMb ? Number(draft.maxFileSizeMb) : undefined,
        ...(draft.attachmentKey
          ? { attachmentKey: draft.attachmentKey, attachmentName: draft.attachmentName }
          : {}),
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
      toast.success('Nachweis gespeichert.');
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

  // Reihenfolge ändern: Liste lokal umstellen und neu durchnummerieren.
  // (Robust auch wenn bestehende Nachweise alle sortOrder=0 haben.)
  async function move(index: number, dir: -1 | 1) {
    if (!list) return;
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[index], next[j]] = [next[j], next[index]];
    setList(next); // sofortiges visuelles Feedback
    try {
      await Promise.all(next.map((ev, idx) => evidence.update(ev.id, { sortOrder: idx + 1 })));
      await load();
      onChanged();
    } catch (e: unknown) {
      showError(e);
      await load();
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-head">
          <h2>Kompetenznachweise · {fieldLabel}</h2>
          <button className="btn-icon" title="Schliessen" onClick={onClose}>
            ✕
          </button>
        </div>

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
                  {list.map((ev, i) => (
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
                        className="btn-icon"
                        title="Nach oben"
                        disabled={i === 0}
                        onClick={() => {
                          void move(i, -1);
                        }}
                      >
                        ▲
                      </button>
                      <button
                        className="btn-icon"
                        title="Nach unten"
                        disabled={i === list.length - 1}
                        onClick={() => {
                          void move(i, 1);
                        }}
                      >
                        ▼
                      </button>
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
                  uploadImage={uploadRichTextImage}
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
                  <label className="goal-check">
                    <input
                      type="checkbox"
                      checked={draft.allowScreenshot}
                      onChange={(e) => setDraft({ ...draft, allowScreenshot: e.target.checked })}
                    />
                    Screenshot
                  </label>
                </div>
              </div>

              {draft.allowText && (
                <label className="goal-check">
                  <input
                    type="checkbox"
                    checked={draft.allowPaste}
                    onChange={(e) => setDraft({ ...draft, allowPaste: e.target.checked })}
                  />
                  Einfügen (Paste) im Textfeld erlauben (Standard: aus – Lernende schreiben selbst)
                </label>
              )}

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

              {/* Lehrer-Anhang zum Download */}
              <div>
                <div className="field-label">Anhang für Lernende (optional)</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="btn sm" style={{ cursor: 'pointer' }}>
                    {attBusy ? '…' : '⬆ Datei anhängen'}
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadTeacherAttachment(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {draft.attachmentName && (
                    <span className="kh-muted" style={{ fontSize: 13 }}>
                      📎 {draft.attachmentName}
                      <button
                        className="btn-icon"
                        title="Anhang entfernen"
                        onClick={() =>
                          setDraft({ ...draft, attachmentKey: '', attachmentName: '' })
                        }
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              </div>

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
