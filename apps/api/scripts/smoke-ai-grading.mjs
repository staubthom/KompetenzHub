/**
 * Smoke-Test – KI-Bewertungsvorschlag (FA-70) & KI-Feedback (FA-72).
 * Erfordert die API mit AI_STUB_MODE=1 (deterministische KI-Antworten).
 * Läuft gegen die lokale API (http://localhost:3001).
 */
import { trackUser, cleanupUsers } from './_cleanup.mjs';

const BASE = 'http://localhost:3001/api/v1';

let ok = 0;
let fail = 0;

async function req(method, path, body, token) {
  if (path === '/auth/dev-login' && body?.email) trackUser(body.email);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}
function check(label, cond, info = '') {
  if (cond) {
    console.log(`  OK   ${label}`);
    ok++;
  } else {
    console.log(`  FAIL ${label}${info ? ' – ' + info : ''}`);
    fail++;
  }
}

// ── Setup (frische Lehrperson ohne KI-Konfiguration) ──────────────
const teacherEmail = `aig-teacher-${Date.now()}@demo.ch`;
const t = await req('POST', '/auth/dev-login', { email: teacherEmail, role: 'TEACHER' });
const teacher = t.body?.token;
const s = await req('POST', '/auth/dev-login', { email: 'aig-student@demo.ch', role: 'LEARNER' });
const student = s.body?.token;
check('Logins', !!teacher && !!student);

const modNum = `AIG${Date.now()}`;
const mod = await req(
  'POST',
  '/modules',
  { number: modNum, title: { de: 'KI-Grading-Test' } },
  teacher,
);
const moduleId = mod.body?.id;
const detail = await req('GET', `/modules/${moduleId}`, null, teacher);
const matrixId = detail.body?.matrix?.id;
const hz = await req(
  'POST',
  `/modules/${moduleId}/action-goals`,
  { code: '1', text: { de: 'HZ' } },
  teacher,
);
const band = await req(
  'POST',
  `/matrices/${matrixId}/bands`,
  { code: 'A1', actionGoalIds: [hz.body.id] },
  teacher,
);
const fieldId = band.body?.fields?.[0]?.id;
// Deskriptor als Bewertungsraster-Grundlage
await req(
  'PUT',
  `/fields/${fieldId}/descriptor`,
  { text: { de: 'Ich kann ein Netzwerk dokumentieren.' } },
  teacher,
);
const cls = await req('POST', '/classes', { name: 'AIG-Anlass', moduleId }, teacher);
const code = await req('POST', `/classes/${cls.body.id}/join-code`, {}, teacher);
await req('POST', '/classes/join', { code: code.body?.code }, student);
const ev = await req(
  'POST',
  '/evidence',
  {
    moduleId,
    title: { de: 'Netzwerkdoku' },
    instructions: { de: '<p>Dokumentiere dein Netzwerk.</p>' },
    isVisible: true,
    maxPoints: 20,
    fieldIds: [fieldId],
  },
  teacher,
);
const evId = ev.body?.id;
const sub = await req(
  'POST',
  `/evidence/${evId}/submissions`,
  { text: 'Meine Netzwerkdoku mit Topologie.' },
  student,
);
const submissionId = sub.body?.submissionId;
check('Setup vollständig', !!fieldId && !!evId && !!submissionId);

// ── Feature-Gate: ohne KI-Konfiguration → 409 ─────────────────────
const gated = await req('POST', `/submissions/${submissionId}/ai-assessment`, {}, teacher);
check('Ohne KI-Konfiguration → 409', gated.status === 409, `status=${gated.status}`);

// ── KI konfigurieren & aktivieren ─────────────────────────────────
const cfg = await req(
  'PUT',
  '/ai/config',
  {
    provider: 'openai-compatible',
    baseUrl: 'https://stub.invalid/v1',
    model: 'stub-model-1',
    apiKey: 'sk-stub-123456',
    enabled: true,
  },
  teacher,
);
check(
  'KI-Konfiguration gespeichert (API mit AI_STUB_MODE=1 starten!)',
  cfg.status === 200 || cfg.status === 201,
  `status=${cfg.status}`,
);

// ── FA-70: KI-Bewertungsvorschlag ─────────────────────────────────
const a = await req('POST', `/submissions/${submissionId}/ai-assessment`, {}, teacher);
check('POST ai-assessment → 200', a.status === 200, `status=${a.status}`);
check('Vorschlag: Punkte begrenzt auf maxPoints', a.body?.suggestedPoints === 14);
check('Vorschlag: Level gesetzt', a.body?.suggestedLevel === 'INTERMEDIATE');
check(
  'Vorschlag: Feedback vorhanden',
  typeof a.body?.feedback === 'string' && a.body.feedback.length > 0,
);
check(
  'Vorschlag: Begründung je Kriterium',
  Array.isArray(a.body?.reasoning) && a.body.reasoning.length >= 1,
);
check('Vorschlag: Modell protokolliert', a.body?.model === 'stub-model-1');

// Kein Auto-Grading: Status bleibt SUBMITTED bis die Lehrperson bewertet
const stillOpen = await req('GET', `/submissions/${submissionId}`, null, teacher);
check('Kein Auto-Grading (Status SUBMITTED)', stillOpen.body?.status === 'SUBMITTED');

// GET liefert den gespeicherten Vorschlag
const aGet = await req('GET', `/submissions/${submissionId}/ai-assessment`, null, teacher);
check('GET ai-assessment liefert Vorschlag', aGet.body?.suggestedPoints === 14);

// ── FA-72: KI-Feedback-Entwurf ────────────────────────────────────
const fb = await req('POST', `/submissions/${submissionId}/ai-feedback`, {}, teacher);
check('POST ai-feedback → 200', fb.status === 200, `status=${fb.status}`);
check(
  'Feedback-Entwurf vorhanden',
  typeof fb.body?.feedback === 'string' && fb.body.feedback.length > 0,
);

// ── Override: Lehrperson übernimmt/überschreibt ───────────────────
const ovr = await req(
  'POST',
  `/submissions/${submissionId}/evaluation`,
  {
    points: 18,
    level: 'ADVANCED',
    feedback: 'Finale Bewertung der Lehrperson.',
  },
  teacher,
);
check('Override-Bewertung → 200/201', ovr.status === 200 || ovr.status === 201);
const graded = await req('GET', `/submissions/${submissionId}`, null, teacher);
check(
  'Finale Bewertung = Lehrperson (Override)',
  graded.body?.status === 'GRADED' &&
    Number(graded.body?.evaluation?.points) === 18 &&
    graded.body?.evaluation?.achievedLevel === 'ADVANCED',
);

// ── RBAC: Lernende:r darf keine KI-Bewertung anstossen ────────────
const forbidden = await req('POST', `/submissions/${submissionId}/ai-assessment`, {}, student);
check('Lernende:r → 403 auf ai-assessment', forbidden.status === 403);

// ── Aufräumen ─────────────────────────────────────────────────────
await req('DELETE', `/evidence/${evId}`, null, teacher);
await req('DELETE', `/classes/${cls.body.id}`, null, teacher);
await req('DELETE', `/modules/${moduleId}`, null, teacher);
await cleanupUsers(BASE);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
