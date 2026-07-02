'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { useToast } from '../../../components/ToastProvider';
import { useI18n } from '../../../lib/i18n';
import { getUser, isAdmin, homePathForRole } from '../../../lib/session';
import {
  admin,
  exportBackupZip,
  storage,
  type AdminOps,
  type TenantStorage,
} from '../../../lib/api';

function formatBytes(n: number | null): string {
  if (n == null) return '–';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

const GB = 1024 ** 3;

/** Bytes → GB-Eingabewert (leer bei „unbegrenzt"). */
function bytesToGbInput(n: number | null): string {
  if (n == null) return '';
  return String(Number((n / GB).toFixed(2)));
}

/** Schmaler Fortschrittsbalken Verbrauch/Quota. Ohne Quota: neutraler Hinweis. */
function QuotaBar({ used, quota }: { used: number; quota: number | null }) {
  if (quota == null) return null;
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 100;
  const over = used > quota;
  return (
    <div
      style={{ height: 6, background: 'var(--kh-border, #e5e7eb)', borderRadius: 4, marginTop: 4 }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 4,
          background: over ? '#dc2626' : pct >= 85 ? '#f59e0b' : '#2563eb',
        }}
      />
    </div>
  );
}

export default function AdminOpsPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [ops, setOps] = useState<AdminOps | null>(null);
  const [store, setStore] = useState<TenantStorage | null>(null);
  const [quotaDraft, setQuotaDraft] = useState<Record<string, string>>({});
  const [savingQuota, setSavingQuota] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [gcRunning, setGcRunning] = useState(false);

  // Store übernehmen und die Quota-Eingabefelder (GB) daraus vorbelegen.
  function applyStore(s: TenantStorage) {
    setStore(s);
    setQuotaDraft(
      Object.fromEntries(s.teachers.map((tt) => [tt.teacherId, bytesToGbInput(tt.quotaBytes)])),
    );
  }

  async function saveTeacherQuota(teacherId: string) {
    const raw = (quotaDraft[teacherId] ?? '').trim().replace(',', '.');
    // Nur speichern, wenn sich der Wert gegenüber dem geladenen Stand geändert hat.
    const current = store?.teachers.find((x) => x.teacherId === teacherId)?.quotaBytes ?? null;
    if (raw === bytesToGbInput(current)) return;
    const gb = raw === '' ? null : Number(raw);
    if (gb !== null && (!Number.isFinite(gb) || gb < 0)) {
      toast.error(t('storage.quotaInvalid'));
      return;
    }
    setSavingQuota(teacherId);
    try {
      await storage.setTeacherQuota(teacherId, gb === null ? null : Math.round(gb * GB));
      applyStore(await storage.school());
      toast.success(t('storage.quotaSaved'));
    } catch (err: unknown) {
      const e2 = err as { body?: { title?: string }; message?: string };
      toast.error(e2.body?.title ?? e2.message ?? t('common.actionFailed'));
    } finally {
      setSavingQuota(null);
    }
  }

  useEffect(() => {
    const u = getUser();
    if (u && !isAdmin(u)) {
      router.replace(homePathForRole(u));
      return;
    }
    void (async () => {
      try {
        setOps(await admin.ops());
      } catch {
        toast.error(t('admin.loadFailed'));
      }
    })();
    // Speicher-Aufschlüsselung pro Lehrperson (eigene Schule); Fehler nicht fatal.
    void storage
      .school()
      .then(applyStore)
      .catch(() => {});
  }, [router, toast, t]);

  async function runGc() {
    setGcRunning(true);
    try {
      const r = await storage.gc();
      toast.success(t('storage.gcDone', { deleted: r.deleted, freed: formatBytes(r.freedBytes) }));
      // Anzeige aktualisieren (Aufschlüsselung + Gesamtwert).
      const [s, o] = await Promise.all([storage.school(), admin.ops()]);
      applyStore(s);
      setOps(o);
    } catch (err: unknown) {
      const e2 = err as { body?: { title?: string }; message?: string };
      toast.error(e2.body?.title ?? e2.message ?? t('common.actionFailed'));
    } finally {
      setGcRunning(false);
    }
  }

  async function downloadBackup() {
    setDownloading(true);
    try {
      const { blob, filename } = await exportBackupZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('admin.backupDone'));
    } catch (err: unknown) {
      const e2 = err as { body?: { title?: string }; message?: string };
      toast.error(e2.body?.title ?? e2.message ?? t('common.actionFailed'));
    } finally {
      setDownloading(false);
    }
  }

  const dot = (state: string) => (
    <span
      className="dotc"
      style={{
        background: state === 'up' ? 'var(--st-graded)' : 'var(--st-rejected)',
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        marginRight: 6,
      }}
    />
  );

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('admin.title')} / {t('admin.opsTitle')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('admin.opsTitle')}</h1>
          <p>{t('admin.opsSubtitle')}</p>
        </div>
      </div>

      {!ops ? (
        <div className="loading">{t('common.loading')}</div>
      ) : (
        <>
          {/* Gesundheit */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('admin.health')}</h2>
              <span
                className={`badge ${ops.health.status === 'ok' ? 'b-published' : 'b-rejected'}`}
              >
                {ops.health.status === 'ok' ? t('admin.healthOk') : t('admin.healthDegraded')}
              </span>
            </div>
            <div className="panel-body">
              <p>
                {dot(ops.health.db)} {t('admin.db')} · {dot(ops.health.redis)} Redis ·{' '}
                {dot(ops.health.s3)} {t('admin.storage')}
              </p>
              <p className="kh-muted" style={{ fontSize: 13 }}>
                {t('admin.version')}: {ops.health.version}
                {ops.health.gitSha && ops.health.gitSha !== 'dev'
                  ? ` · ${ops.health.gitSha}`
                  : ''}
                {ops.health.buildTime ? ` · ${ops.health.buildTime}` : ''}
              </p>
            </div>
          </div>

          {/* Auslastung */}
          <div className="cards">
            <div className="card">
              <div className="k">{t('admin.kpiTeachers')}</div>
              <div className="v">{ops.usage.teachers}</div>
            </div>
            <div className="card">
              <div className="k">{t('admin.kpiLearners')}</div>
              <div className="v">{ops.usage.learners}</div>
            </div>
            <div className="card">
              <div className="k">{t('admin.kpiModules')}</div>
              <div className="v">{ops.usage.modules}</div>
            </div>
            <div className="card">
              <div className="k">{t('admin.kpiClasses')}</div>
              <div className="v">{ops.usage.classes}</div>
            </div>
            <div className="card">
              <div className="k">{t('admin.kpiSubmissions')}</div>
              <div className="v">{ops.usage.submissions}</div>
            </div>
            <div className="card">
              <div className="k">{t('admin.kpiStorage')}</div>
              <div className="v">{formatBytes(ops.usage.storageBytes)}</div>
            </div>
            <div className="card">
              <div className="k">{t('admin.kpiLogins7')}</div>
              <div className="v">{ops.usage.logins7}</div>
              <div className="d">
                {t('admin.kpiLogins30')}: {ops.usage.logins30}
              </div>
            </div>
          </div>

          {/* Speicher pro Lehrperson */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('storage.schoolTitle')}</h2>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {store && (
                  <span className="kh-muted">
                    {store.quotaBytes != null
                      ? `${formatBytes(store.total)} / ${formatBytes(store.quotaBytes)}`
                      : formatBytes(store.total)}
                  </span>
                )}
                <button className="btn sm" disabled={gcRunning} onClick={() => void runGc()}>
                  {gcRunning ? t('storage.gcRunning') : t('storage.gcRun')}
                </button>
              </span>
            </div>
            <div className="panel-body">
              {!store ? (
                <p className="kh-muted" style={{ marginTop: 0 }}>
                  {t('common.loading')}
                </p>
              ) : store.teachers.length === 0 ? (
                <p className="kh-muted" style={{ marginTop: 0 }}>
                  {t('storage.none')}
                </p>
              ) : (
                <>
                  {store.quotaBytes != null && (
                    <div style={{ marginBottom: 12 }}>
                      <QuotaBar used={store.total} quota={store.quotaBytes} />
                    </div>
                  )}
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('storage.teacher')}</th>
                        <th style={{ textAlign: 'right' }}>{t('storage.usage')}</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {t('storage.quotaGb')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {store.teachers.map((tt) => (
                        <tr key={tt.teacherId}>
                          <td>
                            {tt.displayName}
                            {tt.email ? (
                              <span className="kh-muted"> &lt;{tt.email}&gt;</span>
                            ) : null}
                            <QuotaBar used={tt.bytes} quota={tt.quotaBytes} />
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {formatBytes(tt.bytes)}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              style={{
                                width: 84,
                                textAlign: 'right',
                                padding: '4px 6px',
                                border: '1px solid var(--kh-border, #d1d5db)',
                                borderRadius: 6,
                                background: 'var(--kh-surface, #fff)',
                                color: 'inherit',
                              }}
                              placeholder="∞"
                              value={quotaDraft[tt.teacherId] ?? ''}
                              disabled={savingQuota === tt.teacherId}
                              onChange={(e) =>
                                setQuotaDraft((d) => ({ ...d, [tt.teacherId]: e.target.value }))
                              }
                              onBlur={() => void saveTeacherQuota(tt.teacherId)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              <p className="kh-muted" style={{ fontSize: 12, marginBottom: 0 }}>
                {t('storage.attributionHint')}
              </p>
            </div>
          </div>

          {/* Backup */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('admin.backup')}</h2>
            </div>
            <div className="panel-body">
              <p className="kh-muted" style={{ marginTop: 0 }}>
                {t('admin.backupHint')}
              </p>
              <button
                className="btn primary"
                disabled={downloading}
                onClick={() => void downloadBackup()}
              >
                {downloading ? t('admin.backupRunning') : `⬇ ${t('admin.backupDownload')}`}
              </button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
