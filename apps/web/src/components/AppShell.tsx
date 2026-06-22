'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, clearSession, isTeacher, initials, type SessionUser } from '../lib/session';
import { logout as apiLogout, updatePreferences } from '../lib/api';
import { useI18n, normalizeLocale } from '../lib/i18n';

type Theme = 'light' | 'dark' | 'gray';

interface NavItem {
  id: string;
  icon: string;
  labelKey: string;
  href: string;
}

const TEACHER_NAV: NavItem[] = [
  { id: 'dashboard', icon: '▦', labelKey: 'nav.dashboard', href: '/lehrer' },
  { id: 'module', icon: '▤', labelKey: 'nav.module', href: '/modules' },
  { id: 'klassen', icon: '◫', labelKey: 'nav.klassen', href: '/lehrer/klassen' },
  { id: 'bewerten', icon: '✓', labelKey: 'nav.bewerten', href: '/lehrer/bewerten' },
  { id: 'ki', icon: '⚙', labelKey: 'nav.ki', href: '/lehrer/ki' },
];

const STUDENT_NAV: NavItem[] = [
  { id: 'matrix', icon: '▦', labelKey: 'nav.matrix', href: '/lernende' },
  { id: 'lernpfad', icon: '➔', labelKey: 'nav.lernpfad', href: '/lernende/lernpfad' },
  { id: 'nachweise', icon: '📄', labelKey: 'nav.nachweise', href: '/lernende/nachweise' },
  { id: 'fachgespraech', icon: '💬', labelKey: 'nav.modulUeben', href: '/lernende/fachgespraech' },
  {
    id: 'einstellungen',
    icon: '⚙',
    labelKey: 'nav.einstellungen',
    href: '/lernende/einstellungen',
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, setLocale } = useI18n();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [theme, setThemeState] = useState<Theme>('light');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [ready, setReady] = useState(false);

  // Session prüfen – ohne Login zur Login-Seite; Sprache & Theme aus dem Konto anwenden.
  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
    setReady(true);

    setLocale(normalizeLocale(u.locale));

    const savedTheme = (u.theme ??
      (localStorage.getItem('km-theme') as Theme | null) ??
      'light') as Theme;
    setThemeState(savedTheme);
    localStorage.setItem('km-theme', savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, [router, setLocale]);

  // Klick ausserhalb schliesst das Nutzer-Menü
  useEffect(() => {
    if (!userMenuOpen) return;
    const close = () => setUserMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [userMenuOpen]);

  function setTheme(tName: Theme) {
    setThemeState(tName);
    localStorage.setItem('km-theme', tName);
    document.documentElement.setAttribute('data-theme', tName);
    // Pro Konto speichern (überlebt Logout); Fehler nicht fatal.
    void updatePreferences({ theme: tName }).catch(() => {});
  }

  async function handleLogout() {
    await apiLogout();
    clearSession();
    router.replace('/login');
  }

  if (!ready || !user) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  const teacher = isTeacher(user);
  const nav = teacher ? TEACHER_NAV : STUDENT_NAV;
  const roleLabel = teacher ? t('header.roleTeacher') : t('header.roleStudent');
  const themeLabel: Record<Theme, string> = {
    light: t('theme.light'),
    dark: t('theme.dark'),
    gray: t('theme.gray'),
  };

  return (
    <>
      <header className="appbar">
        <button
          className="hamburger"
          aria-label="Menü"
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

        <div className="seg" role="group" aria-label={t('common.theme')}>
          {(['light', 'dark', 'gray'] as Theme[]).map((tName) => (
            <button key={tName} aria-pressed={theme === tName} onClick={() => setTheme(tName)}>
              {themeLabel[tName]}
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
            <Link
              role="menuitem"
              href={teacher ? '/lehrer/ki' : '/lernende/einstellungen'}
              onClick={() => setUserMenuOpen(false)}
            >
              ⚙️ {t('nav.einstellungen')}
            </Link>
            <div className="sep" />
            <button
              role="menuitem"
              onClick={() => {
                void handleLogout();
              }}
            >
              ⎋ {t('header.logout')}
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
                  <span className="ic">{item.icon}</span> {t(item.labelKey)}
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
