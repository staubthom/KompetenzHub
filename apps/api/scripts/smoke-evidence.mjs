/**
 * Smoke-Test Sprint 4 – Nachweise: Quiz + Upload (FA-30, 32, 36, 40)
 * Läuft gegen die lokale API (http://localhost:3001).
 */
const BASE = 'http://localhost:3001/api/v1';

let ok = 0;
let fail = 0;

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let json; try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}
function check(label, cond, info = '') {
  if (cond) { console.log(`  OK   ${label}`); ok++; }
  else { console.log(`  FAIL ${label}${info ? ' – ' + info : ''}`); fail++; }
}

// ── Setup: Lehrer, Modul, Matrix, Band/Feld, Klasse, Student ──────
const t = await req('POST', '/auth/dev-login', { email: 'ev-teacher@demo.ch', role: 'TEACHER' });
const teacher = t.body?.token;
const s = await req('POST', '/auth/dev-login', { email: 'ev-student@demo.ch', role: 'LEARNER' });
const student = s.body?.token;
const studentUserId = s.body?.user?.id;
check('Logins', !!teacher && !!student);

const modNum = `EV${Date.now()}`;
const mod = await req('POST', '/modules', { number: modNum, title: { de: 'Nachweis-Testmodul' } }, teacher);
const moduleId = mod.body?.id;
const detail = await req('GET', `/modules/${moduleId}`, null, teacher);
const matrixId = detail.body?.matrix?.id;
const hz = await req('POST', `/modules/${moduleId}/action-goals`, { code: '1', text: { de: 'HZ' } }, teacher);
const band = await req('POST', `/matrices/${matrixId}/bands`, { code: 'A1', actionGoalIds: [hz.body.id] }, teacher);
const fieldId = band.body?.fields?.[0]?.id;
check('Setup Modul/Matrix/Feld', !!moduleId && !!fieldId);

// Klasse mit Modul + Student beitreten
const cls = await req('POST', '/classes', { name: 'EV-Klasse', moduleId }, teacher);
const classId = cls.body?.id;
const code = await req('POST', `/classes/${classId}/join-code`, {}, teacher);
const join = await req('POST', '/classes/join', { code: code.body?.code }, student);
check('Student der Klasse beigetreten', join.status === 201);

// ── FA-32 + FA-40: Quiz anlegen ───────────────────────────────────
const quizConfig = {
  questions: [
    { id: 'q1', text: '1+1?', type: 'single', points: 2,
      options: [{ id: 'a', text: '2' }, { id: 'b', text: '3' }], correct: ['a'] },
    { id: 'q2', text: 'Gerade Zahlen?', type: 'multiple', points: 3,
      options: [{ id: 'a', text: '2' }, { id: 'b', text: '3' }, { id: 'c', text: '4' }], correct: ['a', 'c'] },
  ],
};
const quiz = await req('POST', '/evidence', {
  moduleId, type: 'QUIZ', title: { de: 'Test-Quiz' }, isVisible: true,
  fieldIds: [fieldId], config: quizConfig,
}, teacher);
check('POST /evidence (Quiz) → 201', quiz.status === 201);
const quizId = quiz.body?.id;
check('maxPoints automatisch summiert (5)', Number(quiz.body?.maxPoints) === 5);
check('Feld zugeordnet', quiz.body?.fields?.length === 1);

// Quiz ohne Frage → 400
const badQuiz = await req('POST', '/evidence', {
  moduleId, type: 'QUIZ', title: { de: 'Leer' }, config: { questions: [] },
}, teacher);
check('Quiz ohne Frage → 400', badQuiz.status === 400);

// ── FA-32: Lösungen werden Lernenden nicht offengelegt ────────────
const studentView = await req('GET', `/evidence/student/${quizId}`, null, student);
check('Student-Sicht → 200', studentView.status === 200);
const sq = studentView.body?.config?.questions ?? [];
check('Keine "correct"-Felder in Student-Sicht', sq.length === 2 && sq.every((q) => q.correct === undefined));

// ── FA-32: Auswertung serverseitig ────────────────────────────────
const fullCorrect = await req('POST', `/evidence/${quizId}/quiz/grade`,
  { answers: { q1: ['a'], q2: ['a', 'c'] } }, student);
check('Quiz voll korrekt → 5/5', fullCorrect.body?.points === 5 && fullCorrect.body?.maxPoints === 5);

