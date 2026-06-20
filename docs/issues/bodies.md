<!--
  Zentrale Quelle für die ausformulierten Issue-Beschreibungen.
  Format: Jeder Abschnitt beginnt mit "### " + EXAKTER Issue-Titel.
  Der Text bis zum nächsten "### " (oder Dateiende) ist der Issue-Body.
  Das Skript .github/scripts/update-issue-bodies.ps1 liest diese Datei
  und setzt die Bodies per `gh issue edit` (Sprint-Zuordnung bleibt erhalten).
-->

### [Chore] Repo-Struktur & Tooling (Lint/Format)
## Ziel
Saubere Monorepo-Struktur und einheitliches Code-Tooling als Fundament für alle weiteren Sprints.

## Aufgaben
- [ ] Verzeichnisse `backend/`, `frontend/`, `infra/`, `docs/` anlegen
- [ ] TypeScript-Konfiguration je Paket
- [ ] ESLint + Prettier mit gemeinsamen Regeln
- [ ] `.editorconfig` und `.gitattributes` (LF-Normalisierung)
- [ ] NPM-/pnpm-Workspaces eingerichtet

## Akzeptanzkriterien
- [ ] `npm install` installiert alle Workspaces fehlerfrei
- [ ] `npm run lint` und `npm run format:check` laufen ohne Fehler
- [ ] Ein absichtlicher Lint-Verstoss wird erkannt

## Definition of Done
- [ ] Lint/Format laufen lokal und in CI · in `main` gemergt

### [Chore] CI-Pipeline (GitHub Actions)
## Ziel
Automatischer Build/Lint/Test bei jedem Push und PR, damit `main` stabil bleibt.

## Aufgaben
- [ ] Workflow `.github/workflows/ci.yml` (Install → Lint → Typecheck → Test → Build)
- [ ] Node-LTS, Dependency-Caching
- [ ] Branch-Schutz für `main` (PR + grüne CI)

## Akzeptanzkriterien
- [ ] Bei jedem PR läuft die Pipeline automatisch
- [ ] Roter Test/Lint blockiert den Merge
- [ ] Laufzeit < 5 Minuten

## Definition of Done
- [ ] CI grün auf `main`, Branch-Schutz aktiv

### [Chore] Docker-Compose (App + DB)
## Ziel
Reproduzierbare lokale Entwicklungsumgebung per `docker compose up`.

## Aufgaben
- [ ] `docker-compose.yml` mit App-Service und PostgreSQL
- [ ] Persistentes Volume für die DB
- [ ] `.env.example` mit allen nötigen Variablen
- [ ] Healthchecks für App und DB

## Akzeptanzkriterien
- [ ] `docker compose up` startet App + DB ohne manuelle Schritte
- [ ] App erreicht die DB; Daten überleben Neustart (Volume)
- [ ] `.env.example` dokumentiert alle Variablen

## Definition of Done
- [ ] Setup in README beschrieben, lokal getestet

### [Chore] Prisma-Schema-Grundgeruest & erste Migration
## Ziel
Initiales Datenbankschema gemäss [docs/05-datenmodell.md](../05-datenmodell.md) als Prisma-Schema.

## Aufgaben
- [ ] Kern-Entitäten (User, Tenant, Modul, Matrix, Kompetenzband, Gütestufe, Kompetenzfeld, Deskriptor)
- [ ] Relationen und Indizes
- [ ] Erste Migration generiert und angewendet
- [ ] Seed-Skript mit Minimaldaten

## Akzeptanzkriterien
- [ ] `prisma migrate dev` läuft fehlerfrei
- [ ] ER-Struktur entspricht Doc 05
- [ ] Seed erzeugt einen Tenant + Beispiel-Modul

## Definition of Done
- [ ] Migration eingecheckt, in CI reproduzierbar

### [Chore] Walking-Skeleton: Health-Endpoint + leere Startseite
## Ziel
Ein durchgängig lauffähiges System über alle Schichten (Frontend → API → DB).

## Aufgaben
- [ ] Backend-Endpoint `GET /health` (prüft DB-Verbindung)
- [ ] Minimale Frontend-Startseite, die `/health` aufruft und Status zeigt
- [ ] Deployment-/Run-Anleitung

## Akzeptanzkriterien
- [ ] `/health` liefert 200 + Status-JSON inkl. DB-Check
- [ ] Startseite zeigt „System OK"
- [ ] End-to-End lokal lauffähig

