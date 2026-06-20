// Smoke-Test für den Auth/RBAC-Flow gegen die laufende API.
// Aufruf: node apps/api/scripts/smoke-auth.mjs
const BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';

let pass = 0;
let fail = 0;

function check(label, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  OK   ${label}${extra ? ' – ' + extra : ''}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${extra ? ' – ' + extra : ''}`);
  }
}

async function devLogin(role, email) {
  const res = await fetch(`${BASE}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  // 1) Geschützte Route ohne Token -> 401
  {
    const res = await fetch(`${BASE}/modules`);
    check('GET /modules ohne Token -> 401', res.status === 401, `HTTP ${res.status}`);
  }

  // 2) dev-login TEACHER
  const teacher = await devLogin('TEACHER', 'lehrer@demo.ch');
  check('POST /auth/dev-login (TEACHER) -> 200/201', [200, 201].includes(teacher.status), `HTTP ${teacher.status}`);
  check('Token vorhanden', typeof teacher.body.token === 'string' && teacher.body.token.length > 20);
  check('Rolle TEACHER im User', teacher.body.user?.roles?.includes('TEACHER'));
  const tToken = teacher.body.token;

  // 3) /auth/me mit Token
  {
    const res = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${tToken}` } });
    const body = await res.json();
    check('GET /auth/me mit Token -> 200', res.status === 200, `HTTP ${res.status}`);
    check('/auth/me liefert eigene E-Mail', body.email === 'lehrer@demo.ch', body.email);
  }

  // 4) GET /modules als TEACHER -> erlaubt
  {
    const res = await fetch(`${BASE}/modules`, { headers: { Authorization: `Bearer ${tToken}` } });
    check('GET /modules (TEACHER) -> 200', res.status === 200, `HTTP ${res.status}`);
  }

  // 5) POST /modules als TEACHER -> erlaubt (Schreibrecht)
  {
    const uniqueNumber = `T${Date.now()}`;
    const res = await fetch(`${BASE}/modules`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: uniqueNumber, title: { de: 'Smoke-Test-Modul' } }),
    });
    check('POST /modules (TEACHER) -> 200/201', [200, 201].includes(res.status), `HTTP ${res.status}`);
  }

  // 5b) POST /modules ohne number -> 400 (saubere Validierung statt 500)
  {
    const res = await fetch(`${BASE}/modules`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: { de: 'Ohne Nummer' } }),
    });
    check('POST /modules ohne number -> 400', res.status === 400, `HTTP ${res.status}`);
  }

  // 6) dev-login LEARNER und POST /modules -> 403 (kein Schreibrecht)
  const student = await devLogin('LEARNER', 'lernende@demo.ch');
  check('POST /auth/dev-login (LEARNER) -> 200/201', [200, 201].includes(student.status), `HTTP ${student.status}`);

  {
    const res = await fetch(`${BASE}/modules`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student.body.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Darf-nicht' }),
    });
    check('POST /modules (STUDENT) -> 403', res.status === 403, `HTTP ${res.status}`);
  }

  // 7) Ungültiger Token -> 401
  {
    const res = await fetch(`${BASE}/auth/me`, { headers: { Authorization: 'Bearer kaputt.token.hier' } });
    check('GET /auth/me mit kaputtem Token -> 401', res.status === 401, `HTTP ${res.status}`);
  }

  console.log(`\nErgebnis: ${pass} OK, ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Smoke-Test abgebrochen:', e);
  process.exit(2);
});
