'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { use } from 'react';
import {
  modules, actionGoals, matrix as matrixApi, descriptors,
  type ModuleDetail, type Band, type ActionGoal, type CompetenceField,
} from '../../../lib/api';

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Beginner (B)',
  INTERMEDIATE: 'Intermediate (I)',
  ADVANCED: 'Advanced (A)',
};

export default function ModuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [mod, setMod] = useState<ModuleDetail | null>(null);
  const [error, setError] = useState('');
  const [editingDesc, setEditingDesc] = useState<{ fieldId: string; text: string } | null>(null);
  const [addingBand, setAddingBand] = useState(false);
  const [bandForm, setBandForm] = useState({ code: '', description: '' });
  const [addingGoal, setAddingGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({ code: '', text: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setMod(await modules.get(id));
    } catch (e: unknown) {
      setError(String(e));
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // ── Handlungsziele ────────────────────────────────────────────
  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalForm.code) return;
    try {
      await actionGoals.create(id, { code: goalForm.code, text: { de: goalForm.text } });
      setAddingGoal(false);
      setGoalForm({ code: '', text: '' });
      await load();
    } catch (e: unknown) {
      setError(String(e));
    }
  }

  async function handleDeleteGoal(goalId: string) {
    if (!confirm('Handlungsziel löschen?')) return;
    await actionGoals.remove(goalId);
    await load();
  }

  // ── Kompetenzbänder ───────────────────────────────────────────
  async function handleAddBand(e: React.FormEvent) {
    e.preventDefault();
    if (!bandForm.code || !mod?.matrix) return;
    try {
      await matrixApi.createBand(mod.matrix.id, {
        code: bandForm.code,
        description: bandForm.description ? { de: bandForm.description } : undefined,
      });
      setAddingBand(false);
      setBandForm({ code: '', description: '' });
      await load();
    } catch (e: unknown) {
      setError(String(e));
    }
  }

  async function handleDeleteBand(bandId: string) {
    if (!confirm('Kompetenzband und alle Felder löschen?')) return;
    await matrixApi.removeBand(bandId);
    await load();
  }

  // ── Deskriptoren ──────────────────────────────────────────────
  function startEditDesc(field: CompetenceField) {
    setEditingDesc({ fieldId: field.id, text: field.descriptor?.text?.de ?? '' });
  }

  async function saveDescriptor() {
    if (!editingDesc) return;
    setSaving(true);
    try {
      await descriptors.upsert(editingDesc.fieldId, { de: editingDesc.text });
      setEditingDesc(null);
      await load();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (error) return <div className="kh-error">{error}</div>;
  if (!mod) return <div className="kh-loading">Lade Modul…</div>;

  const bands: Band[] = mod.matrix?.bands ?? [];

  return (
    <div className="kh-page">
      <div className="kh-breadcrumb">
        <Link href="/modules">Module</Link> / {mod.number}
      </div>

      <div className="kh-page-head">
        <div>
          <h1>Modul {mod.number}</h1>
          <p className="kh-muted">{mod.title?.de}</p>
        </div>
        <span className={`kh-badge kh-badge-${mod.status.toLowerCase()}`}>
          {mod.status === 'DRAFT' ? 'Entwurf' : 'Veröffentlicht'}
        </span>
      </div>

      {error && <div className="kh-error">{error}</div>}

      {/* Handlungsziele */}
      <div className="kh-panel">
        <div className="kh-panel-head">
          <h2>Handlungsziele</h2>
          <button className="kh-btn kh-btn-sm" onClick={() => setAddingGoal(true)}>
            + HZ hinzufügen
          </button>
        </div>

        {addingGoal && (
          <form className="kh-form kh-form-inline" onSubmit={(e) => { void handleAddGoal(e); }}>
            <input
              required
              placeholder="Code (z. B. 1)"
              value={goalForm.code}
              onChange={(e) => setGoalForm((f) => ({ ...f, code: e.target.value }))}
              style={{ width: 80 }}
            />
            <input
              placeholder="Beschreibung (DE)"
              value={goalForm.text}
              onChange={(e) => setGoalForm((f) => ({ ...f, text: e.target.value }))}
              style={{ flex: 1 }}
            />
            <button type="submit" className="kh-btn kh-btn-primary kh-btn-sm">
              Hinzufügen
            </button>
            <button type="button" className="kh-btn kh-btn-sm" onClick={() => setAddingGoal(false)}>
              ✕
            </button>
          </form>
        )}

        {mod.actionGoals.length === 0 ? (
          <p className="kh-muted kh-empty">Noch keine Handlungsziele. Füge das erste HZ hinzu.</p>
        ) : (
          <ul className="kh-hz-list">
            {mod.actionGoals.map((g: ActionGoal) => (
              <li key={g.id} className="kh-hz-item">
                <span className="kh-hz-code">{g.code}</span>
                <span>{g.text?.de ?? '—'}</span>
                <button
                  className="kh-btn-icon"
                  title="Löschen"
                  onClick={() => { void handleDeleteGoal(g.id); }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Matrix-Editor */}
      <div className="kh-panel">
        <div className="kh-panel-head">
          <h2>Kompetenzmatrix</h2>
          <button className="kh-btn kh-btn-sm" onClick={() => setAddingBand(true)}>
            + Band hinzufügen
          </button>
        </div>

        {addingBand && (
          <form className="kh-form kh-form-inline" onSubmit={(e) => { void handleAddBand(e); }}>
            <input
              required
              placeholder="Code (z. B. A1)"
              value={bandForm.code}
              onChange={(e) => setBandForm((f) => ({ ...f, code: e.target.value }))}
              style={{ width: 100 }}
            />
            <input
              placeholder="Beschreibung (DE)"
              value={bandForm.description}
              onChange={(e) => setBandForm((f) => ({ ...f, description: e.target.value }))}
              style={{ flex: 1 }}
            />
            <button type="submit" className="kh-btn kh-btn-primary kh-btn-sm">
              Anlegen
            </button>
            <button type="button" className="kh-btn kh-btn-sm" onClick={() => setAddingBand(false)}>
              ✕
            </button>
          </form>
        )}

        {bands.length === 0 ? (
          <p className="kh-muted kh-empty">
            Noch keine Kompetenzbänder. Füge das erste Band hinzu.
          </p>
        ) : (
          <div className="kh-matrix">
            {/* Header */}
            <div className="kh-matrix-header">
              <div className="kh-matrix-band-col">Band</div>
              {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((lvl) => (
                <div key={lvl} className="kh-matrix-level-col">
                  {LEVEL_LABEL[lvl]}
                </div>
              ))}
              <div className="kh-matrix-act-col"></div>
            </div>

            {bands.map((band: Band) => (
              <div key={band.id} className="kh-matrix-row">
                <div className="kh-matrix-band-col">
                  <div className="kh-band-code">{band.code}</div>
                  {band.description?.de && (
                    <div className="kh-band-desc kh-muted">{band.description.de}</div>
                  )}
                </div>

                {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((lvl) => {
                  const field = band.fields.find((f: CompetenceField) => f.level === lvl);
                  if (!field) return <div key={lvl} className="kh-matrix-level-col" />;
                  const isEditing = editingDesc?.fieldId === field.id;
                  return (
                    <div key={field.id} className="kh-matrix-level-col kh-field-cell">
                      {isEditing ? (
                        <div className="kh-desc-editor">
                          <textarea
                            autoFocus
                            rows={3}
                            value={editingDesc.text}
                            onChange={(e) =>
                              setEditingDesc((d) => d && { ...d, text: e.target.value })
                            }
                            placeholder="Ich kann …"
                          />
                          <div className="kh-desc-editor-btns">
                            <button
                              className="kh-btn kh-btn-primary kh-btn-sm"
                              disabled={saving}
                              onClick={() => { void saveDescriptor(); }}
                            >
                              {saving ? '…' : 'Speichern'}
                            </button>
                            <button
                              className="kh-btn kh-btn-sm"
                              onClick={() => setEditingDesc(null)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="kh-field-btn"
                          title="Deskriptor bearbeiten"
                          onClick={() => startEditDesc(field)}
                        >
                          {field.descriptor?.text?.de ? (
                            <span className="kh-descriptor-text">
                              {field.descriptor.text.de}
                            </span>
                          ) : (
                            <span className="kh-descriptor-empty">Ich kann …</span>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}

                <div className="kh-matrix-act-col">
                  <button
                    className="kh-btn-icon"
                    title="Band löschen"
                    onClick={() => { void handleDeleteBand(band.id); }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
