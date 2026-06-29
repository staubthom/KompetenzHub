# Playwright E2E-Tests

End-to-End-Tests für die KompetenzHub-Webanwendung. Die Tests laufen gegen die echte API und den laufenden Next.js-Dev-Server – kein Mocking.

## Voraussetzungen

- Node.js ≥ 20
- API läuft auf `http://localhost:3001`
- Web-App läuft auf `http://localhost:3000`
- `.env` im Repo-Root enthält `ALLOW_DEV_LOGIN=1` (Dev-Login muss aktiv sein)
- Playwright-Browser einmalig installiert (siehe unten)

## Einrichtung

```bash
# Einmalig: Chromium-Browser herunterladen
cd apps/web
npx playwright install chromium
```

## Tests ausführen

Alle Befehle aus `apps/web/` aufrufen (oder über das Root-Workspace):

```bash
# Alle Tests sequenziell ausführen
npm run test:e2e

# Mit interaktivem Playwright UI (Zeitreise, Schritt-für-Schritt)
npm run test:e2e:ui

# Mit Debugger (Browser öffnet sich, hält bei jedem Schritt)
npm run test:e2e:debug

# Einzelne Datei
npx playwright test e2e/auth.spec.ts

# Einzelnen Test nach Name
npx playwright test --grep "Dev-Login als TEACHER"

# HTML-Report nach dem Lauf öffnen
npx playwright show-report
```

## Testdateien

### `auth.spec.ts` – Login-UI und Authentifizierung

Testet den sichtbaren Login-Ablauf im Browser.

| Test                                 | Beschreibung                                        |
| ------------------------------------ | --------------------------------------------------- |
| Login-Seite zeigt Dev-Login-Formular | Rollenwahl-Buttons und Anmelde-Button sind sichtbar |
| Dev-Login als TEACHER                | Weiterleitung zu `/lehrer` nach Anmeldung           |
| Dev-Login als LEARNER                | Weiterleitung zu `/lernende` nach Anmeldung         |
| Dev-Login als ADMIN                  | Weiterleitung zu `/admin` nach Anmeldung            |
| Eigene E-Mail im Dev-Login           | Freies E-Mail-Feld wird akzeptiert                  |
| Bereits eingeloggt                   | Direkte Weiterleitung ohne Login-Seite              |
| Logout                               | Session löschen → Redirect zur Login-Seite          |
| OAuth-Provider-Button sichtbar       | Mindestens ein Anmelde-Button vorhanden             |

---

### `admin-dashboard.spec.ts` – Admin-Dashboard

Testet Einladungen und Benutzerverwaltung über die Admin-Oberfläche.

| Test                                 | Beschreibung                                                   |
| ------------------------------------ | -------------------------------------------------------------- |
| Einladung erstellen                  | E-Mail-Adresse + Rolle eingeben → erscheint in Einladungsliste |
| Einladung zurückziehen               | Einladung löschen → verschwindet aus der Liste                 |
| Benutzer sperren                     | Sperren-Button → Badge zeigt „gesperrt"                        |
| Gesperrten Benutzer entsperren       | Entsperren-Button → Badge zeigt „aktiv"                        |
| Rolle LERNENDE → LEHRPERSON          | Rollen-Dropdown ändern → Toast „Rolle geändert."               |
| Admin kann sich nicht selbst sperren | Sperren-Button des eigenen Kontos ist deaktiviert              |

---

### `evidence-submission.spec.ts` – Nachweis-Einreichung

Testet den vollständigen Ablauf vom Einreichen bis zur Bewertung.

Setup (per API, vor dem Test):

- Modul + Handlungsziel + Band + Feld anlegen
- Klasse erstellen, Beitritts-Code generieren, Student einschreiben
- Nachweis veröffentlichen

