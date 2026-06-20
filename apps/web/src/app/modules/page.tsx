'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { modules, devLogin, type ModuleSummary } from '../../lib/api';

export default function ModulesPage() {
  const [list, setList] = useState<ModuleSummary[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ number: '', title: '', description: '' });

  async function load() {
    try {
      setList(await modules.list());
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err.status === 401) {
        // Dev-Login für lokale Entwicklung
        await devLogin('dev.lehrperson@example.com', 'TEACHER');
        setList(await modules.list());
      } else {
        setError(String(e));
      }
    }
  }

  useEffect(() => { void load(); }, []);

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
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      setError(err.body?.title ?? String(e));
    }
  }

  async function handleDelete(id: string, number: string) {
    if (!confirm(`Modul ${number} wirklich löschen?`)) return;
    try {
      await modules.remove(id);
      await load();
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      setError(err.body?.title ?? String(e));
    }
  }

  if (error) return <div className="kh-error">{error}</div>;
  if (!list) return <div className="kh-loading">Lade Module…</div>;

  return (
    <div className="kh-page">
      <div className="kh-page-head">
        <div>
          <h1>Module & Matrizen</h1>
          <p className="kh-muted">Kompetenzraster verwalten</p>
        </div>
        <button className="kh-btn kh-btn-primary" onClick={() => setCreating(true)}>
          + Neues Modul
        </button>
      </div>

      {creating && (
        <form className="kh-panel kh-form" onSubmit={(e) => { void handleCreate(e); }}>
          <h2>Neues Modul</h2>
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
          <div className="kh-form-actions">
            <button type="button" className="kh-btn" onClick={() => setCreating(false)}>
              Abbrechen
            </button>
            <button type="submit" className="kh-btn kh-btn-primary">
              Erstellen
            </button>
          </div>
        </form>
      )}

      <div className="kh-panel">
        {list.length === 0 ? (
          <p className="kh-muted kh-empty">Noch keine Module. Erstelle dein erstes Modul.</p>
        ) : (
          <table className="kh-table">
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
                    <div className="kh-mod-num">{m.number}</div>
                    <div className="kh-muted">{m.title?.de ?? '—'}</div>
                  </td>
                  <td>{m.matrix?._count?.bands ?? 0}</td>
                  <td>{m._count?.actionGoals ?? 0}</td>
                  <td>
                    <span className={`kh-badge kh-badge-${m.status.toLowerCase()}`}>
                      {m.status === 'DRAFT' ? 'Entwurf' : m.status === 'PUBLISHED' ? 'Veröffentlicht' : 'Archiviert'}
                    </span>
                  </td>
                  <td className="kh-actions">
                    <Link href={`/modules/${m.id}`} className="kh-btn">
                      Bearbeiten
                    </Link>
                    <button
                      className="kh-btn kh-btn-danger"
                      onClick={() => { void handleDelete(m.id, m.number); }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="kh-stats">
        <div className="kh-stat">
          <div className="kh-stat-v">{list.length}</div>
          <div className="kh-stat-l">Module</div>
        </div>
        <div className="kh-stat">
          <div className="kh-stat-v">
            {list.reduce((s, m) => s + (m.matrix?._count?.bands ?? 0), 0)}
          </div>
          <div className="kh-stat-l">Bänder gesamt</div>
        </div>
        <div className="kh-stat">
          <div className="kh-stat-v">{list.filter((m) => m.status === 'DRAFT').length}</div>
          <div className="kh-stat-l">Entwürfe</div>
        </div>
      </div>
    </div>
  );
}
