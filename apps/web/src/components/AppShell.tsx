'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, clearSession, isTeacher, initials, type SessionUser } from '../lib/session';
import { logout as apiLogout } from '../lib/api';

type Theme = 'light' | 'dark' | 'gray';

interface NavItem {
  id: string;
  icon: string;
  label: string;
  href: string;
}

const TEACHER_NAV: NavItem[] = [
  { id: 'dashboard', icon: '▦', label: 'Dashboard', href: '/lehrer' },
  { id: 'module', icon: '▤', label: 'Module & Matrizen', href: '/modules' },
  { id: 'klassen', icon: '◫', label: 'Klassen', href: '/lehrer/klassen' },
  { id: 'bewerten', icon: '✓', label: 'Bewerten', href: '/lehrer/bewerten' },
  { id: 'ki', icon: '⚙', label: 'KI-Einstellungen', href: '/lehrer/ki' },
];

const STUDENT_NAV: NavItem[] = [
  { id: 'matrix', icon: '▦', label: 'Meine Matrix', href: '/lernende' },
  { id: 'lernpfad', icon: '➔', label: 'Lernpfad', href: '/lernende/lernpfad' },
  { id: 'nachweise', icon: '📄', label: 'Meine Nachweise', href: '/lernende/nachweise' },
  { id: 'quiz', icon: '❓', label: 'Quiz', href: '/lernende/quiz' },
  { id: 'fachgespraech', icon: '💬', label: 'Fachgespräch üben', href: '/lernende/fachgespraech' },
  { id: 'einstellungen', icon: '⚙', label: 'Einstellungen', href: '/lernende/einstellungen' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [theme, setThemeState] = useState<Theme>('light');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [ready, setReady] = useState(false);

  // Session prüfen – ohne Login zur Login-Seite
  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
    setReady(true);
  }, [router]);

  // Theme aus localStorage wiederherstellen
  useEffect(() => {
    const saved = (localStorage.getItem('km-theme') as Theme) ?? 'light';
    setThemeState(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  // Klick ausserhalb schliesst das Nutzer-Menü
  useEffect(() => {
    if (!userMenuOpen) return;
    const close = () => setUserMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [userMenuOpen]);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem('km-theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }

  async function handleLogout() {
    await apiLogout();
    clearSession();
    router.replace('/login');
  }

  if (!ready || !user) {
    return <div className="loading">Lade…</div>;
  }

  const teacher = isTeacher(user);
  const nav = teacher ? TEACHER_NAV : STUDENT_NAV;
  const roleLabel = teacher ? 'Lehrperson' : 'Lernende:r';

  return (
    <>
      <header className="appbar">
        <button
          className="hamburger"
          aria-label="Menü öffnen"
          onClick={() => {
            document.body.classList.toggle('menu-open');
          }}
        >
          ☰
        </button>
        <Link className="brand" href={teacher ? '/lehrer' : '/lernende'}>
          <span className="name">
            Kompetenz<span>Hub</span>
          </span>
        </Link>
        <div className="appspacer" />

        <div className="seg" role="group" aria-label="Anzeige-Modus">
          {(['light', 'dark', 'gray'] as Theme[]).map((t) => (
            <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>
              {t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : 'Gray'}
            </button>
          ))}
        </div>

        <div className={`user ${userMenuOpen ? 'open' : ''}`}>
          <button
            aria-haspopup="true"
            onClick={(e) => {
              e.stopPropagation();
              setUserMenuOpen((o) => !o);
            }}
          >
            <span className="avatar">{initials(user.displayName)}</span>
            <span className="u-info">
              <span className="u-name">{user.displayName}</span>
              <span className="u-role">{roleLabel}</span>
            </span>
            <span aria-hidden="true">▾</span>
          </button>
          <div className="menu" role="menu" aria-label="Konto">
            <button role="menuitem">👤 Profil</button>
            <button role="menuitem">⚙️ Einstellungen</button>
            <div className="sep" />
            <button
              role="menuitem"
              onClick={() => {
                void handleLogout();
              }}
            >
              ⎋ Abmelden
            </button>
          </div>
        </div>
      </header>

      <div className="app">
        <aside className="sidebar">
          <nav className="nav">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/lehrer' &&
                  item.href !== '/lernende' &&
                  pathname.startsWith(item.href));
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={active ? 'active' : ''}
                  onClick={() => {
                    document.body.classList.remove('menu-open');
                  }}
                >
                  <span className="ic">{item.icon}</span> {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="main">{children}</main>
      </div>

      <div
        className="scrim"
        onClick={() => {
          document.body.classList.remove('menu-open');
        }}
      />
    </>
  );
}
