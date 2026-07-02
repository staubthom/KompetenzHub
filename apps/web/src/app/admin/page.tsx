'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import { useToast } from '../../components/ToastProvider';
import { useI18n } from '../../lib/i18n';
import { getUser, isAdmin, homePathForRole } from '../../lib/session';
import { admin, storage, type AdminOverview, type TenantStorage } from '../../lib/api';

/** Bytes menschenlesbar (KB/MB/GB/TB). */
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

export default function AdminOverviewPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [store, setStore] = useState<TenantStorage | null>(null);

  useEffect(() => {
    const u = getUser();
    if (u && !isAdmin(u)) {
      router.replace(homePathForRole(u));
      return;
    }
    void (async () => {
      try {
        setData(await admin.overview());
      } catch {
        toast.error(t('admin.loadFailed'));
      }
    })();
    // Schul-Speicher (Gesamt + gekaufte Quota); Fehler nicht fatal.
    void storage
      .school()
      .then(setStore)
      .catch(() => {});
  }, [router, toast, t]);

  const usedPct =
    store && store.quotaBytes != null && store.quotaBytes > 0
      ? Math.min(100, Math.round((store.total / store.quotaBytes) * 100))
      : null;
  const quotaOver = store?.quotaBytes != null && store.total > store.quotaBytes;
  const barColor = quotaOver ? '#dc2626' : usedPct != null && usedPct >= 85 ? '#f59e0b' : '#2563eb';

  const kpis: { key: string; label: string; value: number | undefined }[] = [
    { key: 'teachers', label: t('admin.kpiTeachers'), value: data?.teachers },
    { key: 'learners', label: t('admin.kpiLearners'), value: data?.learners },
    { key: 'admins', label: t('admin.kpiAdmins'), value: data?.admins },
    { key: 'pendingInvites', label: t('admin.kpiPendingInvites'), value: data?.pendingInvites },
    { key: 'disabled', label: t('admin.kpiDisabled'), value: data?.disabled },
    { key: 'modules', label: t('admin.kpiModules'), value: data?.modules },
    { key: 'classes', label: t('admin.kpiClasses'), value: data?.classes },
  ];

  return (
    <AppShell>
      <div className="breadcrumb">{t('admin.title')}</div>
      <div className="page-head">
        <div>
          <h1>{t('admin.title')}</h1>
          <p>{t('admin.subtitle')}</p>
        </div>
      </div>

      <div className="cards">
        {kpis.map((k) => (
          <div className="card" key={k.key}>
            <div className="k">{k.label}</div>
            <div className="v">{k.value ?? '–'}</div>
          </div>
        ))}
      </div>

      {/* Schul-Speicher: Gesamtverbrauch gegen gekaufte Quota */}
      <div className="panel">
        <div className="panel-head">
          <h2>{t('storage.schoolQuotaTitle')}</h2>
          <span className="kh-muted">
            {store
              ? store.quotaBytes != null
                ? `${formatBytes(store.total)} / ${formatBytes(store.quotaBytes)}${usedPct != null ? ` · ${usedPct}%` : ''}`
                : `${formatBytes(store.total)} · ${t('storage.noLimit')}`
              : t('common.loading')}
          </span>
        </div>
        {store?.quotaBytes != null && (
          <div className="panel-body">
            <div
              style={{
                height: 10,
                background: 'var(--kh-border, #e5e7eb)',
                borderRadius: 6,
                overflow: 'hidden',
              }}
              role="progressbar"
              aria-valuenow={usedPct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                style={{
                  height: '100%',
                  width: `${usedPct ?? 0}%`,
                  borderRadius: 6,
                  background: barColor,
                  transition: 'width .3s ease',
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>{t('common.overview')}</h2>
        </div>
        <div className="panel-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn primary" href="/admin/personen">
            👥 {t('admin.quickPeople')}
          </Link>
          <Link className="btn" href="/admin/einladungen">
            ✉ {t('admin.quickInvite')}
          </Link>
          <Link className="btn" href="/admin/einstellungen">
            ⚙ {t('admin.quickSettings')}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
