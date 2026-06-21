'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '../../components/AppShell';
import TrashIcon from '../../components/TrashIcon';
import { useToast } from '../../components/ToastProvider';
import { modules, type ModuleSummary } from '../../lib/api';

function statusLabel(s: string): string {
  return s === 'DRAFT' ? 'Entwurf' : s === 'PUBLISHED' ? 'Veröffentlicht' : 'Archiviert';
}

export default function ModulesPage() {
  const toast = useToast();
  const [list, setList] = useState<ModuleSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ number: '', title: '', description: '' });

  async function load() {
    try {
      setList(await modules.list());
    } catch {
      toast.error('Module konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.number || !form.title) return;
    try {
      await modules.create({
        number: form.number.trim(),
        title: { de: form.title.trim() },
        description: form.description ? { de: form.description.trim() } : undefined,
      });
      setCreating(false);
      setForm({ number: '', title: '', description: '' });
      await load();
      toast.success(`Modul ${form.number.trim()} erstellt.`);
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? 'Modul konnte nicht erstellt werden.');
    }
  }

  async function handleDelete(id: string, number: string) {
    if (!confirm(`Modul ${number} wirklich löschen?`)) return;
    try {
      await modules.remove(id);
      await load();
      toast.success(`Modul ${number} gelöscht.`);
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? 'Löschen fehlgeschlagen.');
    }
  }

  return (
    <AppShell>
      <div className="breadcrumb">Übersicht / Module &amp; Matrizen</div>
      <div className="page-head">
        <div>
          <h1>Module &amp; Matrizen</h1>
          <p>Kompetenzraster verwalten</p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + Neues Modul
        </button>
      </div>

      {creating && (
        <div className="panel">
          <form
            className="form"
            onSubmit={(e) => {
              void handleCreate(e);
            }}
          >
            <label>
              Modulnummer *
              <input
                required
                placeholder="z. B. 293"
                value={form.number}
                onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
              />
            </label>
            <label>
              Titel (DE) *
              <input
                required
                placeholder="z. B. ICT-Geräte in Betrieb nehmen"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label>
              Beschreibung (DE)
              <input
                placeholder="optional"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
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
        <div className="loading">Lade Module…</div>
      ) : (
        <>
          <div className="panel">
            {list.length === 0 ? (
              <div className="empty">
                <span className="ic">▤</span>
                <p>Noch keine Module. Erstelle dein erstes Modul.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Modul</th>
                    <th>Bänder</th>
                    <th>Handlungsziele</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="mod">{m.number}</div>
                        <div style={{ color: 'var(--fg-muted)' }}>{m.title?.de ?? '—'}</div>
                      </td>
                      <td>{m.matrix?._count?.bands ?? 0}</td>
                      <td>{m._count?.actionGoals ?? 0}</td>
                      <td>
                        <span className={`badge b-${m.status.toLowerCase()}`}>
                          {statusLabel(m.status)}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link href={`/modules/${m.id}`} className="btn sm">
                            Bearbeiten
                          </Link>
                          <button
                            className="btn-icon"
                            title="Löschen"
                            onClick={() => {
                              void handleDelete(m.id, m.number);
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

          <div className="cards">
            <div className="card">
              <div className="k">Module</div>
              <div className="v">{list.length}</div>
            </div>
            <div className="card">
              <div className="k">Bänder gesamt</div>
              <div className="v">
                {list.reduce((s, m) => s + (m.matrix?._count?.bands ?? 0), 0)}
              </div>
            </div>
            <div className="card">
              <div className="k">Entwürfe</div>
              <div className="v">{list.filter((m) => m.status === 'DRAFT').length}</div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
