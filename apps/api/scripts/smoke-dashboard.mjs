/**
 * Smoke-Test Sprint 6 – Dashboard / Fortschritts-Heatmap (FA-90, 91, 92)
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
const t = await req('POST', '/auth/dev-login', { email: 'dash-teacher@demo.ch', role: 'TEACHER' });
const teacher = t.body?.token;
const o = await req('POST', '/auth/dev-login', { email: 'dash-other@demo.ch', role: 'TEACHER' });
const other = o.body?.token;
const s1 = await req('POST', '/auth/dev-login', { email: 'dash-s1@demo.ch', role: 'LEARNER' });
const s2 = await req('POST', '/auth/dev-login', { email: 'dash-s2@demo.ch', role: 'LEARNER' });

const modNum = `DASH${Date.now()}`;
const mod = await req('POST', '/modules', { number: modNum, title: { de: 'Dashboard-Test' } }, teacher);
const moduleId = mod.body?.id;
const detail = await req('GET', `/modules/${moduleId}`, null, teacher);
const matrixId = detail.body?.matrix?.id;
const hz = await req('POST', `/modules/${moduleId}/action-goals`, { code: '1', text: { de: 'HZ' } }, teacher);
const band = await req('POST', `/matrices/${matrixId}/bands`, { code: 'A1', actionGoalIds: [hz.body.id] }, teacher);
const fieldId = band.body?.fields?.[0]?.id; // BEGINNER
const ev = await req('POST', '/evidence', {
  moduleId, title: { de: 'Nachweis A1B' }, isVisible: true, maxPoints: 10, fieldIds: [fieldId],
}, teacher);
const evId = ev.body?.id;
const cls = await req('POST', '/classes', { name: 'Dash-Anlass', moduleId }, teacher);
const code = await req('POST', `/classes/${cls.body.id}/join-code`, {}, teacher);
await req('POST', '/classes/join', { code: code.body?.code }, s1.body.token);
await req('POST', '/classes/join', { code: code.body?.code }, s2.body.token);
check('Setup vollständig', !!fieldId && !!evId);

// Student 1 reicht ein und wird bewertet; Student 2 reicht nur ein
const sub1 = await req('POST', `/evidence/${evId}/submissions`, { text: 'S1 Lösung' }, s1.body.token);
await req('POST', `/submissions/${sub1.body.submissionId}/evaluation`, { points: 8, level: 'INTERMEDIATE' }, teacher);
await req('POST', `/evidence/${evId}/submissions`, { text: 'S2 Lösung' }, s2.body.token);

// ── FA-90/91: Progress-Aggregation ────────────────────────────────
const prog = await req('GET', `/classes/${cls.body.id}/progress`, null, teacher);
check('GET /classes/:id/progress → 200', prog.status === 200);
check('studentCount = 2', prog.body?.studentCount === 2);
check('toGrade = 1', prog.body?.toGrade === 1);
check('graded = 1', prog.body?.graded === 1);
check('Bänder/Felder vorhanden', prog.body?.bands?.[0]?.fields?.length === 3);

const rowS1 = prog.body?.students?.find((st) => st.displayName === 'dash-s1');
const rowS2 = prog.body?.students?.find((st) => st.displayName === 'dash-s2');
check('Student1 Feld GRADED + Punkte', rowS1?.cells?.[fieldId]?.status === 'GRADED'
  && Number(rowS1?.cells?.[fieldId]?.points) === 8);
check('Student2 Feld SUBMITTED', rowS2?.cells?.[fieldId]?.status === 'SUBMITTED');
check('Student1 Fortschritt 33%', rowS1?.progress === 33);
check('Ø Fortschritt = 17', prog.body?.avgProgress === 17);

const fs = prog.body?.fieldStats?.find((f) => f.fieldId === fieldId);
check('Erfüllungsgrad Feld = 50%', fs?.percent === 50);

// ── FA-92: Bewertungs-Queue mit Klassenfilter ─────────────────────
const queue = await req('GET', `/submissions?status=SUBMITTED&classId=${cls.body.id}`, null, teacher);
check('Queue (classId-Filter) → nur submitted dieser Klasse', Array.isArray(queue.body)
  && queue.body.length === 1 && queue.body[0].enrollment.class.id === cls.body.id);

// ── RBAC ──────────────────────────────────────────────────────────
const studentProg = await req('GET', `/classes/${cls.body.id}/progress`, null, s1.body.token);
check('Student → 403', studentProg.status === 403);
const otherProg = await req('GET', `/classes/${cls.body.id}/progress`, null, other);
check('Fremde Lehrperson → 403', otherProg.status === 403);

// ── Aufräumen ─────────────────────────────────────────────────────
await req('DELETE', `/evidence/${evId}`, null, teacher);
await req('DELETE', `/classes/${cls.body.id}`, null, teacher);
await req('DELETE', `/modules/${moduleId}`, null, teacher);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
