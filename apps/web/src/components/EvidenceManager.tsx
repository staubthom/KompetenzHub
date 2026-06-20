'use client';

import { useCallback, useEffect, useState } from 'react';
import TrashIcon from './TrashIcon';
import { evidence, type Evidence, type QuizQuestion } from '../lib/api';

export interface FieldOption {
  id: string;
  label: string;
}

type Draft = {
  type: 'QUIZ' | 'FILE_UPLOAD';
  title: string;
  isVisible: boolean;
  dueAt: string;
  fieldIds: string[];
  // quiz
  questions: QuizQuestion[];
  // upload
  maxPoints: string;
  allowedFileTypes: string;
  maxFileSizeMb: string;
};

function emptyDraft(type: 'QUIZ' | 'FILE_UPLOAD'): Draft {
  return {
    type,
    title: '',
    isVisible: true,
    dueAt: '',
    fieldIds: [],
    questions: type === 'QUIZ' ? [newQuestion()] : [],
    maxPoints: '',
    allowedFileTypes: 'pdf, png, jpg',
    maxFileSizeMb: '10',
  };
}

let qCounter = 0;
function newQuestion(): QuizQuestion {
  qCounter += 1;
  return {
    id: `q${Date.now()}_${qCounter}`,
    text: '',
    type: 'single',
    points: 1,
    options: [
      { id: 'o1', text: '' },
      { id: 'o2', text: '' },
    ],
    correct: [],
  };
}

