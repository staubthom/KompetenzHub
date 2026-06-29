/**
 Copyright (C) 2026  [Thomas Staub / https://potenzialentwickler.ch/]

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
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
import {
  logout as apiLogout,
  updatePreferences,
  branding,
  pluginsApi,
  type PluginNavItem,
} from '../lib/api';
import { useI18n, normalizeLocale, LOCALES, LOCALE_LABEL, type Locale } from '../lib/i18n';
import { pluginT } from '../plugins/registry';

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
  {
    id: 'admin-erweiterungen',
    icon: '🧩',
    labelKey: 'nav.adminPlugins',
    href: '/admin/erweiterungen',
  },
  { id: 'admin-audit', icon: '🛡', labelKey: 'nav.adminAudit', href: '/admin/audit' },
  {
    id: 'admin-einstellungen',
    icon: '🏫',
    labelKey: 'nav.adminSettings',
    href: '/admin/einstellungen',
  },
  {
    id: 'admin-mail',
    icon: '✉',
    labelKey: 'nav.adminMail',
    href: '/admin/mail-vorlagen',
  },
  {
    id: 'admin-konto',
    icon: '⚙',
    labelKey: 'nav.einstellungen',
    href: '/admin/konto',
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
  const [pluginNav, setPluginNav] = useState<{ pluginId: string; item: PluginNavItem }[]>([]);

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

  // Anzeigename änderbar in den Einstellungen → Kopfzeile (u-info) sofort aktualisieren.
  useEffect(() => {
    const onUserUpdated = () => setUser(getUser());
    window.addEventListener('kh:user-updated', onUserUpdated);
    return () => window.removeEventListener('kh:user-updated', onUserUpdated);
  }, []);

  // Nav-Beiträge aktiver Plugins laden (rollen-/aktivierungsgefiltert vom Server).
  useEffect(() => {
    let cancelled = false;
    void pluginsApi
      .contributions()
      .then((r) => {
        if (cancelled) return;
        setPluginNav(
          r.plugins.flatMap((p) => p.nav.map((item) => ({ pluginId: p.pluginId, item }))),
        );
      })
      .catch(() => {
        /* Ohne Plugins bleibt die Navigation unverändert */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  function closeMenu() {
    document.body.classList.remove('menu-open');
    setMenuOpen(false);
    setUserMenuOpen(false);
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
  const settingsHref = admin ? '/admin/konto' : teacher ? '/lehrer/ki' : '/lernende/einstellungen';
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
            if (!open) setUserMenuOpen(false);
          }}
        >
          <span aria-hidden="true">☰</span>
        </button>
        <Link className="brand" href={homeHref}>
          {/* eslint-disable-next-line @next/next/no-img-element -- logoUrl ist eine konfigurierbare Branding-URL (auch data:/extern); next/image bringt hier keinen Vorteil */}
          {logoUrl && <img className="brand-logo" src={logoUrl} alt="" />}
          <span className="name">
            Kompetenz<span>Hub</span>
          </span>
        </Link>
        <div className="appspacer" />

        <div className="appbar-actions">
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
              aria-label={`${user.displayName} · ${roleLabel}`}
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
              <span className="user-caret" aria-hidden="true">
                ▾
              </span>
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
                  onClick={closeMenu}
                >
                  <span className="ic" aria-hidden="true">
                    {item.icon}
                  </span>{' '}
                  {t(item.labelKey)}
                </Link>
              );
            })}

            {pluginNav.length > 0 && (
              <>
                <div
                  className="kh-muted"
                  style={{
                    padding: '12px 12px 4px',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {t('nav.extensions')}
                </div>
                {pluginNav.map(({ pluginId, item }) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={`${pluginId}-${item.id}`}
                      href={item.href}
                      className={active ? 'active' : ''}
                      aria-current={active ? 'page' : undefined}
                      onClick={closeMenu}
                    >
                      <span className="ic" aria-hidden="true">
                        {item.icon}
                      </span>{' '}
                      {pluginT(pluginId, locale, item.labelKey, item.labelKey)}
                    </Link>
                  );
                })}
              </>
            )}
          </nav>
          <div className="mobile-menu-tools">
            <div className="mobile-menu-group">
              <div className="mobile-menu-label">{t('common.language')}</div>
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
            </div>
            <div className="mobile-menu-group">
              <div className="mobile-menu-label">{t('common.theme')}</div>
              <div className="seg" role="group" aria-label={t('common.theme')}>
                {(['light', 'dark', 'gray'] as Theme[]).map((tName) => (
                  <button
                    key={tName}
                    aria-pressed={theme === tName}
                    onClick={() => setTheme(tName)}
                  >
                    {themeLabel[tName]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mobile-user-card">
              <div className="mobile-user-head">
                <span className="avatar">{initials(user.displayName)}</span>
                <div className="u-info">
                  <div className="u-name">{user.displayName}</div>
                  <div className="u-role">{roleLabel}</div>
                </div>
              </div>
              <div className="mobile-user-actions">
                <Link href={settingsHref} onClick={closeMenu}>
                  <span aria-hidden="true">⚙️</span> {t('nav.einstellungen')}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    void handleLogout();
                  }}
                >
                  <span aria-hidden="true">⎋</span> {t('header.logout')}
                </button>
              </div>
            </div>
          </div>
          <div className="sidebar-foot">
            {/* „Kaffee spenden" nur für Lehrpersonen/Admins, nicht für Lernende */}
            {teacher && (
              <a
                className="bmc-link"
                href="https://buymeacoffee.com/potenzialentwickler"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span aria-hidden="true">☕</span> {t('common.buyMeACoffee')}
              </a>
            )}
            {/* AGPLv3 §13: Quellcode für Netzwerk-Nutzer:innen zugänglich machen */}
            <a
              className="source-link"
              href="https://github.com/staubthom/KompetenzHub"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span aria-hidden="true">{'</>'}</span> {t('common.sourceCode')}
            </a>
          </div>
        </aside>

        <main className="main" id="main">
          {children}
        </main>
      </div>

      <div className="scrim" aria-hidden="true" onClick={closeMenu} />
    </>
  );
}
