'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import TrashIcon from '../../../components/TrashIcon';
import {
  classes,
  modules,
  type ClassSummary,
  type ClassDetail,
  type Member,
  type ModuleSummary,
} from '../../../lib/api';

export default function KlassenPage() {
  const [list, setList] = useState<ClassSummary[] | null>(null);
  const [mods, setMods] = useState<ModuleSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', moduleId: '' });

  const loadList = useCallback(async () => {
    try {
      const [cs, ms] = await Promise.all([classes.list(), modules.list()]);
      setList(cs);
      setMods(ms);
    } catch (e: unknown) {
      setError(String(e));
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const [d, m] = await Promise.all([classes.get(id), classes.members(id)]);
      setDetail(d);
      setMembers(m);
    } catch (e: unknown) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    setError(err.body?.title ?? String(e));
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
    if (!confirm(`Klasse "${name}" wirklich löschen?`)) return;
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
    if (!confirm('Mitglied aus der Klasse entfernen?')) return;
    try {
      await classes.removeMember(detail.id, userId);
      await Promise.all([loadDetail(detail.id), loadList()]);
    } catch (e: unknown) {
      showError(e);
    }
  }

  return (
    <AppShell>
      <div className="breadcrumb">Übersicht / Klassen</div>
      <div className="page-head">
        <div>
          <h1>Klassen</h1>
          <p>Lernende verwalten · Module zuweisen · Beitrittscode</p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + Neue Klasse
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {creating && (
        <div className="panel">
          <div className="panel-head">
            <h2>Neue Klasse</h2>
          </div>
          <form
            className="form"
            onSubmit={(e) => {
              void handleCreate(e);
            }}
          >
            <label>
              Klassenname *
              <input
                required
                placeholder="z. B. INF-1a"
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
        <div className="loading">Lade Klassen…</div>
      ) : list.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">◫</span>
            <p>Noch keine Klassen. Erstelle deine erste Klasse.</p>
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
            <h2>{detail.name}</h2>
            <button
              className="btn danger sm"
              onClick={() => {
                void handleDeleteClass(detail.id, detail.name);
              }}
            >
              <TrashIcon /> Klasse löschen
            </button>
          </div>

          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Modulzuordnung */}
            <div>
              <div className="field-label">Modul / Matrix</div>
              <select
                className="inline-select"
                value={detail.module?.id ?? ''}
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

            {/* Beitrittscode */}
            <div>
              <div className="field-label">Beitrittscode</div>
              <div className="joincode-row">
                {detail.activeJoinCode ? (
                  <span className="joincode">{detail.activeJoinCode.code}</span>
                ) : (
                  <span className="kh-muted">Noch kein Code generiert.</span>
                )}
                <button
                  className="btn sm"
                  onClick={() => {
                    void handleGenerateCode();
                  }}
                >
                  {detail.activeJoinCode ? 'Code erneuern' : 'Code generieren'}
                </button>
              </div>
              <p className="kh-muted" style={{ fontSize: 12, marginTop: 6 }}>
                Lernende treten unter „Klasse beitreten" mit diesem Code bei. Erneuern macht den
                alten Code ungültig.
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
