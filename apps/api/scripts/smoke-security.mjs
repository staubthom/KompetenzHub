/**
 * Smoke-Test – Sicherheitshärtung (Header, Eingabevalidierung, Rate Limiting).
 * Für den Rate-Limit-Test die API mit niedrigem Limit starten, z. B.:
 *   THROTTLE_AUTH_LIMIT=5 THROTTLE_LIMIT=50 node dist/main.js
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
let got429 = false;
for (let i = 0; i < burst; i++) {
  const r = await post('/auth/dev-login', { email: `rl-${i}@demo.ch`, role: 'LEARNER' });
  if (r.status === 429) got429 = true;
}
check(`Rate Limiting greift nach ${AUTH_LIMIT} Auth-Anfragen (429)`, got429, `Limit ${AUTH_LIMIT}`);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
