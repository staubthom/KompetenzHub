/**
 * Smoke-Test – Sicherheitshärtung (Header, Eingabevalidierung, Rate Limiting).
 * Für den Rate-Limit-Test die API mit niedrigem Limit starten, z. B.:
 * THROTTLE_AUTH_LIMIT=5 THROTTLE_LIMIT=50 node dist/main.js
 * Läuft gegen http://localhost:3001.
 */
const BASE = 'http://localhost:3001/api/v1';
const AUTH_LIMIT = Number(process.env.THROTTLE_AUTH_LIMIT ?? 60);

let ok = 0;
let fail = 0;
function check(label, cond, info = '') {
  if (cond) {
    console.log(`  OK   ${label}`);
    ok++;
  } else {
    console.log(`  FAIL ${label}${info ? ' – ' + info : ''}`);
    fail++;
  }
}

// ── Sichere HTTP-Header (helmet) ──────────────────────────────────
const h = await fetch(`${BASE}/health`);
check(
  'Header X-Content-Type-Options: nosniff',
  h.headers.get('x-content-type-options') === 'nosniff',
);
check(
  'Header X-Frame-Options oder CSP gesetzt',
  !!(h.headers.get('x-frame-options') || h.headers.get('content-security-policy')),
);
check('Header X-Powered-By entfernt', !h.headers.get('x-powered-by'));

// ── Eingabevalidierung (class-validator) ──────────────────────────
async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

const badEmail = await post('/auth/exchange', {
  provider: 'MICROSOFT',
  externalId: 'x',
  email: 'keine-email',
  displayName: 'Test',
});
check('Ungültige E-Mail → 400', badEmail.status === 400, `status ${badEmail.status}`);

const missing = await post('/auth/exchange', { provider: 'MICROSOFT' });
check('Fehlende Pflichtfelder → 400', missing.status === 400, `status ${missing.status}`);

const badProvider = await post('/auth/exchange', {
  provider: 'FACEBOOK',
  externalId: 'x',
  email: 'a@b.ch',
  displayName: 'T',
});
check('Ungültiger Enum-Wert → 400', badProvider.status === 400, `status ${badProvider.status}`);

// ── Rate Limiting (429) ───────────────────────────────────────────
const burst = AUTH_LIMIT + 5;

// Requests parallel abfeuern für einen echten Belastungstest
const promises = Array.from({ length: burst }).map((_, i) =>
  post('/auth/dev-login', { email: `rl-${i}@demo.ch`, role: 'LEARNER' })
);
const results = await Promise.all(promises);
const got429 = results.some(r => r.status === 429);

check(`Rate Limiting greift nach ${AUTH_LIMIT} Auth-Anfragen (429)`, got429, `Limit ${AUTH_LIMIT}`);

// ── Auth-Guard: geschützte Routen ─────────────────────────────────
async function get(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}${path}`, { headers });
  return res.status;
}

const s1 = await get('/modules');
check('Geschützte Route ohne Token → 401', s1 === 401, `status ${s1}`);

const s2 = await get('/modules', 'not.a.valid.jwt');
check('Geschützte Route mit ungültigem Token → 401', s2 === 401, `status ${s2}`);

const s3 = await get('/modules', 'eyJhbGciOiJIUzI1NiJ9.e30.INVALIDSIG');
check('Geschützte Route mit gefälschter Signatur → 401', s3 === 401, `status ${s3}`);

// ── Injection & XSS-Basics ────────────────────────────────────────
// Ziel: Blockiert (400) oder verarbeitet (201), Hauptsache kein Systemabsturz (500).

const xss = await post('/auth/exchange', {
  provider: 'MICROSOFT',
  externalId: 'x',
  email: 'xss@test.ch',
  displayName: '<script>alert(document.cookie)</script>',
});
check('XSS-Payload in displayName → blockiert oder verarbeitet, kein 500', xss.status === 400 || xss.status === 201, `status ${xss.status}`);

const sqli = await post('/auth/exchange', {
  provider: 'MICROSOFT',
  externalId: "'; DROP TABLE users; --",
  email: 'sqli@test.ch',
  displayName: "' OR '1'='1",
});
check('SQL-Injection in externalId/displayName → blockiert oder verarbeitet, kein 500', sqli.status === 400 || sqli.status === 201, `status ${sqli.status}`);

const nosql = await post('/auth/exchange', {
  provider: 'MICROSOFT',
  externalId: { $gt: '' },   // NoSQL-Operator als Wert → class-validator erwartet string
  email: 'nosql@test.ch',
  displayName: 'test',
});
check('NoSQL-Injection-Objekt in externalId → blockiert oder verarbeitet, kein 500', nosql.status === 400 || nosql.status === 201, `status ${nosql.status}`);

// ── CORS-Header ───────────────────────────────────────────────────
const corsSimple = await fetch(`${BASE}/health`, {
  headers: { Origin: 'http://malicious.com' },
});
const acao = corsSimple.headers.get('access-control-allow-origin');
check(
  'CORS: fremder Origin wird blockiert und kein Wildcard gesetzt',
  acao !== 'http://malicious.com' && acao !== '*',
  `Access-Control-Allow-Origin: ${acao ?? '(nicht gesetzt)'}`,
);

const corsPreflight = await fetch(`${BASE}/modules`, {
  method: 'OPTIONS',
  headers: {
    Origin: 'http://malicious.com',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'Authorization',
  },
});
const preflightAcao = corsPreflight.headers.get('access-control-allow-origin');
check(
  'CORS-Preflight: fremder Origin blockiert und kein Wildcard gesetzt',
  preflightAcao !== 'http://malicious.com' && preflightAcao !== '*',
  `Preflight Access-Control-Allow-Origin: ${preflightAcao ?? '(nicht gesetzt)'}`,
);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);