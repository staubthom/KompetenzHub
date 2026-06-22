/**
 * Smoke-Test – Matrix-Export/-Import (FA-100): Round-Trip + Validierung + RBAC.
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

// Vergleichbare Struktur (ohne IDs/Nummer/Datum) für den Round-Trip.
function normalize(exp) {
  return JSON.stringify({
    title: exp.module.title,
    actionGoals: exp.actionGoals,
    bands: exp.bands,
    evidences: exp.evidences,
    learningPaths: exp.learningPaths,
  });
}

// ── Setup: Quell-Matrix mit allem Drum und Dran ───────────────────
const t = await req('POST', '/auth/dev-login', { email: `mio-teacher-${Date.now()}@demo.ch`, role: 'TEACHER' });
const teacher = t.body?.token;
const s = await req('POST', '/auth/dev-login', { email: `mio-student-${Date.now()}@demo.ch`, role: 'LEARNER' });
const student = s.body?.token;
check('Logins', !!teacher && !!student);

const modNum = `MIO${Date.now()}`;
const mod = await req('POST', '/modules', { number: modNum, title: { de: 'Export-Test' }, description: { de: 'Beschreibung' } }, teacher);
const moduleId = mod.body?.id;
const detail = await req('GET', `/modules/${moduleId}`, null, teacher);
const matrixId = detail.body?.matrix?.id;
const hz = await req('POST', `/modules/${moduleId}/action-goals`, { code: '1', text: { de: 'Handlungsziel 1' } }, teacher);
const bandA = await req('POST', `/matrices/${matrixId}/bands`, { code: 'A1', description: { de: 'Band A1' }, actionGoalIds: [hz.body.id] }, teacher);
const bandB = await req('POST', `/matrices/${matrixId}/bands`, { code: 'B1', actionGoalIds: [hz.body.id] }, teacher);
const fA = bandA.body?.fields?.[0]?.id; // A1B
const fB = bandB.body?.fields?.[0]?.id; // B1B
await req('PUT', `/fields/${fA}/descriptor`, { text: { de: 'Ich kann A.' } }, teacher);
await req('PUT', `/fields/${fB}/descriptor`, { text: { de: 'Ich kann B.' } }, teacher);
const ev = await req('POST', '/evidence', {
  moduleId, title: { de: 'Nachweis A' }, instructions: { de: '<p>Tu A.</p>' }, isVisible: true, maxPoints: 20, fieldIds: [fA],
  config: { allowText: true, allowExpertTalk: true },
}, teacher);
await req('POST', `/matrices/${matrixId}/paths`, { name: 'Pfad 1', fieldIds: [fA, fB], isActive: true }, teacher);
check('Setup vollständig', !!matrixId && !!fA && !!fB && !!ev.body?.id);

// ── Export ────────────────────────────────────────────────────────
const exp = await req('GET', `/matrices/${matrixId}/export`, null, teacher);
check('Export → 200 mit schemaVersion', exp.status === 200 && exp.body?.schemaVersion === 1);
check('Export enthält Bänder/Felder', exp.body?.bands?.length === 2 && exp.body.bands[0].fields.length === 3);
check('Export enthält Deskriptor', exp.body.bands.find((b) => b.code === 'A1')?.fields?.some((f) => f.descriptor?.de === 'Ich kann A.'));
check('Export enthält Handlungsziele + Verknüpfung', exp.body?.actionGoals?.length === 1 && exp.body.bands[0].actionGoalCodes.includes('1'));
check('Export enthält Nachweis mit fieldCodes', exp.body?.evidences?.length === 1 && exp.body.evidences[0].fieldCodes.includes('A1B'));
check('Export enthält Lernpfad', exp.body?.learningPaths?.length === 1 && exp.body.learningPaths[0].fieldCodes.length === 2);
check('Export ohne personenbezogene Daten', JSON.stringify(exp.body).includes('submission') === false);

// ── Import (Round-Trip) ───────────────────────────────────────────
const imp = await req('POST', '/matrices/import', exp.body, teacher);
check('Import → 201 mit neuem Modul', imp.status === 201 && !!imp.body?.moduleId);
check('Import vergibt freie Nummer (Kopie)', imp.body?.number === `${modNum}-Kopie`, `number=${imp.body?.number}`);

// Re-Export des importierten Moduls und strukturell vergleichen
const exp2 = await req('GET', `/matrices/${imp.body.matrixId}/export`, null, teacher);
check('Round-Trip verlustfrei (Struktur identisch)', normalize(exp.body) === normalize(exp2.body));

// ── Validierung ───────────────────────────────────────────────────
const badVersion = await req('POST', '/matrices/import', { ...exp.body, schemaVersion: 99 }, teacher);
check('Falsche Schema-Version → 400', badVersion.status === 400);
const badShape = await req('POST', '/matrices/import', { schemaVersion: 1, kind: 'matrix-export', module: {} }, teacher);
check('Fehlende Pflichtfelder → 400', badShape.status === 400);
const notJsonObj = await req('POST', '/matrices/import', 'kein-objekt', teacher);
check('Kein Objekt → 400', notJsonObj.status === 400);

// ── RBAC ──────────────────────────────────────────────────────────
const forbiddenExp = await req('GET', `/matrices/${matrixId}/export`, null, student);
check('Lernende:r → 403 Export', forbiddenExp.status === 403);
const forbiddenImp = await req('POST', '/matrices/import', exp.body, student);
check('Lernende:r → 403 Import', forbiddenImp.status === 403);

// ── Aufräumen ─────────────────────────────────────────────────────
await req('DELETE', `/modules/${moduleId}`, null, teacher);
if (imp.body?.moduleId) await req('DELETE', `/modules/${imp.body.moduleId}`, null, teacher);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
