/**
 * Smoke-Test – Sicherheitshärtung (Header, Eingabevalidierung, Rate Limiting).
 * Für den Rate-Limit-Test die API mit niedrigem Limit starten, z. B.:
 * THROTTLE_AUTH_LIMIT=5 THROTTLE_LIMIT=50 node dist/main.js
 * Läuft gegen http://localhost:3001.
 */
import { trackUser, cleanupUsers } from './_cleanup.mjs';

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
  if ((path === '/auth/dev-login' || path === '/auth/exchange') && body?.email) {
    trackUser(body.email);
  }
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

// Hilfsfunktion mit Token/Methode für die folgenden Blöcke.
async function authReq(method, path, body, token, extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

// ── Rollen-Isolation über den globalen RolesGuard ─────────────────
// (Vor dem Rate-Limit-Test, damit das Auth-Throttling-Fenster noch frei ist.)
const learner = await post('/auth/dev-login', {
  email: `sec-learner-${Date.now()}@demo.ch`,
  role: 'LEARNER',
});
const learnerToken = learner.body?.token;
if (learnerToken) {
  const lAdmin = await authReq('GET', '/admin/users', undefined, learnerToken);
  check('Lernende:r kann Admin-Route nicht nutzen → 403', lAdmin.status === 403, `status ${lAdmin.status}`);
  const lMod = await authReq(
    'POST',
    '/modules',
    { number: `S${Date.now()}`, title: { de: 'X' } },
    learnerToken,
  );
  check('Lernende:r kann kein Modul anlegen → 403', lMod.status === 403, `status ${lMod.status}`);
}

// ── SVG-Downloads werden als Attachment ausgeliefert (kein Inline-XSS) ──
const secTeacher = await post('/auth/dev-login', {
  email: `sec-teacher-${Date.now()}@demo.ch`,
  role: 'TEACHER',
});
const secTeacherToken = secTeacher.body?.token;
if (secTeacherToken) {
  const svgUp = await authReq(
    'POST',
    '/assets/image-upload-url',
    { fileName: 'logo.svg', contentType: 'image/svg+xml', sizeBytes: 16 },
    secTeacherToken,
  );
  const svgView = decodeURIComponent(svgUp.body?.viewUrl ?? '');
  check(
    'SVG-Download erzwingt Content-Disposition: attachment',
    /content-disposition=attachment/i.test(svgView),
    `viewUrl=${svgView.slice(0, 90)}`,
  );
  const pngUp = await authReq(
    'POST',
    '/assets/image-upload-url',
    { fileName: 'foto.png', contentType: 'image/png', sizeBytes: 16 },
    secTeacherToken,
  );
  const pngView = decodeURIComponent(pngUp.body?.viewUrl ?? '');
  check(
    'PNG-Vorschau bleibt inline (kein erzwungenes attachment)',
    pngView.length > 0 && !/content-disposition=attachment/i.test(pngView),
    `viewUrl=${pngView.slice(0, 90)}`,
  );
}

// ── Selbstregistrierung nur mit erlaubter E-Mail-Domain ───────────
const EXCHANGE_SECRET = process.env.AUTH_EXCHANGE_SECRET;
async function exchange(profile) {
  if (profile.email) trackUser(profile.email);
  const headers = { 'Content-Type': 'application/json' };
  if (EXCHANGE_SECRET) headers['x-auth-exchange'] = EXCHANGE_SECRET;
  const res = await fetch(`${BASE}/auth/exchange`, {
    method: 'POST',
    headers,
    body: JSON.stringify(profile),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}
// Probe: ist der Exchange-Pfad mit unserem (evtl. fehlenden) Secret nutzbar?
const probe = await exchange({
  provider: 'KOMPETENZHUB',
  externalId: `probe-${Date.now()}`,
  email: `sec-probe-${Date.now()}@stud.gibb.ch`,
  displayName: 'Probe',
});
if (!probe.body?.token) {
  console.log(
    `  SKIP Registrierungs-Domain-Tests (Exchange nicht nutzbar, status ${probe.status} – AUTH_EXCHANGE_SECRET im Testlauf setzen)`,
  );
} else {
  const admin = await post('/auth/dev-login', {
    email: `sec-admin-${Date.now()}@demo.ch`,
    role: 'ADMIN',
  });
  const adminToken = admin.body?.token;
  const set = await authReq(
    'PATCH',
    '/admin/settings',
    { allowedRegistrationDomains: ['stud.gibb.ch'] },
    adminToken,
  );
  check('Schuladmin kann Registrierungs-Domains setzen', set.status === 200, `status ${set.status}`);

  const bad = await exchange({
    provider: 'KOMPETENZHUB',
    externalId: `bad-${Date.now()}`,
    email: `sec-bad-${Date.now()}@nicht-erlaubt.ch`,
    displayName: 'Fremd',
  });
  check('Registrierung mit fremder Domain → 403', bad.status === 403, `status ${bad.status}`);

  const good = await exchange({
    provider: 'KOMPETENZHUB',
    externalId: `good-${Date.now()}`,
    email: `sec-good-${Date.now()}@stud.gibb.ch`,
    displayName: 'Erlaubt',
  });
  check('Registrierung mit erlaubter Domain → Token', !!good.body?.token, `status ${good.status}`);

  const badDomain = await authReq(
    'PATCH',
    '/admin/settings',
    { allowedRegistrationDomains: ['kein domain!'] },
    adminToken,
  );
  check('Ungültige Domain wird abgelehnt → 400', badDomain.status === 400, `status ${badDomain.status}`);

  // Einstellung zurücksetzen (keine Einschränkung), damit andere Läufe unbeeinflusst bleiben.
  await authReq('PATCH', '/admin/settings', { allowedRegistrationDomains: [] }, adminToken);
}

// ── Rate Limiting (429) ───────────────────────────────────────────
const burst = AUTH_LIMIT + 5;

// Requests parallel abfeuern für einen echten Belastungstest
const promises = Array.from({ length: burst }).map((_, i) =>
  post('/auth/dev-login', { email: `rl-${i}@demo.ch`, role: 'LEARNER' }),
);
const results = await Promise.all(promises);
const got429 = results.some((r) => r.status === 429);

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
check(
  'XSS-Payload in displayName → blockiert oder verarbeitet, kein 500',
  xss.status === 400 || xss.status === 201,
  `status ${xss.status}`,
);

const sqli = await post('/auth/exchange', {
  provider: 'MICROSOFT',
  externalId: "'; DROP TABLE users; --",
  email: 'sqli@test.ch',
  displayName: "' OR '1'='1",
});
check(
  'SQL-Injection in externalId/displayName → blockiert oder verarbeitet, kein 500',
  sqli.status === 400 || sqli.status === 201,
  `status ${sqli.status}`,
);

const nosql = await post('/auth/exchange', {
  provider: 'MICROSOFT',
  externalId: { $gt: '' }, // NoSQL-Operator als Wert → class-validator erwartet string
  email: 'nosql@test.ch',
  displayName: 'test',
});
check(
  'NoSQL-Injection-Objekt in externalId → blockiert oder verarbeitet, kein 500',
  nosql.status === 400 || nosql.status === 201,
  `status ${nosql.status}`,
);

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

await cleanupUsers(BASE);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
