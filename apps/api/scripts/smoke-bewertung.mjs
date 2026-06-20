/**
 * Smoke-Test Sprint 5 – Einreichung & Bewertung (FA-50, 53, 60, 62, 65)
 * Läuft gegen die lokale API (http://localhost:3001).
 */
const BASE = 'http://localhost:3001/api/v1';

let ok = 0;
let fail = 0;

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}
function check(label, cond, info = '') {
  if (cond) { console.log(`  OK   ${label}`); ok++; }
  else { console.log(`  FAIL ${label}${info ? ' – ' + info : ''}`); fail++; }
}

// ── Setup ─────────────────────────────────────────────────────────
const t = await req('POST', '/auth/dev-login', { email: 'bew-teacher@demo.ch', role: 'TEACHER' });
const teacher = t.body?.token;
const s = await req('POST', '/auth/dev-login', { email: 'bew-student@demo.ch', role: 'LEARNER' });
const student = s.body?.token;
check('Logins', !!teacher && !!student);

const modNum = `BEW${Date.now()}`;
const mod = await req('POST', '/modules', { number: modNum, title: { de: 'Bewertungs-Test' } }, teacher);
const moduleId = mod.body?.id;
const detail = await req('GET', `/modules/${moduleId}`, null, teacher);
const matrixId = detail.body?.matrix?.id;
const hz = await req('POST', `/modules/${moduleId}/action-goals`, { code: '1', text: { de: 'HZ' } }, teacher);
const band = await req('POST', `/matrices/${matrixId}/bands`, { code: 'A1', actionGoalIds: [hz.body.id] }, teacher);
const fieldId = band.body?.fields?.[0]?.id;
const cls = await req('POST', '/classes', { name: 'Bew-Anlass', moduleId }, teacher);
const code = await req('POST', `/classes/${cls.body.id}/join-code`, {}, teacher);
await req('POST', '/classes/join', { code: code.body?.code }, student);
const ev = await req('POST', '/evidence', {
  moduleId, title: { de: 'Doku einreichen' }, isVisible: true, maxPoints: 20, fieldIds: [fieldId],
}, teacher);
const evId = ev.body?.id;
check('Setup vollständig', !!fieldId && !!evId);

// ── FA-50: Lernende:r reicht ein ──────────────────────────────────
const sub = await req('POST', `/evidence/${evId}/submissions`, { text: 'Meine Doku.' }, student);
const submissionId = sub.body?.submissionId;
check('Einreichung → submitted', sub.body?.status === 'SUBMITTED' && !!submissionId);

// FA-53: Status in Lernenden-Sicht
const sv1 = await req('GET', `/evidence/student/${evId}`, null, student);
check('Lernenden-Status = submitted', sv1.body?.lastSubmission?.status === 'SUBMITTED');

// ── Bewertungs-Queue (Lehrperson) ─────────────────────────────────
const queue = await req('GET', '/submissions?status=SUBMITTED', null, teacher);
check('Queue enthält Einreichung', Array.isArray(queue.body) && queue.body.some((x) => x.id === submissionId));

const studentQueue = await req('GET', '/submissions', null, student);
check('Student darf Queue nicht sehen → 403', studentQueue.status === 403);

// Detail mit Student-Inhalt
const det = await req('GET', `/submissions/${submissionId}`, null, teacher);
check('Detail → 200 mit Inhalt', det.status === 200 && det.body?.content?.text === 'Meine Doku.');

// ── FA-62: Zurückweisen ───────────────────────────────────────────
const rejectNoReason = await req('POST', `/submissions/${submissionId}/reject`, {}, teacher);
check('Zurückweisen ohne Begründung → 422', rejectNoReason.status === 422);

const reject = await req('POST', `/submissions/${submissionId}/reject`, { reason: 'Bitte Topologie ergänzen.' }, teacher);
check('Zurückweisen mit Begründung → 200', reject.status === 200 || reject.status === 201);

const svRejected = await req('GET', `/evidence/student/${evId}`, null, student);
check('Lernende:r sieht rejected + Begründung',
  svRejected.body?.lastSubmission?.status === 'REJECTED'
  && svRejected.body?.lastSubmission?.rejectionReason?.includes('Topologie'));

// ── FA-50: erneute Einreichung nach Rückweisung ───────────────────
const sub2 = await req('POST', `/evidence/${evId}/submissions`, { text: 'Doku v2 mit Topologie.' }, student);
const submissionId2 = sub2.body?.submissionId;
check('Erneute Einreichung möglich', sub2.body?.status === 'SUBMITTED' && submissionId2 !== submissionId);

// ── FA-60: Bewerten ───────────────────────────────────────────────
const tooMany = await req('POST', `/submissions/${submissionId2}/evaluation`, { points: 99 }, teacher);
check('Punkte > Max → 422', tooMany.status === 422);

const grade = await req('POST', `/submissions/${submissionId2}/evaluation`,
  { points: 16, level: 'INTERMEDIATE', feedback: 'Gut, vollständig.' }, teacher);
check('Bewerten → 200/201', grade.status === 200 || grade.status === 201);

const svGraded = await req('GET', `/evidence/student/${evId}`, null, student);
check('Lernende:r sieht graded + Punkte + Feedback',
  svGraded.body?.lastSubmission?.status === 'GRADED'
  && Number(svGraded.body?.lastSubmission?.points) === 16
  && svGraded.body?.lastSubmission?.feedback?.includes('vollständig'));

// Bewertung ändern (Override)
const regrade = await req('POST', `/submissions/${submissionId2}/evaluation`,
  { points: 18, level: 'ADVANCED', feedback: 'Nachbesserung top.' }, teacher);
check('Bewertung änderbar', regrade.status === 200 || regrade.status === 201);

// ── FA-65: Historie ───────────────────────────────────────────────
const hist = await req('GET', `/submissions/${submissionId2}/history`, null, teacher);
check('Historie hat 2 Einträge (created + updated)', Array.isArray(hist.body) && hist.body.length === 2);
check('Historie chronologisch (neuester zuerst)',
  hist.body?.[0]?.changeType === 'UPDATED' && hist.body?.[1]?.changeType === 'CREATED');

// Historie der ersten (zurückgewiesenen) Einreichung
const hist1 = await req('GET', `/submissions/${submissionId}/history`, null, teacher);
check('Rückweisungs-Historie vorhanden', hist1.body?.some((h) => h.changeType === 'REJECTED'));

// ── Aufräumen ─────────────────────────────────────────────────────
await req('DELETE', `/evidence/${evId}`, null, teacher);
await req('DELETE', `/classes/${cls.body.id}`, null, teacher);
await req('DELETE', `/modules/${moduleId}`, null, teacher);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
