'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import ProfileNamePanel from '../../../components/ProfileNamePanel';
import { useToast } from '../../../components/ToastProvider';
import { useI18n, LOCALES, LOCALE_LABEL, type Locale } from '../../../lib/i18n';
import { getUser, isAdmin, homePathForRole } from '../../../lib/session';
import { updatePreferences } from '../../../lib/api';

type Theme = 'light' | 'dark' | 'gray';

/** Persönliche Einstellungen des Schuladmins (Anzeigename, Sprache, Anzeigemodus). */
export default function AdminKontoPage() {
  const router = useRouter();
  const toast = useToast();
  const { t, locale, setLocale } = useI18n();
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const u = getUser();
    if (u && !isAdmin(u)) {
      router.replace(homePathForRole(u));
      return;
    }
    setTheme((localStorage.getItem('km-theme') as Theme | null) ?? 'light');
  }, [router]);

  async function changeLanguage(l: Locale) {
    setLocale(l);
    try {
      await updatePreferences({ locale: l });
      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('common.actionFailed'));
    }
  }

  async function changeTheme(tName: Theme) {
    setTheme(tName);
    localStorage.setItem('km-theme', tName);
    document.documentElement.setAttribute('data-theme', tName);
    try {
      await updatePreferences({ theme: tName });
    } catch {
      /* nicht fatal */
    }
  }

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('admin.title')} / {t('settings.title')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.subtitle')}</p>
        </div>
      </div>

      <ProfileNamePanel />

      <div className="panel" style={{ maxWidth: 640 }}>
        <div className="panel-head">
          <h2>{t('settings.prefs')}</h2>
        </div>
        <div className="form">
          <label>
            {t('common.language')}
            <select value={locale} onChange={(e) => void changeLanguage(e.target.value as Locale)}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_LABEL[l]}
                </option>
              ))}
            </select>
          </label>
          <div>
            <div className="field-label">{t('common.theme')}</div>
            <div className="seg" role="group" aria-label={t('common.theme')}>
              {(['light', 'dark', 'gray'] as Theme[]).map((tName) => (
                <button
                  key={tName}
                  aria-pressed={theme === tName}
                  onClick={() => void changeTheme(tName)}
                >
                  {t(`theme.${tName}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
