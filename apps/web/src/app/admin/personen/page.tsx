'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { useToast } from '../../../components/ToastProvider';
import { useI18n } from '../../../lib/i18n';
import { getUser, isAdmin, homePathForRole, type Role } from '../../../lib/session';
import { admin, type AdminUser } from '../../../lib/api';

const ROLES: Role[] = ['ADMIN', 'TEACHER', 'LEARNER'];

export default function AdminPeoplePage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    try {
      setUsers(await admin.users());
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
    setMe(u?.id ?? null);
    void load();
  }, [router, load]);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    toast.error(err.body?.title ?? 'Aktion fehlgeschlagen.');
  }

  async function changeRole(u: AdminUser, role: Role) {
    if (role === u.role) return;
    setBusy(u.id);
    try {
      await admin.setRole(u.id, role);
      toast.success(t('admin.roleChanged'));
      await load();
    } catch (e: unknown) {
      showError(e);
    } finally {
      setBusy(null);
    }
  }

  async function saveName(u: AdminUser) {
    if (!editName.trim() || editName.trim() === u.displayName) {
      setEditId(null);
      return;
    }
    setBusy(u.id);
    try {
      await admin.updateUser(u.id, editName.trim());
      toast.success(t('admin.saved'));
      setEditId(null);
      await load();
    } catch (e: unknown) {
      showError(e);
    } finally {
      setBusy(null);
    }
  }

  async function toggleStatus(u: AdminUser) {
    setBusy(u.id);
    try {
      await admin.setStatus(u.id, u.status !== 'ACTIVE');
      toast.success(t('admin.statusChanged'));
      await load();
    } catch (e: unknown) {
      showError(e);
    } finally {
      setBusy(null);
    }
  }

  async function remove(u: AdminUser) {
    if (!confirm(t('admin.confirmRemove'))) return;
    setBusy(u.id);
    try {
      await admin.removeUser(u.id);
      toast.success(t('admin.removed'));
      await load();
    } catch (e: unknown) {
      showError(e);
    } finally {
      setBusy(null);
    }
  }

  const roleLabel = (r: Role) =>
    r === 'ADMIN'
      ? t('admin.roleAdmin')
      : r === 'TEACHER'
        ? t('admin.roleTeacher')
        : t('admin.roleLearner');

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('admin.title')} / {t('admin.peopleTitle')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('admin.peopleTitle')}</h1>
          <p>{t('admin.peopleSubtitle')}</p>
        </div>
      </div>

      <div className="panel">
        {!users ? (
          <div className="loading">{t('common.loading')}</div>
        ) : users.length === 0 ? (
          <div className="empty">
            <p>{t('admin.empty')}</p>
          </div>
        ) : (
          <div className="tablewrap">
            <table className="smatrix">
              <thead>
                <tr>
                  <th>{t('admin.colName')}</th>
                  <th>{t('admin.colEmail')}</th>
                  <th>{t('admin.colRole')}</th>
                  <th>{t('admin.colStatus')}</th>
                  <th>{t('admin.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const self = u.id === me;
                  return (
                    <tr key={u.id}>
                      <td>
                        {editId === u.id ? (
                          <input
                            // Fokus folgt der gerade geöffneten Inline-Bearbeitung (a11y-konform)
                             
                            autoFocus
                            value={editName}
                            disabled={busy === u.id}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void saveName(u);
                              if (e.key === 'Escape') setEditId(null);
                            }}
                            style={{ width: 180 }}
                          />
                        ) : (
                          <strong>{u.displayName}</strong>
                        )}
                        {self && <span className="badge b-published"> {t('admin.you')}</span>}
                      </td>
                      <td className="kh-muted">{u.email}</td>
                      <td>
                        <select
                          value={u.role}
                          disabled={busy === u.id}
                          aria-label={`${t('admin.colRole')} – ${u.displayName}`}
                          onChange={(e) => void changeRole(u, e.target.value as Role)}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {roleLabel(r)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span
                          className={`badge ${u.status === 'ACTIVE' ? 'b-published' : 'b-rejected'}`}
                        >
                          {u.status === 'ACTIVE'
                            ? t('admin.statusActive')
                            : t('admin.statusDisabled')}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {editId === u.id ? (
                          <>
                            <button
                              className="btn sm primary"
                              disabled={busy === u.id}
                              onClick={() => void saveName(u)}
                            >
                              {t('common.save')}
                            </button>
                            <button className="btn sm" onClick={() => setEditId(null)}>
                              {t('common.cancel')}
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn sm"
                            disabled={busy === u.id}
                            onClick={() => {
                              setEditId(u.id);
                              setEditName(u.displayName);
                            }}
                          >
                            {t('common.edit')}
                          </button>
                        )}
                        <button
                          className="btn sm"
                          disabled={busy === u.id || self}
                          onClick={() => void toggleStatus(u)}
                        >
                          {u.status === 'ACTIVE' ? t('admin.disable') : t('admin.enable')}
                        </button>
                        <button
                          className="btn sm danger"
                          disabled={busy === u.id || self}
                          onClick={() => void remove(u)}
                        >
                          {t('admin.removeUser')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