## Definition of Done
- [ ] In `main`, von CI gebaut

### [FA-08] OAuth/OIDC Login (Microsoft & Google)
**Als** Nutzer:in **möchte ich** mich mit meinem Microsoft- oder Google-Konto anmelden, **damit** ich kein separates Passwort brauche.

## Kontext
Siehe [docs/08-authentifizierung.md](../08-authentifizierung.md).

## Akzeptanzkriterien
- [ ] **Given** ich bin nicht angemeldet, **when** ich „Login mit Microsoft" wähle, **then** werde ich via OIDC authentifiziert und zurückgeleitet
- [ ] Analog für Google
- [ ] Beim ersten Login wird ein Benutzerkonto angelegt (E-Mail, Name, Provider)
- [ ] Session/Token wird sicher gesetzt (HttpOnly, kurze Lebensdauer + Refresh)
- [ ] Logout beendet die Session vollständig

## Definition of Done
- [ ] Beide Provider getestet · Fehlerfälle (abgebrochener Login) behandelt

### [FA-08] Rollenmodell & RBAC-Middleware
**Als** System **möchte ich** Zugriffe anhand von Rollen prüfen, **damit** nur Berechtigte geschützte Aktionen ausführen.

## Akzeptanzkriterien
- [ ] Rollen `Lehrperson`, `Lernende:r`, `Admin` existieren
- [ ] Middleware schützt Routen je nach erforderlicher Rolle
- [ ] **Given** eine:e Lernende:r, **when** sie/er eine Lehrer-Route aufruft, **then** Antwort `403`
- [ ] Rollenzuweisung pro Tenant möglich

## Definition of Done
- [ ] Unit-/Integrationstests für erlaubte und verbotene Zugriffe

### [FA-08] Multi-Tenant-Schema & Tenant-Scope
**Als** Betreiber **möchte ich** mandantenfähige Daten, **damit** mehrere Schulen getrennt arbeiten können.

## Akzeptanzkriterien
- [ ] Jede relevante Entität hat einen `tenantId`
- [ ] Alle Queries werden automatisch auf den aktiven Tenant gescoped
- [ ] **Given** zwei Tenants, **then** sieht keiner die Daten des anderen
- [ ] Ein Default-Tenant ist aktiv (MVP)

## Definition of Done
- [ ] Cross-Tenant-Zugriff durch Test ausgeschlossen

### [FA-01] Modul & Modulidentifikation verwalten
**Als** Lehrperson **möchte ich** Module mit Modulidentifikation anlegen/bearbeiten, **damit** ich die Grundlage der Matrix abbilde.

## Kontext
Siehe [docs/03-fachkonzept-kompetenzmatrix.md](../03-fachkonzept-kompetenzmatrix.md). UI: `mockups/lehrer-module.html`.

## Akzeptanzkriterien
- [ ] Modul anlegen mit Nr., Titel, Modulidentifikation
- [ ] Modul bearbeiten und löschen (sofern nicht in Verwendung)
- [ ] Pflichtfeldvalidierung
- [ ] Liste aller Module des Tenants

## Definition of Done
- [ ] CRUD über API + UI getestet

### [FA-02] Handlungsziele verwalten
**Als** Lehrperson **möchte ich** Handlungsziele je Modul erfassen, **damit** ich sie später Kompetenzbändern zuordnen kann.

## Akzeptanzkriterien
- [ ] Handlungsziel anlegen/bearbeiten/löschen, einem Modul zugeordnet
- [ ] Reihenfolge sortierbar
- [ ] **Given** ein Modul, **then** sehe ich alle zugehörigen Handlungsziele

## Definition of Done
- [ ] CRUD getestet, an Modul gebunden

### [FA-03] Kompetenzbaender x Guetestufen (Matrix-Struktur)
**Als** Lehrperson **möchte ich** Kompetenzbänder und Gütestufen als Raster sehen, **damit** ich die Matrix strukturiere.

## Kontext
Gütestufen: Beginner / Intermediate / Advanced (siehe Glossar in [docs/00-README.md](../00-README.md)).

## Akzeptanzkriterien
- [ ] Kompetenzbänder (Zeilen) anlegen/sortieren, referenzieren 1–n Handlungsziele
- [ ] Gütestufen (Spalten) als Standard vorhanden
- [ ] Matrix wird als Raster (Band × Gütestufe) dargestellt

