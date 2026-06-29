import { getToken, saveSession, saveUser, type Role, type SessionUser } from './session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
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

export interface LoginOptions {
  authProviders: {
    microsoft: boolean;
    google: boolean;
    github: boolean;
  };
  devLoginEnabled: boolean;
  showAdminLogin: boolean;
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

export async function getLoginOptions(): Promise<LoginOptions> {
  const res = await fetch(`${API_BASE}/api/v1/auth/options`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Login-Optionen konnten nicht geladen werden');
  return res.json() as Promise<LoginOptions>;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Auch bei Fehler lokal abmelden
  }
}

/** FA-10: Sprache/Anzeigemodus/Anzeigename speichern (überlebt Logout); aktualisiert die Session. */
export async function updatePreferences(prefs: {
  locale?: string;
  theme?: string;
  displayName?: string;
  notifyDigest?: boolean;
}): Promise<SessionUser> {
  const user = await apiFetch<SessionUser>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  });
  saveUser(user);
  return user;
}

// Modules (FA-01)
export const modules = {
  list: () => apiFetch<ModuleSummary[]>('/modules'),
  get: (id: string) => apiFetch<ModuleDetail>(`/modules/${id}`),
  create: (data: {
    number: string;
    title: { de: string };
    description?: { de: string };
    profession?: string;
  }) => apiFetch<ModuleSummary>('/modules', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: Partial<{
      number: string;
      title: Record<string, string>;
      description: Record<string, string>;
      status: string;
    }>,
  ) => apiFetch<ModuleSummary>(`/modules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/modules/${id}`, { method: 'DELETE' }),
};

