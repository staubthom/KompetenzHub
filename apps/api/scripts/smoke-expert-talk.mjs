/**
 * Smoke-Test – KI-Fachgespräch / Übungsmodus (FA-80).
 * Erfordert die API mit AI_STUB_MODE=1 (deterministische KI-Antworten).
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

// ── Setup: frische Lehrperson (KI-Provider) + zwei Lernende ───────
const teacherEmail = `et-teacher-${Date.now()}@demo.ch`;
const t = await req('POST', '/auth/dev-login', { email: teacherEmail, role: 'TEACHER' });
const teacher = t.body?.token;
const s1 = await req('POST', '/auth/dev-login', { email: `et-stud-a-${Date.now()}@demo.ch`, role: 'LEARNER' });
const studentA = s1.body?.token;
const s2 = await req('POST', '/auth/dev-login', { email: `et-stud-b-${Date.now()}@demo.ch`, role: 'LEARNER' });
const studentB = s2.body?.token;
check('Logins', !!teacher && !!studentA && !!studentB);

// ── Feature-Gate: ohne aktive KI im Mandanten → 409 ──────────────
// (frischer Mandant-Zustand ist nicht garantiert; daher tolerant prüfen)
const gate = await req('POST', '/expert-talk/sessions', { topic: 'Gate-Test' }, studentA);
check('Start ohne/mit KI liefert 409 oder 201', gate.status === 409 || gate.status === 201, `status=${gate.status}`);

// ── KI im Mandanten aktivieren + für Lernende freigeben ──────────
await req('PUT', '/ai/config', {
  provider: 'openai-compatible', baseUrl: 'https://stub.invalid/v1', model: 'stub-tutor-1',
  apiKey: 'sk-stub-tutor-123456', enabled: true, shareWithLearners: true,
}, teacher);

// /available meldet nutzbare KI (freigegebene Lehrer-KI)
const avail = await req('GET', '/expert-talk/available', null, studentA);
check('GET /expert-talk/available → available true', avail.status === 200 && avail.body?.available === true);

// ── FA-80: Gespräch starten (KI stellt erste Frage) ──────────────
const created = await req('POST', '/expert-talk/sessions', { topic: 'Betriebssysteme konfigurieren', context: '<p>Beschreibe die <strong>UAC</strong>-Konfiguration.</p>' }, studentA);
check('Gespräch starten → 201', created.status === 201, `status=${created.status}`);
const sessionId = created.body?.id;
check('Session hat Thema', created.body?.topic === 'Betriebssysteme konfigurieren');
check('KI stellt erste Frage (assistant)', Array.isArray(created.body?.messages) &&
  created.body.messages.length === 1 && created.body.messages[0].role === 'assistant' &&
  created.body.messages[0].content.length > 0);

// Leeres Thema → 422
const empty = await req('POST', '/expert-talk/sessions', { topic: '   ' }, studentA);
check('Leeres Thema → 422', empty.status === 422);

// ── Antwort senden → KI antwortet ────────────────────────────────
const msg = await req('POST', `/expert-talk/sessions/${sessionId}/messages`, { content: 'UAC fragt bei Adminrechten nach.' }, studentA);
check('Antwort senden → 200 (assistant)', msg.status === 200 && msg.body?.role === 'assistant' && msg.body?.content.length > 0);

// Leere Antwort → 422
const emptyMsg = await req('POST', `/expert-talk/sessions/${sessionId}/messages`, { content: '' }, studentA);
check('Leere Antwort → 422', emptyMsg.status === 422);

// ── Verlauf wird gespeichert/abrufbar (Frage, Antwort, Frage) ────
const got = await req('GET', `/expert-talk/sessions/${sessionId}`, null, studentA);
check('Verlauf gespeichert (3 Nachrichten)', got.body?.messages?.length === 3);
check('Reihenfolge assistant → user → assistant',
  got.body?.messages?.[0]?.role === 'assistant' &&
  got.body?.messages?.[1]?.role === 'user' &&
  got.body?.messages?.[2]?.role === 'assistant');

// ── Liste enthält das Gespräch ───────────────────────────────────
const list = await req('GET', '/expert-talk/sessions', null, studentA);
check('Liste enthält Gespräch', Array.isArray(list.body) && list.body.some((x) => x.id === sessionId));

// ── RBAC: andere:r Lernende:r darf fremdes Gespräch nicht sehen ──
const foreign = await req('GET', `/expert-talk/sessions/${sessionId}`, null, studentB);
check('Fremdzugriff → 403', foreign.status === 403, `status=${foreign.status}`);

// ── Modul-weites Lerngespräch (Kontext = alle Kompetenzen) ───────
const modNum = `ET${Date.now()}`;
const mod = await req('POST', '/modules', { number: modNum, title: { de: 'KI-Modul-Üben' } }, teacher);
const moduleId = mod.body?.id;
const det = await req('GET', `/modules/${moduleId}`, null, teacher);
const matrixId = det.body?.matrix?.id;
const hz = await req('POST', `/modules/${moduleId}/action-goals`, { code: '1', text: { de: 'HZ' } }, teacher);
const band = await req('POST', `/matrices/${matrixId}/bands`, { code: 'A1', actionGoalIds: [hz.body.id] }, teacher);
const fieldId = band.body?.fields?.[0]?.id;
await req('PUT', `/fields/${fieldId}/descriptor`, { text: { de: 'Ich kann ein Netzwerk dokumentieren.' } }, teacher);
const cls = await req('POST', '/classes', { name: 'ET-Anlass', moduleId }, teacher);
const code = await req('POST', `/classes/${cls.body.id}/join-code`, {}, teacher);
await req('POST', '/classes/join', { code: code.body?.code }, studentA);

const modSession = await req('POST', '/expert-talk/module-sessions', { moduleId }, studentA);
check('Modul-Session starten → 201', modSession.status === 201, `status=${modSession.status}`);
check('Modul-Session hat mode=module', modSession.body?.mode === 'module');
check('Modul-Session KI stellt erste Frage', modSession.body?.messages?.[0]?.role === 'assistant' && modSession.body.messages[0].content.length > 0);
const modList = await req('GET', '/expert-talk/sessions', null, studentA);
check('Liste enthält Modul-Session mit mode', modList.body.some((x) => x.id === modSession.body.id && x.mode === 'module'));

// Modul ohne Kompetenzen → 422
const emptyMod = await req('POST', '/modules', { number: `ETX${Date.now()}`, title: { de: 'Leer' } }, teacher);
const clsE = await req('POST', '/classes', { name: 'ET-Leer', moduleId: emptyMod.body.id }, teacher);
const codeE = await req('POST', `/classes/${clsE.body.id}/join-code`, {}, teacher);
await req('POST', '/classes/join', { code: codeE.body?.code }, studentA);
const noComp = await req('POST', '/expert-talk/module-sessions', { moduleId: emptyMod.body.id }, studentA);
check('Modul ohne Kompetenzen → 422', noComp.status === 422, `status=${noComp.status}`);

// ── KI-Quelle: eigene KI vs. freigegebene Lehrer-KI ───────────────
const sc = await req('POST', '/auth/dev-login', { email: `et-stud-c-${Date.now()}@demo.ch`, role: 'LEARNER' });
const studentC = sc.body?.token;
const availC1 = await req('GET', '/expert-talk/available', null, studentC);
check('Freigegebene Lehrer-KI → verfügbar', availC1.body?.available === true);
// Freigabe entziehen → ohne eigene KI nicht mehr verfügbar
await req('PUT', '/ai/config', { shareWithLearners: false }, teacher);
const availC2 = await req('GET', '/expert-talk/available', null, studentC);
check('Ohne Freigabe & ohne eigene KI → nicht verfügbar', availC2.body?.available === false);
const blockedC = await req('POST', '/expert-talk/sessions', { topic: 'Kein Zugang' }, studentC);
check('Ohne KI → Start 409', blockedC.status === 409, `status=${blockedC.status}`);
// studentC konfiguriert eigene KI → Vorrang, verfügbar
await req('PUT', '/ai/config', {
  provider: 'openai-compatible', baseUrl: 'https://stub.invalid/v1', model: 'stub-own', apiKey: 'sk-own-123456', enabled: true,
}, studentC);
const availC3 = await req('GET', '/expert-talk/available', null, studentC);
check('Eigene KI → verfügbar (ohne Lehrer-Freigabe)', availC3.body?.available === true);
const ownSession = await req('POST', '/expert-talk/sessions', { topic: 'Eigene KI' }, studentC);
check('Start mit eigener KI → 201', ownSession.status === 201, `status=${ownSession.status}`);
// Lehrer-Freigabe wiederherstellen
await req('PUT', '/ai/config', { shareWithLearners: true }, teacher);

// ── Abschliessen → COMPLETED, danach keine Nachrichten mehr ──────
const done = await req('POST', `/expert-talk/sessions/${sessionId}/complete`, {}, studentA);
check('Abschliessen → COMPLETED', done.status === 200 && done.body?.status === 'COMPLETED');
const afterDone = await req('POST', `/expert-talk/sessions/${sessionId}/messages`, { content: 'Noch was?' }, studentA);
check('Senden nach Abschluss → 422', afterDone.status === 422);

// ── Aufräumen ─────────────────────────────────────────────────────
await req('DELETE', `/classes/${cls.body.id}`, null, teacher);
await req('DELETE', `/classes/${clsE.body.id}`, null, teacher);
await req('DELETE', `/modules/${moduleId}`, null, teacher);
await req('DELETE', `/modules/${emptyMod.body.id}`, null, teacher);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
