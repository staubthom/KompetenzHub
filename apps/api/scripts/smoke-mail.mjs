/**
 * Smoke-Test – E-Mail-Benachrichtigungen (Einladung + Tages-Digest).
 * Prüft: Einladung löst den Mail-Pfad fehlerfrei aus (No-op ohne SMTP),
 * notifyDigest-Opt-out über /auth/me, manueller Digest-Lauf (Admin) und
 * RBAC (nur ADMIN darf den Digest auslösen). Läuft gegen http://localhost:3001.
 *
 * Hinweis: Ohne gesetztes SMTP_HOST versendet die API keine echten Mails –
 * der Test prüft die Pfade/Antworten, nicht die Zustellung.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackUser, cleanupUsers } from './_cleanup.mjs';

// .env aus dem Repo-Root laden (NODE lädt .env nicht automatisch)
try {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const lines = readFileSync(resolve(root, '.env'), 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* keine .env vorhanden – Umgebungsvariablen gelten weiterhin */
}

const BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';

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

const stamp = Date.now();

// ── Bootstrap: Admin + Lehrperson via Dev-Login ───────────────────
const adminLogin = await req('POST', '/auth/dev-login', {
  email: `mail-admin-${stamp}@demo.ch`,
  role: 'ADMIN',
});
const admin = adminLogin.body?.token;
check('Admin-Login', !!admin && adminLogin.body?.user?.roles?.includes('ADMIN'));
check('notifyDigest im Profil (Default true)', adminLogin.body?.user?.notifyDigest === true);

const teacherLogin = await req('POST', '/auth/dev-login', {
  email: `mail-teacher-${stamp}@demo.ch`,
  role: 'TEACHER',
});
const teacher = teacherLogin.body?.token;

// ── Einladung löst den Mail-Pfad fehlerfrei aus ───────────────────
const inv = await req(
  'POST',
  '/admin/invitations',
  { email: `mail-invited-${stamp}@schule.ch`, role: 'TEACHER' },
  admin,
);
check(
  'Einladung erstellt (Mail-Pfad ohne Fehler)',
  inv.status === 201 && inv.body?.status === 'PENDING',
);

// ── Opt-out: notifyDigest über /auth/me umschalten ────────────────
const off = await req('PATCH', '/auth/me', { notifyDigest: false }, admin);
check('notifyDigest = false speicherbar', off.status === 200 && off.body?.notifyDigest === false);
const on = await req('PATCH', '/auth/me', { notifyDigest: true }, admin);
check('notifyDigest = true wieder setzbar', on.status === 200 && on.body?.notifyDigest === true);

// ── Manueller Digest-Lauf (Admin) ─────────────────────────────────
const run = await req('POST', '/admin/notifications/digest-run', null, admin);
check(
  'Digest-Lauf liefert mails-Zähler',
  run.status === 201 && typeof run.body?.mails === 'number',
  `status ${run.status} body ${JSON.stringify(run.body)}`,
);

// ── Wochenbericht + Einladungs-Reminder (Admin) ───────────────────
const weekly = await req('POST', '/admin/notifications/weekly-report-run', null, admin);
check(
  'Wochenbericht-Lauf liefert mails-Zähler',
  weekly.status === 201 && typeof weekly.body?.mails === 'number',
);
const reminders = await req('POST', '/admin/notifications/invite-reminders-run', null, admin);
check(
  'Einladungs-Reminder-Lauf liefert mails-Zähler',
  reminders.status === 201 && typeof reminders.body?.mails === 'number',
);

// ── E-Mail-Vorlagen: lesen, anpassen, zurücksetzen ────────────────
const list = await req('GET', '/admin/mail-templates', null, admin);
const inviteDe = list.body?.find?.((x) => x.type === 'INVITE' && x.locale === 'de');
check(
  'Vorlagen-Liste enthält INVITE/de mit Platzhaltern',
  list.status === 200 && !!inviteDe && Array.isArray(inviteDe.placeholders),
);
check('INVITE/de zunächst nicht angepasst', inviteDe?.customized === false);

const customSubject = `Custom Betreff ${stamp}`;
const upd = await req(
  'PUT',
  '/admin/mail-templates/INVITE/de',
  { subject: customSubject, body: 'Hallo {{email}} – {{school}}' },
  admin,
);
check('Vorlage speicherbar', upd.status === 200 || upd.status === 201 || upd.status === 204);
const list2 = await req('GET', '/admin/mail-templates', null, admin);
const inviteDe2 = list2.body?.find?.((x) => x.type === 'INVITE' && x.locale === 'de');
check(
  'Angepasste Vorlage wird übernommen',
  inviteDe2?.customized === true && inviteDe2?.subject === customSubject,
  JSON.stringify(inviteDe2?.subject),
);

const del = await req('DELETE', '/admin/mail-templates/INVITE/de', null, admin);
check('Vorlage zurücksetzbar', del.status === 204);
const list3 = await req('GET', '/admin/mail-templates', null, admin);
const inviteDe3 = list3.body?.find?.((x) => x.type === 'INVITE' && x.locale === 'de');
check('Nach Reset wieder Standard', inviteDe3?.customized === false);

// ── RBAC: Lehrperson darf weder Digest noch Vorlagen anfassen ─────
const denied = await req('POST', '/admin/notifications/digest-run', null, teacher);
check('RBAC: TEACHER → digest-run = 403', denied.status === 403, `status ${denied.status}`);
const deniedTpl = await req('GET', '/admin/mail-templates', null, teacher);
check(
  'RBAC: TEACHER → mail-templates = 403',
  deniedTpl.status === 403,
  `status ${deniedTpl.status}`,
);

await cleanupUsers(BASE);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
