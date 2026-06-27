/**
 * Smoke-Test – Lernpfade (FA-84). Läuft gegen die lokale API (http://localhost:3001).
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

// ── Setup ─────────────────────────────────────────────────────────
const t = await req('POST', '/auth/dev-login', {
  email: `lp-teacher-${Date.now()}@demo.ch`,
  role: 'TEACHER',
});
const teacher = t.body?.token;
const s = await req('POST', '/auth/dev-login', {
  email: `lp-student-${Date.now()}@demo.ch`,
  role: 'LEARNER',
});
const student = s.body?.token;
check('Logins', !!teacher && !!student);

const modNum = `LP${Date.now()}`;
const mod = await req(
  'POST',
  '/modules',
  { number: modNum, title: { de: 'Lernpfad-Test' } },
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
const bandA = await req(
  'POST',
  `/matrices/${matrixId}/bands`,
  { code: 'A1', actionGoalIds: [hz.body.id] },
  teacher,
);
const bandB = await req(
  'POST',
  `/matrices/${matrixId}/bands`,
  { code: 'B1', actionGoalIds: [hz.body.id] },
  teacher,
);
const fA = bandA.body?.fields?.[0]?.id; // A1B
const fB = bandB.body?.fields?.[0]?.id; // B1B
const fA2 = bandA.body?.fields?.[1]?.id; // A1I
const cls = await req('POST', '/classes', { name: 'LP-Anlass', moduleId }, teacher);
const code = await req('POST', `/classes/${cls.body.id}/join-code`, {}, teacher);
await req('POST', '/classes/join', { code: code.body?.code }, student);
check('Setup', !!matrixId && !!fA && !!fB && !!fA2);

// ── Pfad anlegen ──────────────────────────────────────────────────
const created = await req(
  'POST',
  `/matrices/${matrixId}/paths`,
  { name: 'Empfohlen', fieldIds: [fA, fB, fA2], isActive: true },
  teacher,
);
check('Pfad erstellen → 201', created.status === 201, `status=${created.status}`);
const pathId = created.body?.id;
check(
  'Pfad hat 3 Schritte in Reihenfolge',
  created.body?.steps?.length === 3 && created.body.steps[0].fieldId === fA,
);
check('Pfad ist aktiv', created.body?.isActive === true);

// Feld fremder Matrix → 400
const bad = await req(
  'POST',
  `/matrices/${matrixId}/paths`,
  { name: 'X', fieldIds: ['00000000-0000-0000-0000-000000000000'] },
  teacher,
);
check('Unbekanntes Feld → 400', bad.status === 400);

// Leerer Name → 400
const noName = await req(
  'POST',
  `/matrices/${matrixId}/paths`,
  { name: '  ', fieldIds: [fA] },
  teacher,
);
check('Leerer Name → 400', noName.status === 400);

// ── Liste ─────────────────────────────────────────────────────────
const list = await req('GET', `/matrices/${matrixId}/paths`, null, teacher);
check('Liste enthält den Pfad', Array.isArray(list.body) && list.body.some((p) => p.id === pathId));

// ── Zweiter Pfad + aktiv setzen → erster wird inaktiv ─────────────
const second = await req(
  'POST',
  `/matrices/${matrixId}/paths`,
  { name: 'Alternativ', fieldIds: [fB, fA] },
  teacher,
);
const secondId = second.body?.id;
await req('PATCH', `/paths/${secondId}`, { isActive: true }, teacher);
const list2 = await req('GET', `/matrices/${matrixId}/paths`, null, teacher);
const active = list2.body.filter((p) => p.isActive);
check('Mehrere Pfade, genau einer aktiv', active.length === 1 && active[0].id === secondId);

// wieder ersten aktivieren für die Lernenden-Ansicht
await req('PATCH', `/paths/${pathId}`, { isActive: true }, teacher);

// ── Reihenfolge aktualisieren ─────────────────────────────────────
const upd = await req('PATCH', `/paths/${pathId}`, { fieldIds: [fB, fA] }, teacher);
check(
  'Reihenfolge aktualisiert (2 Schritte)',
  upd.body?.steps?.length === 2 && upd.body.steps[0].fieldId === fB,
);
// zurück auf 3 Schritte für Lernenden-Test
await req('PATCH', `/paths/${pathId}`, { fieldIds: [fA, fB, fA2] }, teacher);

// ── Lernenden-Ansicht: aktiver Pfad mit Status & nächstem Schritt ─
const view = await req('GET', `/modules/${moduleId}/learning-path`, null, student);
check('Lernende:r erhält aktiven Pfad', view.status === 200 && view.body?.path?.id === pathId);
check(
  'Alle Schritte zunächst OPEN',
  view.body?.path?.steps?.every((s) => s.status === 'OPEN'),
);
check('Erster Schritt ist „next"', view.body?.path?.steps?.[0]?.isNext === true);
check('doneCount 0 / total 3', view.body?.path?.doneCount === 0 && view.body?.path?.total === 3);

// ── Einreichung verschiebt den nächsten Schritt ───────────────────
const ev = await req(
  'POST',
  '/evidence',
  { moduleId, title: { de: 'Nachweis A1B' }, isVisible: true, fieldIds: [fA] },
  teacher,
);
const subm = await req('POST', `/evidence/${ev.body.id}/submissions`, { text: 'Done' }, student);
check('Einreichung A1B → submitted', subm.body?.status === 'SUBMITTED');
const view2 = await req('GET', `/modules/${moduleId}/learning-path`, null, student);
const step0 = view2.body?.path?.steps?.[0];
check('A1B jetzt SUBMITTED', step0?.status === 'SUBMITTED');
check('Nächster Schritt wandert weiter (nicht mehr Schritt 1)', step0?.isNext === false);
check(
  'Schritt enthält anklickbaren Nachweis mit Status',
  Array.isArray(step0?.evidences) &&
    step0.evidences.some((x) => x.id === ev.body.id && x.status === 'SUBMITTED'),
);

// ── RBAC: Lernende:r darf keine Pfade verwalten ───────────────────
const forbidden = await req(
  'POST',
  `/matrices/${matrixId}/paths`,
  { name: 'Hack', fieldIds: [fA] },
  student,
);
check('Lernende:r → 403 beim Anlegen', forbidden.status === 403);
const forbiddenList = await req('GET', `/matrices/${matrixId}/paths`, null, student);
check('Lernende:r → 403 bei Pfadliste', forbiddenList.status === 403);

// ── Löschen ───────────────────────────────────────────────────────
const del = await req('DELETE', `/paths/${secondId}`, null, teacher);
check('Pfad löschen → 204', del.status === 204);

// ── Aufräumen ─────────────────────────────────────────────────────
await req('DELETE', `/evidence/${ev.body.id}`, null, teacher);
await req('DELETE', `/classes/${cls.body.id}`, null, teacher);
await req('DELETE', `/modules/${moduleId}`, null, teacher);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
