/**
 * Session-Handling für die SPA.
 *
 * Da das API-JWT als httpOnly-Cookie gesetzt wird (für JS nicht lesbar), legen
 * wir den Token aus der Login-Antwort zusätzlich im localStorage ab und senden
 * ihn als Bearer-Header. Sauberes Muster für ein getrenntes API-Origin.
 */

export type Role = 'TEACHER' | 'LEARNER' | 'ADMIN';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  theme?: string;
  notifyDigest?: boolean;
  tenantId: string;
  roles: Role[];
  /** Plattformweite Super-Admin-Rechte (Mandantenverwaltung). */
  isSuperAdmin?: boolean;
}

const TOKEN_KEY = 'kh_token';
const USER_KEY = 'kh_user';
// Impersonation: Marker (Banner-Info + Rücksprungziel) und Stash der Ursprungs-
// Session (nur relevant, wenn Plattform und Zielschule denselben Origin teilen,
// z. B. localhost – bei echten Subdomains bleibt die Superadmin-Session auf dem
// Plattform-Origin ohnehin unberührt).
const IMP_KEY = 'kh_imp';
const IMP_PREV_KEY = 'kh_imp_prev';

export interface ImpersonationMarker {
  tenantName: string;
  returnUrl: string;
}

export function saveSession(token: string, user: SessionUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Aktualisiert nur das gespeicherte Nutzerprofil (Token bleibt erhalten). */
export function saveUser(user: SessionUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Impersonation (Superadmin schlüpft in Schul-Admin-Rolle) ────────────────

// Muss zum TENANT_OVERRIDE_KEY in api.ts passen. Bewusst als Literal dupliziert,
// da ein Import aus api.ts einen Zyklus erzeugen würde (api.ts importiert session.ts).
const TENANT_OVERRIDE_KEY = 'kh_tenant';

/**
 * Merkt sich die aktuelle (Superadmin-)Session inkl. Tenant-Override, um später
 * zurückzukehren (Same-Origin-Fall, z. B. localhost).
 */
export function stashPreviousSession(): void {
  if (typeof window === 'undefined') return;
  const token = getToken();
  const raw = localStorage.getItem(USER_KEY);
  if (token && raw) {
    const override = localStorage.getItem(TENANT_OVERRIDE_KEY);
    localStorage.setItem(IMP_PREV_KEY, JSON.stringify({ token, user: raw, override }));
  }
}

/**
 * Stellt die gemerkte Ursprungs-Session (inkl. Tenant-Override) wieder her – nur
 * Same-Origin-Fall. Gibt true zurück, wenn eine Session wiederhergestellt wurde.
 */
export function restorePreviousSession(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(IMP_PREV_KEY);
  if (!raw) return false;
  try {
    const { token, user, override } = JSON.parse(raw) as {
      token: string;
      user: string;
      override: string | null;
    };
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, user);
    // Tenant-Override exakt wie zuvor wiederherstellen (sonst würde das Token auf
    // dem Default-Tenant abgelehnt), inkl. Cookie für den serverseitigen Exchange.
    if (override) {
      localStorage.setItem(TENANT_OVERRIDE_KEY, override);
      document.cookie = `${TENANT_OVERRIDE_KEY}=${encodeURIComponent(override)}; path=/; SameSite=Lax`;
    } else {
      localStorage.removeItem(TENANT_OVERRIDE_KEY);
      document.cookie = `${TENANT_OVERRIDE_KEY}=; path=/; Max-Age=0; SameSite=Lax`;
    }
  } catch {
    return false;
  }
  localStorage.removeItem(IMP_PREV_KEY);
  return true;
}

export function saveImpersonationMarker(marker: ImpersonationMarker): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(IMP_KEY, JSON.stringify(marker));
}

export function getImpersonationMarker(): ImpersonationMarker | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(IMP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImpersonationMarker;
  } catch {
    return null;
  }
}

export function clearImpersonation(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(IMP_KEY);
  localStorage.removeItem(IMP_PREV_KEY);
}

export function isTeacher(user: SessionUser | null): boolean {
  return !!user?.roles.some((r) => r === 'TEACHER' || r === 'ADMIN');
}

export function isAdmin(user: SessionUser | null): boolean {
  return !!user?.roles.some((r) => r === 'ADMIN');
}

/** Wohin nach dem Login je nach Rolle? */
export function homePathForRole(user: SessionUser | null): string {
  if (isAdmin(user)) return '/admin';
  return isTeacher(user) ? '/lehrer' : '/lernende';
}

/** Initialen aus dem Anzeigenamen für den Avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
