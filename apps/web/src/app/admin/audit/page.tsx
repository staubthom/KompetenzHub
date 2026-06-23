'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { useToast } from '../../../components/ToastProvider';
import { useI18n } from '../../../lib/i18n';
import { getUser, isAdmin, homePathForRole } from '../../../lib/session';
import { admin, type AuditEntry } from '../../../lib/api';

export default function AdminAuditPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [rows, setRows] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    const u = getUser();
    if (u && !isAdmin(u)) {
      router.replace(homePathForRole(u));
      return;
    }
    void (async () => {
      try {
        setRows(await admin.audit(200));
      } catch {
        toast.error(t('admin.loadFailed'));
      }
    })();
  }, [router, toast, t]);

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('admin.title')} / {t('admin.auditTitle')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('admin.auditTitle')}</h1>
          <p>{t('admin.auditSubtitle')}</p>
        </div>
      </div>

      <div className="panel">
        {!rows ? (
          <div className="loading">{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <p>{t('admin.auditEmpty')}</p>
          </div>
        ) : (
          <div className="tablewrap">
            <table className="smatrix">
              <thead>
                <tr>
                  <th>{t('admin.auditWhen')}</th>
                  <th>{t('admin.auditAction')}</th>
                  <th>{t('admin.auditWho')}</th>
                  <th>{t('admin.auditDetail')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="kh-muted" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <code>{r.action}</code>
                    </td>
                    <td>{r.user ? r.user.displayName : '—'}</td>
                    <td className="kh-muted" style={{ fontSize: 12 }}>
                      {Object.keys(r.detail ?? {}).length > 0 ? JSON.stringify(r.detail) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
