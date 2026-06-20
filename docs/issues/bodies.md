<!--
  Zentrale Quelle für die ausformulierten Issue-Beschreibungen (agententauglich).
  Format: Jeder Abschnitt beginnt mit "### " + EXAKTER Issue-Titel.
  Der Text bis zum nächsten "### " (oder Dateiende) ist der Issue-Body.
  Das Skript .github/scripts/update-issue-bodies.ps1 liest diese Datei
  und setzt die Bodies per `gh issue edit` (Sprint-Zuordnung bleibt erhalten).

  Tech-Stack-Kontext (gilt für ALLE Issues):
  - Backend: NestJS (TypeScript), REST unter /api/v1, DTOs mit class-validator,
    Fehler im RFC-7807-Format (application/problem+json), OpenAPI/Swagger.
  - ORM/DB: Prisma + PostgreSQL. PK = UUID. i18n-Felder als JSONB {de,fr,it,en}.
    Alle Entitäten tenant-gescoped (tenantId aus dem Token).
  - Frontend: Next.js (App Router, React), Tailwind + shadcn/ui, TanStack Query, PWA/i18n.
  - Auth: NextAuth.js (OIDC) mit Microsoft & Google; RBAC-Guards (teacher/student/admin).
  - Uploads: S3-kompatibel via presigned URLs. Async (KI/Export): BullMQ auf Redis.
  - Tests: Jest (Unit/Integration Backend), Playwright/RTL (Frontend) wo sinnvoll.
  - Referenz-Docs in /docs, UI-Vorlagen in /mockups.
-->

### [Chore] Repo-Struktur & Tooling (Lint/Format)

## Ziel

Monorepo-Grundgerüst und einheitliches Tooling als Fundament für alle Sprints. Siehe [docs/06-architektur.md](../06-architektur.md).

## Umsetzung

- Monorepo mit Workspaces: `backend/` (NestJS), `frontend/` (Next.js), `infra/` (Docker/CI), `docs/`.
- TypeScript strict in beiden Paketen; gemeinsame `tsconfig.base.json`.
- ESLint (typescript-eslint) + Prettier mit gemeinsamer Config; `.editorconfig`, `.gitattributes` (LF).
- Root-`package.json` mit Skripten: `lint`, `format:check`, `typecheck`, `build`, `test`.

## Akzeptanzkriterien

- [ ] `npm install` im Root installiert alle Workspaces fehlerfrei
- [ ] `npm run lint`, `npm run format:check`, `npm run typecheck` laufen grün
- [ ] Ein absichtlicher Lint-Verstoss lässt `npm run lint` fehlschlagen (Test des Setups)
- [ ] README beschreibt „Getting Started" (Voraussetzungen, Install, Start)

## Definition of Done

- [ ] Lint/Format/Typecheck laufen lokal und in CI · in `main` gemergt

### [Chore] CI-Pipeline (GitHub Actions)

## Ziel

Automatischer Build/Lint/Typecheck/Test bei jedem Push und PR; `main` bleibt stabil.

## Umsetzung

- Workflow `.github/workflows/ci.yml`, getriggert bei `push` und `pull_request`.
- Jobs/Schritte: `npm ci` → `lint` → `typecheck` → `test` → `build` (Backend + Frontend).
- Node-LTS, `actions/setup-node` mit npm-Cache; Prisma `generate` vor Backend-Build.
- Branch-Schutz für `main`: PR erforderlich, CI muss grün sein.

## Akzeptanzkriterien

- [ ] Bei jedem PR läuft die Pipeline automatisch und ist sichtbar im PR
- [ ] Roter Lint/Typecheck/Test blockiert den Merge
- [ ] Gesamtlaufzeit < 5 Minuten (Caching aktiv)

## Definition of Done

- [ ] CI grün auf `main`, Branch-Schutz aktiv

### [Chore] Docker-Compose (App + DB)

## Ziel

Reproduzierbare lokale Dev-Umgebung per `docker compose up`. Siehe [docs/06-architektur.md](../06-architektur.md).

## Umsetzung

- `infra/docker-compose.yml` mit Services: `db` (PostgreSQL), `redis` (BullMQ), `minio` (S3-kompatibel), optional `app`.
- Persistente Volumes für `db` und `minio`; Healthchecks je Service.
- `.env.example` mit allen Variablen (DB-URL, Redis, S3/MinIO, NextAuth/OIDC-Platzhalter).

## Akzeptanzkriterien

- [ ] `docker compose up` startet DB + Redis + MinIO ohne manuelle Schritte
- [ ] Backend kann sich mit DB, Redis und MinIO verbinden
- [ ] Daten überleben einen Neustart (Volumes); `.env.example` dokumentiert alle Variablen

## Definition of Done

- [ ] Setup in README beschrieben und lokal getestet

### [Chore] Prisma-Schema-Grundgeruest & erste Migration

## Ziel

Initiales DB-Schema gemäss [docs/05-datenmodell.md](../05-datenmodell.md) als Prisma-Schema.

## Umsetzung (Entitäten lt. Datenmodell)

