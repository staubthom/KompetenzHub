/**
 * Smoke-Test – Modulanlass-Archivierung + Export/Import (FA-103).
 * Läuft gegen die lokale API (http://localhost:3001).
 */
import AdmZip from 'adm-zip';

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
async function exportZip(classId, token) {
  const res = await fetch(`${BASE}/classes/${classId}/archive-export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, buffer: Buffer.from(await res.arrayBuffer()) };
}
async function importZip(bytes, token) {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type: 'application/zip' }), 'archiv.zip');
  const res = await fetch(`${BASE}/classes/archive-import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

// ── Setup: Modul + Klasse + Lernende:r + Einreichung + Bewertung ──
const t = await req('POST', '/auth/dev-login', {
  email: `ca-teacher-${Date.now()}@demo.ch`,
  role: 'TEACHER',
});
const teacher = t.body?.token;
const s = await req('POST', '/auth/dev-login', {
  email: `ca-student-${Date.now()}@demo.ch`,
  role: 'LEARNER',
});
const student = s.body?.token;
check('Logins', !!teacher && !!student);

const modNum = `CA${Date.now()}`;
const mod = await req('POST', '/modules', { number: modNum, title: { de: 'CA-Modul' } }, teacher);
const moduleId = mod.body?.id;
const det = await req('GET', `/modules/${moduleId}`, null, teacher);
const matrixId = det.body?.matrix?.id;
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
const cls = await req('POST', '/classes', { name: 'CA-Anlass', moduleId }, teacher);
const classId = cls.body?.id;
const code = await req('POST', `/classes/${classId}/join-code`, {}, teacher);
await req('POST', '/classes/join', { code: code.body?.code }, student);
const ev = await req(
  'POST',
  '/evidence',
  { moduleId, title: { de: 'CA-Nachweis' }, isVisible: true, maxPoints: 20, fieldIds: [fieldId] },
  teacher,
);
const sub = await req(
  'POST',
  `/evidence/${ev.body.id}/submissions`,
  { text: 'Meine Abgabe mit Inhalt' },
  student,
);
const submissionId = sub.body?.submissionId;
await req(
  'POST',
  `/submissions/${submissionId}/evaluation`,
  { points: 16, level: 'ADVANCED', feedback: 'Gut gemacht.' },
  teacher,
);
check('Setup vollständig', !!classId && !!submissionId);

// ── Archivieren ───────────────────────────────────────────────────
const arch = await req('POST', `/classes/${classId}/archive`, {}, teacher);
check('Archivieren → status ARCHIVED', arch.body?.status === 'ARCHIVED', `status=${arch.status}`);
const activeList = await req('GET', '/classes', null, teacher);
check(
  'Aktiv-Liste blendet archivierte aus',
  !(activeList.body ?? []).some((c) => c.id === classId),
);
const archList = await req('GET', '/classes?archived=true', null, teacher);
check(
  'Archiv-Liste zeigt archivierte',
  (archList.body ?? []).some((c) => c.id === classId),
);

// Read-only: keine neuen Einreichungen, keine Bewertung, kein Code/Update
const blockedSubmit = await req(
  'POST',
  `/evidence/${ev.body.id}/submissions`,
  { text: 'Nochmal' },
  student,
);
check(
  'Archiviert: neue Einreichung blockiert',
  blockedSubmit.status === 403 || blockedSubmit.status === 409,
  `status=${blockedSubmit.status}`,
);
const blockedGrade = await req(
  'POST',
  `/submissions/${submissionId}/evaluation`,
  { points: 5 },
  teacher,
);
check(
  'Archiviert: Bewertung blockiert (read-only)',
  blockedGrade.status === 409,
  `status=${blockedGrade.status}`,
);
const blockedCode = await req('POST', `/classes/${classId}/join-code`, {}, teacher);
check('Archiviert: Code-Generierung blockiert', blockedCode.status === 409);

// ── Wiederherstellen ──────────────────────────────────────────────
const restore = await req('POST', `/classes/${classId}/restore`, {}, teacher);
check('Wiederherstellen → ACTIVE', restore.body?.status === 'ACTIVE');
check(
  'Aktiv-Liste zeigt wiederhergestellten',
  (await req('GET', '/classes', null, teacher)).body.some((c) => c.id === classId),
);

// ── Export (ZIP, inkl. Abgaben/Bewertungen) ───────────────────────
const exp = await exportZip(classId, teacher);
check('Export → 200', exp.status === 200);
const zip = new AdmZip(exp.buffer);
const manifestEntry = zip.getEntry('class-archive.json');
check('ZIP enthält class-archive.json', !!manifestEntry);
const manifest = manifestEntry ? JSON.parse(manifestEntry.getData().toString('utf8')) : {};
check(
  'Manifest: kind + schemaVersion',
  manifest.kind === 'class-archive' && manifest.schemaVersion === 1,
);
const en0 = manifest.enrollments?.[0];
const sub0 = en0?.submissions?.[0];
check(
  'Export enthält Einreichung mit Zeitstempel',
  !!sub0?.submittedAt && sub0?.text === 'Meine Abgabe mit Inhalt',
);
check(
  'Export enthält Bewertung + Feedback',
  sub0?.evaluation?.points === 16 &&
    sub0?.evaluation?.feedback === 'Gut gemacht.' &&
    sub0?.evaluation?.achievedLevel === 'ADVANCED',
);
check('Export enthält Verlauf', Array.isArray(sub0?.history) && sub0.history.length >= 1);

// ── Import → read-only archivierter Modulanlass ───────────────────
const imp = await importZip(exp.buffer, teacher);
check('Import → 201', imp.status === 201, `status=${imp.status}`);
check('Import: Name mit „(Importiert)"', (imp.body?.name ?? '').includes('(Importiert)'));
const importedId = imp.body?.classId;
const archList2 = await req('GET', '/classes?archived=true', null, teacher);
check(
  'Importierter ist archiviert (read-only)',
  (archList2.body ?? []).some((c) => c.id === importedId),
);
check(
  'Importierter NICHT in Aktiv-Liste',
  !(await req('GET', '/classes', null, teacher)).body.some((c) => c.id === importedId),
);
// Importierte Einreichungen + Bewertung vorhanden
const impMembers = await req('GET', `/classes/${importedId}/members`, null, teacher);
check('Import: Lernende:r übernommen (displayName)', (impMembers.body ?? []).length === 1);

// ── RBAC ──────────────────────────────────────────────────────────
const other = await req('POST', '/auth/dev-login', {
  email: `ca-teacherB-${Date.now()}@demo.ch`,
  role: 'TEACHER',
});
const expForbidden = await exportZip(classId, other.body.token);
check(
  'Fremde Lehrperson → Export 403/404',
  expForbidden.status === 403 || expForbidden.status === 404,
);

// ── Aufräumen ─────────────────────────────────────────────────────
await req('DELETE', `/classes/${classId}`, null, teacher);
if (importedId) await req('DELETE', `/classes/${importedId}`, null, teacher);
await req('DELETE', `/modules/${moduleId}`, null, teacher);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
