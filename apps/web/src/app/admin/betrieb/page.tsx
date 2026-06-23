'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { useToast } from '../../../components/ToastProvider';
import { useI18n } from '../../../lib/i18n';
import { getUser, isAdmin, homePathForRole } from '../../../lib/session';
import { admin, exportBackupZip, type AdminOps } from '../../../lib/api';

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

export default function AdminOpsPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [ops, setOps] = useState<AdminOps | null>(null);
  const [downloading, setDownloading] = useState(false);

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
  }, [router, toast, t]);

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
      toast.error(e2.body?.title ?? e2.message ?? 'Aktion fehlgeschlagen.');
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
