'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppShell from '../../../../components/AppShell';
import TrashIcon from '../../../../components/TrashIcon';
import { useToast } from '../../../../components/ToastProvider';
import { useI18n } from '../../../../lib/i18n';
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
  const { t } = useI18n();
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
        toast.error(t('pe.loadFailed'));
      }
    },
    [toast, t],
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
      toast.error(t('pe.nameRequired'));
      return;
    }
    if (selected.length === 0) {
      toast.error(t('pe.selectFieldRequired'));
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await learningPaths.update(editId, { name: name.trim(), fieldIds: selected });
        toast.success(t('pe.saved'));
      } else {
        await learningPaths.create(matrixId, { name: name.trim(), fieldIds: selected });
        toast.success(t('pe.created'));
      }
      resetForm();
      await loadPaths(matrixId);
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? t('pe.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function setActive(p: LearningPath, active: boolean) {
    if (!matrixId) return;
    try {
      await learningPaths.update(p.id, { isActive: active });
      await loadPaths(matrixId);
      toast.success(active ? t('pe.activated') : t('pe.deactivated'));
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? t('pe.saveFailed'));
    }
  }

  async function remove(p: LearningPath) {
    if (!matrixId) return;
    if (!confirm(t('pe.confirmDelete'))) return;
    try {
      await learningPaths.remove(p.id);
      await loadPaths(matrixId);
      toast.success(t('pe.deleted'));
    } catch {
      toast.error(t('pe.deleteFailed'));
    }
  }

  const showEditor = creating || editId !== null;

  return (
    <AppShell>
      <div className="breadcrumb">
        <Link href="/modules">{t('me.modules')}</Link> /{' '}
        <Link href={`/modules/${moduleId}`}>{t('me.module')}</Link> / {t('pe.title')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('pe.title')}</h1>
          <p>{t('pe.subtitle')}</p>
        </div>
        {!showEditor && (
          <button className="btn primary" onClick={startCreate} disabled={!matrixId}>
            {t('pe.new')}
          </button>
        )}
      </div>

      {!data ? (
        <div className="loading">{t('common.loading')}</div>
      ) : fields.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">▦</span>
            <p>
              {t('pe.noFieldsPre')}
              <Link href={`/modules/${moduleId}`}>{t('pe.matrixLink')}</Link>
              {t('pe.noFieldsPost')}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Editor */}
          {showEditor && (
            <div className="panel">
              <div className="panel-head">
                <h2>{editId ? t('pe.editPath') : t('pe.newPath')}</h2>
              </div>
              <div className="form">
                <label>
                  {t('pe.name')}
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('pe.namePlaceholder')}
                  />
                </label>

                <div className="grid2">
                  {/* Verfügbare Felder */}
                  <div>
                    <div className="field-label">{t('pe.available')}</div>
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
                              {used ? t('pe.added') : t('pe.add')}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Gewählte Reihenfolge */}
                  <div>
                    <div className="field-label">{t('pe.order')}</div>
                    {selected.length === 0 ? (
                      <p className="kh-muted" style={{ fontSize: 13 }}>
                        {t('pe.noneSelected')}
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
                                title={t('fe.moveUp')}
                                disabled={i === 0}
                                onClick={() => move(i, -1)}
                              >
                                ▲
                              </button>
                              <button
                                className="btn-icon"
                                title={t('fe.moveDown')}
                                disabled={i === selected.length - 1}
                                onClick={() => move(i, 1)}
                              >
                                ▼
                              </button>
                              <button
                                className="btn-icon"
                                title={t('pe.remove')}
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
                    {t('common.cancel')}
                  </button>
                  <button className="btn primary" disabled={saving} onClick={() => void save()}>
                    {saving ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Liste der Pfade */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('pe.existing')}</h2>
            </div>
            {!paths ? (
              <div className="loading">{t('common.loading')}</div>
            ) : paths.length === 0 ? (
              <div className="empty">
                <p>{t('pe.empty')}</p>
              </div>
            ) : (
              <ul className="hz-list">
                {paths.map((p) => (
                  <li key={p.id} className="hz-item">
                    <div style={{ flex: 1 }}>
                      <strong>{p.name}</strong>
                      <div className="kh-muted" style={{ fontSize: 12 }}>
                        {p.steps.length} {t('pe.steps')}: {p.steps.map((s) => s.code).join(' → ')}
                      </div>
                    </div>
                    {p.isActive ? (
                      <span className="badge b-published">{t('pe.active')}</span>
                    ) : (
                      <button className="btn sm" onClick={() => void setActive(p, true)}>
                        {t('pe.setActive')}
                      </button>
                    )}
                    <button className="btn sm" onClick={() => startEdit(p)}>
                      {t('common.edit')}
                    </button>
                    <button
                      className="btn-icon"
                      title={t('common.delete')}
                      onClick={() => void remove(p)}
                    >
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
