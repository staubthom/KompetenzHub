/**
 * Smoke-Test – Schuladmin-Dashboard + Zugangs-Gate (Sprint 11).
 * Prüft: Einladung→Promotion, Default-LERNENDE, Sperre, Provider-Schalter,
 * Rollenwechsel sowie RBAC (nur ADMIN). Läuft gegen http://localhost:3001.
 *
 * Dev-Login umgeht das Gate (Entwicklung); das echte Gate wird über
 * /auth/exchange (IdP-Pfad) getestet.
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

const stamp = Date.now();
function exchange(email, provider = 'MICROSOFT', desiredRole) {
  return req('POST', '/auth/exchange', {
    provider,
    externalId: `ext:${email}`,
    email,
    displayName: email.split('@')[0],
    desiredRole,
  });
}

// ── Bootstrap: Admin via Dev-Login (umgeht Gate) ──────────────────
const adminLogin = await req('POST', '/auth/dev-login', {
  email: `admin-${stamp}@demo.ch`,
  role: 'ADMIN',
});
const admin = adminLogin.body?.token;
check('Admin-Login', !!admin && adminLogin.body?.user?.roles?.includes('ADMIN'));

// ── RBAC: Lehrperson darf nicht ins Admin-Modul ───────────────────
const teacherLogin = await req('POST', '/auth/dev-login', {
  email: `t-${stamp}@demo.ch`,
  role: 'TEACHER',
});
const teacher = teacherLogin.body?.token;
const denied = await req('GET', '/admin/users', null, teacher);
check('RBAC: TEACHER → /admin/users = 403', denied.status === 403, `status ${denied.status}`);
const anon = await req('GET', '/admin/users', null, null);
check('RBAC: ohne Token = 401', anon.status === 401, `status ${anon.status}`);

// ── Übersicht ─────────────────────────────────────────────────────
const overview = await req('GET', '/admin/overview', null, admin);
check('Übersicht liefert Kennzahlen', overview.status === 200 && typeof overview.body?.teachers === 'number');

// ── Einladung → Promotion beim ersten Login ───────────────────────
const invitedEmail = `invited-${stamp}@schule.ch`;
const inv = await req('POST', '/admin/invitations', { email: invitedEmail, role: 'TEACHER' }, admin);
check('Einladung erstellt', inv.status === 201 && inv.body?.status === 'PENDING');
const invList = await req('GET', '/admin/invitations', null, admin);
check('Einladung in Liste', invList.body?.some?.((i) => i.email === invitedEmail));

const invitedLogin = await exchange(invitedEmail);
check(
  'Eingeladene Person wird beim Login TEACHER',
  invitedLogin.body?.user?.roles?.includes('TEACHER'),
  JSON.stringify(invitedLogin.body?.user?.roles),
);
const invListAfter = await req('GET', '/admin/invitations', null, admin);
check('Einladung nach Login eingelöst (weg)', !invListAfter.body?.some?.((i) => i.email === invitedEmail));

// ── Nicht eingeladene Person → LERNENDE ───────────────────────────
const learnerEmail = `walkin-${stamp}@schule.ch`;
const learnerLogin = await exchange(learnerEmail, 'MICROSOFT', 'TEACHER'); // desiredRole wird ignoriert
check(
  'Unbekannter Login wird LERNENDE (desiredRole ignoriert)',
  learnerLogin.body?.user?.roles?.includes('LEARNER') &&
    !learnerLogin.body?.user?.roles?.includes('TEACHER'),
  JSON.stringify(learnerLogin.body?.user?.roles),
);
const learnerId = learnerLogin.body?.user?.id;

// ── Promotion bestehender Person ──────────────────────────────────
const promote = await req('PATCH', `/admin/users/${learnerId}/role`, { role: 'TEACHER' }, admin);
check('Promotion LERNENDE → TEACHER', promote.status === 200 && promote.body?.role === 'TEACHER');

// ── Konto sperren → Login verweigert ──────────────────────────────
const disable = await req('PATCH', `/admin/users/${learnerId}/status`, { active: false }, admin);
check('Konto sperren', disable.status === 200 && disable.body?.status === 'DISABLED');
const blocked = await exchange(learnerEmail);
check('Gesperrtes Konto kann sich nicht anmelden', blocked.status === 401, `status ${blocked.status}`);
const reenable = await req('PATCH', `/admin/users/${learnerId}/status`, { active: true }, admin);
check('Konto entsperren', reenable.status === 200 && reenable.body?.status === 'ACTIVE');

// ── Self-Schutz: Admin kann sich nicht selbst sperren ─────────────
const adminId = adminLogin.body?.user?.id;
const selfDisable = await req('PATCH', `/admin/users/${adminId}/status`, { active: false }, admin);
check('Admin kann sich nicht selbst sperren', selfDisable.status === 400, `status ${selfDisable.status}`);

// ── Auth-Provider-Schalter ────────────────────────────────────────
const off = await req('PATCH', '/admin/settings', { authProviders: { google: false } }, admin);
check('Google-Provider deaktiviert', off.status === 200 && off.body?.authProviders?.google === false);
const googleBlocked = await exchange(`g-${stamp}@schule.ch`, 'GOOGLE');
check('Login über deaktivierten Provider abgewiesen', googleBlocked.status === 401, `status ${googleBlocked.status}`);
const msStillOk = await exchange(`m-${stamp}@schule.ch`, 'MICROSOFT');
check('Aktiver Provider weiterhin möglich', msStillOk.status === 201 || msStillOk.status === 200);
await req('PATCH', '/admin/settings', { authProviders: { google: true } }, admin); // zurücksetzen

// ── Einladung zurückziehen ────────────────────────────────────────
const inv2 = await req('POST', '/admin/invitations', { email: `revoke-${stamp}@schule.ch`, role: 'TEACHER' }, admin);
const rev = await req('DELETE', `/admin/invitations/${inv2.body?.id}`, null, admin);
check('Einladung zurückziehen', rev.status === 204);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