## Definition of Done
- [ ] Rasterdarstellung im UI, Daten persistent

### [FA-04] Kompetenzfelder & Deskriptoren (Ich kann)
**Als** Lehrperson **möchte ich** je Kompetenzfeld „Ich kann …"-Deskriptoren erfassen, **damit** Kompetenzen konkret beschrieben sind.

## Kontext
UI: `mockups/lehrer-module.html`.

## Akzeptanzkriterien
- [ ] Pro Schnittpunkt (Band × Gütestufe) ein Deskriptor editierbar
- [ ] Deskriptoren werden gespeichert und in der Lernenden-Matrix angezeigt
- [ ] Leere Felder erlaubt (nicht jedes Feld muss belegt sein)

## Definition of Done
- [ ] Editor + Anzeige getestet

### [FA-20] Klasse anlegen & Matrix zuordnen
**Als** Lehrperson **möchte ich** eine Klasse anlegen und ihr eine Matrix zuordnen, **damit** Lernende mit der richtigen Matrix arbeiten.

## Akzeptanzkriterien
- [ ] Klasse mit Name/Bezeichnung anlegen
- [ ] Genau eine Matrix zuordnen
- [ ] Klasse bearbeiten/archivieren

## Definition of Done
- [ ] CRUD + Zuordnung getestet

### [FA-23] Beitrittscode generieren & beitreten
**Als** Lehrperson **möchte ich** einen Beitrittscode erzeugen, **damit** Lernende der Klasse selbständig beitreten.

## Akzeptanzkriterien
- [ ] Code generieren (eindeutig, optional ablaufend)
- [ ] **Given** ein gültiger Code, **when** ein:e Lernende:r ihn eingibt, **then** wird sie/er Mitglied
- [ ] Ungültiger/abgelaufener Code wird abgewiesen
- [ ] Code neu generieren/invalidieren möglich

## Definition of Done
- [ ] Happy- und Fehlerpfad getestet

### [FA-25] Mitgliederliste & Verwaltung
**Als** Lehrperson **möchte ich** die Mitglieder meiner Klasse verwalten, **damit** ich den Überblick behalte.

## Kontext
UI: `mockups/lehrer-klassen.html`.

## Akzeptanzkriterien
- [ ] Liste aller Mitglieder mit Status
- [ ] Mitglied entfernen
- [ ] Nur Lehrperson der Klasse hat Zugriff (RBAC)

## Definition of Done
- [ ] Liste + Entfernen getestet

### [FA-30] Kompetenznachweis: Upload-Typ
**Als** Lehrperson **möchte ich** einen Upload-Nachweis definieren, **damit** Lernende Dateien als Beleg einreichen.

## Akzeptanzkriterien
- [ ] Nachweis-Typ „Upload" mit Titel, Beschreibung, erlaubten Dateitypen, Max-Grösse
- [ ] Zuordnung zu Kompetenzfeld(ern)
- [ ] Validierung der Uploads serverseitig

## Definition of Done
- [ ] Definition + Speicherung getestet

### [FA-32] Kompetenznachweis: Quiz-Typ
**Als** Lehrperson **möchte ich** Quiz-Nachweise mit automatischer Auswertung, **damit** Wissen ohne manuelle Korrektur geprüft wird.

## Kontext
UI: `mockups/lernende-quiz.html`.

## Akzeptanzkriterien
- [ ] Fragen (Single/Multiple Choice) mit korrekten Antworten anlegen
- [ ] Automatische Punkteauswertung
- [ ] **Given** ein abgeschlossenes Quiz, **then** wird die Punktzahl berechnet und gespeichert

## Definition of Done
- [ ] Auswertung getestet (inkl. Grenzfälle)

### [FA-36] Sichtbarkeit & Ablaufdatum
**Als** Lehrperson **möchte ich** Nachweise sichtbar/unsichtbar schalten und mit Fälligkeit versehen, **damit** ich den Ablauf steuere.

## Akzeptanzkriterien
- [ ] Flag „sichtbar/unsichtbar" je Nachweis
- [ ] Optionales Fälligkeitsdatum
- [ ] **Given** unsichtbarer Nachweis, **then** für Lernende nicht zugänglich
- [ ] Nach Fälligkeit: Hinweis/Status „überfällig"