const partial = await req('POST', `/evidence/${quizId}/quiz/grade`,
  { answers: { q1: ['a'], q2: ['a'] } }, student); // q2 unvollständig → 0
check('Quiz teilweise → 2/5 (all-or-nothing je Frage)', partial.body?.points === 2);

const none = await req('POST', `/evidence/${quizId}/quiz/grade`,
  { answers: { q1: ['b'], q2: ['b'] } }, student);
check('Quiz keine korrekt → 0/5', none.body?.points === 0);

// ── FA-36: Sichtbarkeit ───────────────────────────────────────────
const hidden = await req('POST', '/evidence', {
  moduleId, type: 'QUIZ', title: { de: 'Verborgen' }, isVisible: false, config: quizConfig,
}, teacher);
const hiddenId = hidden.body?.id;
const hiddenForStudent = await req('GET', `/evidence/student/${hiddenId}`, null, student);
check('Unsichtbarer Nachweis für Student → 404', hiddenForStudent.status === 404);

const studentListQuiz = await req('GET', '/evidence/student/list?type=QUIZ', null, student);
check('Student-Liste enthält nur sichtbare', Array.isArray(studentListQuiz.body)
  && studentListQuiz.body.some((e) => e.id === quizId)
  && !studentListQuiz.body.some((e) => e.id === hiddenId));

// FA-36: Fälligkeit → isOverdue
await req('PATCH', `/evidence/${quizId}`, { dueAt: '2020-01-01T00:00:00Z' }, teacher);
const overdue = await req('GET', `/evidence/student/${quizId}`, null, student);
check('Überfälliger Nachweis → isOverdue true', overdue.body?.isOverdue === true);

// ── FA-30: Upload-Nachweis + presigned URL ────────────────────────
const upload = await req('POST', '/evidence', {
  moduleId, type: 'FILE_UPLOAD', title: { de: 'Datei-Nachweis' }, isVisible: true,
  maxPoints: 10, fieldIds: [fieldId],
  config: { allowedFileTypes: ['pdf', 'png'], maxFileSizeMb: 5 },
}, teacher);
check('POST /evidence (Upload) → 201', upload.status === 201);
const uploadId = upload.body?.id;

// Falscher Dateityp → 422
const badType = await req('POST', `/evidence/${uploadId}/upload-url`,
  { fileName: 'schad.exe', contentType: 'application/octet-stream', sizeBytes: 1000 }, student);
check('Upload falscher Typ → 422', badType.status === 422);

// Zu gross → 422
const tooBig = await req('POST', `/evidence/${uploadId}/upload-url`,
  { fileName: 'gross.pdf', contentType: 'application/pdf', sizeBytes: 6 * 1024 * 1024 }, student);
check('Upload zu gross → 422', tooBig.status === 422);

// Gültig → presigned URL
const presign = await req('POST', `/evidence/${uploadId}/upload-url`,
  { fileName: 'nachweis.pdf', contentType: 'application/pdf', sizeBytes: 1024 }, student);
check('Upload gültig → presigned URL', presign.status === 201 && typeof presign.body?.uploadUrl === 'string'
  && presign.body.uploadUrl.startsWith('http'));
check('Presigned-URL zeigt nicht auf die API', !presign.body?.uploadUrl?.includes('/api/v1'));

// Echter PUT an MinIO über die presigned URL
const putRes = await fetch(presign.body.uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/pdf' },
  body: Buffer.from('%PDF-1.4 smoke-test'),
});
check('Datei-Upload an MinIO (PUT) → 200', putRes.status === 200);

// Upload bestätigen → Submission
const confirm = await req('POST', `/evidence/${uploadId}/upload-confirm`,
  { key: presign.body?.key, fileName: 'nachweis.pdf' }, student);
check('Upload bestätigen → submitted', confirm.body?.status === 'SUBMITTED');

// ── RBAC: Student darf keine Nachweise anlegen ────────────────────
const studentCreate = await req('POST', '/evidence', { moduleId, type: 'QUIZ', title: { de: 'x' }, config: quizConfig }, student);
check('Student POST /evidence → 403', studentCreate.status === 403);

// ── Aufräumen ─────────────────────────────────────────────────────
await req('DELETE', `/evidence/${quizId}`, null, teacher);
await req('DELETE', `/evidence/${hiddenId}`, null, teacher);
await req('DELETE', `/evidence/${uploadId}`, null, teacher);
await req('DELETE', `/classes/${classId}`, null, teacher);
await req('DELETE', `/modules/${moduleId}`, null, teacher);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
