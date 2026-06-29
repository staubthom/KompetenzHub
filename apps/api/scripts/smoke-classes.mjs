/**
 * Smoke-Test Sprint 3 – Klassen & Beitrittscode (FA-20, 23, 25)
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

// ── Logins ────────────────────────────────────────────────────────
const t = await req('POST', '/auth/dev-login', { email: 'cls-teacher@demo.ch', role: 'TEACHER' });
const teacher = t.body?.token;
check('Login TEACHER', !!teacher);

const s = await req('POST', '/auth/dev-login', { email: 'cls-student@demo.ch', role: 'LEARNER' });
const student = s.body?.token;
check('Login LEARNER', !!student);

// ── Modul für die Zuordnung ───────────────────────────────────────
const modNum = `CLS${Date.now()}`;
const mod = await req(
  'POST',
  '/modules',
  { number: modNum, title: { de: 'Klassen-Testmodul' } },
  teacher,
);
const moduleId = mod.body?.id;
check('Modul angelegt', !!moduleId);

// ── FA-20: Klasse anlegen & Matrix zuordnen ───────────────────────
const create = await req('POST', '/classes', { name: 'INF-Test', moduleId }, teacher);
check('POST /classes → 201', create.status === 201);
const classId = create.body?.id;
check('Klasse-ID vorhanden', !!classId);
check('Modul zugeordnet', create.body?.module?.id === moduleId);

const list = await req('GET', '/classes', null, teacher);
check('GET /classes → 200', list.status === 200);
check('Klasse in Liste', Array.isArray(list.body) && list.body.some((c) => c.id === classId));

const detail = await req('GET', `/classes/${classId}`, null, teacher);
check('GET /classes/:id → 200', detail.status === 200);

const patch = await req(
  'PATCH',
  `/classes/${classId}`,
  { name: 'INF-Test-2', status: 'ACTIVE' },
  teacher,
);
check('PATCH /classes/:id → 200', patch.status === 200 && patch.body?.name === 'INF-Test-2');

// Student darf Klassenliste nicht sehen (RBAC)
const studentList = await req('GET', '/classes', null, student);
check('GET /classes als LEARNER → 403', studentList.status === 403);

// ── FA-23: Beitrittscode generieren & beitreten ───────────────────
const code1 = await req('POST', `/classes/${classId}/join-code`, {}, teacher);
check('POST join-code → 201', code1.status === 201);
const firstCode = code1.body?.code;
check('Code vorhanden (6 Zeichen)', typeof firstCode === 'string' && firstCode.length === 6);

// Erneuern invalidiert den alten Code
const code2 = await req('POST', `/classes/${classId}/join-code`, {}, teacher);
const secondCode = code2.body?.code;
check('Code erneuert (neuer Code)', secondCode && secondCode !== firstCode);

// Alter Code ungültig
const joinOld = await req('POST', '/classes/join', { code: firstCode }, student);
check('Beitritt mit altem Code → 400', joinOld.status === 400);

// Ungültiger Code
const joinBad = await req('POST', '/classes/join', { code: 'ZZZZZZ' }, student);
check('Beitritt mit ungültigem Code → 400', joinBad.status === 400);

// Gültiger Code → Mitglied
const join = await req('POST', '/classes/join', { code: secondCode }, student);
check('Beitritt mit gültigem Code → 201', join.status === 201);
check('Klasse korrekt', join.body?.class?.id === classId);

// Doppelter Beitritt idempotent (kein Fehler, kein Duplikat)
const joinAgain = await req('POST', '/classes/join', { code: secondCode }, student);
check('Doppelter Beitritt idempotent → 201', joinAgain.status === 201);

// ── FA-25: Mitgliederliste & entfernen ────────────────────────────
const members = await req('GET', `/classes/${classId}/members`, null, teacher);
check('GET /members → 200', members.status === 200);
check('Genau 1 Mitglied (idempotent)', Array.isArray(members.body) && members.body.length === 1);

const studentUserId = s.body?.user?.id;
const del = await req('DELETE', `/classes/${classId}/members/${studentUserId}`, null, teacher);
check('DELETE member → 204', del.status === 204);

const membersAfter = await req('GET', `/classes/${classId}/members`, null, teacher);
check('Mitglied entfernt (0)', Array.isArray(membersAfter.body) && membersAfter.body.length === 0);

// Student darf Mitglieder nicht sehen
const studentMembers = await req('GET', `/classes/${classId}/members`, null, student);
check('GET /members als LEARNER → 403', studentMembers.status === 403);

// ── Aufräumen ─────────────────────────────────────────────────────
const delClass = await req('DELETE', `/classes/${classId}`, null, teacher);
check('DELETE /classes/:id → 204', delClass.status === 204);
await req('DELETE', `/modules/${moduleId}`, null, teacher);

await cleanupUsers(BASE);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
