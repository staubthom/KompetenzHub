'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  getUser,
  clearSession,
  isTeacher,
  isAdmin,
  initials,
  type SessionUser,
} from '../lib/session';
import { logout as apiLogout, updatePreferences, branding } from '../lib/api';
import { useI18n, normalizeLocale, LOCALES, LOCALE_LABEL, type Locale } from '../lib/i18n';

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

const ADMIN_NAV: NavItem[] = [
  { id: 'admin', icon: '▦', labelKey: 'nav.adminOverview', href: '/admin' },
  { id: 'admin-personen', icon: '👥', labelKey: 'nav.adminPeople', href: '/admin/personen' },
  { id: 'admin-einladungen', icon: '✉', labelKey: 'nav.adminInvites', href: '/admin/einladungen' },
  { id: 'admin-betrieb', icon: '❤', labelKey: 'nav.adminOps', href: '/admin/betrieb' },
  { id: 'admin-audit', icon: '🛡', labelKey: 'nav.adminAudit', href: '/admin/audit' },
  {
    id: 'admin-einstellungen',
    icon: '⚙',
    labelKey: 'nav.adminSettings',
    href: '/admin/einstellungen',
  },
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
  const { t, locale, setLocale } = useI18n();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [theme, setThemeState] = useState<Theme>('light');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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

    // Schul-Branding (Logo + Akzentfarbe) laden (Fehler nicht fatal).
    void branding
      .get()
      .then((b) => {
        setLogoUrl(b.logoUrl);
        if (b.primaryColor) {
          document.documentElement.style.setProperty('--brand-primary', b.primaryColor);
        }
      })
      .catch(() => {});
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

  function changeLocale(l: Locale) {
    setLocale(l);
    // Pro Konto speichern (überlebt Logout); Fehler nicht fatal.
    void updatePreferences({ locale: l }).catch(() => {});
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
  const admin = isAdmin(user);
  const nav = admin ? ADMIN_NAV : teacher ? TEACHER_NAV : STUDENT_NAV;
  const homeHref = admin ? '/admin' : teacher ? '/lehrer' : '/lernende';
  const roleLabel = admin
    ? t('header.roleAdmin')
    : teacher
      ? t('header.roleTeacher')
      : t('header.roleStudent');
  const settingsHref = admin
    ? '/admin/einstellungen'
    : teacher
      ? '/lehrer/ki'
      : '/lernende/einstellungen';
  const themeLabel: Record<Theme, string> = {
    light: t('theme.light'),
    dark: t('theme.dark'),
    gray: t('theme.gray'),
  };

  return (
    <>
      <a className="skip-link" href="#main">
        {t('a11y.skip')}
      </a>
      <header className="appbar">
        <button
          className="hamburger"
          aria-label={t('a11y.menu')}
          aria-expanded={menuOpen}
          onClick={() => {
            const open = document.body.classList.toggle('menu-open');
            setMenuOpen(open);
          }}
        >
          <span aria-hidden="true">☰</span>
        </button>
        <Link className="brand" href={homeHref}>
          {logoUrl && <img className="brand-logo" src={logoUrl} alt="" />}
          <span className="name">
            Kompetenz<span>Hub</span>
          </span>
        </Link>
        <div className="appspacer" />

        <select
          className="lang-select"
          aria-label={t('common.language')}
          title={t('common.language')}
          value={locale}
          onChange={(e) => changeLocale(e.target.value as Locale)}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()} · {LOCALE_LABEL[l]}
            </option>
          ))}
        </select>

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
            aria-expanded={userMenuOpen}
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
          <div className="menu" role="menu" aria-label={t('a11y.account')}>
            <Link role="menuitem" href={settingsHref} onClick={() => setUserMenuOpen(false)}>
              <span aria-hidden="true">⚙️</span> {t('nav.einstellungen')}
            </Link>
            <div className="sep" />
            <button
              role="menuitem"
              onClick={() => {
                void handleLogout();
              }}
            >
              <span aria-hidden="true">⎋</span> {t('header.logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="app">
        <aside className="sidebar">
          <nav className="nav">
            {nav.map((item) => {
              const isRoot =
                item.href === '/lehrer' || item.href === '/lernende' || item.href === '/admin';
              const active = pathname === item.href || (!isRoot && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={active ? 'active' : ''}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    document.body.classList.remove('menu-open');
                    setMenuOpen(false);
                  }}
                >
                  <span className="ic" aria-hidden="true">
                    {item.icon}
                  </span>{' '}
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
          <a
            className="bmc-link"
            href="https://buymeacoffee.com/potenzialentwickler"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span aria-hidden="true">☕</span> {t('common.buyMeACoffee')}
          </a>
        </aside>

        <main className="main" id="main">
          {children}
        </main>
      </div>

      <div
        className="scrim"
        aria-hidden="true"
        onClick={() => {
          document.body.classList.remove('menu-open');
          setMenuOpen(false);
        }}
      />
    </>
  );
}
