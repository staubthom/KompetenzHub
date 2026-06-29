// Gemeinsames Aufräum-Helferlein für die Smoke-Tests.
//
// Jeder Smoke-Test, der per Dev-Login Test-User anlegt, soll diese am Ende
// wieder entfernen. Dazu werden die verwendeten E-Mail-Adressen gesammelt
// (`trackUser`) und am Schluss über `POST /auth/dev-delete` gelöscht
// (`cleanupUsers`). Das Löschen ist "best effort": Fehler beim Aufräumen
// dürfen das Testergebnis nicht verfälschen.

const created = new Set();

/** Merkt sich eine per Dev-Login angelegte E-Mail und gibt sie unverändert zurück. */
export function trackUser(email) {
  if (email) created.add(email);
  return email;
}

/** Löscht alle gemerkten Test-User wieder (best effort). */
export async function cleanupUsers(base) {
  for (const email of created) {
    try {
      await fetch(`${base}/auth/dev-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Aufräumen ist best effort – ein Fehler hier darf den Testlauf nicht kippen.
    }
  }
  created.clear();
}