## Definition of Done
- [ ] Sichtbarkeits- und Fälligkeitslogik getestet

### [FA-40] Punktevergabe-Schema (X/Y)
**Als** Lehrperson **möchte ich** je Nachweis ein Punkteschema (erreichte/maximale Punkte) festlegen, **damit** die Bewertung einheitlich ist.

## Akzeptanzkriterien
- [ ] Maximalpunkte je Nachweis konfigurierbar
- [ ] Erreichte Punkte werden als X/Y dargestellt
- [ ] Validierung: 0 ≤ erreicht ≤ max

## Definition of Done
- [ ] Schema in Bewertung + Anzeige genutzt

### [FA-50] Lernende reicht Nachweis ein
**Als** Lernende:r **möchte ich** einen Nachweis einreichen, **damit** meine Kompetenz bewertet werden kann.

## Kontext
UI: `mockups/lernende-nachweis.html`.

## Akzeptanzkriterien
- [ ] Upload bzw. Quiz absenden
- [ ] Bestätigung nach Einreichung; Status wechselt auf „eingereicht"
- [ ] Erneute Einreichung nach Zurückweisung möglich
- [ ] Validierung (Dateityp/-grösse bzw. Quiz vollständig)

## Definition of Done
- [ ] Einreichen für beide Typen getestet

### [FA-53] Statusanzeige fuer Lernende
**Als** Lernende:r **möchte ich** den Status meiner Nachweise sehen, **damit** ich weiss, was offen ist.

## Akzeptanzkriterien
- [ ] Status: offen / eingereicht / bewertet / zurückgewiesen
- [ ] Anzeige je Kompetenzfeld in der Matrix
- [ ] Bei „bewertet": Punkte/Gütestufe sichtbar

## Definition of Done
- [ ] Statusfluss in UI korrekt abgebildet

### [FA-60] Lehrperson bewertet (Punkte/Level + Feedback)
**Als** Lehrperson **möchte ich** eingereichte Nachweise bewerten, **damit** Lernende eine Rückmeldung und Gütestufe erhalten.

## Kontext
UI: `mockups/lehrer-bewerten.html`.

## Akzeptanzkriterien
- [ ] Punkte (X/Y) und/oder Gütestufe vergeben
- [ ] Freitext-Feedback erfassen
- [ ] **Given** eine Bewertung, **then** wechselt der Status auf „bewertet" und ist für Lernende sichtbar
- [ ] Bewertung änderbar (mit Historie, siehe FA-65)

## Definition of Done
- [ ] Bewerten + Sichtbarkeit für Lernende getestet

### [FA-62] Einreichung zurueckweisen
**Als** Lehrperson **möchte ich** eine Einreichung mit Begründung zurückweisen, **damit** Lernende nachbessern können.

## Akzeptanzkriterien
- [ ] Zurückweisen mit Pflicht-Begründung
- [ ] Status „zurückgewiesen", Begründung für Lernende sichtbar
- [ ] Lernende:r kann erneut einreichen (FA-50)

## Definition of Done
- [ ] Zurückweisen + Wiedervorlage getestet

### [FA-65] Bewertungshistorie / Audit
**Als** Lehrperson/Admin **möchte ich** eine nachvollziehbare Historie aller Bewertungsschritte, **damit** Änderungen transparent sind.

## Akzeptanzkriterien
- [ ] Jede Bewertung/Zurückweisung wird mit Zeitstempel und Akteur protokolliert
- [ ] Historie je Nachweis einsehbar
- [ ] Einträge sind unveränderlich (append-only)

## Definition of Done
- [ ] Historie wird bei allen Bewertungsaktionen geschrieben und angezeigt

### [FA-90] Fortschritts-Heatmap (Basis)
**Als** Lehrperson **möchte ich** eine Heatmap des Klassenfortschritts, **damit** ich Stärken/Lücken schnell erkenne.

## Kontext
UI: `mockups/lehrer-dashboard.html`.

## Akzeptanzkriterien
- [ ] Matrix-Raster mit Farbcodierung je Kompetenzfeld (Erfüllungsgrad)
- [ ] Aggregiert über alle Lernenden der Klasse
- [ ] Klick auf Feld zeigt Details/Lernende

## Definition of Done
- [ ] Heatmap mit echten Daten getestet

