'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { devLogin, getLoginOptions, type LoginOptions } from '../../lib/api';
import { useToast } from '../../components/ToastProvider';
import { getUser, homePathForRole, type Role } from '../../lib/session';
import { useI18n } from '../../lib/i18n';

const DEMO_EMAIL: Record<Role, string> = {
  TEACHER: 'lehrperson@demo.ch',
  LEARNER: 'lernende@demo.ch',
  ADMIN: 'admin@demo.ch',
};

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { t } = useI18n();
  const [role, setRole] = useState<Role>('TEACHER');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginOptions, setLoginOptions] = useState<LoginOptions | null>(null);

  // Effektive Login-Optionen von der API laden
  useEffect(() => {
    getLoginOptions()
      .then(setLoginOptions)
      .catch(() => {
        /* Fehler ignorieren – Seite bleibt nutzbar */
      });
  }, []);

  // Bereits eingeloggt? → direkt weiterleiten
  useEffect(() => {
    const u = getUser();
    if (u) router.replace(homePathForRole(u));
  }, [router]);

  // Theme wiederherstellen (Login liegt ausserhalb der AppShell)
  useEffect(() => {
    const saved = localStorage.getItem('km-theme') ?? 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  // OAuth-Fehler aus URL-Parameter anzeigen (Redirect von /login/callback oder NextAuth)
  useEffect(() => {
    const error = searchParams.get('error');
    if (!error) return;
    const messages: Record<string, string> = {
      oauth: 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.',
      exchange: 'Konto wurde beim Server nicht akzeptiert. Bitte an die Schuladmin wenden.',
      OAuthCallback: 'Fehler beim OAuth-Callback. Bitte erneut versuchen.',
      OAuthCreateAccount: 'Konto konnte nicht erstellt werden.',
      AccessDenied: 'Zugriff verweigert.',
    };
    toast.error(messages[error] ?? 'Anmeldung fehlgeschlagen.');
  }, [searchParams, toast]);

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const mail = email.trim() || DEMO_EMAIL[role];
      const result = await devLogin(mail, role);
      router.replace(homePathForRole(result.user));
    } catch {
      toast.error('Login fehlgeschlagen. Läuft die API?');
    } finally {
      setLoading(false);
    }
  }

  function handleOAuth(provider: 'microsoft' | 'google' | 'github') {
    const providerId =
      provider === 'microsoft' ? 'azure-ad' : provider === 'github' ? 'github' : 'google';
    const label =
      provider === 'microsoft' ? 'Microsoft' : provider === 'github' ? 'GitHub' : 'Google';
    if (loginOptions && !loginOptions.authProviders[provider]) {
      toast.info(`${label}-Login ist auf diesem Server nicht konfiguriert.`);
      return;
    }
    void signIn(providerId, { callbackUrl: '/login/callback' });
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1 className="login-logo">
          Kompetenz<span>Hub</span>
        </h1>
        <p className="login-sub">{t('login.subtitle')}</p>

        {/* OAuth-Provider (FA-08) */}
        {loginOptions?.authProviders.microsoft && (
        <button className="provider-btn" onClick={() => handleOAuth('microsoft')} type="button">
          <svg className="logo" viewBox="0 0 23 23" aria-hidden="true">
            <path fill="#f25022" d="M1 1h10v10H1z" />
            <path fill="#7fba00" d="M12 1h10v10H12z" />
            <path fill="#00a4ef" d="M1 12h10v10H1z" />
            <path fill="#ffb900" d="M12 12h10v10H12z" />
          </svg>
          Mit Microsoft anmelden
        </button>
        )}
        {loginOptions?.authProviders.google && (
        <button className="provider-btn" onClick={() => handleOAuth('google')} type="button">
          <svg className="logo" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.46 3.44 1.34l2.58-2.58A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"
            />
          </svg>
          Mit Google anmelden
        </button>
        )}
        {loginOptions?.authProviders.github && (
        <button className="provider-btn" onClick={() => handleOAuth('github')} type="button">
          <svg className="logo" viewBox="0 0 16 16" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
            />
          </svg>
          Mit GitHub anmelden
        </button>
        )}

        {loginOptions?.devLoginEnabled && <div className="login-divider">oder zum Entwickeln</div>}

        {/* Dev-Login mit Rollenwahl */}
        {loginOptions?.devLoginEnabled && (
        <form
          onSubmit={(e) => {
            void handleDevLogin(e);
          }}
        >
          <div className="login-section-label">Rolle wählen</div>
          <div className="role-seg">
            <button
              type="button"
              aria-pressed={role === 'TEACHER'}
              onClick={() => setRole('TEACHER')}
            >
              👩‍🏫 {t('header.roleTeacher')}
            </button>
            <button
              type="button"
              aria-pressed={role === 'LEARNER'}
              onClick={() => setRole('LEARNER')}
            >
              🎓 {t('header.roleStudent')}
            </button>
            {loginOptions?.showAdminLogin && (
            <button type="button" aria-pressed={role === 'ADMIN'} onClick={() => setRole('ADMIN')}>
              🛠 {t('header.roleAdmin')}
            </button>
            )}
          </div>

          <div className="login-section-label">E-Mail (optional)</div>
          <input
            className="provider-btn"
            style={{ justifyContent: 'flex-start', cursor: 'text', fontWeight: 400 }}
            type="email"
            placeholder={DEMO_EMAIL[role]}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            type="submit"
            className="btn primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? t('common.loading') : 'Als Dev anmelden'}
          </button>
        </form>
        )}

        {loginOptions?.devLoginEnabled && (
          <p className="login-hint">
            Dev-Login nur für die lokale Entwicklung. Produktiv via Microsoft, Google oder GitHub.
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
