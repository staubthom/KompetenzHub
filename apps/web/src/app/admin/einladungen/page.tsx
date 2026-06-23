'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { useToast } from '../../../components/ToastProvider';
import { useI18n } from '../../../lib/i18n';
import { getUser, isAdmin, homePathForRole, type Role } from '../../../lib/session';
import { admin, type Invitation } from '../../../lib/api';

export default function AdminInvitesPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [list, setList] = useState<Invitation[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('TEACHER');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await admin.invitations());
    } catch {
      toast.error(t('admin.loadFailed'));
    }
  }, [toast, t]);

  useEffect(() => {
    const u = getUser();
    if (u && !isAdmin(u)) {
      router.replace(homePathForRole(u));
      return;
    }
    void load();
  }, [router, load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await admin.invite(email.trim(), role);
      setEmail('');
      toast.success(t('admin.invited'));
      await load();
    } catch (err: unknown) {
      const e2 = err as { body?: { title?: string } };
      toast.error(e2.body?.title ?? 'Aktion fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(inv: Invitation) {
    if (!confirm(t('admin.confirmRevoke'))) return;
    try {
      await admin.revokeInvitation(inv.id);
      toast.success(t('admin.inviteRevoked'));
      await load();
    } catch (err: unknown) {
      const e2 = err as { body?: { title?: string } };
      toast.error(e2.body?.title ?? 'Aktion fehlgeschlagen.');
    }
  }

  const roleLabel = (r: Role) => (r === 'ADMIN' ? t('admin.roleAdmin') : t('admin.roleTeacher'));

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('admin.title')} / {t('admin.invitesTitle')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('admin.invitesTitle')}</h1>
          <p>{t('admin.invitesSubtitle')}</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body">
          <p className="kh-muted" style={{ marginTop: 0 }}>
            {t('admin.inviteHint')}
          </p>
          <form
            className="form-inline"
            onSubmit={(e) => {
              void invite(e);
            }}
          >
            <input
              type="email"
              placeholder={t('admin.inviteEmailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="TEACHER">{roleLabel('TEACHER')}</option>
              <option value="ADMIN">{roleLabel('ADMIN')}</option>
            </select>
            <button type="submit" className="btn primary" disabled={busy}>
              {t('admin.sendInvite')}
            </button>
          </form>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>{t('admin.kpiPendingInvites')}</h2>
        </div>
        {!list ? (
          <div className="loading">{t('common.loading')}</div>
        ) : list.length === 0 ? (
          <div className="empty">
            <p>{t('admin.noInvites')}</p>
          </div>
        ) : (
          <ul className="hz-list">
            {list.map((inv) => (
              <li key={inv.id} className="hz-item">
                <div style={{ flex: 1 }}>
                  <strong>{inv.email}</strong>
                  <div className="kh-muted" style={{ fontSize: 12 }}>
                    {roleLabel(inv.role)} · {new Date(inv.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button className="btn sm danger" onClick={() => void revoke(inv)}>
                  {t('admin.revoke')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