export default function EvidenceManager({
  moduleId,
  fields,
}: {
  moduleId: string;
  fields: FieldOption[];
}) {
  const [list, setList] = useState<Evidence[] | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await evidence.list(moduleId));
    } catch (e: unknown) {
      setError(String(e));
    }
  }, [moduleId]);

  useEffect(() => {
    void load();
  }, [load]);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    setError(err.body?.title ?? String(e));
  }

  async function handleToggleVisible(ev: Evidence) {
    try {
      await evidence.update(ev.id, { isVisible: !ev.isVisible });
      await load();
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Nachweis löschen?')) return;
    try {
      await evidence.remove(id);
      await load();
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleSave() {
    if (!draft) return;
    if (!draft.title.trim()) {
      setError('Titel ist erforderlich.');
      return;
    }
    try {
      if (draft.type === 'QUIZ') {
        // Validierung: jede Frage Text + ≥1 korrekt
        for (const q of draft.questions) {
          if (!q.text.trim()) {
            setError('Jede Frage braucht einen Text.');
            return;
          }
          if (!q.correct || q.correct.length === 0) {
            setError(`Frage "${q.text}" braucht eine korrekte Antwort.`);
            return;
          }
        }
        await evidence.create({
          moduleId,
          type: 'QUIZ',
          title: { de: draft.title.trim() },
          isVisible: draft.isVisible,
          dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
          fieldIds: draft.fieldIds,
          config: { questions: draft.questions },
        });
      } else {
        await evidence.create({
          moduleId,
          type: 'FILE_UPLOAD',
          title: { de: draft.title.trim() },
          isVisible: draft.isVisible,
          dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
          maxPoints: draft.maxPoints ? Number(draft.maxPoints) : undefined,
          fieldIds: draft.fieldIds,
          config: {
            allowedFileTypes: draft.allowedFileTypes
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            maxFileSizeMb: draft.maxFileSizeMb ? Number(draft.maxFileSizeMb) : undefined,
          },
        });
      }
      setDraft(null);
      await load();
    } catch (e: unknown) {
      showError(e);
    }
  }

  // Quiz-Frage-Editor-Helfer
  function updateQuestion(qi: number, patch: Partial<QuizQuestion>) {
    setDraft(
      (d) =>
        d && { ...d, questions: d.questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)) },
    );
  }
  function toggleCorrect(qi: number, optId: string) {
    setDraft((d) => {
      if (!d) return d;
      const q = d.questions[qi];
      const isCorrect = q.correct?.includes(optId);
      let correct: string[];
      if (q.type === 'single') correct = isCorrect ? [] : [optId];
      else
        correct = isCorrect
          ? (q.correct ?? []).filter((c) => c !== optId)
          : [...(q.correct ?? []), optId];
      return { ...d, questions: d.questions.map((qq, i) => (i === qi ? { ...qq, correct } : qq)) };
    });
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Kompetenznachweise</h2>
        {!draft && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn sm" onClick={() => setDraft(emptyDraft('QUIZ'))}>
              + Quiz
            </button>
            <button className="btn sm" onClick={() => setDraft(emptyDraft('FILE_UPLOAD'))}>
              + Upload
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="error" style={{ margin: '12px 18px 0' }}>
          {error}
        </div>
      )}

      {/* Erstellformular */}
      {draft && (
        <div className="form">
          <div className="kh-muted" style={{ fontWeight: 600 }}>
            Neuer {draft.type === 'QUIZ' ? 'Quiz' : 'Upload'}-Nachweis
          </div>
          <label>
            Titel *
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="z. B. Quiz Fehlerdiagnose"
            />
          </label>

          {draft.type === 'FILE_UPLOAD' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ width: 120 }}>
                Max. Punkte
                <input
                  type="number"
                  value={draft.maxPoints}
                  onChange={(e) => setDraft({ ...draft, maxPoints: e.target.value })}
                />
              </label>
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

          {/* Quiz-Fragen-Editor */}
          {draft.type === 'QUIZ' && (
            <div className="quiz-editor">
              {draft.questions.map((q, qi) => (
                <div key={q.id} className="quiz-q">
                  <div className="quiz-q-head">
                    <strong>Frage {qi + 1}</strong>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        value={q.type}
                        onChange={(e) =>
                          updateQuestion(qi, {
                            type: e.target.value as 'single' | 'multiple',
                            correct: [],
                          })
                        }
                      >
                        <option value="single">Einfachauswahl</option>
                        <option value="multiple">Mehrfachauswahl</option>
                      </select>
                      <input
                        type="number"
                        title="Punkte"
                        style={{ width: 70 }}
                        value={q.points}
                        onChange={(e) => updateQuestion(qi, { points: Number(e.target.value) })}
                      />
                      {draft.questions.length > 1 && (
                        <button
                          className="btn-icon"
                          title="Frage entfernen"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              questions: draft.questions.filter((_, i) => i !== qi),
                            })
                          }
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    className="quiz-q-text"
                    placeholder="Fragetext"
                    value={q.text}
                    onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                  />
                  <div className="quiz-opts">
                    {q.options.map((o, oi) => (
                      <div key={o.id} className="quiz-opt">
                        <input
                          type={q.type === 'single' ? 'radio' : 'checkbox'}
                          checked={q.correct?.includes(o.id) ?? false}
                          onChange={() => toggleCorrect(qi, o.id)}
                          title="Als korrekt markieren"
                        />
                        <input
                          placeholder={`Option ${oi + 1}`}
                          value={o.text}
                          onChange={(e) =>
                            updateQuestion(qi, {
                              options: q.options.map((oo, i) =>
                                i === oi ? { ...oo, text: e.target.value } : oo,
                              ),
                            })
                          }
                        />
                        {q.options.length > 2 && (
                          <button
                            className="btn-icon"
                            title="Option entfernen"
                            onClick={() =>
                              updateQuestion(qi, {
                                options: q.options.filter((_, i) => i !== oi),
                                correct: (q.correct ?? []).filter((c) => c !== o.id),
                              })
                            }
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      className="btn sm"
                      type="button"
                      onClick={() =>
                        updateQuestion(qi, {
                          options: [
                            ...q.options,
                            { id: `o${q.options.length + 1}_${Date.now()}`, text: '' },
                          ],
                        })
                      }
                    >
                      + Option
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="btn sm"
                type="button"
                onClick={() =>
                  setDraft({ ...draft, questions: [...draft.questions, newQuestion()] })
                }
              >
                + Frage
              </button>
            </div>
          )}

          {/* Kompetenzfeld-Zuordnung */}
          {fields.length > 0 && (
            <fieldset className="goal-picker">
              <legend>Kompetenzfeld(er) zuordnen</legend>
              {fields.map((f) => (
                <label key={f.id} className="goal-check">
                  <input
                    type="checkbox"
                    checked={draft.fieldIds.includes(f.id)}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        fieldIds: draft.fieldIds.includes(f.id)
                          ? draft.fieldIds.filter((x) => x !== f.id)
                          : [...draft.fieldIds, f.id],
                      })
                    }
                  />
                  {f.label}
                </label>
              ))}
            </fieldset>
          )}

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="goal-check" style={{ fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={draft.isVisible}
                onChange={(e) => setDraft({ ...draft, isVisible: e.target.checked })}
              />
              Sichtbar für Lernende
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              Fällig bis
              <input
                type="datetime-local"
                value={draft.dueAt}
                onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })}
              />
            </label>
          </div>

          <div className="form-actions">
            <button
              className="btn"
              onClick={() => {
                setDraft(null);
                setError('');
              }}
            >
              Abbrechen
            </button>
            <button
              className="btn primary"
              onClick={() => {
                void handleSave();
              }}
            >
              Nachweis speichern
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {!list ? (
        <div className="loading">Lade Nachweise…</div>
      ) : list.length === 0 && !draft ? (
        <div className="empty">
          <p>Noch keine Nachweise. Lege ein Quiz oder einen Upload-Nachweis an.</p>
        </div>
      ) : list.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th>Nachweis</th>
              <th>Typ</th>
              <th>Punkte</th>
              <th>Einreichungen</th>
              <th>Sichtbar</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((ev) => (
              <tr key={ev.id}>
                <td>
                  <div className="mod">{ev.title?.de ?? '—'}</div>
                  {ev.dueAt && (
                    <div className="kh-muted" style={{ fontSize: 12 }}>
                      fällig {new Date(ev.dueAt).toLocaleString('de-CH')}
                    </div>
                  )}
                </td>
                <td>
                  <span className="badge b-archived">{ev.type === 'QUIZ' ? 'Quiz' : 'Upload'}</span>
                </td>
                <td>{ev.maxPoints ?? '—'}</td>
                <td>{ev._count?.submissions ?? 0}</td>
                <td>
                  <button
                    className={`badge ${ev.isVisible ? 'b-published' : 'b-archived'}`}
                    style={{ cursor: 'pointer', border: 'none' }}
                    onClick={() => {
                      void handleToggleVisible(ev);
                    }}
                  >
                    {ev.isVisible ? 'sichtbar' : 'verborgen'}
                  </button>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="btn-icon"
                      title="Löschen"
                      onClick={() => {
                        void handleDelete(ev.id);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
