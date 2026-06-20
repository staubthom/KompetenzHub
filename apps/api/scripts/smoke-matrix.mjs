/**
 * Smoke-Test Sprint 2 – Matrix-Editor (FA-01..04)
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

function check(label, condition, info = '') {
  if (condition) {
    console.log(`  OK   ${label}`);
    ok++;
  } else {
    console.log(`  FAIL ${label}${info ? ' – ' + info : ''}`);
    fail++;
  }
}

// ── Login als TEACHER ─────────────────────────────────────────────
const login = await req('POST', '/auth/dev-login', { email: 'matrix-test@demo.ch', role: 'TEACHER' });
check('Login als TEACHER → 201', login.status === 201);
const token = login.body?.token;
check('Token vorhanden', !!token);

// ── FA-01: Modul CRUD ─────────────────────────────────────────────
// Unique Nummer pro Lauf – verhindert Konflikte bei wiederholten Testläufen
const testNumber = `SMOKE${Date.now()}`;
const createMod = await req('POST', '/modules', { number: testNumber, title: { de: 'Testmodul' } }, token);
check('POST /modules → 201', createMod.status === 201);
const moduleId = createMod.body?.id;
check('Modul-ID vorhanden', !!moduleId);

const listMod = await req('GET', '/modules', null, token);
check('GET /modules → 200', listMod.status === 200);
check('Modul in Liste', Array.isArray(listMod.body) && listMod.body.some(m => m.id === moduleId));

const getMod = await req('GET', `/modules/${moduleId}`, null, token);
check('GET /modules/:id → 200', getMod.status === 200);
check('Modul hat Matrix', !!getMod.body?.matrix);

const patchMod = await req('PATCH', `/modules/${moduleId}`, { title: { de: 'Geändert' } }, token);
check('PATCH /modules/:id → 200', patchMod.status === 200);

const dupMod = await req('POST', '/modules', { number: testNumber, title: { de: 'Duplikat' } }, token);
check('POST /modules Duplikat → 409', dupMod.status === 409);

// ── FA-02: Handlungsziele ─────────────────────────────────────────
const createHZ = await req('POST', `/modules/${moduleId}/action-goals`, {
  code: '1', text: { de: 'Handlungsziel 1' }
}, token);
check('POST /modules/:id/action-goals → 201', createHZ.status === 201);
const goalId = createHZ.body?.id;
check('Handlungsziel-ID vorhanden', !!goalId);

const listHZ = await req('GET', `/modules/${moduleId}/action-goals`, null, token);
check('GET /modules/:id/action-goals → 200', listHZ.status === 200);
check('Handlungsziel in Liste', Array.isArray(listHZ.body) && listHZ.body.some(g => g.id === goalId));

const patchHZ = await req('PATCH', `/action-goals/${goalId}`, { text: { de: 'HZ 1 (aktualisiert)' } }, token);
check('PATCH /action-goals/:id → 200', patchHZ.status === 200);

// ── FA-03: Kompetenzband ──────────────────────────────────────────
const matrixId = getMod.body?.matrix?.id;
check('Matrix-ID vorhanden', !!matrixId);

const createBand = await req('POST', `/matrices/${matrixId}/bands`, {
  code: 'A1',
  description: { de: 'Hardware & Betriebssystem' },
  actionGoalIds: [goalId],
}, token);
check('POST /matrices/:id/bands → 201', createBand.status === 201);
const bandId = createBand.body?.id;
check('Band-ID vorhanden', !!bandId);
check('Band hat 3 Felder (B/I/A)', createBand.body?.fields?.length === 3);

const matrix = await req('GET', `/modules/${moduleId}/matrix`, null, token);
check('GET /modules/:id/matrix → 200', matrix.status === 200);
check('Matrix enthält Band', matrix.body?.matrix?.bands?.length >= 1);

// ── FA-04: Deskriptor ─────────────────────────────────────────────
const fieldId = createBand.body?.fields?.[0]?.id; // erstes Feld (BEGINNER)
check('Feld-ID vorhanden', !!fieldId);

const putDesc = await req('PUT', `/fields/${fieldId}/descriptor`, {
  text: { de: 'Ich kann grundlegende Hardware-Komponenten benennen.' }
}, token);
check('PUT /fields/:id/descriptor → 200', putDesc.status === 200);

const getDesc = await req('GET', `/fields/${fieldId}/descriptor`, null, token);
check('GET /fields/:id/descriptor → 200', getDesc.status === 200);
check('Deskriptor-Text korrekt', getDesc.body?.text?.de?.startsWith('Ich kann'));

// Zweites PUT (Update)
const putDesc2 = await req('PUT', `/fields/${fieldId}/descriptor`, {
  text: { de: 'Ich kann Hardware-Komponenten benennen und installieren.' }
}, token);
check('PUT /fields/:id/descriptor (Update) → 200', putDesc2.status === 200);

// ── Aufräumen ─────────────────────────────────────────────────────
const delBand = await req('DELETE', `/bands/${bandId}`, null, token);
check('DELETE /bands/:id → 204', delBand.status === 204);

const delHZ = await req('DELETE', `/action-goals/${goalId}`, null, token);
check('DELETE /action-goals/:id → 204', delHZ.status === 204);

const delMod = await req('DELETE', `/modules/${moduleId}`, null, token);
check('DELETE /modules/:id → 204', delMod.status === 204);

const gone = await req('GET', `/modules/${moduleId}`, null, token);
check('GET /modules/:id nach DELETE → 404', gone.status === 404);

// ── Ergebnis ──────────────────────────────────────────────────────
console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
