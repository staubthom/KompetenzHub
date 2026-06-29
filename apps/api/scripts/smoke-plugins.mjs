/**
 * Smoke-Test – Plugin-Plattform (Pilot, Modell A).
 * Prüft: RBAC der Admin-Endpunkte, Discovery/Installation, Enable/Disable,
 * den generischen Dispatcher (/plugins/:id/:route) inkl. Aktivierungs- und
 * Rollen-Gating, die Contributions-Sicht, Konfiguration sowie den Uninstall
 * mit Cleanup (Vorbedingung „deaktiviert" + Datenlöschung).
 *
 * Voraussetzung: API läuft auf http://localhost:3001 und das Beispiel-Plugin
 * ist gebaut (plugins/packages/_example/dist/server). DEV_LOGIN muss aktiv sein.
 */
import { trackUser, cleanupUsers } from './_cleanup.mjs';

const BASE = 'http://localhost:3001/api/v1';
const PLUGIN = 'example';

let ok = 0;
let fail = 0;

async function req(method, path, body, token) {
  if (path === '/auth/dev-login' && body?.email) trackUser(body.email);
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
async function login(role) {
  const r = await req('POST', '/auth/dev-login', {
    email: `${role.toLowerCase()}-plugins-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@demo.ch`,
    role,
  });
  return r.body?.token;
}

const admin = await login('ADMIN');
const teacher = await login('TEACHER');
const learner = await login('LEARNER');
check('Logins (ADMIN/TEACHER/LEARNER)', !!admin && !!teacher && !!learner);

// ── RBAC der Admin-Endpunkte ──────────────────────────────────────
const adminDenied = await req('GET', '/admin/plugins', null, teacher);
check(
  'RBAC: TEACHER → /admin/plugins = 403',
  adminDenied.status === 403,
  `status ${adminDenied.status}`,
);
const adminAnon = await req('GET', '/admin/plugins', null, null);
check('RBAC: ohne Token = 401', adminAnon.status === 401, `status ${adminAnon.status}`);

// ── Discovery/Installation sichtbar ───────────────────────────────
const list = await req('GET', '/admin/plugins', null, admin);
const inst = list.body?.find?.((p) => p.pluginId === PLUGIN);
check(
  'Beispiel-Plugin ist installiert',
  list.status === 200 && !!inst && inst.installStatus === 'INSTALLED',
  JSON.stringify(inst),
);

// ── Vor Aktivierung: Dispatcher 404, Contributions leer ───────────
const pingBefore = await req('GET', `/plugins/${PLUGIN}/ping`, null, teacher);
check(
  'Vor Enable: /plugins/example/ping = 404',
  pingBefore.status === 404,
  `status ${pingBefore.status}`,
);
const contribBefore = await req('GET', '/plugins/contributions', null, teacher);
check(
  'Vor Enable: nicht in Contributions',
  contribBefore.status === 200 &&
    !contribBefore.body?.plugins?.some?.((p) => p.pluginId === PLUGIN),
);

// ── Aktivieren (Admin) ────────────────────────────────────────────
const enable = await req('POST', `/admin/plugins/${PLUGIN}/enable`, {}, admin);
check(
  'Enable (Admin)',
  enable.status === 200 && enable.body?.enabled === true,
  `status ${enable.status}`,
);

// ── Nach Aktivierung: Dispatch + Contributions + Rollen ───────────
const ping = await req('GET', `/plugins/${PLUGIN}/ping`, null, teacher);
check(
  'Dispatch: TEACHER /ping = 200 pong',
  ping.status === 200 && ping.body?.pong === true && ping.body?.plugin === PLUGIN,
  JSON.stringify(ping.body),
);
const pingLearner = await req('GET', `/plugins/${PLUGIN}/ping`, null, learner);
check(
  'Dispatch: LERNENDE /ping = 200 (Route erlaubt alle Rollen)',
  pingLearner.status === 200,
  `status ${pingLearner.status}`,
);
const pingAnon = await req('GET', `/plugins/${PLUGIN}/ping`, null, null);
check('Dispatch: ohne Token = 401', pingAnon.status === 401, `status ${pingAnon.status}`);
const unknownRoute = await req('GET', `/plugins/${PLUGIN}/does-not-exist`, null, teacher);
check(
  'Dispatch: unbekannte Route = 404',
  unknownRoute.status === 404,
  `status ${unknownRoute.status}`,
);
const unknownPlugin = await req('GET', '/plugins/nope/ping', null, teacher);
check(
  'Dispatch: unbekanntes Plugin = 404',
  unknownPlugin.status === 404,
  `status ${unknownPlugin.status}`,
);

const contrib = await req('GET', '/plugins/contributions', null, teacher);
const ex = contrib.body?.plugins?.find?.((p) => p.pluginId === PLUGIN);
check(
  'Contributions: Nav + Widget für TEACHER',
  !!ex && ex.nav?.length > 0 && ex.widgets?.some?.((w) => w.slot === 'teacher.dashboard'),
  JSON.stringify(ex),
);

// ── Konfiguration ─────────────────────────────────────────────────
const cfg = await req(
  'PATCH',
  `/admin/plugins/${PLUGIN}/config`,
  { config: { greeting: 'hi' } },
  admin,
);
check(
  'Konfiguration gespeichert (configVersion↑)',
  cfg.status === 200 && cfg.body?.configVersion >= 1,
  `status ${cfg.status}`,
);

// ── Uninstall-Vorbedingung: muss deaktiviert sein ─────────────────
const uninstallEnabled = await req('POST', `/admin/plugins/${PLUGIN}/uninstall`, {}, admin);
check(
  'Uninstall bei aktivem Plugin = 409',
  uninstallEnabled.status === 409,
  `status ${uninstallEnabled.status}`,
);

// ── Deaktivieren ──────────────────────────────────────────────────
const disable = await req('POST', `/admin/plugins/${PLUGIN}/disable`, {}, admin);
check(
  'Disable (Admin)',
  disable.status === 200 && disable.body?.enabled === false,
  `status ${disable.status}`,
);
const pingAfterDisable = await req('GET', `/plugins/${PLUGIN}/ping`, null, teacher);
check(
  'Nach Disable: /ping = 404',
  pingAfterDisable.status === 404,
  `status ${pingAfterDisable.status}`,
);

// ── Uninstall mit Cleanup (der /ping-Aufruf hat 1 Datensatz erzeugt) ──
const uninstall = await req('POST', `/admin/plugins/${PLUGIN}/uninstall`, {}, admin);
check(
  'Uninstall: 200 + Datensatz gelöscht (Cleanup verifiziert)',
  uninstall.status === 200 && uninstall.body?.removedData >= 1,
  JSON.stringify(uninstall.body),
);

// ── Nach Uninstall: Installation bleibt, Aktivierung weg ──────────
const listAfter = await req('GET', '/admin/plugins', null, admin);
const instAfter = listAfter.body?.find?.((p) => p.pluginId === PLUGIN);
check('Nach Uninstall: installiert aber deaktiviert', !!instAfter && instAfter.enabled === false);

await cleanupUsers(BASE);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
