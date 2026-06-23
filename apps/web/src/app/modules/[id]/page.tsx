'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import TrashIcon from '../../../components/TrashIcon';
import FieldEvidenceModal from '../../../components/FieldEvidenceModal';
import { useToast } from '../../../components/ToastProvider';
import { useI18n } from '../../../lib/i18n';
import {
  modules,
  actionGoals,
  matrix as matrixApi,
  exportMatrixZip,
  descriptors,
  type ModuleDetail,
  type Band,
  type ActionGoal,
  type CompetenceField,
} from '../../../lib/api';

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;

// In Next.js 14 ist params ein einfaches Objekt (kein Promise).
export default function ModuleDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [mod, setMod] = useState<ModuleDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // Modul-Bearbeitung
  const [editMod, setEditMod] = useState(false);
  const [modForm, setModForm] = useState({
    number: '',
    title: '',
    description: '',
    status: 'DRAFT',
  });

  // Handlungsziele
  const [addingGoal, setAddingGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({ code: '', text: '' });
  const [editGoal, setEditGoal] = useState<{ id: string; code: string; text: string } | null>(null);

  // Bänder
  const [addingBand, setAddingBand] = useState(false);
  const [bandForm, setBandForm] = useState<{
    code: string;
    description: string;
    goalIds: string[];
  }>({
    code: '',
    description: '',
    goalIds: [],
  });
  const [editBand, setEditBand] = useState<{
    id: string;
    code: string;
    description: string;
    goalIds: string[];
  } | null>(null);

  // Deskriptoren
  const [editingDesc, setEditingDesc] = useState<{ fieldId: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Nachweise je Feld (Modal)
  const [evidenceField, setEvidenceField] = useState<{ id: string; label: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setMod(await modules.get(id));
    } catch (e: unknown) {
      setLoadFailed(true);
      toast.error(t('me.loadFailed'));
    }
  }, [id, toast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    toast.error(err.body?.title ?? 'Aktion fehlgeschlagen.');
  }

  // ── Modul bearbeiten (FA-01) ──────────────────────────────────
  async function handleExport() {
    if (!mod?.matrix) return;
    try {
      const { blob, filename } = await exportMatrixZip(mod.matrix.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('me.exportSuccess'));
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? t('me.exportFailed'));
    }
  }

  function startEditMod() {
    if (!mod) return;
    setModForm({
      number: mod.number,
      title: mod.title?.de ?? '',
      description: mod.description?.de ?? '',
      status: mod.status,
    });
    setEditMod(true);
  }

  async function saveMod(e: React.FormEvent) {
    e.preventDefault();
    try {
      await modules.update(id, {
        number: modForm.number.trim(),
        title: { de: modForm.title.trim() },
        description: { de: modForm.description.trim() },
        status: modForm.status,
      });
      setEditMod(false);
      await load();
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleDeleteModule() {
    if (!mod) return;
    if (!confirm(t('me.confirmDeleteModule'))) return;
    try {
      await modules.remove(id);
      router.replace('/modules');
    } catch (e: unknown) {
      showError(e);
    }
  }

  // ── Handlungsziele (FA-02) ────────────────────────────────────
  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalForm.code) return;
    try {
      await actionGoals.create(id, {
        code: goalForm.code.trim(),
        text: { de: goalForm.text.trim() },
      });
      setAddingGoal(false);
      setGoalForm({ code: '', text: '' });
      await load();
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function saveEditGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!editGoal) return;
    try {
      await actionGoals.update(editGoal.id, {
        code: editGoal.code.trim(),
        text: { de: editGoal.text.trim() },
      });
      setEditGoal(null);
      await load();
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleDeleteGoal(goalId: string) {
    if (!confirm(t('me.confirmDeleteGoal'))) return;
    try {
      await actionGoals.remove(goalId);
      await load();
    } catch (e: unknown) {
      showError(e);
    }
  }

  // Reihenfolge per Tausch des sortOrder mit dem Nachbarn
  async function moveGoal(index: number, dir: -1 | 1) {
    if (!mod) return;
    const goals = mod.actionGoals;
    const target = goals[index + dir];
    const current = goals[index];
    if (!target || !current) return;
    try {
      await Promise.all([
        actionGoals.update(current.id, { sortOrder: target.sortOrder }),
        actionGoals.update(target.id, { sortOrder: current.sortOrder }),
      ]);
      await load();
    } catch (e: unknown) {
      showError(e);
    }
  }

  // ── Kompetenzbänder (FA-03) ───────────────────────────────────
  function toggleGoalId(setFn: (ids: string[]) => void, ids: string[], goalId: string) {
    setFn(ids.includes(goalId) ? ids.filter((g) => g !== goalId) : [...ids, goalId]);
  }

  async function handleAddBand(e: React.FormEvent) {
    e.preventDefault();
    if (!bandForm.code || !mod?.matrix) return;
    if (bandForm.goalIds.length === 0) {
      toast.error(t('me.bandMustRefGoal'));
      return;
    }
    try {
      await matrixApi.createBand(mod.matrix.id, {
        code: bandForm.code.trim(),
        description: bandForm.description ? { de: bandForm.description.trim() } : undefined,
        actionGoalIds: bandForm.goalIds,
      });
      setAddingBand(false);
      setBandForm({ code: '', description: '', goalIds: [] });
      await load();
    } catch (e: unknown) {
      showError(e);
    }
  }

  function startEditBand(band: Band) {
    setEditBand({
      id: band.id,
      code: band.code,
      description: band.description?.de ?? '',
      goalIds: band.actionGoals.map((a) => a.actionGoal.id),
    });
  }

  async function saveEditBand(e: React.FormEvent) {
    e.preventDefault();
    if (!editBand) return;
    if (editBand.goalIds.length === 0) {
      toast.error(t('me.bandMustRefGoal'));
      return;
    }
    try {
      await matrixApi.updateBand(editBand.id, {
        code: editBand.code.trim(),
        description: { de: editBand.description.trim() },
        actionGoalIds: editBand.goalIds,
      });
      setEditBand(null);
      await load();
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleDeleteBand(bandId: string) {
    if (!confirm(t('me.confirmDeleteBand'))) return;
    try {
      await matrixApi.removeBand(bandId);
      await load();
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function moveBand(index: number, dir: -1 | 1) {
    const bands = mod?.matrix?.bands ?? [];
    const current = bands[index];
    const target = bands[index + dir];
    if (!current || !target) return;
    try {
      await Promise.all([
        matrixApi.updateBand(current.id, { sortOrder: target.sortOrder }),
        matrixApi.updateBand(target.id, { sortOrder: current.sortOrder }),
      ]);
      await load();
    } catch (e: unknown) {
      showError(e);
    }
  }

  // ── Deskriptoren (FA-04) ──────────────────────────────────────
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
      showError(e);
    } finally {
      setSaving(false);
    }
  }

  if (!mod) {
    return (
      <AppShell>
        <div className="loading">{loadFailed ? t('me.loadFailed') : t('me.loading')}</div>
      </AppShell>
    );
  }

  const bands: Band[] = mod.matrix?.bands ?? [];
  const goals: ActionGoal[] = mod.actionGoals;

  return (
    <AppShell>
      <div className="breadcrumb">
        <Link href="/modules">{t('me.modules')}</Link> / {mod.number}
      </div>

      <div className="page-head">
        <div>
          <h1>
            {t('me.module')} {mod.number}
          </h1>
          <p>{mod.title?.de}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`badge b-${mod.status.toLowerCase()}`}>
            {t(`modstatus.${mod.status}`)}
          </span>
          <Link className="btn sm" href={`/modules/${id}/lernpfade`}>
            {t('me.paths')}
          </Link>
          <button
            className="btn sm"
            disabled={!mod.matrix}
            onClick={() => {
              void handleExport();
            }}
          >
            {t('me.export')}
          </button>
          <button className="btn sm" onClick={startEditMod}>
            {t('me.editModule')}
          </button>
        </div>
      </div>

      {/* Modul bearbeiten (FA-01) */}
      {editMod && (
        <div className="panel">
          <div className="panel-head">
            <h2>{t('me.editModule')}</h2>
          </div>
          <form
            className="form"
            onSubmit={(e) => {
              void saveMod(e);
            }}
          >
            <label>
              {t('me.moduleNumber')}
              <input
                required
                value={modForm.number}
                onChange={(e) => setModForm((f) => ({ ...f, number: e.target.value }))}
              />
            </label>
            <label>
              {t('me.titleDe')}
              <input
                value={modForm.title}
                onChange={(e) => setModForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label>
              {t('me.descDe')}
              <input
                value={modForm.description}
                onChange={(e) => setModForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label>
              {t('me.status')}
              <select
                value={modForm.status}
                onChange={(e) => setModForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="DRAFT">{t('modstatus.DRAFT')}</option>
                <option value="PUBLISHED">{t('modstatus.PUBLISHED')}</option>
                <option value="ARCHIVED">{t('modstatus.ARCHIVED')}</option>
              </select>
            </label>
            <div className="form-actions" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  void handleDeleteModule();
                }}
              >
                <TrashIcon /> {t('me.deleteModule')}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn" onClick={() => setEditMod(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn primary">
                  {t('common.save')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Handlungsziele (FA-02) */}
      <div className="panel">
        <div className="panel-head">
          <h2>{t('me.goals')}</h2>
          <button className="btn sm" onClick={() => setAddingGoal(true)}>
            {t('me.addGoal')}
          </button>
        </div>

        {addingGoal && (
          <form
            className="form-inline"
            onSubmit={(e) => {
              void handleAddGoal(e);
            }}
          >
            <input
              required
              placeholder={t('me.goalCodePlaceholder')}
              value={goalForm.code}
              onChange={(e) => setGoalForm((f) => ({ ...f, code: e.target.value }))}
              style={{ width: 90 }}
            />
            <input
              placeholder={t('me.goalTextPlaceholder')}
              value={goalForm.text}
              onChange={(e) => setGoalForm((f) => ({ ...f, text: e.target.value }))}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn primary sm">
              {t('me.add')}
            </button>
            <button type="button" className="btn sm" onClick={() => setAddingGoal(false)}>
              ✕
            </button>
          </form>
        )}

        {goals.length === 0 ? (
          <div className="empty">
            <p>{t('me.noGoals')}</p>
          </div>
        ) : (
          <ul className="hz-list">
            {goals.map((g, i) => (
              <li key={g.id} className="hz-item">
                {editGoal?.id === g.id ? (
                  <form
                    className="form-inline"
                    style={{ flex: 1, padding: 0, border: 'none' }}
                    onSubmit={(e) => {
                      void saveEditGoal(e);
                    }}
                  >
                    <input
                      value={editGoal.code}
                      onChange={(e) => setEditGoal((d) => d && { ...d, code: e.target.value })}
                      style={{ width: 90 }}
                    />
                    <input
                      value={editGoal.text}
                      onChange={(e) => setEditGoal((d) => d && { ...d, text: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn primary sm">
                      {t('common.save')}
                    </button>
                    <button type="button" className="btn sm" onClick={() => setEditGoal(null)}>
                      ✕
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="hz-code">{g.code}</span>
                    <span style={{ flex: 1 }}>{g.text?.de ?? '—'}</span>
                    <button
                      className="btn-icon"
                      title={t('fe.moveUp')}
                      disabled={i === 0}
                      onClick={() => {
                        void moveGoal(i, -1);
                      }}
                    >
                      ▲
                    </button>
                    <button
                      className="btn-icon"
                      title={t('fe.moveDown')}
                      disabled={i === goals.length - 1}
                      onClick={() => {
                        void moveGoal(i, 1);
                      }}
                    >
                      ▼
                    </button>
                    <button
                      className="btn sm"
                      onClick={() =>
                        setEditGoal({ id: g.id, code: g.code, text: g.text?.de ?? '' })
                      }
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      className="btn-icon"
                      title={t('common.delete')}
                      onClick={() => {
                        void handleDeleteGoal(g.id);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Matrix-Editor (FA-03 + FA-04) */}
      <div className="panel">
        <div className="panel-head">
          <h2>{t('me.matrix')}</h2>
          <button
            className="btn sm"
            onClick={() => setAddingBand(true)}
            disabled={goals.length === 0}
          >
            {t('me.addBand')}
          </button>
        </div>

        {goals.length === 0 && (
          <div className="empty">
            <p>{t('me.needGoalsFirst')}</p>
          </div>
        )}

        {addingBand && (
          <form
            className="form"
            onSubmit={(e) => {
              void handleAddBand(e);
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ width: 130 }}>
                {t('me.code')}
                <input
                  required
                  placeholder="z. B. A1"
                  value={bandForm.code}
                  onChange={(e) => setBandForm((f) => ({ ...f, code: e.target.value }))}
                />
              </label>
              <label style={{ flex: 1 }}>
                {t('me.descDe')}
                <input
                  placeholder={t('common.optional')}
                  value={bandForm.description}
                  onChange={(e) => setBandForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
            </div>
            <fieldset className="goal-picker">
              <legend>{t('me.refGoals')}</legend>
              {goals.map((g) => (
                <label key={g.id} className="goal-check">
                  <input
                    type="checkbox"
                    checked={bandForm.goalIds.includes(g.id)}
                    onChange={() =>
                      toggleGoalId(
                        (ids) => setBandForm((f) => ({ ...f, goalIds: ids })),
                        bandForm.goalIds,
                        g.id,
                      )
                    }
                  />
                  <span className="hz-code">{g.code}</span> {g.text?.de ?? ''}
                </label>
              ))}
            </fieldset>
            <div className="form-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setAddingBand(false);
                  setBandForm({ code: '', description: '', goalIds: [] });
                }}
              >
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn primary">
                {t('me.createBand')}
              </button>
            </div>
          </form>
        )}

        {bands.length === 0 ? (
          <div className="empty">
            <span className="ic">▦</span>
            <p>{t('me.noBands')}</p>
          </div>
        ) : (
          <div className="matrix">
            <div className="matrix-header">
              <div>{t('me.colBand')}</div>
              {LEVELS.map((lvl) => (
                <div key={lvl}>{t(`level.${lvl}`)}</div>
              ))}
              <div></div>
            </div>

            {bands.map((band, i) => (
              <div key={band.id} className="matrix-row">
                <div className="band-col">
                  <div className="band-code">{band.code}</div>
                  {band.description?.de && <div className="band-desc">{band.description.de}</div>}
                  <div className="band-goals">
                    {band.actionGoals.map((a) => (
                      <span key={a.actionGoal.id} className="goal-chip">
                        HZ {a.actionGoal.code}
                      </span>
                    ))}
                  </div>
                </div>

                {LEVELS.map((lvl) => {
                  const field = band.fields.find((f) => f.level === lvl);
                  if (!field) return <div key={lvl} className="level-col" />;
                  const isEditing = editingDesc?.fieldId === field.id;
                  return (
                    <div key={field.id} className="level-col">
                      {isEditing ? (
                        <div className="desc-editor">
                          <textarea
                            // Fokus folgt dem gerade geöffneten Deskriptor-Editor (a11y-konform)
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus
                            rows={3}
                            value={editingDesc.text}
                            onChange={(e) =>
                              setEditingDesc((d) => d && { ...d, text: e.target.value })
                            }
                            placeholder={t('me.descPlaceholder')}
                          />
                          <div className="desc-editor-btns">
                            <button
                              className="btn primary sm"
                              disabled={saving}
                              onClick={() => {
                                void saveDescriptor();
                              }}
                            >
                              {saving ? '…' : t('common.save')}
                            </button>
                            <button className="btn sm" onClick={() => setEditingDesc(null)}>
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            className="field-btn"
                            title={t('me.editDescriptor')}
                            onClick={() => startEditDesc(field)}
                          >
                            <span className="field-code">{field.code}</span>
                            {field.descriptor?.text?.de ? (
                              <span className="descriptor-text">{field.descriptor.text.de}</span>
                            ) : (
                              <span className="descriptor-empty">{t('me.descPlaceholder')}</span>
                            )}
                          </button>
                          <div className="field-evidence">
                            {(field.evidences ?? []).map((e) => (
                              <span
                                key={e.evidence.id}
                                className="evidence-chip"
                                title={e.evidence.title?.de}
                              >
                                📎 {e.evidence.title?.de}
                                {!e.evidence.isVisible && (
                                  <span className="ev-hidden"> {t('me.hidden')}</span>
                                )}
                              </span>
                            ))}
                            <button
                              className="evidence-add"
                              onClick={() =>
                                setEvidenceField({
                                  id: field.id,
                                  label: `${band.code} · ${t(`level.${field.level}`)}`,
                                })
                              }
                            >
                              {t('me.addEvidence')}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                <div className="act-col">
                  <button
                    className="btn-icon"
                    title={t('fe.moveUp')}
                    disabled={i === 0}
                    onClick={() => {
                      void moveBand(i, -1);
                    }}
                  >
                    ▲
                  </button>
                  <button
                    className="btn-icon"
                    title={t('fe.moveDown')}
                    disabled={i === bands.length - 1}
                    onClick={() => {
                      void moveBand(i, 1);
                    }}
                  >
                    ▼
                  </button>
                  <button
                    className="btn-icon"
                    title={t('me.editBand')}
                    onClick={() => startEditBand(band)}
                  >
                    ✎
                  </button>
                  <button
                    className="btn-icon"
                    title={t('me.deleteBand')}
                    onClick={() => {
                      void handleDeleteBand(band.id);
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Band bearbeiten (FA-03) */}
      {editBand && (
        <div className="panel">
          <div className="panel-head">
            <h2>
              {t('me.editBand')} · {editBand.code}
            </h2>
          </div>
          <form
            className="form"
            onSubmit={(e) => {
              void saveEditBand(e);
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ width: 130 }}>
                {t('me.code')}
                <input
                  value={editBand.code}
                  onChange={(e) => setEditBand((d) => d && { ...d, code: e.target.value })}
                />
              </label>
              <label style={{ flex: 1 }}>
                {t('me.descDe')}
                <input
                  value={editBand.description}
                  onChange={(e) => setEditBand((d) => d && { ...d, description: e.target.value })}
                />
              </label>
            </div>
            <fieldset className="goal-picker">
              <legend>{t('me.refGoals')}</legend>
              {goals.map((g) => (
                <label key={g.id} className="goal-check">
                  <input
                    type="checkbox"
                    checked={editBand.goalIds.includes(g.id)}
                    onChange={() =>
                      setEditBand(
                        (d) =>
                          d && {
                            ...d,
                            goalIds: d.goalIds.includes(g.id)
                              ? d.goalIds.filter((x) => x !== g.id)
                              : [...d.goalIds, g.id],
                          },
                      )
                    }
                  />
                  <span className="hz-code">{g.code}</span> {g.text?.de ?? ''}
                </label>
              ))}
            </fieldset>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setEditBand(null)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn primary">
                {t('common.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Nachweise je Kompetenzfeld (Modal) */}
      {evidenceField && (
        <FieldEvidenceModal
          moduleId={id}
          fieldId={evidenceField.id}
          fieldLabel={evidenceField.label}
          onClose={() => setEvidenceField(null)}
          onChanged={() => {
            void load();
          }}
        />
      )}
    </AppShell>
  );
}
