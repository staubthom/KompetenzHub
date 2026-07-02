/**
 * Smoke-Test – Mandanten-/Owner-Isolation zwischen Lehrpersonen.
 * Lehrperson B darf weder Module noch Einreichungen von Lehrperson A sehen.
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

// ── Setup: zwei Lehrpersonen + eine lernende Person ───────────────
const ta = await req('POST', '/auth/dev-login', {
  email: `iso-teacherA-${Date.now()}@demo.ch`,
  role: 'TEACHER',
});
const teacherA = ta.body?.token;
const tb = await req('POST', '/auth/dev-login', {
  email: `iso-teacherB-${Date.now()}@demo.ch`,
  role: 'TEACHER',
});
const teacherB = tb.body?.token;
const st = await req('POST', '/auth/dev-login', {
  email: `iso-student-${Date.now()}@demo.ch`,
  role: 'LEARNER',
});
const student = st.body?.token;
check('Logins', !!teacherA && !!teacherB && !!student);

// Lehrperson A: Modul + Matrix + Feld + Klasse + Nachweis + Einreichung
const aNum = `ISOA${Date.now()}`;
const aMod = await req('POST', '/modules', { number: aNum, title: { de: 'A-Modul' } }, teacherA);
const aModuleId = aMod.body?.id;
const aDetail = await req('GET', `/modules/${aModuleId}`, null, teacherA);
const aMatrixId = aDetail.body?.matrix?.id;
const aHz = await req(
  'POST',
  `/modules/${aModuleId}/action-goals`,
  { code: '1', text: { de: 'HZ' } },
  teacherA,
);
const aBand = await req(
  'POST',
  `/matrices/${aMatrixId}/bands`,
  { code: 'A1', actionGoalIds: [aHz.body.id] },
  teacherA,
);
const aField = aBand.body?.fields?.[0]?.id;
const aClass = await req('POST', '/classes', { name: 'A-Anlass', moduleId: aModuleId }, teacherA);
const aCode = await req('POST', `/classes/${aClass.body.id}/join-code`, {}, teacherA);
await req('POST', '/classes/join', { code: aCode.body?.code }, student);
const aEv = await req(
  'POST',
  '/evidence',
  {
    moduleId: aModuleId,
    title: { de: 'A-Nachweis' },
    isVisible: true,
    maxPoints: 10,
    fieldIds: [aField],
  },
  teacherA,
);
const aSub = await req(
  'POST',
  `/evidence/${aEv.body.id}/submissions`,
  { text: 'Meine Abgabe' },
  student,
);
const aSubmissionId = aSub.body?.submissionId;

// Lehrperson B: eigenes Modul
const bNum = `ISOB${Date.now()}`;
const bMod = await req('POST', '/modules', { number: bNum, title: { de: 'B-Modul' } }, teacherB);
const bModuleId = bMod.body?.id;
check('Setup vollständig', !!aMatrixId && !!aField && !!aSubmissionId && !!bModuleId);

// ── Modul-Sichtbarkeit ────────────────────────────────────────────
const bModules = await req('GET', '/modules', null, teacherB);
const bIds = (bModules.body ?? []).map((m) => m.id);
check('B sieht A-Modul NICHT', !bIds.includes(aModuleId));
check('B sieht eigenes Modul', bIds.includes(bModuleId));
const aModules = await req('GET', '/modules', null, teacherA);
check(
  'A sieht eigenes Modul',
  (aModules.body ?? []).some((m) => m.id === aModuleId),
);

// B darf A-Modul nicht öffnen/bearbeiten/löschen/exportieren
const bOpenA = await req('GET', `/modules/${aModuleId}`, null, teacherB);
check('B kann A-Modul nicht öffnen → 404', bOpenA.status === 404, `status=${bOpenA.status}`);
const bEditA = await req('PATCH', `/modules/${aModuleId}`, { title: { de: 'Hack' } }, teacherB);
check('B kann A-Modul nicht bearbeiten → 404', bEditA.status === 404);
const bDelA = await req('DELETE', `/modules/${aModuleId}`, null, teacherB);
check('B kann A-Modul nicht löschen → 404', bDelA.status === 404);
const bExportA = await req('GET', `/matrices/${aMatrixId}/export`, null, teacherB);
check('B kann A-Matrix nicht exportieren → 404', bExportA.status === 404);

// ── Einreichungs-Sichtbarkeit ─────────────────────────────────────
const bQueue = await req('GET', '/submissions', null, teacherB);
check(
  'B sieht A-Einreichung NICHT in der Queue',
  Array.isArray(bQueue.body) && !bQueue.body.some((x) => x.id === aSubmissionId),
);
const aQueue = await req('GET', '/submissions', null, teacherA);
check(
  'A sieht eigene Einreichung in der Queue',
  Array.isArray(aQueue.body) && aQueue.body.some((x) => x.id === aSubmissionId),
);

// B darf A-Einreichung nicht im Detail/Verlauf sehen und nicht bewerten/zurückweisen
const bDetail = await req('GET', `/submissions/${aSubmissionId}`, null, teacherB);
check(
  'B kann A-Einreichung nicht öffnen → 403',
  bDetail.status === 403,
  `status=${bDetail.status}`,
);
const bHist = await req('GET', `/submissions/${aSubmissionId}/history`, null, teacherB);
check('B kann A-Verlauf nicht sehen → 403', bHist.status === 403);
const bGrade = await req(
  'POST',
  `/submissions/${aSubmissionId}/evaluation`,
  { points: 10 },
  teacherB,
);
check('B kann A-Einreichung nicht bewerten → 403', bGrade.status === 403);
const bReject = await req(
  'POST',
  `/submissions/${aSubmissionId}/reject`,
  { reason: 'nö' },
  teacherB,
);
check('B kann A-Einreichung nicht zurückweisen → 403', bReject.status === 403);

// A darf die eigene Einreichung sehen und bewerten
const aDetailSub = await req('GET', `/submissions/${aSubmissionId}`, null, teacherA);
check('A kann eigene Einreichung öffnen → 200', aDetailSub.status === 200);
const aGrade = await req(
  'POST',
  `/submissions/${aSubmissionId}/evaluation`,
  { points: 8 },
  teacherA,
);
check('A kann eigene Einreichung bewerten', aGrade.status === 200 || aGrade.status === 201);

// ── Klassen-/Modulanlass-Isolation ────────────────────────────────
const bClasses = await req('GET', '/classes', null, teacherB);
check(
  'B sieht A-Modulanlass NICHT in der Klassenliste',
  Array.isArray(bClasses.body) && !bClasses.body.some((c) => c.id === aClass.body.id),
);
const bOpenAClass = await req('GET', `/classes/${aClass.body.id}`, null, teacherB);
check(
  'B kann A-Modulanlass nicht öffnen → 403/404',
  bOpenAClass.status === 403 || bOpenAClass.status === 404,
  `status=${bOpenAClass.status}`,
);
const bMembersA = await req('GET', `/classes/${aClass.body.id}/members`, null, teacherB);
check(
  'B kann A-Teilnehmende nicht sehen → 403/404',
  bMembersA.status === 403 || bMembersA.status === 404,
  `status=${bMembersA.status}`,
);
const bDelAClass = await req('DELETE', `/classes/${aClass.body.id}`, null, teacherB);
check(
  'B kann A-Modulanlass nicht löschen → 403/404',
  bDelAClass.status === 403 || bDelAClass.status === 404,
  `status=${bDelAClass.status}`,
);

// ── Rollen-Isolation: Lernende dürfen keine Lehrer-Routen nutzen ───
const stMod = await req('POST', '/modules', { number: `X${Date.now()}`, title: { de: 'X' } }, student);
check('Lernende:r kann kein Modul anlegen → 403', stMod.status === 403, `status=${stMod.status}`);
const stQueue = await req('GET', '/submissions', null, student);
check(
  'Lernende:r sieht die Bewertungs-Queue nicht → 403',
  stQueue.status === 403,
  `status=${stQueue.status}`,
);
const stAdmin = await req('GET', '/admin/users', null, student);
check(
  'Lernende:r kann Admin-Route nicht nutzen → 403',
  stAdmin.status === 403,
  `status=${stAdmin.status}`,
);
const teacherAdmin = await req('GET', '/admin/users', null, teacherA);
check(
  'Lehrperson kann Admin-Route nicht nutzen → 403',
  teacherAdmin.status === 403,
  `status=${teacherAdmin.status}`,
);

// ── Aufräumen ─────────────────────────────────────────────────────
await req('DELETE', `/classes/${aClass.body.id}`, null, teacherA);
await req('DELETE', `/modules/${aModuleId}`, null, teacherA);
await req('DELETE', `/modules/${bModuleId}`, null, teacherB);
await cleanupUsers(BASE);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
