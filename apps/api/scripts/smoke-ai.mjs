/**
 * Smoke-Test – KI-Konfiguration je Lehrperson (FA-34).
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

// ── Setup ─────────────────────────────────────────────────────────
const t = await req('POST', '/auth/dev-login', { email: 'ai-teacher@demo.ch', role: 'TEACHER' });
const teacher = t.body?.token;
const s = await req('POST', '/auth/dev-login', { email: 'ai-student@demo.ch', role: 'LEARNER' });
const student = s.body?.token;
check('Logins', !!teacher && !!student);

// ── Default-Konfiguration (noch nichts gespeichert) ───────────────
const def = await req('GET', '/ai/config', null, teacher);
check('GET /ai/config liefert Defaults', def.status === 200 && def.body?.provider === 'openai');
check('Default: kein API-Key', def.body?.hasApiKey === false && def.body?.apiKeyMask === null);
check('Default: deaktiviert', def.body?.enabled === false);

// ── Speichern inkl. API-Key ───────────────────────────────────────
const saved = await req(
  'PUT',
  '/ai/config',
  {
    provider: 'openai-compatible',
    baseUrl: 'https://example.invalid/v1/',
    model: 'gpt-4o-mini',
    apiKey: 'sk-supersecret-123456',
    enabled: true,
  },
  teacher,
);
check('PUT /ai/config speichert', saved.status === 200);
check('baseUrl normalisiert (kein Trailing-Slash)', saved.body?.baseUrl === 'https://example.invalid/v1');
check('hasApiKey true nach Speichern', saved.body?.hasApiKey === true);
check('Key wird maskiert zurückgegeben', saved.body?.apiKeyMask?.endsWith('3456') === true);
check(
  'Klartext-Key NIE im Response',
  JSON.stringify(saved.body).includes('supersecret') === false,
  JSON.stringify(saved.body),
);

// ── Erneut lesen: Key bleibt maskiert ─────────────────────────────
const re = await req('GET', '/ai/config', null, teacher);
check('Re-GET: hasApiKey bleibt true', re.body?.hasApiKey === true);
check('Re-GET: kein Klartext-Key', JSON.stringify(re.body).includes('supersecret') === false);

// ── Status (Feature-Gate) ─────────────────────────────────────────
const st = await req('GET', '/ai/status', null, teacher);
check('GET /ai/status configured+enabled', st.body?.configured === true && st.body?.enabled === true);

// ── Teil-Update: nur Modell ändern, Key beibehalten ───────────────
const upd = await req('PUT', '/ai/config', { model: 'gpt-4o' }, teacher);
check('Teil-Update behält Key', upd.body?.model === 'gpt-4o' && upd.body?.hasApiKey === true);

// ── Verbindungstest gegen unerreichbaren Endpoint → ok:false (200) ─
const test = await req('POST', '/ai/config/test', {}, teacher);
check('POST /ai/config/test antwortet 200', test.status === 200);
check('Test gegen Fake-Endpoint: ok=false', test.body?.ok === false && typeof test.body?.message === 'string');

// ── Validierung ───────────────────────────────────────────────────
const badProvider = await req('PUT', '/ai/config', { provider: 'hal9000' }, teacher);
check('Unbekannter Provider → 400', badProvider.status === 400);
const badUrl = await req('PUT', '/ai/config', { baseUrl: 'ftp://nope' }, teacher);
check('Ungültige baseUrl → 400', badUrl.status === 400);

// ── RBAC: Lernende:r hat keinen Zugriff ───────────────────────────
const forbidden = await req('GET', '/ai/config', null, student);
check('Lernende:r → 403 auf /ai/config', forbidden.status === 403);

// ── Key entfernen ─────────────────────────────────────────────────
const cleared = await req('PUT', '/ai/config', { apiKey: '' }, teacher);
check('API-Key entfernbar', cleared.body?.hasApiKey === false);
const st2 = await req('GET', '/ai/status', null, teacher);
check('Ohne Key: Feature-Gate deaktiviert', st2.body?.configured === false && st2.body?.enabled === false);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
