'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { useToast } from '../../../components/ToastProvider';
import { useI18n } from '../../../lib/i18n';
import { getUser, isAdmin, homePathForRole } from '../../../lib/session';
import { admin, type AdminSettings } from '../../../lib/api';

export default function AdminSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await admin.settings();
      setSettings(s);
      setSchoolName(s.schoolName);
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

  async function save(patch: Partial<AdminSettings> & { schoolName?: string }) {
    setBusy(true);
    try {
      const next = await admin.updateSettings({
        schoolName: patch.schoolName,
        authProviders: patch.authProviders,
      });
      setSettings(next);
      setSchoolName(next.schoolName);
      toast.success(t('admin.settingsSaved'));
    } catch (err: unknown) {
      const e2 = err as { body?: { title?: string } };
      toast.error(e2.body?.title ?? 'Aktion fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  function toggleProvider(key: 'microsoft' | 'google') {
    if (!settings) return;
    void save({
      authProviders: { ...settings.authProviders, [key]: !settings.authProviders[key] },
    });
  }

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('admin.title')} / {t('admin.settingsTitle')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('admin.settingsTitle')}</h1>
          <p>{t('admin.settingsSubtitle')}</p>
        </div>
      </div>

      {!settings ? (
        <div className="loading">{t('common.loading')}</div>
      ) : (
        <>
          {/* Schulname */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('admin.schoolName')}</h2>
            </div>
            <form
              className="form-inline"
              onSubmit={(e) => {
                e.preventDefault();
                void save({ schoolName });
              }}
            >
              <input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                style={{ flex: 1, minWidth: 220 }}
              />
              <button type="submit" className="btn primary" disabled={busy}>
                {t('common.save')}
              </button>
            </form>
          </div>

          {/* Auth-Provider */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('admin.authProviders')}</h2>
            </div>
            <div className="panel-body">
              <p className="kh-muted" style={{ marginTop: 0 }}>
                {t('admin.authProvidersHint')}
              </p>
              <label className="goal-check" style={{ display: 'block', marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={settings.authProviders.microsoft}
                  disabled={busy}
                  onChange={() => toggleProvider('microsoft')}
                />{' '}
                {t('admin.authMicrosoft')}
              </label>
              <label className="goal-check" style={{ display: 'block' }}>
                <input
                  type="checkbox"
                  checked={settings.authProviders.google}
                  disabled={busy}
                  onChange={() => toggleProvider('google')}
                />{' '}
                {t('admin.authGoogle')}
              </label>
            </div>
          </div>

          {/* Betrieb (read-only) */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('common.status')}</h2>
            </div>
            <div className="panel-body">
              <p>
                <strong>{t('admin.devLogin')}:</strong>{' '}
                <span className={`badge ${settings.devLoginEnabled ? 'b-draft' : 'b-archived'}`}>
                  {settings.devLoginEnabled ? t('admin.devLoginOn') : t('admin.devLoginOff')}
                </span>
              </p>
              <p className="kh-muted" style={{ fontSize: 13, marginTop: -4 }}>
                {t('admin.devLoginHint')}
              </p>
              <p>
                <strong>{t('admin.adminEmails')}:</strong>{' '}
                <span
                  className={`badge ${settings.adminEmailsConfigured ? 'b-published' : 'b-archived'}`}
                >
                  {settings.adminEmailsConfigured
                    ? t('admin.adminEmailsSet')
                    : t('admin.adminEmailsUnset')}
                </span>
              </p>
              <p className="kh-muted" style={{ fontSize: 13, marginTop: -4 }}>
                {t('admin.adminEmailsHint')}
              </p>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
