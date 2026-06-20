'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import AppShell from '../../../components/AppShell';
import {
  modules, actionGoals, matrix as matrixApi, descriptors,
  type ModuleDetail, type Band, type ActionGoal, type CompetenceField,
} from '../../../lib/api';

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Beginner (B)',
  INTERMEDIATE: 'Intermediate (I)',
  ADVANCED: 'Advanced (A)',
};
const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;

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

  if (!mod) {
    return (
      <AppShell>
        {error ? <div className="error">{error}</div> : <div className="loading">Lade Modul…</div>}
      </AppShell>
    );
  }

  const bands: Band[] = mod.matrix?.bands ?? [];

  return (
    <AppShell>
      <div className="breadcrumb">
        <Link href="/modules">Module</Link> / {mod.number}
      </div>

      <div className="page-head">
        <div>
          <h1>Modul {mod.number}</h1>
          <p>{mod.title?.de}</p>
        </div>
        <span className={`badge b-${mod.status.toLowerCase()}`}>
          {mod.status === 'DRAFT' ? 'Entwurf' : 'Veröffentlicht'}
        </span>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Handlungsziele */}
      <div className="panel">
        <div className="panel-head">
          <h2>Handlungsziele</h2>
          <button className="btn sm" onClick={() => setAddingGoal(true)}>
            + HZ hinzufügen
          </button>
        </div>

        {addingGoal && (
          <form className="form-inline" onSubmit={(e) => { void handleAddGoal(e); }}>
            <input
              required
              placeholder="Code (z. B. 1)"
              value={goalForm.code}
              onChange={(e) => setGoalForm((f) => ({ ...f, code: e.target.value }))}
              style={{ width: 90 }}
            />
            <input
              placeholder="Beschreibung (DE)"
              value={goalForm.text}
              onChange={(e) => setGoalForm((f) => ({ ...f, text: e.target.value }))}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn primary sm">Hinzufügen</button>
            <button type="button" className="btn sm" onClick={() => setAddingGoal(false)}>✕</button>
          </form>
        )}

        {mod.actionGoals.length === 0 ? (
          <div className="empty">
            <p>Noch keine Handlungsziele. Füge das erste HZ hinzu.</p>
          </div>
        ) : (
          <ul className="hz-list">
            {mod.actionGoals.map((g: ActionGoal) => (
              <li key={g.id} className="hz-item">
                <span className="hz-code">{g.code}</span>
                <span style={{ flex: 1 }}>{g.text?.de ?? '—'}</span>
                <button className="btn-icon" title="Löschen" onClick={() => { void handleDeleteGoal(g.id); }}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Matrix-Editor */}
      <div className="panel">
        <div className="panel-head">
          <h2>Kompetenzmatrix</h2>
          <button className="btn sm" onClick={() => setAddingBand(true)}>
            + Band hinzufügen
          </button>
        </div>

        {addingBand && (
          <form className="form-inline" onSubmit={(e) => { void handleAddBand(e); }}>
            <input
              required
              placeholder="Code (z. B. A1)"
              value={bandForm.code}
              onChange={(e) => setBandForm((f) => ({ ...f, code: e.target.value }))}
              style={{ width: 110 }}
            />
            <input
              placeholder="Beschreibung (DE)"
              value={bandForm.description}
              onChange={(e) => setBandForm((f) => ({ ...f, description: e.target.value }))}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn primary sm">Anlegen</button>
            <button type="button" className="btn sm" onClick={() => setAddingBand(false)}>✕</button>
          </form>
        )}

        {bands.length === 0 ? (
          <div className="empty">
            <span className="ic">▦</span>
            <p>Noch keine Kompetenzbänder. Füge das erste Band hinzu.</p>
          </div>
        ) : (
          <div className="matrix">
            <div className="matrix-header">
              <div>Band</div>
              {LEVELS.map((lvl) => (
                <div key={lvl}>{LEVEL_LABEL[lvl]}</div>
              ))}
              <div></div>
            </div>

            {bands.map((band: Band) => (
              <div key={band.id} className="matrix-row">
                <div className="band-col">
                  <div className="band-code">{band.code}</div>
                  {band.description?.de && <div className="band-desc">{band.description.de}</div>}
                </div>

                {LEVELS.map((lvl) => {
                  const field = band.fields.find((f: CompetenceField) => f.level === lvl);
                  if (!field) return <div key={lvl} className="level-col" />;
                  const isEditing = editingDesc?.fieldId === field.id;
                  return (
                    <div key={field.id} className="level-col">
                      {isEditing ? (
                        <div className="desc-editor">
                          <textarea
                            autoFocus
                            rows={3}
                            value={editingDesc.text}
                            onChange={(e) => setEditingDesc((d) => d && { ...d, text: e.target.value })}
                            placeholder="Ich kann …"
                          />
                          <div className="desc-editor-btns">
                            <button
                              className="btn primary sm"
                              disabled={saving}
                              onClick={() => { void saveDescriptor(); }}
                            >
                              {saving ? '…' : 'Speichern'}
                            </button>
                            <button className="btn sm" onClick={() => setEditingDesc(null)}>✕</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="field-btn"
                          title="Deskriptor bearbeiten"
                          onClick={() => startEditDesc(field)}
                        >
                          <span className="field-code">{field.code}</span>
                          {field.descriptor?.text?.de ? (
                            <span className="descriptor-text">{field.descriptor.text.de}</span>
                          ) : (
                            <span className="descriptor-empty">Ich kann …</span>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}

                <div className="act-col">
                  <button
                    className="btn-icon"
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
    </AppShell>
  );
}