### [FA-91] Kennzahlen-Karten
**Als** Lehrperson **möchte ich** Kennzahlen auf einen Blick, **damit** ich den Status der Klasse schnell erfasse.

## Akzeptanzkriterien
- [ ] Karten: Anzahl Lernende, zu bewerten, bewertet, Ø Fortschritt
- [ ] Werte aktualisieren sich mit den Daten
- [ ] Klick führt zur jeweiligen Detailansicht

## Definition of Done
- [ ] Kennzahlen korrekt berechnet, im Dashboard sichtbar

### [FA-92] Bewertungs-Queue (Wartet auf Bewertung)
**Als** Lehrperson **möchte ich** eine Liste offener Einreichungen, **damit** ich nichts übersehe.

## Akzeptanzkriterien
- [ ] Liste aller Einreichungen mit Status „eingereicht"
- [ ] Sortier-/Filtermöglichkeit (Klasse, Datum)
- [ ] Direktsprung zur Bewertungsansicht (FA-60)

## Definition of Done
- [ ] Queue zeigt offene Einreichungen, Schnellzugriff funktioniert

### [Chore] MVP-Polish & Pilotvorbereitung (Modul 293)
## Ziel
MVP für den Pilot mit Modul 293 stabilisieren.

## Aufgaben
- [ ] Bugfixing aus internen Tests
- [ ] UX-Feinschliff der Kernflows
- [ ] Beispiel-Matrix Modul 293 vollständig erfasst
- [ ] Kurzanleitung für Pilot-Lehrpersonen

## Akzeptanzkriterien
- [ ] Kompletter Flow (Matrix → Klasse → Einreichen → Bewerten → Dashboard) ohne Blocker
- [ ] Pilot-Daten vorbereitet

## Definition of Done
- [ ] Pilot kann starten

### [FA-34] KI-Konfiguration (Endpoint je Lehrperson)
**Als** Lehrperson **möchte ich** meinen KI-Endpoint/Provider konfigurieren, **damit** KI-Funktionen meine eigene Anbindung nutzen.

## Kontext
UI: `mockups/lehrer-ki.html`. Siehe [docs/09-ki-konzept.md](../09-ki-konzept.md).

