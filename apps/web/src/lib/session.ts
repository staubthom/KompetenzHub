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
  tenantId: string;
  roles: Role[];
}

const TOKEN_KEY = 'kh_token';
const USER_KEY = 'kh_user';

export function saveSession(token: string, user: SessionUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
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

export function isTeacher(user: SessionUser | null): boolean {
  return !!user?.roles.some((r) => r === 'TEACHER' || r === 'ADMIN');
}

/** Wohin nach dem Login je nach Rolle? */
export function homePathForRole(user: SessionUser | null): string {
  return isTeacher(user) ? '/lehrer' : '/lernende';
}

/** Initialen aus dem Anzeigenamen für den Avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