// Action Goals (FA-02)
export const actionGoals = {
  list: (moduleId: string) => apiFetch<ActionGoal[]>(`/modules/${moduleId}/action-goals`),
  create: (moduleId: string, data: { code: string; text?: { de: string } }) =>
    apiFetch<ActionGoal>(`/modules/${moduleId}/action-goals`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (
    id: string,
    data: Partial<{ code: string; text: Record<string, string>; sortOrder: number }>,
  ) => apiFetch<ActionGoal>(`/action-goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/action-goals/${id}`, { method: 'DELETE' }),
};

// Matrix / Bands (FA-03)
export const matrix = {
  /**
   * Matrix eines Moduls. Lehrpersonen/Admins können mit `enrollmentId` die Sicht
   * einer bestimmten lernenden Person laden (Einreichungs-Status & Punkte je Nachweis).
   */
  get: (moduleId: string, enrollmentId?: string) =>
    apiFetch<MatrixResponse>(
      `/modules/${moduleId}/matrix${enrollmentId ? `?enrollmentId=${encodeURIComponent(enrollmentId)}` : ''}`,
    ),
  createBand: (
    matrixId: string,
    data: { code: string; description?: { de: string }; actionGoalIds?: string[] },
  ) =>
    apiFetch<Band>(`/matrices/${matrixId}/bands`, { method: 'POST', body: JSON.stringify(data) }),
  updateBand: (
    id: string,
    data: Partial<{
      code: string;
      description: Record<string, string>;
      weight: number;
      sortOrder: number;
      actionGoalIds: string[];
    }>,
  ) => apiFetch<Band>(`/bands/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
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

// Classes (FA-20, 23, 25, 103)
export const classes = {
  list: (archived = false) =>
    apiFetch<ClassSummary[]>(`/classes${archived ? '?archived=true' : ''}`),
  mine: () => apiFetch<MyEnrollment[]>('/classes/mine'),
  get: (id: string) => apiFetch<ClassDetail>(`/classes/${id}`),
  archive: (id: string) =>
    apiFetch<{ id: string; status: string }>(`/classes/${id}/archive`, { method: 'POST' }),
  restore: (id: string) =>
    apiFetch<{ id: string; status: string }>(`/classes/${id}/restore`, { method: 'POST' }),
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
  coTeachers: (id: string) => apiFetch<CoTeacher[]>(`/classes/${id}/co-teachers`),
  addCoTeacher: (id: string, email: string) =>
    apiFetch<CoTeacher>(`/classes/${id}/co-teachers`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  removeCoTeacher: (id: string, userId: string) =>
    apiFetch<void>(`/classes/${id}/co-teachers/${userId}`, { method: 'DELETE' }),
};

// Evidence / Kompetenznachweise (FA-30, 36, 40)
export const evidence = {
  // Lehrer
  list: (moduleId: string) => apiFetch<Evidence[]>(`/evidence?moduleId=${moduleId}`),
  create: (data: EvidenceInput) =>
    apiFetch<Evidence>('/evidence', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<EvidenceInput>) =>
    apiFetch<Evidence>(`/evidence/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/evidence/${id}`, { method: 'DELETE' }),
  // Lernende
  studentList: () => apiFetch<StudentEvidence[]>('/evidence/student/list'),
  studentGet: (id: string) => apiFetch<StudentEvidence>(`/evidence/student/${id}`),
  requestUpload: (
    id: string,
    fileName: string,
    contentType: string,
    sizeBytes: number,
    kind: 'file' | 'screenshot' = 'file',
  ) =>
    apiFetch<{ uploadUrl: string; key: string }>(`/evidence/${id}/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ fileName, contentType, sizeBytes, kind }),
    }),
  /** Zentrale Einreichung: Text + Link + Dateien/Screenshots zusammen. */
  submit: (
    id: string,
    payload: {
      text?: string;
      link?: string;
      files?: { key: string; name: string; kind: 'file' | 'screenshot' }[];
    },
  ) =>
    apiFetch<{ submissionId: string; status: string }>(`/evidence/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

/** Lade eine Datei/Screenshot zur Einreichung hoch → liefert Storage-Key. */
export async function uploadSubmissionFile(
  evidenceId: string,
  file: Blob,
  fileName: string,
  kind: 'file' | 'screenshot' = 'file',
): Promise<string> {
  const contentType =
    file.type || (kind === 'screenshot' ? 'image/png' : 'application/octet-stream');
  const { uploadUrl, key } = await evidence.requestUpload(
    evidenceId,
    fileName,
    contentType,
    file.size,
    kind,
  );
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!put.ok) throw new Error('Upload zum Speicher fehlgeschlagen.');
  return key;
}

// Dashboard / Fortschritt (FA-90, 91)
export const dashboard = {
  progress: (classId: string) => apiFetch<ClassProgress>(`/classes/${classId}/progress`),
};

// ── Plugin-Plattform (P3 Frontend-Extension-Points) ─────────────────
export interface PluginNavItem {
  id: string;
  labelKey: string;
  icon: string;
  href: string;
  roles: string[];
}
export interface PluginSlotComponent {
  slot: string;
  component: string;
  labelKey: string;
  icon?: string;
  roles: string[];
}
export interface PluginContribution {
  pluginId: string;
  nav: PluginNavItem[];
  pages: { route: string; component: string; roles: string[] }[];
  widgets: { slot: string; component: string; roles: string[] }[];
  /** Aktions-Buttons in Zeilen/Toolbars (Slot erhält Zeilenkontext). */
  actions: PluginSlotComponent[];
  /** Zusätzliche Tabs auf bestehenden Seiten. */
  tabs: PluginSlotComponent[];
}

export const pluginsApi = {
  /** UI-Beiträge der für den aktuellen User aktiven Plugins. */
  contributions: () => apiFetch<{ plugins: PluginContribution[] }>('/plugins/contributions'),
};

export interface AdminPluginItem {
  pluginId: string;
  displayName: string;
  installedVersion: string;
  installStatus: string;
  enabled: boolean;
  tenantStatus: string;
  config: Record<string, unknown>;
  configVersion: number;
  capabilities: string[];
}

/** Schuladmin-Verwaltung der Plugins (P4). Nur ADMIN. */
export const adminPlugins = {
  list: () => apiFetch<AdminPluginItem[]>('/admin/plugins'),
  enable: (id: string) =>
    apiFetch<unknown>(`/admin/plugins/${id}/enable`, { method: 'POST', body: '{}' }),
  disable: (id: string) =>
    apiFetch<unknown>(`/admin/plugins/${id}/disable`, { method: 'POST', body: '{}' }),
  configure: (id: string, config: Record<string, unknown>) =>
    apiFetch<unknown>(`/admin/plugins/${id}/config`, {
      method: 'PATCH',
      body: JSON.stringify({ config }),
    }),
  uninstall: (id: string) =>
    apiFetch<{
      pluginId: string;
      removedSecrets: number;
      removedStorage: number;
      removedData: number;
    }>(`/admin/plugins/${id}/uninstall`, { method: 'POST', body: '{}' }),
};

/** Ruft einen Endpunkt eines Plugins auf (/plugins/<id><path>); nutzt Auth/Fehlerbehandlung. */
export function pluginFetch<T = unknown>(
  pluginId: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return apiFetch<T>(`/plugins/${pluginId}${path}`, options);
}

// KI-Konfiguration je Lehrperson (FA-34)
export const ai = {
  getConfig: () => apiFetch<AiConfig>('/ai/config'),
  saveConfig: (data: AiConfigInput) =>
    apiFetch<AiConfig>('/ai/config', { method: 'PUT', body: JSON.stringify(data) }),
  test: (data: AiConfigInput) =>
    apiFetch<AiTestResult>('/ai/config/test', { method: 'POST', body: JSON.stringify(data) }),
  status: () => apiFetch<{ configured: boolean; enabled: boolean }>('/ai/status'),
};

// Lernpfade (FA-84)
export const learningPaths = {
  list: (matrixId: string) => apiFetch<LearningPath[]>(`/matrices/${matrixId}/paths`),
  create: (matrixId: string, data: { name: string; fieldIds: string[]; isActive?: boolean }) =>
    apiFetch<LearningPath>(`/matrices/${matrixId}/paths`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; fieldIds?: string[]; isActive?: boolean }) =>
    apiFetch<LearningPath>(`/paths/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/paths/${id}`, { method: 'DELETE' }),
  activeForModule: (moduleId: string) =>
    apiFetch<ActiveLearningPath>(`/modules/${moduleId}/learning-path`),
};

// KI-Fachgespräch / Übungsmodus (FA-80)
export const expertTalk = {
  available: () => apiFetch<{ available: boolean }>('/expert-talk/available'),
  list: () => apiFetch<ExpertTalkSummary[]>('/expert-talk/sessions'),
  create: (topic: string, context?: string) =>
    apiFetch<ExpertTalkSession>('/expert-talk/sessions', {
      method: 'POST',
      body: JSON.stringify({ topic, context }),
    }),
  createModule: (moduleId: string) =>
    apiFetch<ExpertTalkSession>('/expert-talk/module-sessions', {
      method: 'POST',
      body: JSON.stringify({ moduleId }),
    }),
  get: (id: string) => apiFetch<ExpertTalkSession>(`/expert-talk/sessions/${id}`),
  send: (id: string, content: string) =>
    apiFetch<ExpertTalkMessage>(`/expert-talk/sessions/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  complete: (id: string) =>
    apiFetch<ExpertTalkSession>(`/expert-talk/sessions/${id}/complete`, { method: 'POST' }),
};

