'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '../../components/AppShell';
import TrashIcon from '../../components/TrashIcon';
import { useToast } from '../../components/ToastProvider';
import { useI18n } from '../../lib/i18n';
import { modules, importMatrixZip, type ModuleSummary } from '../../lib/api';

export default function ModulesPage() {
  const toast = useToast();
  const { t } = useI18n();
  const statusLabel = (s: string) => t(`modstatus.${s}`);
  const [list, setList] = useState<ModuleSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
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

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const res = await importMatrixZip(file);
      await load();
      toast.success(`Modul importiert als „${res.number}".`);
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? 'Import fehlgeschlagen.');
    } finally {
      setImporting(false);
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
      <div className="breadcrumb">
        {t('common.overview')} / {t('mod.title')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('mod.title')}</h1>
          <p>{t('mod.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="btn" style={{ cursor: 'pointer' }}>
            {importing ? t('mod.importing') : t('mod.import')}
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
            {t('mod.new')}
          </button>
        </div>
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
              {t('mod.fNumber')}
              <input
                required
                placeholder="z. B. 293"
                value={form.number}
                onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
              />
            </label>
            <label>
              {t('mod.fTitle')}
              <input
                required
                placeholder="z. B. ICT-Geräte in Betrieb nehmen"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label>
              {t('mod.fDesc')}
              <input
                placeholder={t('common.optional')}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
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
        <div className="loading">{t('mod.loading')}</div>
      ) : (
        <>
          <div className="panel">
            {list.length === 0 ? (
              <div className="empty">
                <span className="ic">▤</span>
                <p>{t('mod.empty')}</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('common.module')}</th>
                    <th>{t('mod.colBands')}</th>
                    <th>{t('mod.colGoals')}</th>
                    <th>{t('common.status')}</th>
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
                            {t('common.edit')}
                          </Link>
                          <button
                            className="btn-icon"
                            title={t('common.delete')}
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
              <div className="k">{t('mod.cardModules')}</div>
              <div className="v">{list.length}</div>
            </div>
            <div className="card">
              <div className="k">{t('mod.cardBands')}</div>
              <div className="v">
                {list.reduce((s, m) => s + (m.matrix?._count?.bands ?? 0), 0)}
              </div>
            </div>
            <div className="card">
              <div className="k">{t('mod.cardDrafts')}</div>
              <div className="v">{list.filter((m) => m.status === 'DRAFT').length}</div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
