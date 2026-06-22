'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import TrashIcon from '../../../components/TrashIcon';
import { useToast } from '../../../components/ToastProvider';
import {
  classes,
  modules,
  exportClassArchiveZip,
  importClassArchiveZip,
  type ClassSummary,
  type ClassDetail,
  type Member,
  type ModuleSummary,
} from '../../../lib/api';

export default function KlassenPage() {
  const toast = useToast();
  const [list, setList] = useState<ClassSummary[] | null>(null);
  const [mods, setMods] = useState<ModuleSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

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
        const [d, m] = await Promise.all([classes.get(id), classes.members(id)]);
        setDetail(d);
        setMembers(m);
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

  return (
    <AppShell>
      <div className="breadcrumb">Übersicht / Modulanlässe</div>
      <div className="page-head">
        <div>
          <h1>Modulanlässe</h1>
          <p>Lernende verwalten · Modul zuweisen · Beitrittscode · Archiv</p>
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
              Aktiv
            </button>
            <button
              aria-pressed={showArchived}
              onClick={() => {
                setSelectedId(null);
                setDetail(null);
                setShowArchived(true);
              }}
            >
              Archiv
            </button>
          </div>
          <label className="btn" style={{ cursor: 'pointer' }}>
            {importing ? 'Importiere…' : '⬆ Archiv importieren'}
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
            + Neuer Modulanlass
          </button>
        </div>
      </div>

      {creating && (
        <div className="panel">
          <div className="panel-head">
            <h2>Neuer Modulanlass</h2>
          </div>
          <form
            className="form"
            onSubmit={(e) => {
              void handleCreate(e);
            }}
          >
            <label>
              Bezeichnung *
              <input
                required
                placeholder="z. B. INF-1a · Modul 293 (HS25)"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label>
              Modul / Matrix zuordnen
              <select
                value={form.moduleId}
                onChange={(e) => setForm((f) => ({ ...f, moduleId: e.target.value }))}
              >
                <option value="">— kein Modul —</option>
                {mods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.number} · {m.title?.de ?? ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setCreating(false)}>
                Abbrechen
              </button>
              <button type="submit" className="btn primary">
                Erstellen
              </button>
            </div>
          </form>
        </div>
      )}

      {!list ? (
        <div className="loading">Lade Modulanlässe…</div>
      ) : list.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">◫</span>
            <p>Noch keine Modulanlässe. Erstelle deinen ersten Modulanlass.</p>
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
                <span className={`badge b-${c.status === 'ACTIVE' ? 'published' : 'archived'}`}>
                  {c.status === 'ACTIVE' ? 'aktiv' : 'archiviert'}
                </span>
              </div>
              <div className="kh-muted" style={{ fontSize: 13 }}>
                {c._count?.enrollments ?? 0} Lernende
                {c.module ? ` · Modul ${c.module.number}` : ' · kein Modul'}
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
                  archiviert · read-only
                </span>
              )}
            </h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={() => void handleExport(detail.id)}>
                ⬇ Exportieren
              </button>
              {detail.status === 'ACTIVE' ? (
                <button className="btn sm" onClick={() => void handleArchive(detail.id)}>
                  Archivieren
                </button>
              ) : (
                <button className="btn sm" onClick={() => void handleRestore(detail.id)}>
                  Wiederherstellen
                </button>
              )}
              <button
                className="btn danger sm"
                onClick={() => {
                  void handleDeleteClass(detail.id, detail.name);
                }}
              >
                <TrashIcon /> Löschen
              </button>
            </div>
          </div>

          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Modulzuordnung */}
            <div>
              <div className="field-label">Modul / Matrix</div>
              <select
                className="inline-select"
                value={detail.module?.id ?? ''}
                disabled={detail.status !== 'ACTIVE'}
                onChange={(e) => {
                  void handleAssignModule(e.target.value);
                }}
              >
                <option value="">— kein Modul —</option>
                {mods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.number} · {m.title?.de ?? ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Beitrittscode + Beitrittslink */}
            <div>
              <div className="field-label">Beitrittscode</div>
              <div className="joincode-row">
                {detail.activeJoinCode ? (
                  <>
                    <span className="joincode">{detail.activeJoinCode.code}</span>
                    <button
                      className="btn sm"
                      onClick={() => {
                        void copy(detail.activeJoinCode!.code, 'Code');
                      }}
                    >
                      Code kopieren
                    </button>
                  </>
                ) : (
                  <span className="kh-muted">Noch kein Code generiert.</span>
                )}
                {detail.status === 'ACTIVE' && (
                  <button
                    className="btn sm"
                    onClick={() => {
                      void handleGenerateCode();
                    }}
                  >
                    {detail.activeJoinCode ? 'Code erneuern' : 'Code generieren'}
                  </button>
                )}
              </div>

              {detail.activeJoinCode && (
                <div style={{ marginTop: 10 }}>
                  <div className="field-label">Beitrittslink</div>
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
                        void copy(joinLink(detail.activeJoinCode!.code), 'Link');
                      }}
                    >
                      Link kopieren
                    </button>
                  </div>
                </div>
              )}

              <p className="kh-muted" style={{ fontSize: 12, marginTop: 6 }}>
                Lernende treten mit dem Code unter „Modulanlass beitreten" bei – oder direkt über
                den Link. Erneuern macht den alten Code/Link ungültig.
              </p>
            </div>
          </div>

          {/* Mitglieder */}
          <div className="panel-head" style={{ borderTop: '1px solid var(--border)' }}>
            <h2>Lernende ({members.length})</h2>
          </div>
          {members.length === 0 ? (
            <div className="empty">
              <p>Noch keine Lernenden. Teile den Beitrittscode.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Lernende:r</th>
                  <th>E-Mail</th>
                  <th>Beigetreten</th>
                  <th>Status</th>
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
                    <td className="kh-muted">{new Date(m.joinedAt).toLocaleDateString('de-CH')}</td>
                    <td>
                      <span className="badge b-published">
                        {m.status === 'ACTIVE' ? 'aktiv' : m.status.toLowerCase()}
                      </span>
                    </td>
                    <td>
                      {detail.status === 'ACTIVE' && (
                        <div className="row-actions">
                          <button
                            className="btn-icon"
                            title="Entfernen"
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