## Akzeptanzkriterien
- [ ] Provider/Endpoint + API-Key je Lehrperson speichern (verschlüsselt)
- [ ] Verbindungstest („Test"-Button)
- [ ] Ohne Konfiguration sind KI-Funktionen deaktiviert

## Definition of Done
- [ ] Konfiguration + Test funktionieren, Key sicher gespeichert

### [FA-70] KI-Bewertungsvorschlag
**Als** Lehrperson **möchte ich** einen KI-Bewertungsvorschlag, **damit** ich schneller bewerte – mit finalem Wort bei mir.

## Akzeptanzkriterien
- [ ] KI schlägt Punkte/Gütestufe für eine Einreichung vor
- [ ] Vorschlag ist klar als „KI-Vorschlag" markiert
- [ ] **Given** ein Vorschlag, **then** kann die Lehrperson ihn übernehmen oder überschreiben (Override)
- [ ] Keine automatische Endbewertung ohne Bestätigung

## Definition of Done
- [ ] Vorschlag + Override getestet

### [FA-72] KI-Feedbacktext generieren
**Als** Lehrperson **möchte ich** einen KI-Feedbacktext-Vorschlag, **damit** ich Rückmeldungen schneller formuliere.

## Akzeptanzkriterien
- [ ] KI generiert Feedback-Entwurf zur Einreichung
- [ ] Text ist editierbar vor dem Speichern
- [ ] Bezug zu Kriterien/Gütestufe erkennbar

## Definition of Done
- [ ] Generierung + Bearbeitung getestet

### [FA-80] KI-Fachgespraech (Uebungsmodus)
**Als** Lernende:r **möchte ich** ein KI-gestütztes Fachgespräch üben, **damit** ich mich auf Prüfungen vorbereite.

## Kontext
UI: `mockups/lernende-fachgespraech.html`.

## Akzeptanzkriterien
- [ ] Dialogmodus mit KI zu einem Kompetenzthema
- [ ] Übungscharakter (keine Note), Hinweise/Feedback im Verlauf
- [ ] Gesprächsverlauf einsehbar

## Definition of Done
- [ ] Übungsdialog funktioniert end-to-end

### [FA-84] Lernpfade (alternative Reihenfolge)
**Als** Lehrperson **möchte ich** Lernpfade definieren, **damit** Lernende die Matrix in didaktisch sinnvoller Reihenfolge durchlaufen.

## Kontext
UI: `mockups/lernende-lernpfad.html`.

## Akzeptanzkriterien
- [ ] Reihenfolge von Kompetenzen/Bändern als Pfad festlegen
- [ ] Lernende sehen empfohlene nächste Schritte
- [ ] Mehrere Pfade je Matrix möglich

## Definition of Done
- [ ] Pfad-Definition + Anzeige getestet

### [FA-100] Matrix-Export/-Import
**Als** Lehrperson **möchte ich** eine Matrix exportieren und importieren, **damit** ich sie sichern/teilen kann.

## Kontext
Siehe [docs/10-export-import.md](../10-export-import.md).

## Akzeptanzkriterien
- [ ] Export einer Matrix in definiertes Format (z. B. JSON)
- [ ] Re-Import erzeugt identische Struktur
- [ ] Versions-/Schema-Kennung im Export
- [ ] Fehlerhafte Importdatei wird abgewiesen

## Definition of Done
- [ ] Round-Trip (Export → Import) verlustfrei getestet

### [FA-103] Klassen-Archivierung
**Als** Lehrperson **möchte ich** Klassen archivieren, **damit** abgeschlossene Klassen die Übersicht nicht stören.

## Akzeptanzkriterien
- [ ] Klasse archivieren/wiederherstellen
- [ ] Archivierte Klassen standardmässig ausgeblendet
- [ ] Daten bleiben erhalten (read-only im Archiv)

## Definition of Done
- [ ] Archivieren/Wiederherstellen getestet

### [FA-10] Mehrsprachigkeit FR/IT/EN
**Als** Nutzer:in **möchte ich** die App in FR/IT/EN nutzen, **damit** sie schweizweit einsetzbar ist.

## Akzeptanzkriterien
- [ ] i18n-Framework eingebunden, DE vorhanden
- [ ] Übersetzungen FR, IT, EN ergänzt
- [ ] Sprachumschaltung in den Einstellungen (`mockups/lernende-einstellungen.html`)
- [ ] Keine hartcodierten UI-Strings mehr

## Definition of Done
- [ ] Alle vier Sprachen schaltbar, Kern-UI übersetzt

### [FA-11] Excel-Import (ICT-BBCH-Template)
**Als** Lehrperson **möchte ich** eine Matrix aus dem offiziellen Excel-Template importieren, **damit** ich nicht alles manuell erfasse.

## Akzeptanzkriterien
- [ ] Upload des offiziellen ICT-BBCH-Excel-Templates
- [ ] Parsing in Module/Bänder/Gütestufen/Deskriptoren
- [ ] Validierungs-/Fehlerbericht bei abweichendem Format
- [ ] Vorschau vor dem endgültigen Import

## Definition of Done
- [ ] Import mit echtem Template getestet

### [FA-93] Erweitertes Reporting & Filter
**Als** Lehrperson **möchte ich** Reports und Filter, **damit** ich Auswertungen über Bänder und Klassen erstelle.

## Akzeptanzkriterien
- [ ] Filter nach Klasse, Band, Gütestufe, Zeitraum
- [ ] Aggregierte Auswertungen (z. B. Erfüllungsgrad je Band)
- [ ] Export der Auswertung (CSV/PDF)

## Definition of Done
- [ ] Filter + Report mit echten Daten getestet

### [Chore] Haertung: Sicherheit, A11y, Performance
## Ziel
Nicht-funktionale Reife gemäss [docs/12-nicht-funktionale-anforderungen.md](../12-nicht-funktionale-anforderungen.md).

## Aufgaben
- [ ] Security-Review (OWASP Top 10, Rate Limiting, Input-Validierung)
- [ ] Barrierefreiheit (WCAG AA) der Kernscreens
- [ ] Performance-Optimierung kritischer Pfade (Dashboard, Matrix)
- [ ] Logging/Monitoring-Grundlagen

## Akzeptanzkriterien
- [ ] Keine kritischen Findings im Security-Check
- [ ] A11y-Audit der Kernscreens bestanden
- [ ] Definierte Performance-Budgets eingehalten

## Definition of Done
- [ ] NFR-Checkliste aus Doc 12 erfüllt
