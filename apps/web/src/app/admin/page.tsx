'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import { useToast } from '../../components/ToastProvider';
import { useI18n } from '../../lib/i18n';
import { getUser, isAdmin, homePathForRole } from '../../lib/session';
import { admin, type AdminOverview } from '../../lib/api';

export default function AdminOverviewPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [data, setData] = useState<AdminOverview | null>(null);

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
  }, [router, toast, t]);

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