- `Tenant`, `TenantBranding` (1:1), `User`, `Membership` (User×Tenant mit `role`, `status`).
- `Module` (`number`, `title` i18n, `ownerId`, `status`), `ActionGoal` (FK `moduleId`).
- Matrix-Struktur: Kompetenzband, Gütestufe, Kompetenzfeld, `Descriptor` (i18n).
- Konventionen: PK = UUID, i18n-Felder als JSONB `{de,fr,it,en}`, `createdAt/updatedAt`, alle fachlichen Tabellen mit `tenantId`.
- Seed-Skript: 1 Tenant + 1 Beispielmodul (Nr. „293").

## Akzeptanzkriterien

- [ ] `prisma migrate dev` läuft fehlerfrei; `prisma generate` erzeugt den Client
- [ ] Schema bildet die in Doc 05 genannten Entitäten/Relationen/Enums ab
- [ ] `prisma db seed` erzeugt Tenant + Beispielmodul 293
- [ ] Migration ist eingecheckt und in CI reproduzierbar

## Definition of Done

- [ ] Schema + Migration + Seed in `main`, CI grün

### [Chore] Walking-Skeleton: Health-Endpoint + leere Startseite

## Ziel

Durchgängig lauffähiges System über alle Schichten (Next.js → NestJS → Postgres).

## Umsetzung

- Backend: `GET /api/v1/health` (NestJS) prüft DB-Verbindung (Prisma) und gibt `{status, db, version}` zurück.
- Frontend: minimale Startseite ruft `/api/v1/health` (TanStack Query) und zeigt den Status an.

## Akzeptanzkriterien

- [ ] `GET /api/v1/health` liefert `200` + JSON inkl. DB-Check
- [ ] Startseite zeigt „System OK" bei gesunder DB, Fehlermeldung sonst
- [ ] End-to-End lokal lauffähig (compose up → Seiten erreichbar)

## Definition of Done

- [ ] In `main`, von CI gebaut

### [FA-08] OAuth/OIDC Login (Microsoft & Google)

**Als** Nutzer:in **möchte ich** mich mit Microsoft oder Google anmelden, **damit** ich kein separates Passwort brauche.

> Referenz: [docs/08-authentifizierung.md](../08-authentifizierung.md). UI: `mockups/index.html` (Login-Einstieg).

## Umsetzung

- NextAuth.js (OIDC) mit Providern **Microsoft** und **Google**.
- Backend stellt `GET /api/v1/auth/me` (Profil + Rollen) und `POST /api/v1/auth/logout` bereit.
- Beim ersten Login `User` anlegen/finden (`email` unique, `displayName`, `authProvider`, `externalId`); `Membership` mit Default-Rolle im aktiven Tenant.
- JWT/Session via `Authorization: Bearer <token>`; HttpOnly-Cookie, Refresh.

## Akzeptanzkriterien

- [ ] **Given** nicht angemeldet, **when** „Login mit Microsoft", **then** OIDC-Flow → Redirect → eingeloggt
- [ ] Analog für Google
- [ ] Erster Login legt `User` + `Membership` an; erneuter Login nutzt denselben `User`
- [ ] `GET /api/v1/auth/me` liefert Profil + Rollen; `POST /api/v1/auth/logout` beendet die Session
- [ ] Abgebrochener/fehlgeschlagener Login zeigt verständliche Fehlermeldung

## Definition of Done

- [ ] Beide Provider manuell getestet; Integrationstest für `/auth/me` (eingeloggt/anonym)

### [FA-08] Rollenmodell & RBAC-Middleware

**Als** System **möchte ich** Zugriffe anhand von Rollen prüfen, **damit** nur Berechtigte geschützte Aktionen ausführen.

> Referenz: [docs/02-rollen-und-use-cases.md](../02-rollen-und-use-cases.md).

## Umsetzung

- Rollen `teacher`, `student`, `admin` auf `Membership.role` (pro Tenant).
- NestJS `RolesGuard` + `@Roles()`-Decorator; geschützte Controller/Routen kennzeichnen.
- Unauthentifiziert → `401`; falsche Rolle → `403` (RFC-7807-Body).

## Akzeptanzkriterien

- [ ] Decorator/Guard schützt Routen nach erforderlicher Rolle
- [ ] **Given** `student`, **when** Aufruf einer teacher-Route, **then** `403` (problem+json)
- [ ] **Given** anonym, **when** geschützte Route, **then** `401`
- [ ] Rollen werden pro Tenant ausgewertet

## Definition of Done

- [ ] Unit-/Integrationstests für erlaubte und verbotene Zugriffe (je Rolle)

### [FA-08] Multi-Tenant-Schema & Tenant-Scope

**Als** Betreiber **möchte ich** mandantenfähige Daten, **damit** mehrere Schulen getrennt arbeiten.

## Umsetzung

- `tenantId` an allen fachlichen Entitäten; Tenant aus dem Token ableiten (Request-Context).
- Zentrale Prisma-Scoping-Schicht (z.B. Middleware/Repository-Helper), die `tenantId` automatisch in Queries setzt.
- MVP: ein Default-Tenant aktiv.

## Akzeptanzkriterien

- [ ] Jede fachliche Entität besitzt `tenantId`
- [ ] Alle Lese-/Schreibzugriffe sind automatisch auf den aktiven Tenant gescoped
- [ ] **Given** zwei Tenants mit gleichartigen Daten, **then** sieht Tenant A keine Daten von Tenant B
- [ ] Versuch eines Cross-Tenant-Zugriffs per ID liefert `404/403`

## Definition of Done

- [ ] Integrationstest stellt Tenant-Isolation sicher (kein Cross-Tenant-Leak)

### [FA-01] Modul & Modulidentifikation verwalten

**Als** Lehrperson **möchte ich** Module mit Modulidentifikation anlegen/bearbeiten, **damit** ich die Grundlage der Matrix abbilde.

> Referenz: [docs/03-fachkonzept-kompetenzmatrix.md](../03-fachkonzept-kompetenzmatrix.md). UI: `mockups/lehrer-module.html`.

## Umsetzung

- Entität `Module` (`number`, `title`/`description` i18n, `profession?`, `ownerId`, `status`).
- Endpunkte: `GET/POST /api/v1/modules`, `GET/PATCH/DELETE /api/v1/modules/:id` (Rolle teacher).
- DTO-Validierung (class-validator): `number` und `title.de` Pflicht.
- Löschen nur, wenn das Modul nicht referenziert wird (sonst `409`).

## Akzeptanzkriterien

- [ ] Modul anlegen mit Nr., Titel (i18n), optional Beruf → erscheint in `GET /modules`
- [ ] Modul bearbeiten (PATCH) und löschen (DELETE) als Eigentümer/teacher
- [ ] Pflichtfeldverletzung → `422`/`400` mit RFC-7807-`errors[]`
- [ ] Nur Module des aktiven Tenants sichtbar (Tenant-Scope)

## Definition of Done

- [ ] CRUD über API getestet (Jest) + im UI bedienbar

### [FA-02] Handlungsziele verwalten

**Als** Lehrperson **möchte ich** Handlungsziele je Modul erfassen, **damit** ich sie Kompetenzbändern zuordnen kann.

> UI: `mockups/lehrer-module.html`.

## Umsetzung

- Entität `ActionGoal` (FK `moduleId`, `title`/`text` i18n, `sortOrder`).
- Endpunkte: `GET/POST /api/v1/modules/:id/action-goals`, `PATCH/DELETE /api/v1/action-goals/:id`.

## Akzeptanzkriterien

- [ ] Handlungsziel anlegen/bearbeiten/löschen, einem Modul zugeordnet
- [ ] Reihenfolge über `sortOrder` änderbar; Liste kommt sortiert zurück
- [ ] **Given** ein Modul, **then** liefert `GET /modules/:id/action-goals` alle zugehörigen Ziele

## Definition of Done

- [ ] CRUD getestet, korrekt an Modul gebunden, tenant-gescoped

### [FA-03] Kompetenzbaender x Guetestufen (Matrix-Struktur)

**Als** Lehrperson **möchte ich** Kompetenzbänder und Gütestufen als Raster, **damit** ich die Matrix strukturiere.

> Referenz: [docs/03-fachkonzept-kompetenzmatrix.md](../03-fachkonzept-kompetenzmatrix.md). UI: `mockups/lehrer-module.html`.

## Umsetzung

- Entitäten gemäss Doc 05: Kompetenzband (Zeile, referenziert 1..n `ActionGoal`), Gütestufe (Spalte), Kompetenzfeld = Schnittpunkt Band×Gütestufe.
- Endpunkt `GET /api/v1/modules/:id/matrix` liefert die komplette Rasterstruktur (Bänder × Gütestufen inkl. Feld-IDs).
- Bänder anlegen/sortieren; Standard-Gütestufen vorhanden (Beginner/Intermediate/Advanced).

## Akzeptanzkriterien

- [ ] Bänder anlegen/sortieren; jedes Band referenziert ≥1 Handlungsziel
- [ ] Gütestufen als Spalten vorhanden
- [ ] `GET /modules/:id/matrix` liefert das vollständige Raster (Band × Gütestufe) mit stabilen Feld-IDs
- [ ] UI stellt das Raster dar (Vorlage `lehrer-module.html`)

## Definition of Done

- [ ] Rasterabruf getestet; Daten persistent; UI zeigt Struktur

### [FA-04] Kompetenzfelder & Deskriptoren (Ich kann)

**Als** Lehrperson **möchte ich** je Kompetenzfeld „Ich kann …"-Deskriptoren erfassen, **damit** Kompetenzen konkret beschrieben sind.

> UI: `mockups/lehrer-module.html` (Editor), `mockups/lernende-matrix.html` (Anzeige).

## Umsetzung

- Entität `Descriptor` (FK auf Kompetenzfeld, Text i18n).
- Endpunkte zum Setzen/Ändern des Deskriptors je Feld (z.B. `PATCH /api/v1/competence-fields/:id`).

## Akzeptanzkriterien

- [ ] Pro Schnittpunkt (Band×Gütestufe) ist ein Deskriptor editierbar (i18n, mind. `de`)
- [ ] Gespeicherte Deskriptoren erscheinen in der Lernenden-Matrix (`lernende-matrix.html`)
- [ ] Leere Felder erlaubt (nicht jedes Feld muss belegt sein)

## Definition of Done

- [ ] Editor + Anzeige getestet; i18n-Speicherung korrekt

### [FA-20] Klasse anlegen & Matrix zuordnen

**Als** Lehrperson **möchte ich** eine Klasse anlegen und ihr eine Matrix zuordnen, **damit** Lernende mit der richtigen Matrix arbeiten.

> UI: `mockups/lehrer-klassen.html`.

## Umsetzung

- Entität `Class` (`name`, `tenantId`, `moduleId`/Matrix-Referenz, `status` aktiv/archiviert).
- Endpunkte: `GET/POST /api/v1/classes`, `GET/PATCH/DELETE /api/v1/classes/:id` (teacher).

## Akzeptanzkriterien

- [ ] Klasse mit Name anlegen und genau eine Matrix/Modul zuordnen
- [ ] Klasse bearbeiten; Status archivieren (siehe FA-103)
- [ ] Nur Klassen des aktiven Tenants/der Lehrperson sichtbar

## Definition of Done

- [ ] CRUD + Matrix-Zuordnung getestet

### [FA-23] Beitrittscode generieren & beitreten

**Als** Lehrperson **möchte ich** einen Beitrittscode erzeugen, **damit** Lernende selbständig beitreten.

> UI: `mockups/lehrer-klassen.html` (Code anzeigen), `mockups/index.html`/Onboarding (Code eingeben).

## Umsetzung

- `Class.joinCode` (eindeutig, optional `joinCodeExpiresAt`).
- Endpunkte: `POST /api/v1/classes/:id/join-code` (generieren/erneuern, teacher), `POST /api/v1/classes/join` mit `{code}` (student → `Membership`/Klassenmitgliedschaft).

## Akzeptanzkriterien

- [ ] Code generieren (eindeutig), optional mit Ablauf; erneuern invalidiert den alten
- [ ] **Given** gültiger Code, **when** student gibt ihn ein, **then** wird sie/er Mitglied der Klasse
- [ ] Ungültiger/abgelaufener Code → `400/410` mit klarer Meldung
- [ ] Doppelter Beitritt wird idempotent behandelt (kein Duplikat)

## Definition of Done

- [ ] Happy- und Fehlerpfade getestet (gültig/ungültig/abgelaufen/doppelt)

### [FA-25] Mitgliederliste & Verwaltung

**Als** Lehrperson **möchte ich** die Mitglieder meiner Klasse verwalten, **damit** ich den Überblick behalte.

> UI: `mockups/lehrer-klassen.html`.

## Umsetzung

- Endpunkte: `GET /api/v1/classes/:id/members`, `DELETE /api/v1/classes/:id/members/:userId` (teacher der Klasse).

## Akzeptanzkriterien

- [ ] Liste aller Mitglieder mit Status (z.B. aktiv)
- [ ] Mitglied entfernen entfernt die Klassenmitgliedschaft
- [ ] Nur die Lehrperson der Klasse hat Zugriff (RBAC), sonst `403`

## Definition of Done

- [ ] Liste + Entfernen getestet (inkl. Berechtigungsprüfung)

### [FA-30] Kompetenznachweis: Upload-Typ

**Als** Lehrperson **möchte ich** einen Upload-Nachweis definieren, **damit** Lernende Dateien als Beleg einreichen.

> UI: `mockups/lernende-nachweis.html`. Uploads via S3 presigned URLs.

## Umsetzung

- Entität `Evidence`/`Nachweis` mit `type='upload'`, `title`/`description` i18n, `allowedFileTypes`, `maxFileSizeMb`, Zuordnung zu Kompetenzfeld(ern).
- Upload-Flow: Backend liefert presigned URL; Datei landet im S3-Bucket; nur Key wird gespeichert.

## Akzeptanzkriterien

- [ ] Upload-Nachweis mit Titel, Beschreibung, erlaubten Dateitypen und Max-Grösse definierbar
- [ ] Zuordnung zu einem oder mehreren Kompetenzfeldern
- [ ] Serverseitige Validierung von Dateityp/-grösse beim Einreichen
- [ ] Presigned-URL-Flow funktioniert (kein direkter Datei-Upload an die API)

## Definition of Done

- [ ] Definition + presigned-Upload getestet

### [FA-32] Kompetenznachweis: Quiz-Typ

**Als** Lehrperson **möchte ich** Quiz-Nachweise mit automatischer Auswertung, **damit** Wissen ohne manuelle Korrektur geprüft wird.

> UI: `mockups/lernende-quiz.html`.

## Umsetzung

- `Evidence` mit `type='quiz'`; Fragenmodell (Single/Multiple Choice) mit korrekten Antworten; max. Punkte (siehe FA-40).
- Auswertung serverseitig (Lösungen nie an den Client ausliefern).

## Akzeptanzkriterien

- [ ] Fragen (Single/Multiple Choice) mit korrekten Antworten anlegen
- [ ] **Given** abgeschlossenes Quiz, **then** wird die Punktzahl serverseitig berechnet und gespeichert
- [ ] Korrekte Antworten werden dem Client nicht offengelegt
- [ ] Grenzfälle (keine/alle Antworten korrekt) korrekt bewertet

## Definition of Done

- [ ] Auswertung getestet (inkl. Grenzfälle)

### [FA-36] Sichtbarkeit & Ablaufdatum

**Als** Lehrperson **möchte ich** Nachweise sichtbar/unsichtbar schalten und mit Fälligkeit versehen, **damit** ich den Ablauf steuere.

## Umsetzung

- Felder am `Evidence`: `visible` (bool), `dueAt` (timestamptz, optional).
- Sichtbarkeitsfilter in den Lernenden-Queries; Fälligkeitsstatus serverseitig ableiten.

## Akzeptanzkriterien

- [ ] `visible` je Nachweis schaltbar; optionales Fälligkeitsdatum setzbar
- [ ] **Given** `visible=false`, **then** ist der Nachweis für Lernende nicht zugänglich
- [ ] Nach `dueAt` wird Status „überfällig" angezeigt (Lehrer- und Lernenden-Sicht)

## Definition of Done

- [ ] Sichtbarkeits- und Fälligkeitslogik getestet

### [FA-40] Punktevergabe-Schema (X/Y)

**Als** Lehrperson **möchte ich** je Nachweis ein Punkteschema (erreichte/maximale Punkte) festlegen, **damit** die Bewertung einheitlich ist.

## Umsetzung

- `Evidence.maxPoints` (int); erreichte Punkte je Einreichung als `Submission.points`.
- Validierung: `0 ≤ points ≤ maxPoints`.

## Akzeptanzkriterien

- [ ] Maximalpunkte je Nachweis konfigurierbar
- [ ] Bewertung erfasst erreichte Punkte; Anzeige als „X/Y"
- [ ] Ungültige Punkte (negativ oder > max) → `422` mit RFC-7807

## Definition of Done

- [ ] Schema in Bewertung + Anzeige genutzt und getestet

### [FA-50] Lernende reicht Nachweis ein

**Als** Lernende:r **möchte ich** einen Nachweis einreichen, **damit** meine Kompetenz bewertet werden kann.

> UI: `mockups/lernende-nachweis.html`, `mockups/lernende-quiz.html`.

## Umsetzung

- Entität `Submission` (FK `evidenceId`, `userId`, `status`, `fileKey?`, `answers?`, `points?`, Zeitstempel).
- Status-Enum: `open` → `submitted` → `graded` | `rejected` (siehe FA-53/FA-60/FA-62).
- Endpunkt `POST /api/v1/evidences/:id/submissions` (student); Upload (presigned) bzw. Quiz-Antworten.

## Akzeptanzkriterien

- [ ] Upload- bzw. Quiz-Einreichung möglich; Status wechselt auf `submitted`
- [ ] Bestätigung nach Einreichung; Validierung (Dateityp/-grösse bzw. Quiz vollständig)
- [ ] Nach `rejected` ist erneute Einreichung möglich
- [ ] Einreichen nur bei `visible=true` und (falls gesetzt) vor/innerhalb `dueAt`-Regel

## Definition of Done

- [ ] Einreichen für beide Typen getestet (Happy + Validierungsfehler)

### [FA-53] Statusanzeige fuer Lernende

**Als** Lernende:r **möchte ich** den Status meiner Nachweise sehen, **damit** ich weiss, was offen ist.

> UI: `mockups/lernende-matrix.html`, `mockups/lernende-nachweis.html`.

## Umsetzung

- Aggregierte Statusabfrage je Lernende:r pro Kompetenzfeld (offen/eingereicht/bewertet/zurückgewiesen).

## Akzeptanzkriterien

- [ ] Status `open`/`submitted`/`graded`/`rejected` je Nachweis sichtbar
- [ ] Anzeige je Kompetenzfeld in der Matrix
- [ ] Bei `graded`: erreichte Punkte/Gütestufe sichtbar

## Definition of Done

- [ ] Statusfluss im UI korrekt abgebildet (mit echten Daten)

### [FA-60] Lehrperson bewertet (Punkte/Level + Feedback)

**Als** Lehrperson **möchte ich** eingereichte Nachweise bewerten, **damit** Lernende Rückmeldung und Gütestufe erhalten.

> UI: `mockups/lehrer-bewerten.html`.

## Umsetzung

- Endpunkt `POST/PATCH /api/v1/submissions/:id/assessment` (teacher): `points` (X/Y), `level` (Gütestufe), `feedback` (Text).
- Bewertung setzt `Submission.status='graded'`; schreibt Historieneintrag (siehe FA-65).

## Akzeptanzkriterien

- [ ] Punkte (X/Y) und/oder Gütestufe sowie Freitext-Feedback erfassbar
- [ ] **Given** eine Bewertung, **then** Status `graded`, für Lernende sichtbar
- [ ] Bewertung änderbar; jede Änderung erzeugt einen Historieneintrag
- [ ] Validierung der Punkte gegen `maxPoints` (FA-40)

## Definition of Done

- [ ] Bewerten + Sichtbarkeit für Lernende getestet

### [FA-62] Einreichung zurueckweisen

**Als** Lehrperson **möchte ich** eine Einreichung mit Begründung zurückweisen, **damit** Lernende nachbessern können.

> UI: `mockups/lehrer-bewerten.html`.

## Umsetzung

- Endpunkt `POST /api/v1/submissions/:id/reject` (teacher) mit Pflichtfeld `reason`.
- Setzt `status='rejected'`; Begründung für Lernende sichtbar; Historieneintrag (FA-65).

## Akzeptanzkriterien

- [ ] Zurückweisen mit Pflicht-Begründung (`reason` fehlt → `422`)
- [ ] Status `rejected`; Begründung für Lernende sichtbar
- [ ] Lernende:r kann erneut einreichen (FA-50)

## Definition of Done

- [ ] Zurückweisen + Wiedervorlage getestet

### [FA-65] Bewertungshistorie / Audit

**Als** Lehrperson/Admin **möchte ich** eine nachvollziehbare Historie aller Bewertungsschritte, **damit** Änderungen transparent sind.

## Umsetzung

- Entität `AssessmentHistory` (append-only): `submissionId`, `actorId`, `action` (graded/updated/rejected), `payload` (Snapshot: points/level/feedback/reason), `createdAt`.
- Schreiben bei jeder Bewertungs-/Zurückweisungsaktion (FA-60/FA-62).

## Akzeptanzkriterien

- [ ] Jede Bewertung/Änderung/Zurückweisung erzeugt einen unveränderlichen Eintrag mit Zeitstempel und Akteur
- [ ] Historie je Einreichung abrufbar (chronologisch)
- [ ] Einträge sind append-only (kein Update/Delete)

## Definition of Done

- [ ] Historie wird bei allen Bewertungsaktionen geschrieben und angezeigt; Test deckt die Aktionen ab

### [FA-90] Fortschritts-Heatmap (Basis)

**Als** Lehrperson **möchte ich** eine Heatmap des Klassenfortschritts, **damit** ich Stärken/Lücken schnell erkenne.

> UI: `mockups/lehrer-dashboard.html`.

## Umsetzung

- Aggregations-Endpunkt `GET /api/v1/classes/:id/progress` liefert je Kompetenzfeld den Erfüllungsgrad über alle Lernenden.
- Frontend rendert das Raster mit Farbcodierung (Statusfarben aus `shared.css`).

## Akzeptanzkriterien

- [ ] Heatmap zeigt je Kompetenzfeld einen aggregierten Erfüllungsgrad der Klasse
- [ ] Farbcodierung entspricht dem UI-Konzept (Statusfarben)
- [ ] Klick auf ein Feld zeigt Details/zugehörige Lernende

## Definition of Done

- [ ] Heatmap mit echten Daten getestet (Aggregation korrekt)

### [FA-91] Kennzahlen-Karten

**Als** Lehrperson **möchte ich** Kennzahlen auf einen Blick, **damit** ich den Status der Klasse schnell erfasse.

> UI: `mockups/lehrer-dashboard.html`.

## Umsetzung

- Kennzahlen aus `GET /api/v1/classes/:id/progress` (oder dediziertem Stats-Endpoint): Anzahl Lernende, „zu bewerten", „bewertet", Ø Fortschritt.

## Akzeptanzkriterien

- [ ] Karten zeigen: Anzahl Lernende, zu bewerten, bewertet, Ø Fortschritt
- [ ] Werte aktualisieren sich mit den Daten
- [ ] Klick auf eine Karte führt zur passenden Detailansicht (z.B. Bewertungs-Queue)

## Definition of Done

- [ ] Kennzahlen korrekt berechnet und im Dashboard sichtbar

### [FA-92] Bewertungs-Queue (Wartet auf Bewertung)

**Als** Lehrperson **möchte ich** eine Liste offener Einreichungen, **damit** ich nichts übersehe.

> UI: `mockups/lehrer-dashboard.html` / `mockups/lehrer-bewerten.html`.

## Umsetzung

- Endpunkt `GET /api/v1/submissions?status=submitted&classId=…` (teacher), mit Sortierung/Filter und Pagination (`?page=&pageSize=`).

## Akzeptanzkriterien

- [ ] Liste aller Einreichungen mit Status `submitted`
- [ ] Sortier-/Filtermöglichkeit (Klasse, Datum) + Pagination
- [ ] Direktsprung in die Bewertungsansicht (FA-60)

## Definition of Done

- [ ] Queue zeigt offene Einreichungen; Schnellzugriff funktioniert

### [Chore] MVP-Polish & Pilotvorbereitung (Modul 293)

## Ziel

MVP für den Pilot mit Modul 293 stabilisieren. Referenz: [docs/13-roadmap-und-mvp.md](../13-roadmap-und-mvp.md).

## Umsetzung

- Bugfixing aus internen Tests; UX-Feinschliff der Kernflows (Matrix → Klasse → Einreichen → Bewerten → Dashboard).
- Beispiel-Matrix Modul 293 vollständig erfassen (Quelle: `Kompetenzmatrixen/293.*`).
- Kurzanleitung für Pilot-Lehrpersonen.

## Akzeptanzkriterien

- [ ] Kompletter End-to-End-Flow ohne Blocker durchführbar
- [ ] Modul 293 als Beispiel-Matrix vollständig vorhanden
- [ ] Pilot-Daten und Kurzanleitung bereit

## Definition of Done

- [ ] Pilot kann starten

### [FA-34] KI-Konfiguration (Endpoint je Lehrperson)

**Als** Lehrperson **möchte ich** meinen KI-Endpoint/Provider konfigurieren, **damit** KI-Funktionen meine eigene Anbindung nutzen.

> Referenz: [docs/09-ki-konzept.md](../09-ki-konzept.md). UI: `mockups/lehrer-ki.html`. OpenAI-kompatibler HTTP-Client.

## Umsetzung

- Entität für KI-Konfiguration je Lehrperson: `provider`, `baseUrl/endpoint`, `model`, `apiKey` (verschlüsselt gespeichert).
- Endpunkte: `GET/PUT /api/v1/ai/config` (teacher), `POST /api/v1/ai/config/test` (Verbindungstest).
- Ohne gültige Konfiguration sind KI-Funktionen deaktiviert (Feature-Gate).

## Akzeptanzkriterien

- [ ] Provider/Endpoint/Model + API-Key je Lehrperson speicherbar; Key verschlüsselt at rest, nie im Klartext zurückgegeben
- [ ] „Test"-Button prüft die Verbindung und zeigt Erfolg/Fehler
- [ ] Ohne Konfiguration sind KI-Funktionen (FA-70/72/80) deaktiviert/ausgegraut

## Definition of Done

- [ ] Konfiguration + Test funktionieren; Key sicher gespeichert (Test deckt Maskierung ab)

### [FA-70] KI-Bewertungsvorschlag

**Als** Lehrperson **möchte ich** einen KI-Bewertungsvorschlag, **damit** ich schneller bewerte – mit finalem Wort bei mir.

> Referenz: [docs/09-ki-konzept.md](../09-ki-konzept.md) (Override-Prinzip, kein Auto-Grading). UI: `mockups/lehrer-bewerten.html`.

## Umsetzung

- Async via BullMQ: `POST /api/v1/submissions/:id/ai-assessment` enqueued Job; Worker lädt Aufgabe + Bewertungsraster + eingereichten Inhalt, ruft KI, speichert `AiAssessment` (`suggestedLevel`, `suggestedPoints`, `feedback`, Begründung je Kriterium).
- Vorschlag wird im UI klar als „KI-Vorschlag" markiert; Übernahme schreibt eine normale Bewertung (FA-60).

## Akzeptanzkriterien

- [ ] KI liefert strukturierten Vorschlag (`suggestedPoints`, `suggestedLevel`, `feedback`)
- [ ] Vorschlag ist im UI eindeutig als „KI-Vorschlag" gekennzeichnet
- [ ] **Given** ein Vorschlag, **then** kann die Lehrperson ihn übernehmen oder überschreiben (Override)
- [ ] Keine automatische Endbewertung ohne Bestätigung der Lehrperson

## Definition of Done

- [ ] Vorschlag (mit Mock-/Stub-KI im Test) + Override getestet

### [FA-72] KI-Feedbacktext generieren

**Als** Lehrperson **möchte ich** einen KI-Feedbacktext-Vorschlag, **damit** ich Rückmeldungen schneller formuliere.

> Referenz: [docs/09-ki-konzept.md](../09-ki-konzept.md).

## Umsetzung

- Endpunkt `POST /api/v1/submissions/:id/ai-feedback` liefert einen editierbaren Feedback-Entwurf (Bezug zu Kriterien/Gütestufe).

## Akzeptanzkriterien

- [ ] KI generiert einen Feedback-Entwurf zur Einreichung
- [ ] Text ist vor dem Speichern editierbar
- [ ] Bezug zu Bewertungskriterien/Gütestufe erkennbar
- [ ] Klar als KI-Hinweis gekennzeichnet, ersetzt keine Bewertung

## Definition of Done

- [ ] Generierung + Bearbeitung getestet (Stub-KI)

### [FA-80] KI-Fachgespraech (Uebungsmodus)

**Als** Lernende:r **möchte ich** ein KI-gestütztes Fachgespräch üben, **damit** ich mich auf Prüfungen vorbereite.

> Referenz: [docs/09-ki-konzept.md](../09-ki-konzept.md) (Expert Talk). UI: `mockups/lernende-fachgespraech.html`.

## Umsetzung

- Session mit Thema + `mode`; KI agiert als wohlwollende:r Prüfer:in. Verlauf wird gespeichert; optional Streaming via WebSocket.
- Endpunkte: `POST /api/v1/expert-talk/sessions`, `POST /api/v1/expert-talk/sessions/:id/messages`.

## Akzeptanzkriterien

- [ ] Dialogmodus mit KI zu einem Kompetenzthema startbar
- [ ] Übungscharakter (keine Note); Hinweise/Feedback im Verlauf
- [ ] Gesprächsverlauf wird gespeichert und ist einsehbar

## Definition of Done

- [ ] Übungsdialog end-to-end (Stub-KI) getestet

### [FA-84] Lernpfade (alternative Reihenfolge)

**Als** Lehrperson **möchte ich** Lernpfade definieren, **damit** Lernende die Matrix in didaktisch sinnvoller Reihenfolge durchlaufen.

> UI: `mockups/lernende-lernpfad.html`.

## Umsetzung

- Entität `LearningPath` (je Matrix, geordnete Liste von Kompetenzen/Bändern); Endpunkte zum Erstellen/Lesen.
- Lernende sehen empfohlene nächste Schritte basierend auf dem aktiven Pfad.

## Akzeptanzkriterien

- [ ] Reihenfolge von Kompetenzen/Bändern als Pfad festlegbar
- [ ] Lernende sehen die empfohlene nächste Aktivität
- [ ] Mehrere Pfade je Matrix möglich

## Definition of Done

- [ ] Pfad-Definition + Anzeige getestet

### [FA-100] Matrix-Export/-Import

**Als** Lehrperson **möchte ich** eine Matrix exportieren und importieren, **damit** ich sie sichern/teilen kann.

> Referenz: [docs/10-export-import.md](../10-export-import.md).

## Umsetzung

- Export einer Matrix als **JSON** mit Versions-/Schema-Kennung (`schemaVersion`) inkl. Module, Bänder, Gütestufen, Felder, Deskriptoren (i18n).
- Re-Import validiert das Schema (z.B. Zod/JSON-Schema) und erzeugt eine identische Struktur (Round-Trip).
- Endpunkte: `GET /api/v1/matrices/:id/export`, `POST /api/v1/matrices/import`.

## Akzeptanzkriterien

- [ ] Export liefert valides JSON inkl. `schemaVersion`
- [ ] Re-Import erzeugt strukturgleiche Matrix (Round-Trip verlustfrei)
- [ ] Fehlerhafte/inkompatible Importdatei wird mit klarer Fehlermeldung abgewiesen

## Definition of Done

- [ ] Round-Trip-Test (Export → Import → Vergleich) grün

### [FA-103] Klassen-Archivierung

**Als** Lehrperson **möchte ich** Klassen archivieren, **damit** abgeschlossene Klassen die Übersicht nicht stören.

> UI: `mockups/lehrer-klassen.html`.

## Umsetzung

- `Class.status` (`active`/`archived`); Endpunkte `POST /api/v1/classes/:id/archive` und `.../restore`.
- Standardlisten filtern `archived` aus; Archiv ist read-only.

## Akzeptanzkriterien

- [ ] Klasse archivieren/wiederherstellen
- [ ] Archivierte Klassen sind standardmässig ausgeblendet, separat einsehbar
- [ ] Daten bleiben erhalten; archivierte Klasse ist read-only

## Definition of Done

- [ ] Archivieren/Wiederherstellen getestet

### [FA-10] Mehrsprachigkeit FR/IT/EN

**Als** Nutzer:in **möchte ich** die App in FR/IT/EN nutzen, **damit** sie schweizweit einsetzbar ist.

> UI: `mockups/lernende-einstellungen.html` (Sprachumschaltung). Daten-i18n als JSONB `{de,fr,it,en}`.

## Umsetzung

- Next.js-i18n mit Locale-Routing; UI-Strings in Übersetzungsdateien (DE vorhanden) für FR/IT/EN ergänzen.
- `User.locale` steuert die Standardsprache; i18n-Inhaltsfelder rendern die aktive Sprache mit DE-Fallback.

## Akzeptanzkriterien

- [ ] i18n-Framework eingebunden; FR-, IT-, EN-Übersetzungen der Kern-UI ergänzt
- [ ] Sprachumschaltung in den Einstellungen; Auswahl wird in `User.locale` persistiert
- [ ] Keine hartcodierten UI-Strings in den Kernscreens (Lint/Review)
- [ ] Fehlende Übersetzung fällt definiert auf DE zurück

## Definition of Done

- [ ] Alle vier Sprachen schaltbar; Kern-UI übersetzt

### [FA-11] Excel-Import (ICT-BBCH-Template)

**Als** Lehrperson **möchte ich** eine Matrix aus dem offiziellen Excel-Template importieren, **damit** ich nicht alles manuell erfasse.

> Referenz: [docs/10-export-import.md](../10-export-import.md). Beispiel: `Kompetenzmatrixen/293.*`.

## Umsetzung

- Upload des offiziellen ICT-BBCH-Excel-Templates; Parsing (z.B. SheetJS) in Module/Bänder/Gütestufen/Felder/Deskriptoren.
- Vorschau vor dem endgültigen Import; Validierungs-/Fehlerbericht bei abweichendem Format.

## Akzeptanzkriterien

- [ ] Upload + Parsing des offiziellen Templates in die Matrix-Struktur
- [ ] Vorschau vor dem endgültigen Import (kein direkter Schreibzugriff)
- [ ] Abweichendes Format erzeugt verständlichen Validierungs-/Fehlerbericht
- [ ] Erfolgreicher Import erzeugt eine vollständige, korrekte Matrix

## Definition of Done

- [ ] Import mit einem echten Template getestet

### [FA-93] Erweitertes Reporting & Filter

**Als** Lehrperson **möchte ich** Reports und Filter, **damit** ich Auswertungen über Bänder und Klassen erstelle.

> UI: `mockups/lehrer-dashboard.html`.

## Umsetzung

- Report-Endpunkt mit Filtern (Klasse, Band, Gütestufe, Zeitraum) und Aggregationen (z.B. Erfüllungsgrad je Band).
- Export der Auswertung als CSV/PDF.

## Akzeptanzkriterien

- [ ] Filter nach Klasse, Band, Gütestufe, Zeitraum
- [ ] Aggregierte Auswertungen (z.B. Erfüllungsgrad je Band)
- [ ] Export der Auswertung als CSV/PDF

## Definition of Done

- [ ] Filter + Report mit echten Daten getestet

### [Chore] Haertung: Sicherheit, A11y, Performance

## Ziel

Nicht-funktionale Reife gemäss [docs/12-nicht-funktionale-anforderungen.md](../12-nicht-funktionale-anforderungen.md).

## Umsetzung

- Security: OWASP Top 10 Review, Rate Limiting, Input-Validierung (class-validator), sichere Header, Secrets-Handling.
- A11y: WCAG 2.1 AA der Kernscreens (Fokus, Kontrast, ARIA) – Audit mit axe.
- Performance: Budgets für Dashboard/Matrix; DB-Indizes; Query-Optimierung; Caching (TanStack Query).
- Beobachtbarkeit: strukturiertes Logging + Basis-Monitoring.

## Akzeptanzkriterien

- [ ] Keine kritischen Findings im Security-Check; Rate Limiting aktiv
- [ ] A11y-Audit (axe) der Kernscreens ohne kritische Verstösse
- [ ] Definierte Performance-Budgets eingehalten (Messung dokumentiert)

## Definition of Done

- [ ] NFR-Checkliste aus Doc 12 erfüllt und dokumentiert
