import { type APIRequestContext, type Page } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type Role = 'TEACHER' | 'LEARNER' | 'ADMIN';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
  tenantId: string;
  locale: string;
  avatarUrl: string | null;
}

export interface LoginResult {
  token: string;
  user: SessionUser;
}

/**
 * Sammelt alle per Dev-Login/Exchange angelegten Test-User, damit sie nach dem
 * Testlauf wieder gelöscht werden können (siehe `cleanupTestUsers`). Geteilte
 * Demo-Konten (lehrperson@/lernende@/admin@demo.ch) werden bewusst NICHT
 * getrackt, damit lokale Demo-Daten erhalten bleiben.
 */
const createdEmails = new Set<string>();

/** Merkt sich eine angelegte Test-E-Mail und gibt sie unverändert zurück. */
export function trackTestUser(email: string): string {
  if (email) createdEmails.add(email);
  return email;
}

/**
 * Löscht alle gemerkten Test-User wieder (best effort) über den Dev-Endpunkt
 * `POST /auth/dev-delete`. In `test.afterAll` jeder Spec aufrufen.
 */
export async function cleanupTestUsers(): Promise<void> {
  for (const email of createdEmails) {
    try {
      await fetch(`${API_BASE}/api/v1/auth/dev-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Aufräumen ist best effort – Fehler hier dürfen den Testlauf nicht kippen.
    }
  }
  createdEmails.clear();
}

/**
 * Meldet sich via Dev-Login-API an und speichert Token + User in localStorage.
 * Navigiert zuerst zu /login um den richtigen Origin zu setzen.
 */
export async function loginAs(page: Page, role: Role, email?: string): Promise<LoginResult> {
  const mail = trackTestUser(email ?? `e2e-${role.toLowerCase()}-${Date.now()}@demo.ch`);
  await page.goto('/login');
  const res = await page.request.post(`${API_BASE}/api/v1/auth/dev-login`, {
    data: { email: mail, role },
  });
  const { token, user } = (await res.json()) as LoginResult;
  await page.evaluate(
    ([t, u]) => {
      localStorage.setItem('kh_token', t as string);
      localStorage.setItem('kh_user', u as string);
    },
    [token, JSON.stringify(user)],
  );
  return { token, user };
}

export async function clearSession(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('kh_token');
    localStorage.removeItem('kh_user');
  });
}

/**
 * Generische API-Hilfsfunktion für Setup/Teardown in beforeAll/afterAll.
 */
export async function api(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const url = `${API_BASE}/api/v1${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const data = body as Record<string, unknown> | undefined;

  // Per API angelegte Test-User für das spätere Aufräumen vormerken.
  if (
    (path === '/auth/dev-login' || path === '/auth/exchange') &&
    typeof data?.email === 'string'
  ) {
    trackTestUser(data.email);
  }

  let res;
  switch (method) {
    case 'POST':
      res = await request.post(url, { headers, data });
      break;
    case 'PATCH':
      res = await request.patch(url, { headers, data });
      break;
    case 'PUT':
      res = await request.put(url, { headers, data });
      break;
    case 'DELETE':
      res = await request.delete(url, { headers });
      break;
    default:
      res = await request.get(url, { headers });
      break;
  }

  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* leer */
  }
  return { status: res.status(), body: json };
}
