'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import TrashIcon from '../../../components/TrashIcon';
import { useToast } from '../../../components/ToastProvider';
import { useI18n, localized } from '../../../lib/i18n';
import {
  classes,
  modules,
  exportClassArchiveZip,
  importClassArchiveZip,
  type ClassSummary,
  type ClassDetail,
  type Member,
  type CoTeacher,
  type ModuleSummary,
} from '../../../lib/api';

export default function KlassenPage() {
  const toast = useToast();
  const { t, locale } = useI18n();
  const [list, setList] = useState<ClassSummary[] | null>(null);
  const [mods, setMods] = useState<ModuleSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [coTeachers, setCoTeachers] = useState<CoTeacher[]>([]);
  const [coEmail, setCoEmail] = useState('');

  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({ name: '', moduleId: '' });

  const loadList = useCallback(async () => {
    try {
      const [cs, ms] = await Promise.all([classes.list(showArchived), modules.list()]);
      setList(cs);
      setMods(ms);
    } catch {
      toast.error('Modulanlässe konnten nicht geladen werden.');
    }
  }, [toast, showArchived]);

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        const [d, m, co] = await Promise.all([
          classes.get(id),
          classes.members(id),
          classes.coTeachers(id),
        ]);
        setDetail(d);
        setMembers(m);
        setCoTeachers(co);
      } catch {
        toast.error('Details konnten nicht geladen werden.');
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    toast.error(err.body?.title ?? 'Aktion fehlgeschlagen.');
  }

  function joinLink(code: string): string {
    if (typeof window === 'undefined') return code;
    return `${window.location.origin}/lernende?code=${code}`;
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} kopiert.`);
    } catch {
      toast.info(text);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const created = await classes.create({
        name: form.name.trim(),
        moduleId: form.moduleId || undefined,
      });
      setCreating(false);
      setForm({ name: '', moduleId: '' });
      await loadList();
      setSelectedId(created.id);
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleDeleteClass(id: string, name: string) {
    if (!confirm(`Modulanlass "${name}" wirklich löschen?`)) return;
    try {
      await classes.remove(id);
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      await loadList();
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleGenerateCode() {
    if (!detail) return;
    try {
      await classes.generateJoinCode(detail.id);
      await loadDetail(detail.id);
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleAssignModule(moduleId: string) {
    if (!detail) return;
    try {
      await classes.update(detail.id, { moduleId: moduleId || null });
      await Promise.all([loadDetail(detail.id), loadList()]);
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleRemoveMember(userId: string | null) {
    if (!detail || !userId) return;
    if (!confirm('Mitglied aus dem Modulanlass entfernen?')) return;
    try {
      await classes.removeMember(detail.id, userId);
      await Promise.all([loadDetail(detail.id), loadList()]);
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleAddCoTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !coEmail.trim()) return;
    try {
      await classes.addCoTeacher(detail.id, coEmail.trim());
      setCoEmail('');
      setCoTeachers(await classes.coTeachers(detail.id));
      toast.success(t('co.added'));
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleRemoveCoTeacher(userId: string) {
    if (!detail) return;
    if (!confirm(t('co.confirmRemove'))) return;
    try {
      await classes.removeCoTeacher(detail.id, userId);
      setCoTeachers(await classes.coTeachers(detail.id));
      toast.success(t('co.removed'));
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleArchive(id: string) {
    try {
      await classes.archive(id);
      setSelectedId(null);
      setDetail(null);
      await loadList();
      toast.success('Modulanlass archiviert.');
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleRestore(id: string) {
    try {
      await classes.restore(id);
      setSelectedId(null);
      setDetail(null);
      await loadList();
      toast.success('Modulanlass wiederhergestellt.');
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleExport(id: string) {
    try {
      const { blob, filename } = await exportClassArchiveZip(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Modulanlass exportiert (ZIP).');
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const res = await importClassArchiveZip(file);
      setShowArchived(true);
      await loadList();
      toast.success(`Archiv importiert als „${res.name}" (archiviert, read-only).`);
    } catch (e: unknown) {
      showError(e);
    } finally {
      setImporting(false);
    }
  }

  // Ist die aktuelle Lehrperson nur Co-Leitung des ausgewählten Modulanlasses?
  const detailIsCoLeader = !!list?.find((c) => c.id === detail?.id)?.isCoLeader;

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('common.overview')} / {t('cl.title')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('cl.title')}</h1>
          <p>{t('cl.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="seg" role="group" aria-label="Ansicht">
            <button
              aria-pressed={!showArchived}
              onClick={() => {
                setSelectedId(null);
                setDetail(null);
                setShowArchived(false);
              }}
            >
              {t('cl.viewActive')}
            </button>
            <button
              aria-pressed={showArchived}
              onClick={() => {
                setSelectedId(null);
                setDetail(null);
                setShowArchived(true);
              }}
            >
              {t('cl.viewArchive')}
            </button>
          </div>
          <label className="btn" style={{ cursor: 'pointer' }}>
            {importing ? t('mod.importing') : t('cl.importArchive')}
            <input
              type="file"
              accept="application/zip,.zip"
              style={{ display: 'none' }}
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImport(f);
                e.target.value = '';
              }}
            />
          </label>
          <button className="btn primary" onClick={() => setCreating(true)}>
            {t('cl.new')}
          </button>
        </div>
      </div>

      {creating && (
        <div className="panel">
          <div className="panel-head">
            <h2>{t('cl.newTitle')}</h2>
          </div>
          <form
            className="form"
            onSubmit={(e) => {
              void handleCreate(e);
            }}
          >
            <label>
              {t('cl.fName')}
              <input
                required
                placeholder="z. B. INF-1a · Modul 293 (HS25)"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label>
              {t('cl.assignModule')}
              <select
                value={form.moduleId}
                onChange={(e) => setForm((f) => ({ ...f, moduleId: e.target.value }))}
              >
                <option value="">— {t('common.noModule')} —</option>
                {mods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.number} · {localized(m.title, locale)}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setCreating(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn primary">
                {t('common.create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {!list ? (
        <div className="loading">{t('cl.loading')}</div>
      ) : list.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">◫</span>
            <p>{t('cl.empty')}</p>
          </div>
        </div>
      ) : (
        <div className="classgrid">
          {list.map((c) => (
            <button
              key={c.id}
              className={`classcard ${selectedId === c.id ? 'active' : ''}`}
              onClick={() => setSelectedId(c.id)}
            >
              <div className="classcard-head">
                <strong>{c.name}</strong>
                <span style={{ display: 'flex', gap: 4 }}>
                  {c.isCoLeader && <span className="badge b-draft">{t('co.badge')}</span>}
                  <span className={`badge b-${c.status === 'ACTIVE' ? 'published' : 'archived'}`}>
                    {c.status === 'ACTIVE' ? t('cl.active') : t('cl.archived')}
                  </span>
                </span>
              </div>
              <div className="kh-muted" style={{ fontSize: 13 }}>
                {c._count?.enrollments ?? 0} {t('cl.learnersCount')}
                {c.module
                  ? ` · ${t('common.module')} ${c.module.number}`
                  : ` · ${t('common.noModule')}`}
              </div>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <div className="panel">
          <div className="panel-head">
            <h2>
              {detail.name}{' '}
              {detail.status !== 'ACTIVE' && (
                <span className="badge b-archived" style={{ marginLeft: 6 }}>
                  {t('cl.readonly')}
                </span>
              )}
            </h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={() => void handleExport(detail.id)}>
                {t('cl.export')}
              </button>
              {detail.status === 'ACTIVE' ? (
                <button className="btn sm" onClick={() => void handleArchive(detail.id)}>
                  {t('cl.archive')}
                </button>
              ) : (
                <button className="btn sm" onClick={() => void handleRestore(detail.id)}>
                  {t('cl.restore')}
                </button>
              )}
              {!detailIsCoLeader && (
                <button
                  className="btn danger sm"
                  onClick={() => {
                    void handleDeleteClass(detail.id, detail.name);
                  }}
                >
                  <TrashIcon /> {t('common.delete')}
                </button>
              )}
            </div>
          </div>

          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Modulzuordnung */}
            <div>
              <div className="field-label">{t('cl.moduleMatrix')}</div>
              <select
                className="inline-select"
                value={detail.module?.id ?? ''}
                disabled={detail.status !== 'ACTIVE'}
                onChange={(e) => {
                  void handleAssignModule(e.target.value);
                }}
              >
                <option value="">— {t('common.noModule')} —</option>
                {mods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.number} · {localized(m.title, locale)}
                  </option>
                ))}
              </select>
            </div>

            {/* Beitrittscode + Beitrittslink */}
            <div>
              <div className="field-label">{t('cl.joinCode')}</div>
              <div className="joincode-row">
                {detail.activeJoinCode ? (
                  <>
                    <span className="joincode">{detail.activeJoinCode.code}</span>
                    <button
                      className="btn sm"
                      onClick={() => {
                        void copy(detail.activeJoinCode!.code, t('cl.joinCode'));
                      }}
                    >
                      {t('cl.copyCode')}
                    </button>
                  </>
                ) : (
                  <span className="kh-muted">{t('cl.noCode')}</span>
                )}
                {detail.status === 'ACTIVE' && (
                  <button
                    className="btn sm"
                    onClick={() => {
                      void handleGenerateCode();
                    }}
                  >
                    {detail.activeJoinCode ? t('cl.renewCode') : t('cl.genCode')}
                  </button>
                )}
              </div>

              {detail.activeJoinCode && (
                <div style={{ marginTop: 10 }}>
                  <div className="field-label">{t('cl.joinLink')}</div>
                  <div className="joincode-row">
                    <input
                      className="link-input"
                      readOnly
                      value={joinLink(detail.activeJoinCode.code)}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button
                      className="btn sm"
                      onClick={() => {
                        void copy(joinLink(detail.activeJoinCode!.code), t('cl.joinLink'));
                      }}
                    >
                      {t('cl.copyLink')}
                    </button>
                  </div>
                </div>
              )}

              <p className="kh-muted" style={{ fontSize: 12, marginTop: 6 }}>
                {t('cl.codeHint')}
              </p>
            </div>
          </div>

          {/* Mitglieder */}
          <div className="panel-head" style={{ borderTop: '1px solid var(--border)' }}>
            <h2>
              {t('cl.members')} ({members.length})
            </h2>
          </div>
          {members.length === 0 ? (
            <div className="empty">
              <p>{t('cl.noMembers')}</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('bw.colLearner')}</th>
                  <th>{t('cl.colEmail')}</th>
                  <th>{t('cl.colJoined')}</th>
                  <th>{t('common.status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="member-cell">
                        <span className="avatar sm">{initials(m.displayName)}</span> {m.displayName}
                      </div>
                    </td>
                    <td className="kh-muted">{m.user?.email ?? '—'}</td>
                    <td className="kh-muted">{new Date(m.joinedAt).toLocaleDateString()}</td>
                    <td>
                      <span className="badge b-published">
                        {m.status === 'ACTIVE' ? t('cl.active') : m.status.toLowerCase()}
                      </span>
                    </td>
                    <td>
                      {detail.status === 'ACTIVE' && (
                        <div className="row-actions">
                          <button
                            className="btn-icon"
                            title={t('common.delete')}
                            onClick={() => {
                              void handleRemoveMember(m.userId);
                            }}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Co-Leitung (Co-Teaching) */}
          <div className="panel-head" style={{ borderTop: '1px solid var(--border)' }}>
            <h2>
              {t('co.title')} ({coTeachers.length})
            </h2>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="kh-muted" style={{ margin: 0, fontSize: 13 }}>
              {t('co.hint')}
            </p>

            {coTeachers.length > 0 && (
              <table className="table">
                <tbody>
                  {coTeachers.map((co) => (
                    <tr key={co.userId}>
                      <td>
                        <div className="member-cell">
                          <span className="avatar sm">{initials(co.displayName)}</span>{' '}
                          {co.displayName}
                        </div>
                      </td>
                      <td className="kh-muted">{co.email}</td>
                      <td>
                        {!detailIsCoLeader && (
                          <div className="row-actions">
                            <button
                              className="btn-icon"
                              title={t('co.remove')}
                              onClick={() => {
                                void handleRemoveCoTeacher(co.userId);
                              }}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!detailIsCoLeader ? (
              <form
                className="joincode-row"
                onSubmit={(e) => {
                  void handleAddCoTeacher(e);
                }}
              >
                <input
                  className="link-input"
                  type="email"
                  placeholder={t('co.emailPlaceholder')}
                  aria-label={t('co.title')}
                  value={coEmail}
                  onChange={(e) => setCoEmail(e.target.value)}
                  style={{ flex: 1, minWidth: 220 }}
                />
                <button type="submit" className="btn primary sm">
                  {t('co.add')}
                </button>
              </form>
            ) : (
              coTeachers.length === 0 && (
                <p className="kh-muted" style={{ margin: 0, fontSize: 13 }}>
                  {t('co.none')}
                </p>
              )
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
