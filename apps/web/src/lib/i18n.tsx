'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Locale = 'de' | 'fr' | 'it' | 'en';
export const LOCALES: Locale[] = ['de', 'fr', 'it', 'en'];
export const LOCALE_LABEL: Record<Locale, string> = {
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  en: 'English',
};

/**
 * Leichtgewichtige i18n für die SPA: flache, gepunktete Schlüssel je Sprache.
 * Fehlende Übersetzungen fallen definiert auf Deutsch (de) zurück, sonst auf den
 * Schlüssel selbst. Aktive Sprache kommt aus User.locale (persistiert).
 */
const DICT: Record<Locale, Record<string, string>> = {
  de: {
    'nav.matrix': 'Meine Matrix',
    'nav.lernpfad': 'Lernpfad',
    'nav.nachweise': 'Meine Nachweise',
    'nav.modulUeben': 'Modul mit KI üben',
    'nav.einstellungen': 'Einstellungen',
    'nav.dashboard': 'Dashboard',
    'nav.klassen': 'Modulanlässe',
    'nav.module': 'Module & Matrizen',
    'nav.bewerten': 'Bewerten',
    'nav.ki': 'KI-Einstellungen',
    'nav.sectionStudent': 'Lernende',
    'nav.sectionTeacher': 'Lehrperson',
    'header.logout': 'Abmelden',
    'header.roleTeacher': 'Lehrperson',
    'header.roleStudent': 'Lernende:r',
    'header.roleAdmin': 'Administration',
    'common.save': 'Speichern',
    'common.cancel': 'Abbrechen',
    'common.delete': 'Löschen',
    'common.back': 'Zurück',
    'common.loading': 'Lädt…',
    'common.language': 'Sprache',
    'common.theme': 'Anzeigemodus',
    'theme.light': 'Hell',
    'theme.dark': 'Dunkel',
    'theme.gray': 'Grau',
    'login.title': 'KompetenzHub',
    'login.subtitle': 'Anmelden, um fortzufahren',
    'login.asTeacher': 'Als Lehrperson anmelden',
    'login.asStudent': 'Als Lernende:r anmelden',
    'login.devNote': 'Dev-Login für die lokale Entwicklung',
    'settings.title': 'Einstellungen',
    'settings.subtitle': 'Sprache & Anzeigemodus',
    'settings.prefs': 'Darstellung',
    'settings.languageHint':
      'Die Sprache wird bei deinem Konto gespeichert und bleibt nach dem Abmelden erhalten.',
    'settings.saved': 'Einstellungen gespeichert.',
    'settings.aiSection': 'Meine KI-Anbindung',
  },
  fr: {
    'nav.matrix': 'Ma matrice',
    'nav.lernpfad': 'Parcours',
    'nav.nachweise': 'Mes preuves',
    'nav.modulUeben': 'Réviser le module avec l’IA',
    'nav.einstellungen': 'Paramètres',
    'nav.dashboard': 'Tableau de bord',
    'nav.klassen': 'Sessions de module',
    'nav.module': 'Modules & matrices',
    'nav.bewerten': 'Évaluer',
    'nav.ki': 'Paramètres IA',
    'nav.sectionStudent': 'Apprenant·e',
    'nav.sectionTeacher': 'Enseignant·e',
    'header.logout': 'Se déconnecter',
    'header.roleTeacher': 'Enseignant·e',
    'header.roleStudent': 'Apprenant·e',
    'header.roleAdmin': 'Administration',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.back': 'Retour',
    'common.loading': 'Chargement…',
    'common.language': 'Langue',
    'common.theme': 'Apparence',
    'theme.light': 'Clair',
    'theme.dark': 'Sombre',
    'theme.gray': 'Gris',
    'login.title': 'KompetenzHub',
    'login.subtitle': 'Connectez-vous pour continuer',
    'login.asTeacher': 'Se connecter comme enseignant·e',
    'login.asStudent': 'Se connecter comme apprenant·e',
    'login.devNote': 'Connexion dev pour le développement local',
    'settings.title': 'Paramètres',
    'settings.subtitle': 'Langue et apparence',
    'settings.prefs': 'Affichage',
    'settings.languageHint':
      'La langue est enregistrée sur votre compte et conservée après la déconnexion.',
    'settings.saved': 'Paramètres enregistrés.',
    'settings.aiSection': 'Ma connexion IA',
  },
  it: {
    'nav.matrix': 'La mia matrice',
    'nav.lernpfad': 'Percorso',
    'nav.nachweise': 'Le mie prove',
    'nav.modulUeben': 'Esercita il modulo con l’IA',
    'nav.einstellungen': 'Impostazioni',
    'nav.dashboard': 'Cruscotto',
    'nav.klassen': 'Sessioni di modulo',
    'nav.module': 'Moduli e matrici',
    'nav.bewerten': 'Valutare',
    'nav.ki': 'Impostazioni IA',
    'nav.sectionStudent': 'Studente',
    'nav.sectionTeacher': 'Docente',
    'header.logout': 'Esci',
    'header.roleTeacher': 'Docente',
    'header.roleStudent': 'Studente',
    'header.roleAdmin': 'Amministrazione',
    'common.save': 'Salva',
    'common.cancel': 'Annulla',
    'common.delete': 'Elimina',
    'common.back': 'Indietro',
    'common.loading': 'Caricamento…',
    'common.language': 'Lingua',
    'common.theme': 'Aspetto',
    'theme.light': 'Chiaro',
    'theme.dark': 'Scuro',
    'theme.gray': 'Grigio',
    'login.title': 'KompetenzHub',
    'login.subtitle': 'Accedi per continuare',
    'login.asTeacher': 'Accedi come docente',
    'login.asStudent': 'Accedi come studente',
    'login.devNote': 'Accesso dev per lo sviluppo locale',
    'settings.title': 'Impostazioni',
    'settings.subtitle': 'Lingua e aspetto',
    'settings.prefs': 'Visualizzazione',
    'settings.languageHint':
      'La lingua viene salvata nel tuo account e mantenuta dopo la disconnessione.',
    'settings.saved': 'Impostazioni salvate.',
    'settings.aiSection': 'La mia connessione IA',
  },
  en: {
    'nav.matrix': 'My matrix',
    'nav.lernpfad': 'Learning path',
    'nav.nachweise': 'My evidence',
    'nav.modulUeben': 'Practise module with AI',
    'nav.einstellungen': 'Settings',
    'nav.dashboard': 'Dashboard',
    'nav.klassen': 'Module sessions',
    'nav.module': 'Modules & matrices',
    'nav.bewerten': 'Grade',
    'nav.ki': 'AI settings',
    'nav.sectionStudent': 'Learner',
    'nav.sectionTeacher': 'Teacher',
    'header.logout': 'Log out',
    'header.roleTeacher': 'Teacher',
    'header.roleStudent': 'Learner',
    'header.roleAdmin': 'Administration',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.back': 'Back',
    'common.loading': 'Loading…',
    'common.language': 'Language',
    'common.theme': 'Appearance',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.gray': 'Gray',
    'login.title': 'KompetenzHub',
    'login.subtitle': 'Sign in to continue',
    'login.asTeacher': 'Sign in as teacher',
    'login.asStudent': 'Sign in as learner',
    'login.devNote': 'Dev login for local development',
    'settings.title': 'Settings',
    'settings.subtitle': 'Language & appearance',
    'settings.prefs': 'Display',
    'settings.languageHint': 'Your language is stored on your account and kept after you log out.',
    'settings.saved': 'Settings saved.',
    'settings.aiSection': 'My AI connection',
  },
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function normalizeLocale(value: string | null | undefined): Locale {
  return value && (LOCALES as string[]).includes(value) ? (value as Locale) : 'de';
}

export function translate(locale: Locale, key: string): string {
  return DICT[locale]?.[key] ?? DICT.de[key] ?? key;
}

/** Wählt aus einem i18n-JSON-Feld {de,fr,it,en} die aktive Sprache mit DE-Fallback. */
export function localized(
  field: Record<string, string> | undefined | null,
  locale: Locale,
): string {
  if (!field) return '';
  return field[locale] ?? field.de ?? Object.values(field)[0] ?? '';
}

export function LocaleProvider({
  initialLocale = 'de',
  children,
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Beim Mount aus dem gespeicherten User/localStorage übernehmen.
  useEffect(() => {
    const stored = normalizeLocale(localStorage.getItem('kh-locale'));
    setLocaleState(stored);
    document.documentElement.setAttribute('lang', stored);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('kh-locale', l);
    document.documentElement.setAttribute('lang', l);
  }, []);

  const t = useCallback((key: string) => translate(locale, key), [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback ausserhalb des Providers (z. B. SSR): Deutsch.
    return { locale: 'de', setLocale: () => {}, t: (k: string) => translate('de', k) };
  }
  return ctx;
}
