'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { devLogin } from '../../lib/api';
import { useToast } from '../../components/ToastProvider';
import { getUser, homePathForRole, type Role } from '../../lib/session';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [role, setRole] = useState<Role>('TEACHER');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

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

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const mail = email.trim() || (role === 'TEACHER' ? 'lehrperson@demo.ch' : 'lernende@demo.ch');
      const result = await devLogin(mail, role);
      router.replace(homePathForRole(result.user));
    } catch {
      toast.error('Login fehlgeschlagen. Läuft die API?');
    } finally {
      setLoading(false);
    }
  }

  function handleOAuth(provider: 'microsoft' | 'google') {
    // FA-08: OIDC-Flow folgt (NextAuth.js, BFF /auth/exchange).
    toast.info(
      `${provider === 'microsoft' ? 'Microsoft' : 'Google'}-Login wird später aktiviert. ` +
        `Bitte vorerst den Dev-Login verwenden.`,
    );
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1 className="login-logo">
          Kompetenz<span>Hub</span>
        </h1>
        <p className="login-sub">Anmelden, um fortzufahren</p>

        {/* OAuth-Provider (FA-08) */}
        <button className="provider-btn" onClick={() => handleOAuth('microsoft')} type="button">
          <svg className="logo" viewBox="0 0 23 23" aria-hidden="true">
            <path fill="#f25022" d="M1 1h10v10H1z" />
            <path fill="#7fba00" d="M12 1h10v10H12z" />
            <path fill="#00a4ef" d="M1 12h10v10H1z" />
            <path fill="#ffb900" d="M12 12h10v10H12z" />
          </svg>
          Mit Microsoft anmelden
        </button>
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

        <div className="login-divider">oder zum Entwickeln</div>

        {/* Dev-Login mit Rollenwahl */}
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
              👩‍🏫 Lehrperson
            </button>
            <button
              type="button"
              aria-pressed={role === 'LEARNER'}
              onClick={() => setRole('LEARNER')}
            >
              🎓 Lernende:r
            </button>
          </div>

          <div className="login-section-label">E-Mail (optional)</div>
          <input
            className="provider-btn"
            style={{ justifyContent: 'flex-start', cursor: 'text', fontWeight: 400 }}
            type="email"
            placeholder={role === 'TEACHER' ? 'lehrperson@demo.ch' : 'lernende@demo.ch'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            type="submit"
            className="btn primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Anmelden…' : 'Als Dev anmelden'}
          </button>
        </form>

        <p className="login-hint">
          Dev-Login nur für die lokale Entwicklung. Produktiv via Microsoft/Google.
        </p>
      </div>
    </div>
  );
}
