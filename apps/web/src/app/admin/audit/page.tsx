'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { useToast } from '../../../components/ToastProvider';
import { useI18n } from '../../../lib/i18n';
import { getUser, isAdmin, homePathForRole } from '../../../lib/session';
import { admin, type AuditEntry } from '../../../lib/api';

type SortKey = 'time' | 'action' | 'user';
type SortDir = 'asc' | 'desc';

/** Kurzfassung des User-Agent (Browser/OS) für die Tabelle; voller Wert im title. */
function shortAgent(ua: string | null): string {
  if (!ua) return '—';
  const m =
    /(Edg|Edge|Chrome|Firefox|Safari|Opera|OPR)\/[\d.]+/.exec(ua) ??
    /(Mobile|Android|iPhone|iPad)/.exec(ua);
  return m ? m[0].replace('OPR', 'Opera').replace('Edg', 'Edge') : ua.slice(0, 24);
}

export default function AdminAuditPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const u = getUser();
    if (u && !isAdmin(u)) {
      router.replace(homePathForRole(u));
      return;
    }
    void (async () => {
      try {
        setRows(await admin.audit(500));
      } catch {
        toast.error(t('admin.loadFailed'));
      }
    })();
  }, [router, toast, t]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'time' ? 'desc' : 'asc');
    }
  }

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (rows ?? []).filter((r) => {
      if (!q) return true;
      const hay = [
        r.action,
        r.user?.displayName ?? '',
        r.user?.email ?? '',
        r.ip ?? '',
        r.userAgent ?? '',
        JSON.stringify(r.detail ?? {}),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'time':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'action':
          cmp = a.action.localeCompare(b.action);
          break;
        case 'user':
          cmp = (a.user?.displayName ?? '').localeCompare(b.user?.displayName ?? '');
          break;
      }
      return cmp * dir;
    });
  }, [rows, query, sortKey, sortDir]);

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');
  function header(key: SortKey, label: string) {
    return (
      <th>
        <button
          className="linklike"
          style={{ font: 'inherit', fontWeight: 600 }}
          onClick={() => toggleSort(key)}
        >
          {label}
          {sortArrow(key)}
        </button>
      </th>
    );
  }

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
        <input
          className="link-input"
          style={{ minWidth: 240, maxWidth: 320 }}
          type="search"
          placeholder={t('admin.auditSearch')}
          aria-label={t('admin.auditSearch')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="panel">
        {!rows ? (
          <div className="loading">{t('common.loading')}</div>
        ) : view.length === 0 ? (
          <div className="empty">
            <p>{query.trim() ? t('admin.noMatches') : t('admin.auditEmpty')}</p>
          </div>
        ) : (
          <div className="tablewrap">
            <table className="smatrix">
              <thead>
                <tr>
                  {header('time', t('admin.auditWhen'))}
                  {header('action', t('admin.auditAction'))}
                  {header('user', t('admin.auditWho'))}
                  <th>{t('admin.auditIp')}</th>
                  <th>{t('admin.auditAgent')}</th>
                  <th>{t('admin.auditDetail')}</th>
                </tr>
              </thead>
              <tbody>
                {view.map((r) => (
                  <tr key={r.id}>
                    <td className="kh-muted" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <code>{r.action}</code>
                    </td>
                    <td>{r.user ? <span title={r.user.email}>{r.user.displayName}</span> : '—'}</td>
                    <td className="kh-muted" style={{ whiteSpace: 'nowrap' }}>
                      {r.ip ?? '—'}
                    </td>
                    <td className="kh-muted" title={r.userAgent ?? ''}>
                      {shortAgent(r.userAgent)}
                    </td>
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
