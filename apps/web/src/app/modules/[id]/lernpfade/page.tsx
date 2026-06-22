'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppShell from '../../../../components/AppShell';
import TrashIcon from '../../../../components/TrashIcon';
import { useToast } from '../../../../components/ToastProvider';
import {
  matrix as matrixApi,
  learningPaths,
  type LearningPath,
  type MatrixResponse,
} from '../../../../lib/api';

interface FlatField {
  id: string;
  code: string;
  level: string;
  bandCode: string;
  descriptor: string;
}

export default function LearningPathsPage({ params }: { params: { id: string } }) {
  const moduleId = params.id;
  const toast = useToast();
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [paths, setPaths] = useState<LearningPath[] | null>(null);
  const [editId, setEditId] = useState<string | null>(null); // null = kein Editor, 'new' via separate state
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const matrixId = data?.matrix?.id ?? null;

  const fields: FlatField[] = useMemo(() => {
    const list: FlatField[] = [];
    for (const band of data?.matrix?.bands ?? []) {
      for (const f of band.fields) {
        list.push({
          id: f.id,
          code: f.code,
          level: f.level,
          bandCode: band.code,
          descriptor: f.descriptor?.text?.de ?? '',
        });
      }
    }
    return list;
  }, [data]);

  const fieldById = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);

  const loadPaths = useCallback(
    async (mId: string) => {
      try {
        setPaths(await learningPaths.list(mId));
      } catch {
        toast.error('Lernpfade konnten nicht geladen werden.');
      }
    },
    [toast],
  );

  useEffect(() => {
    void (async () => {
      try {
        const m = await matrixApi.get(moduleId);
        setData(m);
        if (m.matrix?.id) await loadPaths(m.matrix.id);
      } catch {
        toast.error('Matrix konnte nicht geladen werden.');
      }
    })();
  }, [moduleId, loadPaths, toast]);

  function resetForm() {
    setEditId(null);
    setCreating(false);
    setName('');
    setSelected([]);
  }

  function startCreate() {
    setCreating(true);
    setEditId(null);
    setName('');
    setSelected([]);
  }

  function startEdit(p: LearningPath) {
    setEditId(p.id);
    setCreating(false);
    setName(p.name);
    setSelected(p.steps.map((s) => s.fieldId));
  }

  function addField(id: string) {
    setSelected((s) => (s.includes(id) ? s : [...s, id]));
  }
  function removeField(id: string) {
    setSelected((s) => s.filter((x) => x !== id));
  }
  function move(index: number, dir: -1 | 1) {
    setSelected((s) => {
      const j = index + dir;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  async function save() {
    if (!matrixId) return;
    if (!name.trim()) {
      toast.error('Bitte einen Namen angeben.');
      return;
    }
    if (selected.length === 0) {
      toast.error('Bitte mindestens ein Kompetenzfeld auswählen.');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await learningPaths.update(editId, { name: name.trim(), fieldIds: selected });
        toast.success('Lernpfad gespeichert.');
      } else {
        await learningPaths.create(matrixId, { name: name.trim(), fieldIds: selected });
        toast.success('Lernpfad erstellt.');
      }
      resetForm();
      await loadPaths(matrixId);
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(p: LearningPath, active: boolean) {
    if (!matrixId) return;
    try {
      await learningPaths.update(p.id, { isActive: active });
      await loadPaths(matrixId);
      toast.success(active ? `„${p.name}" ist jetzt der aktive Pfad.` : 'Pfad deaktiviert.');
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? 'Aktion fehlgeschlagen.');
    }
  }

  async function remove(p: LearningPath) {
    if (!matrixId) return;
    if (!confirm(`Lernpfad „${p.name}" löschen?`)) return;
    try {
      await learningPaths.remove(p.id);
      await loadPaths(matrixId);
      toast.success('Lernpfad gelöscht.');
    } catch {
      toast.error('Löschen fehlgeschlagen.');
    }
  }

  const showEditor = creating || editId !== null;

  return (
    <AppShell>
      <div className="breadcrumb">
        <Link href="/modules">Module</Link> / <Link href={`/modules/${moduleId}`}>Modul</Link> /
        Lernpfade
      </div>
      <div className="page-head">
        <div>
          <h1>Lernpfade</h1>
          <p>Empfohlene Reihenfolge der Kompetenzen für Lernende festlegen</p>
        </div>
        {!showEditor && (
          <button className="btn primary" onClick={startCreate} disabled={!matrixId}>
            + Neuer Lernpfad
          </button>
        )}
      </div>

      {!data ? (
        <div className="loading">Lade…</div>
      ) : fields.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">▦</span>
            <p>
              Für dieses Modul gibt es noch keine Kompetenzfelder. Lege zuerst in der{' '}
              <Link href={`/modules/${moduleId}`}>Matrix</Link> Bänder an.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Editor */}
          {showEditor && (
            <div className="panel">
              <div className="panel-head">
                <h2>{editId ? 'Lernpfad bearbeiten' : 'Neuer Lernpfad'}</h2>
              </div>
              <div className="form">
                <label>
                  Name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="z. B. Empfohlener Pfad Modul 293"
                  />
                </label>

                <div className="grid2">
                  {/* Verfügbare Felder */}
                  <div>
                    <div className="field-label">Verfügbare Kompetenzfelder</div>
                    <ul
                      className="hz-list"
                      style={{ border: '1px solid var(--border)', borderRadius: 8 }}
                    >
                      {fields.map((f) => {
                        const used = selected.includes(f.id);
                        return (
                          <li key={f.id} className="hz-item" style={{ padding: '8px 10px' }}>
                            <span style={{ flex: 1 }}>
                              <strong>{f.code}</strong>{' '}
                              <span className="kh-muted" style={{ fontSize: 12 }}>
                                {f.descriptor || f.level}
                              </span>
                            </span>
                            <button
                              className="btn sm"
                              disabled={used}
                              onClick={() => addField(f.id)}
                            >
                              {used ? '✓ hinzugefügt' : '+ hinzufügen'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Gewählte Reihenfolge */}
                  <div>
                    <div className="field-label">Reihenfolge des Pfads</div>
                    {selected.length === 0 ? (
                      <p className="kh-muted" style={{ fontSize: 13 }}>
                        Noch keine Felder gewählt. Füge links Felder hinzu.
                      </p>
                    ) : (
                      <ul
                        className="hz-list"
                        style={{ border: '1px solid var(--border)', borderRadius: 8 }}
                      >
                        {selected.map((id, i) => {
                          const f = fieldById.get(id);
                          return (
                            <li key={id} className="hz-item" style={{ padding: '8px 10px' }}>
                              <span
                                style={{ width: 22, textAlign: 'right', color: 'var(--fg-muted)' }}
                              >
                                {i + 1}.
                              </span>
                              <span style={{ flex: 1 }}>
                                <strong>{f?.code ?? '—'}</strong>{' '}
                                <span className="kh-muted" style={{ fontSize: 12 }}>
                                  {f?.descriptor || f?.level}
                                </span>
                              </span>
                              <button
                                className="btn-icon"
                                title="Nach oben"
                                disabled={i === 0}
                                onClick={() => move(i, -1)}
                              >
                                ▲
                              </button>
                              <button
                                className="btn-icon"
                                title="Nach unten"
                                disabled={i === selected.length - 1}
                                onClick={() => move(i, 1)}
                              >
                                ▼
                              </button>
                              <button
                                className="btn-icon"
                                title="Entfernen"
                                onClick={() => removeField(id)}
                              >
                                <TrashIcon />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={resetForm}>
                    Abbrechen
                  </button>
                  <button className="btn primary" disabled={saving} onClick={() => void save()}>
                    {saving ? 'Speichert…' : 'Speichern'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Liste der Pfade */}
          <div className="panel">
            <div className="panel-head">
              <h2>Vorhandene Lernpfade</h2>
            </div>
            {!paths ? (
              <div className="loading">Lade…</div>
            ) : paths.length === 0 ? (
              <div className="empty">
                <p>Noch keine Lernpfade. Lege oben einen an.</p>
              </div>
            ) : (
              <ul className="hz-list">
                {paths.map((p) => (
                  <li key={p.id} className="hz-item">
                    <div style={{ flex: 1 }}>
                      <strong>{p.name}</strong>
                      <div className="kh-muted" style={{ fontSize: 12 }}>
                        {p.steps.length} Schritt(e): {p.steps.map((s) => s.code).join(' → ')}
                      </div>
                    </div>
                    {p.isActive ? (
                      <span className="badge b-published">aktiv</span>
                    ) : (
                      <button className="btn sm" onClick={() => void setActive(p, true)}>
                        Aktiv setzen
                      </button>
                    )}
                    <button className="btn sm" onClick={() => startEdit(p)}>
                      Bearbeiten
                    </button>
                    <button className="btn-icon" title="Löschen" onClick={() => void remove(p)}>
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