| Test                                                                    | Beschreibung                                                      |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Student sieht beide Nachweise in der Matrix                             | Nachweistitel erscheint auf `/lernende`                           |
| Student reicht beide Nachweise ein                                      | Freitext eingeben → „Einreichen"-Button → Status „eingereicht"    |
| Lehrperson sieht beide eingereichten Nachweise in Bewerten              | Nachweis erscheint auf `/lehrer/bewerten` im Filter „eingereicht" |
| Lehrperson bewertet Nachweis A mit vollen Punkten, weist B zurück       | Punkte + Feedback eingeben → Status wechselt zu „bewertet"        |
| Student sieht Bewertung und reicht zurückgewiesenen Nachweis erneut ein |                                                                   |

---

### `matrix-editor.spec.ts` – Kompetenzmatrix-Editor

Testet CRUD-Operationen im Modul- und Matrixeditor.

> Drag & Drop (Reihenfolge von Bändern/Feldern) ist nicht abgedeckt.

| Test                              | Beschreibung                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Neues Modul erstellen             | Modulnummer + Titel eingeben → erscheint in der Modulliste                                                     |
| Handlungsziel hinzufügen          | Code + Beschreibung eingeben → HZ erscheint in der Liste                                                       |
| Kompetenzband hinzufügen          | Band-Code + HZ referenzieren → Band erscheint in der Matrix                                                    |
| Deskriptor und Nachweis eintragen | Matrixfeld anklicken → Deskriptor eingeben → gespeichert; danach Nachweis im Feld anlegen → erscheint als Chip |
| Modul löschen                     | „Modul löschen"-Button → Bestätigung → nicht mehr in der Liste                                                 |

---

### `preferences.spec.ts` – Sprache und Layout

Testet ob Spracheinstellung und Anzeigemodus (Theme) über Sitzungen hinweg erhalten bleiben.

| Test                       | Beschreibung                                                               |
| -------------------------- | -------------------------------------------------------------------------- |
| Sprache auf Französisch    | Dropdown auf FR → UI-Texte wechseln → nach Neuanmeldung noch FR            |
| Sprache zurück auf Deutsch | FR → EN → DE → nach Neuanmeldung noch DE                                   |
| Theme auf Dunkel           | „Dunkel"-Button → `data-theme=dark` gesetzt → nach Neuanmeldung noch aktiv |
| Theme auf Hell             | Grau → Hell → nach Neuanmeldung `data-theme=light`                         |

> Sprache wird serverseitig in den Benutzereinstellungen gespeichert. Theme wird in `localStorage` (`km-theme`) gespeichert und beim Laden ausgelesen.

---

## Hilfsfunktionen (`helpers/index.ts`)

```ts
// Meldet sich via Dev-Login an und setzt die Session in localStorage
await loginAs(page, 'TEACHER', 'optional@email.ch');

// Session aus localStorage löschen (simuliert Logout)
await clearSession(page);

// Direkter API-Aufruf für Setup/Teardown (kein Browser nötig)
await api(request, 'POST', '/modules', token, { number: '293', title: { de: 'Test' } });

// Test-User wieder aufräumen (in test.afterAll jeder Spec)
await cleanupTestUsers();
```

## Aufräumen der Test-User

`loginAs` und `api(..., '/auth/dev-login'|'/auth/exchange', ...)` merken sich
jede angelegte E-Mail (`trackTestUser`). Jede Spec ruft in `test.afterAll`
`cleanupTestUsers()` auf, das die User über `POST /auth/dev-delete` wieder löscht
(kaskadiert deren Daten; Endpunkt nur bei aktivem Dev-Login). Geteilte Demo-Konten
(`lehrperson@`/`lernende@`/`admin@demo.ch`) werden bewusst **nicht** getrackt,
damit lokale Demo-Daten erhalten bleiben.

## Konfiguration

Umgebungsvariablen (aus `.env` im Repo-Root, werden automatisch geladen):

| Variable              | Bedeutung       | Standard                |
| --------------------- | --------------- | ----------------------- |
| `BASE_URL`            | URL der Web-App | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | URL der API     | `http://localhost:3001` |

Der Report (HTML) wird nach jedem Lauf in `apps/web/playwright-report/` gespeichert.