// Rich-Text-Assets (Bild-Upload vom PC)
export const assets = {
  imageUploadUrl: (fileName: string, contentType: string, sizeBytes: number) =>
    apiFetch<{ uploadUrl: string; publicUrl: string }>('/assets/image-upload-url', {
      method: 'POST',
      body: JSON.stringify({ fileName, contentType, sizeBytes }),
    }),
  attachmentUploadUrl: (fileName: string, contentType: string) =>
    apiFetch<{ uploadUrl: string; key: string }>('/assets/attachment-upload-url', {
      method: 'POST',
      body: JSON.stringify({ fileName, contentType }),
    }),
};

/** Lehrer-Anhang hochladen → liefert {key, name}. */
export async function uploadAttachment(file: File): Promise<{ key: string; name: string }> {
  const { uploadUrl, key } = await assets.attachmentUploadUrl(
    file.name,
    file.type || 'application/octet-stream',
  );
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!put.ok) throw new Error('Anhang-Upload fehlgeschlagen.');
  return { key, name: file.name };
}

// Submissions / Bewertung (FA-50, 53, 60, 62, 65)
export const submissions = {
  list: (params?: { status?: string; classId?: string; evidenceId?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.classId) q.set('classId', params.classId);
    if (params?.evidenceId) q.set('evidenceId', params.evidenceId);
    const qs = q.toString();
    return apiFetch<SubmissionListItem[]>(`/submissions${qs ? `?${qs}` : ''}`);
  },
  detail: (id: string) => apiFetch<SubmissionDetail>(`/submissions/${id}`),
  history: (id: string) => apiFetch<HistoryEntry[]>(`/submissions/${id}/history`),
  evaluate: (id: string, data: { points?: number; level?: string; feedback?: string }) =>
    apiFetch<unknown>(`/submissions/${id}/evaluation`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  reject: (id: string, reason: string) =>
    apiFetch<unknown>(`/submissions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  // KI (FA-70/72)
  aiAssessment: (id: string) =>
    apiFetch<AiAssessment>(`/submissions/${id}/ai-assessment`, { method: 'POST' }),
  getAiAssessment: (id: string) =>
    apiFetch<AiAssessment | null>(`/submissions/${id}/ai-assessment`),
  aiFeedback: (id: string) =>
    apiFetch<{ feedback: string }>(`/submissions/${id}/ai-feedback`, { method: 'POST' }),
};

/** Bild vom PC hochladen → liefert die einbettbare öffentliche URL. */
export async function uploadRichTextImage(file: File): Promise<string> {
  const { uploadUrl, publicUrl } = await assets.imageUploadUrl(
    file.name,
    file.type || 'image/png',
    file.size,
  );
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'image/png' },
    body: file,
  });
  if (!put.ok) throw new Error('Bild-Upload fehlgeschlagen.');
  return publicUrl;
}

// ── Matrix-Export/-Import als ZIP (FA-100) ──────────────────────────

/** Lädt eine Matrix als ZIP herunter (matrix.json + assets/). */
export async function exportMatrixZip(matrixId: string): Promise<{ blob: Blob; filename: string }> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/v1/matrices/${matrixId}/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ title: res.statusText }));
    throw Object.assign(new Error(err.title ?? 'Export fehlgeschlagen'), {
      status: res.status,
      body: err,
    });
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const m = cd.match(/filename="?([^"]+)"?/);
  return { blob, filename: m?.[1] ?? `modul-${matrixId}.zip` };
}

/** Lädt ein Modulanlass-Archiv als ZIP herunter (inkl. Abgaben/Bewertungen/Dateien). */
export async function exportClassArchiveZip(
  classId: string,
): Promise<{ blob: Blob; filename: string }> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/v1/classes/${classId}/archive-export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ title: res.statusText }));
    throw Object.assign(new Error(err.title ?? 'Export fehlgeschlagen'), {
      status: res.status,
      body: err,
    });
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const m = cd.match(/filename="?([^"]+)"?/);
  return { blob, filename: m?.[1] ?? `modulanlass-${classId}.zip` };
}

/** Importiert ein Modulanlass-Archiv (ZIP) → read-only archivierter Modulanlass. */
export async function importClassArchiveZip(
  file: File,
): Promise<{ classId: string; name: string }> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/v1/classes/archive-import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ title: res.statusText }));
    throw Object.assign(new Error(err.title ?? 'Import fehlgeschlagen'), {
      status: res.status,
      body: err,
    });
  }
  return res.json() as Promise<{ classId: string; name: string }>;
}

/** Importiert ein ZIP-Paket → neues Modul. */
export async function importMatrixZip(
  file: File,
): Promise<{ moduleId: string; matrixId: string; number: string }> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/v1/matrices/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ title: res.statusText }));
    throw Object.assign(new Error(err.title ?? 'Import fehlgeschlagen'), {
      status: res.status,
      body: err,
    });
  }
  return res.json() as Promise<{ moduleId: string; matrixId: string; number: string }>;
}

// ── Typen ──────────────────────────────────────────────────────────

export interface AiConfig {
  provider: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  shareWithLearners: boolean;
  hasApiKey: boolean;
  apiKeyMask: string | null;
  updatedAt: string | null;
}

export interface AiConfigInput {
  provider?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string | null; // weglassen = unverändert; '' = löschen
  enabled?: boolean;
  shareWithLearners?: boolean;
}

export interface AiTestResult {
  ok: boolean;
  message: string;
  models?: string[];
}

export interface AiAssessment {
  id: string;
  suggestedPoints: number | null;
  suggestedLevel: string | null;
  feedback: string;
  reasoning: { criterion: string; comment: string }[];
  model: string | null;
  createdAt: string;
}

export interface LearningPathStepDef {
  id: string;
  fieldId: string;
  code: string;
  level: string;
  sortOrder: number;
}

export interface LearningPath {
  id: string;
  name: string;
  isActive: boolean;
  steps: LearningPathStepDef[];
}

export interface ActivePathStep {
  id: string;
  fieldId: string;
  code: string;
  level: string;
  bandCode: string;
  descriptor: Record<string, string> | null;
  status: 'OPEN' | 'SUBMITTED' | 'GRADED' | 'REJECTED';
  isNext: boolean;
  evidences: {
    id: string;
    title: Record<string, string>;
    status: 'OPEN' | 'SUBMITTED' | 'GRADED' | 'REJECTED';
  }[];
}

export interface ActiveLearningPath {
  module: { number: string; title: Record<string, string> } | null;
  path: {
    id: string;
    name: string;
    steps: ActivePathStep[];
    doneCount: number;
    total: number;
    hasEnrollment: boolean;
  } | null;
}

export interface ExpertTalkMessage {
  id: string;
  role: string; // "user" | "assistant"
  content: string;
  createdAt: string;
}

export interface ExpertTalkSession {
  id: string;
  topic: string;
  mode?: string; // topic | module
  status: string; // ACTIVE | COMPLETED
  createdAt: string;
  messages: ExpertTalkMessage[];
}

export interface ExpertTalkSummary {
  id: string;
  topic: string;
  mode?: string;
  status: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

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
  evidences?: { evidence: FieldEvidence }[];
}

/** Kompaktdarstellung eines Nachweises in der Matrix. */
export interface FieldEvidence {
  id: string;
  title: Record<string, string>;
  instructions: Record<string, string>;
  isVisible: boolean;
  dueAt: string | null;
  maxPoints: string | null;
  config: EvidenceConfig;
  _count?: { submissions: number };
  /** Letzte Einreichung der betrachteten Person (für Chip-Status, Punkte & Nachbewerten). */
  submissions?: { id: string; status: string; points: string | null }[];
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
  /** true, wenn die aktuelle Lehrperson nur Co-Leitung ist (nicht Besitzerin). */
  isCoLeader?: boolean;
}

export interface CoTeacher {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  since?: string;
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

export interface MyEnrollment {
  enrollmentId: string;
  joinedAt: string;
  class: {
    id: string;
    name: string;
    status: string;
    module: ClassModuleRef | null;
  };
}

export interface Member {
  id: string;
  displayName: string;
  status: string;
  joinedAt: string;
  userId: string | null;
  user: { id: string; email: string; displayName: string; avatarUrl: string | null } | null;
}

// ── Kompetenznachweise (Upload: Datei / Link / Text) ────────────────

export interface EvidenceConfig {
  allowedFileTypes?: string[];
  maxFileSizeMb?: number;
  allowFile?: boolean;
  allowLink?: boolean;
  allowText?: boolean;
  allowScreenshot?: boolean;
  allowPaste?: boolean;
  allowExpertTalk?: boolean;
  attachmentKey?: string;
  attachmentName?: string;
}

export interface EvidenceInput {
  moduleId?: string;
  title?: Record<string, string>;
  /** Rich-Text-Beschreibung (HTML). */
  instructions?: Record<string, string>;
  maxPoints?: number;
  isVisible?: boolean;
  dueAt?: string | null;
  sortOrder?: number;
  config?: EvidenceConfig;
  fieldIds?: string[];
}

export interface Evidence {
  id: string;
  moduleId: string;
  type: string;
  title: Record<string, string>;
  instructions: Record<string, string>;
  maxPoints: string | null;
  isVisible: boolean;
  dueAt: string | null;
  sortOrder: number;
  config: EvidenceConfig;
  fields: { evidenceId: string; fieldId: string }[];
  _count?: { submissions: number };
}

export interface LastSubmission {
  id: string;
  status: string;
  points: string | null;
  achievedLevel: string | null;
  feedback: string | null;
  rejectionReason: string | null;
}

export interface StudentEvidence {
  id: string;
  type: string;
  title: Record<string, string>;
  instructions: Record<string, string>;
  maxPoints: string | null;
  dueAt: string | null;
  isOverdue: boolean;
  config: EvidenceConfig;
  attachmentUrl: string | null;
  lastSubmission: LastSubmission | null;
}

// ── Submissions / Bewertung ─────────────────────────────────────────

export interface SubmissionListItem {
  id: string;
  status: string;
  submittedAt: string | null;
  points: string | null;
  evidence: {
    id: string;
    title: Record<string, string>;
    maxPoints: string | null;
    dueAt: string | null;
  };
  enrollment: { id: string; displayName: string; class: { id: string; name: string } | null };
}

export interface HistoryEntry {
  id: string;
  changeType: string;
  achievedLevel: string | null;
  points: string | null;
  feedback: string | null;
  source: string;
  createdAt: string;
  changedBy: { displayName: string };
}

// ── Dashboard ───────────────────────────────────────────────────────

export interface ProgressCell {
  status: 'OPEN' | 'SUBMITTED' | 'REJECTED' | 'GRADED';
  points: number | null;
  maxPoints: number | null;
}
export interface ProgressStudent {
  enrollmentId: string;
  displayName: string;
  cells: Record<string, ProgressCell>;
  gradedFields: number;
  toGradeCount: number;
  progress: number;
  /** Summe der bewerteten Punkte über das ganze Modul. */
  earnedPoints: number;
  /** Erreichte Punkte je Nachweis (null = noch nicht bewertet). */
  evidencePoints: Record<string, number | null>;
}

export interface ProgressEvidence {
  id: string;
  title: Record<string, string>;
  maxPoints: number | null;
}
export interface ProgressField {
  id: string;
  code: string;
  level: string;
  evidenceCount: number;
}
export interface ClassProgress {
  class: { id: string; name: string };
  module: { id: string; number: string; title: Record<string, string> } | null;
  studentCount: number;
  toGrade: number;
  graded: number;
  avgProgress: number;
  /** Maximal erreichbare Punkte des gesamten Moduls. */
  maxPoints: number;
  /** Eindeutige Nachweise (Aufgaben) des Moduls – für CSV-Export. */
  evidences: ProgressEvidence[];
  bands: {
    id: string;
    code: string;
    description: Record<string, string>;
    fields: ProgressField[];
  }[];
  fieldStats: { fieldId: string; gradedCount: number; percent: number }[];
  students: ProgressStudent[];
}

export interface SubmissionDetail {
  id: string;
  status: string;
  content: {
    kind?: string;
    text?: string;
    link?: string;
    files?: { key: string; name: string; kind: string }[];
    expertTalk?: boolean;
  };
  fileKey: string | null;
  fileName: string | null;
  fileUrl: string | null;
  files?: { name: string; kind: string; url: string }[];
  submittedAt: string | null;
  points: string | null;
  evidence: {
    id: string;
    title: Record<string, string>;
    instructions: Record<string, string>;
    maxPoints: string | null;
    dueAt: string | null;
  };
  enrollment: { displayName: string; class: { id: string; name: string } | null };
  evaluation: {
    points: string | null;
    achievedLevel: string | null;
    feedback: string;
    rejectionReason: string | null;
  } | null;
  history: HistoryEntry[];
}

// ── Schuladmin-Dashboard (Sprint 11) ───────────────────────────
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: Role;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: string;
  createdAt: string;
}

export interface AdminOverview {
  admins: number;
  teachers: number;
  learners: number;
  disabled: number;
  pendingInvites: number;
  modules: number;
  classes: number;
}

export interface AdminSettings {
  schoolName: string;
  logoUrl: string | null;
  primaryColor: string;
  defaultLocale: string;
  authProviders: { microsoft: boolean; google: boolean; github: boolean };
  devLoginEnabled: boolean;
  adminEmailsConfigured: boolean;
}

export interface Branding {
  logoUrl: string | null;
  displayName: string | null;
  primaryColor: string | null;
}

export interface AdminOps {
  health: { status: string; db: string; redis: string; s3: string; version: string };
  usage: {
    users: number;
    teachers: number;
    learners: number;
    modules: number;
    classes: number;
    evidences: number;
    submissions: number;
    storageBytes: number | null;
    logins7: number;
    logins30: number;
  };
}

export interface AuditEntry {
  id: string;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
  ip: string | null;
  userAgent: string | null;
  user: { id: string; displayName: string; email: string } | null;
}

/** Schul-Branding (Logo, Akzentfarbe) – für die Kopfzeile, alle Rollen. */
export const branding = {
  get: () => apiFetch<Branding>('/branding'),
};

export const admin = {
  overview: () => apiFetch<AdminOverview>('/admin/overview'),
  users: () => apiFetch<AdminUser[]>('/admin/users'),
  setRole: (id: string, role: Role) =>
    apiFetch<AdminUser>(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  setStatus: (id: string, active: boolean) =>
    apiFetch<AdminUser>(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),
  updateUser: (id: string, displayName: string) =>
    apiFetch<AdminUser>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ displayName }),
    }),
  removeUser: (id: string) => apiFetch<void>(`/admin/users/${id}`, { method: 'DELETE' }),
  invitations: () => apiFetch<Invitation[]>('/admin/invitations'),
  invite: (email: string, role: Role) =>
    apiFetch<Invitation>('/admin/invitations', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  revokeInvitation: (id: string) =>
    apiFetch<void>(`/admin/invitations/${id}`, { method: 'DELETE' }),
  settings: () => apiFetch<AdminSettings>('/admin/settings'),
  updateSettings: (dto: {
    schoolName?: string;
    authProviders?: { microsoft?: boolean; google?: boolean; github?: boolean };
    logoUrl?: string | null;
    primaryColor?: string;
    defaultLocale?: string;
  }) =>
    apiFetch<AdminSettings>('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  ops: () => apiFetch<AdminOps>('/admin/ops'),
  audit: (limit = 100) => apiFetch<AuditEntry[]>(`/admin/audit?limit=${limit}`),
  // E-Mail-Benachrichtigungen: geplante Läufe manuell auslösen
  runDigest: () =>
    apiFetch<{ mails: number }>('/admin/notifications/digest-run', {
      method: 'POST',
      body: '{}',
    }),
  runWeeklyReport: () =>
    apiFetch<{ mails: number }>('/admin/notifications/weekly-report-run', {
      method: 'POST',
      body: '{}',
    }),
  runInviteReminders: () =>
    apiFetch<{ mails: number }>('/admin/notifications/invite-reminders-run', {
      method: 'POST',
      body: '{}',
    }),
  // E-Mail-Vorlagen
  mailTemplates: () => apiFetch<MailTemplate[]>('/admin/mail-templates'),
  updateMailTemplate: (
    type: string,
    locale: string,
    data: { subject?: string | null; body?: string | null },
  ) =>
    apiFetch<void>(`/admin/mail-templates/${type}/${locale}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  resetMailTemplate: (type: string, locale: string) =>
    apiFetch<void>(`/admin/mail-templates/${type}/${locale}`, { method: 'DELETE' }),
};

export interface MailTemplate {
  type: string;
  locale: string;
  subject: string;
  body: string;
  defaultSubject: string;
  defaultBody: string;
  customized: boolean;
  placeholders: string[];
}

/** Voll-Backup (DB-Daten + Dateien) als ZIP herunterladen. */
export async function exportBackupZip(): Promise<{ blob: Blob; filename: string }> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/v1/admin/backup`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ title: res.statusText }));
    throw Object.assign(new Error(err.title ?? 'Backup fehlgeschlagen'), {
      status: res.status,
      body: err,
    });
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const m = cd.match(/filename="?([^"]+)"?/);
  return { blob, filename: m?.[1] ?? 'kompetenzhub-backup.zip' };
}
