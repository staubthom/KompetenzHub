'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { useToast } from '../../../components/ToastProvider';
import { useI18n, LOCALES, LOCALE_LABEL, type Locale } from '../../../lib/i18n';
import { getUser, isAdmin, homePathForRole } from '../../../lib/session';
import { admin, uploadRichTextImage, type AdminSettings } from '../../../lib/api';

// Akzentfarben-Vorschläge (siehe Branding-Mockup)
const COLOR_PRESETS = ['#2563eb', '#0d9488', '#9333ea', '#e11d48', '#ea580c', '#16a34a', '#0369a1'];

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
        logoUrl: patch.logoUrl,
        primaryColor: patch.primaryColor,
        defaultLocale: patch.defaultLocale,
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

  function pickColor(color: string) {
    // Sofort sichtbar machen (Live-Vorschau in der ganzen App).
    document.documentElement.style.setProperty('--brand-primary', color);
    void save({ primaryColor: color });
  }

  async function uploadLogo(file: File) {
    setBusy(true);
    try {
      const url = await uploadRichTextImage(file);
      await save({ logoUrl: url });
    } catch (err: unknown) {
      const e2 = err as { body?: { title?: string }; message?: string };
      toast.error(e2.body?.title ?? e2.message ?? 'Aktion fehlgeschlagen.');
      setBusy(false);
    }
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
            <div className="panel-body" style={{ paddingTop: 0 }}>
              <label className="fld" style={{ maxWidth: 320 }}>
                <span className="field-label">{t('admin.defaultLocale')}</span>
                <select
                  value={settings.defaultLocale}
                  disabled={busy}
                  onChange={(e) => void save({ defaultLocale: e.target.value })}
                >
                  {LOCALES.map((l) => (
                    <option key={l} value={l}>
                      {LOCALE_LABEL[l as Locale]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="kh-muted" style={{ fontSize: 13, margin: '6px 0 0' }}>
                {t('admin.defaultLocaleHint')}
              </p>
            </div>
          </div>

          {/* Akzentfarbe */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('admin.accent')}</h2>
            </div>
            <div className="panel-body">
              <p className="kh-muted" style={{ marginTop: 0 }}>
                {t('admin.accentHint')}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    disabled={busy}
                    onClick={() => pickColor(c)}
                    className={`color-sw${settings.primaryColor.toLowerCase() === c ? ' sel' : ''}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="color"
                  value={settings.primaryColor}
                  disabled={busy}
                  onChange={(e) => pickColor(e.target.value)}
                  style={{ width: 44, height: 36, padding: 0, cursor: 'pointer' }}
                />
                <span className="kh-muted" style={{ fontSize: 13 }}>
                  {t('admin.accentCustom')} ({settings.primaryColor})
                </span>
              </label>
            </div>
          </div>

          {/* Logo */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('admin.logo')}</h2>
            </div>
            <div className="panel-body">
              <p className="kh-muted" style={{ marginTop: 0 }}>
                {t('admin.logoHint')}
              </p>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                {settings.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt="Logo"
                    style={{ height: 40, maxWidth: 200, objectFit: 'contain' }}
                  />
                )}
                <label className="btn sm" style={{ cursor: 'pointer' }}>
                  {busy ? '…' : t('admin.uploadLogo')}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadLogo(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                {settings.logoUrl && (
                  <button
                    className="btn sm danger"
                    disabled={busy}
                    onClick={() => void save({ logoUrl: null })}
                  >
                    {t('admin.removeLogo')}
                  </button>
                )}
              </div>
            </div>
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
