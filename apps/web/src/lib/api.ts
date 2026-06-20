import { getToken, saveSession, type Role, type SessionUser } from './session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ title: res.statusText }));
    throw Object.assign(new Error(err.title ?? 'API-Fehler'), { status: res.status, body: err });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

interface AuthResult {
  token: string;
  user: SessionUser;
}

// Auth (Dev-Login für lokale Entwicklung; speichert die Session)
export async function devLogin(email: string, role: Role): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/api/v1/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Login fehlgeschlagen');
  const result = (await res.json()) as AuthResult;
  saveSession(result.token, result.user);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Auch bei Fehler lokal abmelden
  }
}

// Modules (FA-01)
export const modules = {
  list: () => apiFetch<ModuleSummary[]>('/modules'),
  get: (id: string) => apiFetch<ModuleDetail>(`/modules/${id}`),
  create: (data: { number: string; title: { de: string }; description?: { de: string }; profession?: string }) =>
    apiFetch<ModuleSummary>('/modules', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ number: string; title: Record<string,string>; description: Record<string,string>; status: string }>) =>
    apiFetch<ModuleSummary>(`/modules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/modules/${id}`, { method: 'DELETE' }),
};

// Action Goals (FA-02)
export const actionGoals = {
  list: (moduleId: string) => apiFetch<ActionGoal[]>(`/modules/${moduleId}/action-goals`),
  create: (moduleId: string, data: { code: string; text?: { de: string } }) =>
    apiFetch<ActionGoal>(`/modules/${moduleId}/action-goals`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ code: string; text: Record<string,string>; sortOrder: number }>) =>
    apiFetch<ActionGoal>(`/action-goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/action-goals/${id}`, { method: 'DELETE' }),
};

// Matrix / Bands (FA-03)
export const matrix = {
  get: (moduleId: string) => apiFetch<MatrixResponse>(`/modules/${moduleId}/matrix`),
  createBand: (matrixId: string, data: { code: string; description?: { de: string }; actionGoalIds?: string[] }) =>
    apiFetch<Band>(`/matrices/${matrixId}/bands`, { method: 'POST', body: JSON.stringify(data) }),
  updateBand: (id: string, data: Partial<{ code: string; description: Record<string,string>; weight: number; sortOrder: number; actionGoalIds: string[] }>) =>
    apiFetch<Band>(`/bands/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeBand: (id: string) => apiFetch<void>(`/bands/${id}`, { method: 'DELETE' }),
};

// Descriptors (FA-04)
export const descriptors = {
  get: (fieldId: string) => apiFetch<Descriptor>(`/fields/${fieldId}/descriptor`),
  upsert: (fieldId: string, text: Record<string, string>) =>
    apiFetch<Descriptor>(`/fields/${fieldId}/descriptor`, {
      method: 'PUT',
      body: JSON.stringify({ text }),
    }),
};

// Classes (FA-20, 23, 25)
export const classes = {
  list: () => apiFetch<ClassSummary[]>('/classes'),
  get: (id: string) => apiFetch<ClassDetail>(`/classes/${id}`),
  create: (data: { name: string; moduleId?: string; year?: number; schoolYear?: string }) =>
    apiFetch<ClassSummary>('/classes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; moduleId: string | null; status: string }>) =>
    apiFetch<ClassSummary>(`/classes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/classes/${id}`, { method: 'DELETE' }),
  generateJoinCode: (id: string) =>
    apiFetch<JoinCode>(`/classes/${id}/join-code`, { method: 'POST', body: '{}' }),
  join: (code: string) =>
    apiFetch<{ class: { id: string; name: string } }>('/classes/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  members: (id: string) => apiFetch<Member[]>(`/classes/${id}/members`),
  removeMember: (id: string, userId: string) =>
    apiFetch<void>(`/classes/${id}/members/${userId}`, { method: 'DELETE' }),
};

// ── Typen ──────────────────────────────────────────────────────────

export interface ModuleSummary {
  id: string;
  number: string;
  title: Record<string, string>;
  description: Record<string, string>;
  status: string;
  createdAt: string;
  matrix?: { id: string; status: string; _count: { bands: number } };
  _count?: { actionGoals: number };
}

export interface ModuleDetail extends Omit<ModuleSummary, 'matrix'> {
  actionGoals: ActionGoal[];
  matrix: MatrixFull | null;
}

export interface ActionGoal {
  id: string;
  code: string;
  text: Record<string, string>;
  sortOrder: number;
}

export interface MatrixFull {
  id: string;
  bands: Band[];
}

export interface Band {
  id: string;
  code: string;
  description: Record<string, string>;
  weight: number;
  sortOrder: number;
  fields: CompetenceField[];
  actionGoals: { actionGoal: ActionGoal }[];
}

export interface CompetenceField {
  id: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  code: string;
  descriptor: Descriptor | null;
}

export interface Descriptor {
  id: string;
  fieldId: string;
  text: Record<string, string>;
}

export interface MatrixResponse {
  module: { id: string; number: string; title: Record<string, string> };
  matrix: MatrixFull;
}

// ── Klassen ─────────────────────────────────────────────────────────

export interface ClassModuleRef {
  id: string;
  number: string;
  title: Record<string, string>;
}

export interface ClassSummary {
  id: string;
  name: string;
  status: string;
  year: number | null;
  schoolYear: string | null;
  createdAt: string;
  module: ClassModuleRef | null;
  _count?: { enrollments: number };
}

export interface JoinCode {
  id: string;
  code: string;
  expiresAt: string | null;
  isActive: boolean;
}

export interface ClassDetail extends ClassSummary {
  activeJoinCode: JoinCode | null;
}

export interface Member {
  id: string;
  displayName: string;
  status: string;
  joinedAt: string;
  userId: string | null;
  user: { id: string; email: string; displayName: string; avatarUrl: string | null } | null;
}
