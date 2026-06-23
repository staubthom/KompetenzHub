/**
 * A11y-Audit der Kernscreens mit axe-core (WCAG 2.1 A/AA).
 * Voraussetzung: Web (http://localhost:3000) und API (http://localhost:3001) laufen
 * sowie ein Browser (npx playwright install chromium).
 *
 *   node apps/web/scripts/a11y-audit.mjs
 *
 * Exit-Code 1, wenn kritische/schwere (critical/serious) Verstösse gefunden werden.
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:3001/api/v1';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['critical', 'serious']);

async function devLogin(role, email) {
  const res = await fetch(`${API}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) throw new Error(`dev-login (${role}) fehlgeschlagen: ${res.status}`);
  return res.json();
}

// Kernscreens je Rolle
const SESSIONS = [
  { role: null, label: 'Anonym', screens: ['/login'] },
  {
    role: 'LEARNER',
    email: 'a11y-learner@demo.ch',
    label: 'Lernende',
    screens: ['/lernende', '/lernende/nachweise', '/lernende/einstellungen'],
  },
  {
    role: 'TEACHER',
    email: 'a11y-teacher@demo.ch',
    label: 'Lehrperson',
    screens: ['/lehrer', '/modules', '/lehrer/klassen', '/lehrer/bewerten', '/lehrer/ki'],
  },
  {
    role: 'ADMIN',
    email: 'a11y-admin@demo.ch',
    label: 'Schuladmin',
    screens: ['/admin', '/admin/personen', '/admin/einladungen', '/admin/betrieb', '/admin/einstellungen'],
  },
];

let total = 0;
let blocking = 0;

const browser = await chromium.launch();
try {
  for (const session of SESSIONS) {
    const context = await browser.newContext();
    if (session.role) {
      const auth = await devLogin(session.role, session.email);
      // Session so ablegen, wie es die SPA erwartet (localStorage).
      await context.addInitScript(
        ([token, user]) => {
          localStorage.setItem('kh_token', token);
          localStorage.setItem('kh_user', user);
          localStorage.setItem('km-theme', 'light');
        },
        [auth.token, JSON.stringify(auth.user)],
      );
    }
    const page = await context.newPage();
    for (const screen of session.screens) {
      await page.goto(`${WEB}${screen}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const violations = results.violations.filter((v) => BLOCKING.has(v.impact));
      total += results.violations.length;
      blocking += violations.length;
      const tag = violations.length === 0 ? 'OK  ' : 'FAIL';
      console.log(
        `  ${tag} [${session.label}] ${screen} – ${violations.length} kritisch/schwer, ${results.violations.length} gesamt`,
      );
      for (const v of violations) {
        console.log(`        • ${v.id} (${v.impact}): ${v.help} [${v.nodes.length}×]`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\nGesamt: ${total} Verstösse, davon ${blocking} kritisch/schwer.`);
process.exit(blocking > 0 ? 1 : 0);
