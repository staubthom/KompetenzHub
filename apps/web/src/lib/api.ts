import { getToken, saveSession, type Role, type SessionUser } from './session';

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
  get: (moduleId: string) => apiFetch<MatrixResponse>(`/modules/${moduleId}/matrix`),
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

// Classes (FA-20, 23, 25)
export const classes = {
  list: () => apiFetch<ClassSummary[]>('/classes'),
  mine: () => apiFetch<MyEnrollment[]>('/classes/mine'),
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

// KI-Konfiguration je Lehrperson (FA-34)
export const ai = {
  getConfig: () => apiFetch<AiConfig>('/ai/config'),
  saveConfig: (data: AiConfigInput) =>
    apiFetch<AiConfig>('/ai/config', { method: 'PUT', body: JSON.stringify(data) }),
  test: (data: AiConfigInput) =>
    apiFetch<AiTestResult>('/ai/config/test', { method: 'POST', body: JSON.stringify(data) }),
  status: () => apiFetch<{ configured: boolean; enabled: boolean }>('/ai/status'),
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

// ── Typen ──────────────────────────────────────────────────────────

export interface AiConfig {
  provider: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
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

export interface ExpertTalkMessage {
  id: string;
  role: string; // "user" | "assistant"
  content: string;
  createdAt: string;
}

export interface ExpertTalkSession {
  id: string;
  topic: string;
  status: string; // ACTIVE | COMPLETED
  createdAt: string;
  messages: ExpertTalkMessage[];
}

export interface ExpertTalkSummary {
  id: string;
  topic: string;
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
  /** Letzte Einreichung des/der aufrufenden Lernenden (für Chip-Status). */
  submissions?: { status: string }[];
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
  evidence: { id: string; title: Record<string, string>; maxPoints: string | null };
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
