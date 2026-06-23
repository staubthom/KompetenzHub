/**
 * Smoke-Test – Co-Teaching / Co-Leitung von Modulanlässen.
 * Lehrperson A fügt Lehrperson B als Co-Leitung hinzu. B sieht den Modulanlass
 * und darf Einreichungen bewerten; B darf den Modulanlass NICHT löschen und
 * keine Co-Leitung verwalten. Lehrperson C bleibt aussen vor.
 * Läuft gegen http://localhost:3001.
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

const stamp = Date.now();

// ── Setup: drei Lehrpersonen + eine lernende Person ───────────────
const aEmail = `coA-${stamp}@demo.ch`;
const bEmail = `coB-${stamp}@demo.ch`;
const cEmail = `coC-${stamp}@demo.ch`;
const a = (await req('POST', '/auth/dev-login', { email: aEmail, role: 'TEACHER' })).body?.token;
const b = (await req('POST', '/auth/dev-login', { email: bEmail, role: 'TEACHER' })).body?.token;
const c = (await req('POST', '/auth/dev-login', { email: cEmail, role: 'TEACHER' })).body?.token;
const student = (await req('POST', '/auth/dev-login', { email: `coS-${stamp}@demo.ch`, role: 'LEARNER' })).body?.token;
check('Logins', !!a && !!b && !!c && !!student);

// Lehrperson A: Modul + Matrix + Klasse + Nachweis + Einreichung der lernenden Person
const modNum = `CO${stamp}`;
const mod = await req('POST', '/modules', { number: modNum, title: { de: 'Co-Modul' } }, a);
const moduleId = mod.body?.id;
const matrixId = (await req('GET', `/modules/${moduleId}`, null, a)).body?.matrix?.id;
const hz = await req('POST', `/modules/${moduleId}/action-goals`, { code: '1', text: { de: 'HZ' } }, a);
const band = await req('POST', `/matrices/${matrixId}/bands`, { code: 'A1', actionGoalIds: [hz.body.id] }, a);
const fieldId = band.body?.fields?.[0]?.id;
const cls = await req('POST', '/classes', { name: 'Co-Anlass', moduleId }, a);
const classId = cls.body?.id;
const code = await req('POST', `/classes/${classId}/join-code`, {}, a);
await req('POST', '/classes/join', { code: code.body?.code }, student);
const ev = await req('POST', '/evidence', { moduleId, title: { de: 'Co-Nachweis' }, isVisible: true, maxPoints: 10, fieldIds: [fieldId] }, a);
const sub = await req('POST', `/evidence/${ev.body.id}/submissions`, { text: 'Abgabe' }, student);
const submissionId = sub.body?.submissionId;
check('Setup vollständig', !!classId && !!submissionId);

// ── Vorher: B sieht den Modulanlass NICHT und darf nicht bewerten ─
const bListBefore = await req('GET', '/classes', null, b);
check('B sieht A-Anlass anfangs nicht', !bListBefore.body?.some?.((x) => x.id === classId));
const bGradeBefore = await req('POST', `/submissions/${submissionId}/evaluation`, { points: 5 }, b);
check('B darf anfangs nicht bewerten → 403/404', [403, 404].includes(bGradeBefore.status), `status ${bGradeBefore.status}`);

// ── A fügt B per E-Mail als Co-Leitung hinzu ──────────────────────
const add = await req('POST', `/classes/${classId}/co-teachers`, { email: bEmail }, a);
check(
  'A fügt B als Co-Leitung hinzu',
  add.status === 201 && add.body?.email?.toLowerCase() === bEmail.toLowerCase(),
  `status ${add.status}`,
);
const coList = await req('GET', `/classes/${classId}/co-teachers`, null, a);
check('Co-Leitung in Liste', coList.body?.some?.((x) => x.email?.toLowerCase() === bEmail.toLowerCase()));

// Nicht-Lehrperson / unbekannte E-Mail → 404
const addBad = await req('POST', `/classes/${classId}/co-teachers`, { email: `nobody-${stamp}@demo.ch` }, a);
check('Unbekannte E-Mail als Co-Leitung → 404', addBad.status === 404, `status ${addBad.status}`);

// ── Nachher: B sieht den Modulanlass und darf bewerten ────────────
const bList = await req('GET', '/classes', null, b);
const bEntry = bList.body?.find?.((x) => x.id === classId);
check('B sieht A-Anlass jetzt', !!bEntry);
check('B-Anlass ist als Co-Leitung markiert', bEntry?.isCoLeader === true);

const bProgress = await req('GET', `/classes/${classId}/progress`, null, b);
check('B sieht Fortschritts-Dashboard', bProgress.status === 200);

const bQueue = await req('GET', '/submissions?status=SUBMITTED', null, b);
check('B sieht Einreichung in der Bewertungs-Queue', bQueue.body?.some?.((x) => x.id === submissionId));

const bGrade = await req('POST', `/submissions/${submissionId}/evaluation`, { points: 8, level: 'ADVANCED' }, b);
check('B darf als Co-Leitung bewerten', bGrade.status === 200 || bGrade.status === 201, `status ${bGrade.status}`);

// ── Lehrperson C (kein Co) bleibt aussen vor ──────────────────────
const cQueue = await req('GET', '/submissions?status=GRADED', null, c);
check('C sieht A-Einreichung nicht', !cQueue.body?.some?.((x) => x.id === submissionId));

// ── B darf NICHT: Co-Leitung verwalten oder Anlass löschen ────────
const bAddCo = await req('POST', `/classes/${classId}/co-teachers`, { email: cEmail }, b);
check('B darf keine Co-Leitung hinzufügen → 403', bAddCo.status === 403, `status ${bAddCo.status}`);
const bDelete = await req('DELETE', `/classes/${classId}`, null, b);
check('B darf Anlass nicht löschen → 403', bDelete.status === 403, `status ${bDelete.status}`);

// ── A entfernt B wieder ───────────────────────────────────────────
const bUserId = add.body?.userId;
const rem = await req('DELETE', `/classes/${classId}/co-teachers/${bUserId}`, null, a);
check('A entfernt Co-Leitung', rem.status === 204);
const bListAfter = await req('GET', '/classes', null, b);
check('B sieht Anlass nach Entzug nicht mehr', !bListAfter.body?.some?.((x) => x.id === classId));

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
