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

// ── KI im Mandanten aktivieren (durch die Lehrperson) ────────────
await req('PUT', '/ai/config', {
  provider: 'openai-compatible', baseUrl: 'https://stub.invalid/v1', model: 'stub-tutor-1',
  apiKey: 'sk-stub-tutor-123456', enabled: true,
}, teacher);

// /available meldet aktive KI (steuert die KI-Übung im Abgabe-Dialog)
const avail = await req('GET', '/expert-talk/available', null, studentA);
check('GET /expert-talk/available → available true', avail.status === 200 && avail.body?.available === true);

// ── FA-80: Gespräch starten (KI stellt erste Frage) ──────────────
const created = await req('POST', '/expert-talk/sessions', { topic: 'Betriebssysteme konfigurieren' }, studentA);
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

// ── Abschliessen → COMPLETED, danach keine Nachrichten mehr ──────
const done = await req('POST', `/expert-talk/sessions/${sessionId}/complete`, {}, studentA);
check('Abschliessen → COMPLETED', done.status === 200 && done.body?.status === 'COMPLETED');
const afterDone = await req('POST', `/expert-talk/sessions/${sessionId}/messages`, { content: 'Noch was?' }, studentA);
check('Senden nach Abschluss → 422', afterDone.status === 422);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
