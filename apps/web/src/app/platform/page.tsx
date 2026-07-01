'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import { useToast } from '../../components/ToastProvider';
import { getUser } from '../../lib/session';
import { useI18n } from '../../lib/i18n';
import { platform, type PlatformTenant, type TenantAdmins } from '../../lib/api';

/**
 * Plattform-Verwaltung (Super-Admin): Schulen/Mandanten anlegen und verwalten.
 * Zugriff wird serverseitig über SUPERADMIN_EMAILS geprüft; ohne Recht liefert
 * die API 403 und diese Seite zeigt einen Hinweis.
 */
export default function PlatformPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [list, setList] = useState<PlatformTenant[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [busy, setBusy] = useState(false);
  // Admin-Verwaltung pro Schule (ausklappbar)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [admins, setAdmins] = useState<TenantAdmins | null>(null);
  const [newAdmin, setNewAdmin] = useState('');

  const load = useCallback(async () => {
    try {
      setList(await platform.listTenants());
    } catch (err: unknown) {
      const e = err as { status?: number; body?: { title?: string } };
      if (e.status === 403) setDenied(true);
      else toast.error(e.body?.title ?? t('toast.loadFailed'));
    }
  }, [toast, t]);

  useEffect(() => {
    if (!getUser()) {
      router.replace('/login');
      return;
    }
    void load();
  }, [router, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!slug.trim() || !name.trim()) return;
    setBusy(true);
    try {
      const res = await platform.createTenant({
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        adminEmail: adminEmail.trim() || undefined,
      });
      toast.success(
        res.adminInvited
          ? t('toast.schoolCreatedWithAdmin', { name: res.name })
          : t('toast.schoolCreated', { name: res.name }),
      );
      setSlug('');
      setName('');
      setAdminEmail('');
      await load();
    } catch (err: unknown) {
      const e = err as { body?: { title?: string } };
      toast.error(e.body?.title ?? t('toast.createFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(tn: PlatformTenant) {
    try {
      await platform.updateTenant(tn.id, { active: !tn.active });
      toast.success(
        tn.active
          ? t('toast.schoolDeactivated', { name: tn.name })
          : t('toast.schoolActivated', { name: tn.name }),
      );
      await load();
    } catch (err: unknown) {
      const e = err as { body?: { title?: string } };
      toast.error(e.body?.title ?? t('common.actionFailed'));
    }
  }

  async function removeTenant(tn: PlatformTenant) {
    if (
      !confirm(
        `Schule „${tn.name}" (${tn.slug}) unwiderruflich löschen? Alle Personen, Module, Klassen und Nachweise dieser Schule werden entfernt.`,
      )
    )
      return;
    try {
      await platform.deleteTenant(tn.id);
      toast.success(t('toast.schoolDeleted', { name: tn.name }));
      if (expandedId === tn.id) setExpandedId(null);
      await load();
    } catch (err: unknown) {
      const e = err as { body?: { title?: string } };
      toast.error(e.body?.title ?? t('toast.deleteFailed'));
    }
  }

  async function openAdmins(tn: PlatformTenant) {
    if (expandedId === tn.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(tn.id);
    setAdmins(null);
    setNewAdmin('');
    try {
      setAdmins(await platform.listAdmins(tn.id));
    } catch (err: unknown) {
      const e = err as { body?: { title?: string } };
      toast.error(e.body?.title ?? t('toast.adminsLoadFailed'));
    }
  }

  async function addAdmin(tenantId: string) {
    const email = newAdmin.trim();
    if (!email) return;
    try {
      const res = await platform.addAdmin(tenantId, email);
      toast.success(
        res.invited ? t('toast.adminInvited', { email }) : t('toast.adminSet', { email }),
      );
      setNewAdmin('');
      setAdmins(await platform.listAdmins(tenantId));
      await load();
    } catch (err: unknown) {
      const e = err as { body?: { title?: string } };
      toast.error(e.body?.title ?? t('toast.addFailed'));
    }
  }

  async function removeAdmin(tenantId: string, target: { userId?: string; email?: string }) {
    try {
      await platform.removeAdmin(tenantId, target);
      toast.success(t('toast.adminRemoved'));
      setAdmins(await platform.listAdmins(tenantId));
      await load();
    } catch (err: unknown) {
      const e = err as { body?: { title?: string } };
      toast.error(e.body?.title ?? t('toast.removeFailed'));
    }
  }

  if (denied) {
    return (
      <AppShell>
        <div className="page-head">
          <h1>Plattform-Verwaltung</h1>
        </div>
        <div className="panel">
          <div className="panel-body">
            <p className="kh-muted">Diese Seite ist nur für Plattform-Administrator:innen.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="breadcrumb">Plattform / Schulen</div>
      <div className="page-head">
        <div>
          <h1>Schulen (Mandanten)</h1>
          <p>
            Neue Schule anlegen und bestehende verwalten. Jede Schule ist über ihre Subdomain
            erreichbar.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Neue Schule anlegen</h2>
        </div>
        <div className="panel-body">
          <form
            className="form-inline"
            onSubmit={(e) => {
              void create(e);
            }}
          >
            <input
              placeholder="slug (z. B. schule-a)"
              aria-label="Slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              style={{ minWidth: 160 }}
            />
            <input
              placeholder="Name der Schule"
              aria-label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <input
              type="email"
              placeholder="Admin-E-Mail (optional)"
              aria-label="Admin-E-Mail"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              style={{ minWidth: 220 }}
            />
            <button type="submit" className="btn primary" disabled={busy}>
              Anlegen
            </button>
          </form>
          <p className="kh-muted" style={{ marginBottom: 0 }}>
            Slug: nur Kleinbuchstaben, Ziffern und Bindestrich (wird zur Subdomain
            <code> slug.&lt;basisdomain&gt;</code>). Die optionale Admin-E-Mail erhält beim ersten
            Login automatisch Schuladmin-Rechte.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Alle Schulen</h2>
        </div>
        {!list ? (
          <div className="loading">Laden…</div>
        ) : list.length === 0 ? (
          <div className="panel-body">
            <p className="kh-muted">Noch keine Schulen angelegt.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Slug</th>
                <th>Name</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Personen</th>
                <th style={{ textAlign: 'right' }}>Module</th>
                <th style={{ textAlign: 'right' }}>Klassen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((tn) => (
                <Fragment key={tn.id}>
                  <tr>
                    <td>
                      <code>{tn.slug}</code>
                    </td>
                    <td>{tn.name}</td>
                    <td>{tn.active ? 'aktiv' : 'deaktiviert'}</td>
                    <td style={{ textAlign: 'right' }}>{tn.memberships}</td>
                    <td style={{ textAlign: 'right' }}>{tn.modules}</td>
                    <td style={{ textAlign: 'right' }}>{tn.classes}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          void openAdmins(tn);
                        }}
                      >
                        Admins
                      </button>{' '}
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          void toggleActive(tn);
                        }}
                      >
                        {tn.active ? 'Deaktivieren' : 'Aktivieren'}
                      </button>{' '}
                      <button
                        type="button"
                        className="btn danger"
                        onClick={() => {
                          void removeTenant(tn);
                        }}
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                  {expandedId === tn.id && (
                    <tr>
                      <td colSpan={7} style={{ background: 'var(--kh-surface-2, #f8fafc)' }}>
                        <div style={{ padding: '8px 4px' }}>
                          <strong>Schuladmins von „{tn.name}"</strong>
                          {!admins ? (
                            <p className="kh-muted">Laden…</p>
                          ) : (
                            <>
                              {admins.admins.length === 0 && admins.pendingInvites.length === 0 ? (
                                <p className="kh-muted">Noch keine Admins.</p>
                              ) : (
                                <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
                                  {admins.admins.map((a) => (
                                    <li key={a.membershipId}>
                                      {a.displayName} &lt;{a.email}&gt;{' '}
                                      <button
                                        type="button"
                                        className="btn danger btn-sm"
                                        onClick={() => {
                                          void removeAdmin(tn.id, { userId: a.userId });
                                        }}
                                      >
                                        Entfernen
                                      </button>
                                    </li>
                                  ))}
                                  {admins.pendingInvites.map((p) => (
                                    <li key={p.id}>
                                      {p.email} <em className="kh-muted">(eingeladen)</em>{' '}
                                      <button
                                        type="button"
                                        className="btn danger btn-sm"
                                        onClick={() => {
                                          void removeAdmin(tn.id, { email: p.email });
                                        }}
                                      >
                                        Widerrufen
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <div className="form-inline" style={{ marginTop: 4 }}>
                                <input
                                  type="email"
                                  placeholder="admin@schule.ch"
                                  aria-label="Neue Admin-E-Mail"
                                  value={newAdmin}
                                  onChange={(e) => setNewAdmin(e.target.value)}
                                  style={{ minWidth: 240 }}
                                />
                                <button
                                  type="button"
                                  className="btn primary"
                                  onClick={() => {
                                    void addAdmin(tn.id);
                                  }}
                                >
                                  Admin hinzufügen
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
