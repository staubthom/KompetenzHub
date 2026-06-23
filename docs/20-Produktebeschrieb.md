# KompetenzHub

## Produkt- und Kompetenzdokumentation für Lehrpersonen, im Kompetenzorientierten Unterricht. 🏫

KompetenzHub ist eine Webanwendung für die kompetenzorientierte Planung, Begleitung und Bewertung in der beruflichen Bildung. Die Software bildet Kompetenzmatrizen digital ab, organisiert Kompetenznachweise, unterstützt die Bewertung und macht Lernfortschritte transparent.
Sie richtet sich an Personen, die beurteilen möchten,

- ob die Software fachlich in den Schulalltag passt,
- welche Prozesse damit digitalisiert werden,
- welche technischen Voraussetzungen für Betrieb und Einführung nötig sind,
- wie die Anwendung lokal oder auf einem Server installiert werden kann.

---

## Kurzüberblick 👀

KompetenzHub deckt im aktuellen Stand insbesondere folgende Bereiche ab:

- Kompetenzmatrizen für Module und Handlungsziele
- Klassenverwaltung mit Beitrittscodes
- Kompetenznachweise für Upload, Quiz und Fachgespräch
- Bewertungsoberflächen mit Gütestufen, Punkten und Feedback
- Lernpfade als alternative, didaktische Sicht auf Kompetenzen
- Matrix-Import/-Export und Klassenarchiv
- KI-gestützte Bewertungsvorschläge und Fachgespräche
- Health- und API-Struktur für einen geregelten technischen Betrieb

Technisch besteht das System aus einer Next.js-Web-App, einer NestJS-API, PostgreSQL, Redis sowie einem S3-kompatiblen Dateispeicher, lokal standardmässig über MinIO.

---

## Für wen die Software gedacht ist

### Lehrpersonen 👩‍🏫

KompetenzHub unterstützt Lehrpersonen dabei, Kompetenzmodelle nicht nur zu dokumentieren, sondern direkt im Unterrichts- und Bewertungsprozess zu verwenden. Die Stärke liegt weniger in der klassischen Kursverwaltung als in der strukturierten Verbindung von Kompetenzmatrix, Nachweis und Beurteilung.

### Fachschaften und Bildungsgänge 🤝

Wenn mehrere Lehrpersonen dieselben Module oder dieselbe Logik der Beurteilung verwenden, bietet die Plattform Vorteile durch wiederverwendbare Matrizen, standardisierte Nachweise und nachvollziehbare Bewertungsstrukturen.

### Schulleitungen und technisch versierte Verantwortliche 🛠️

Für Schulleitungen ist KompetenzHub interessant, wenn eine Schule Kompetenzbeurteilung einheitlicher, transparenter und langfristig besser wartbar organisieren will. Die Software ist webbasiert, modular aufgebaut und für lokalen wie auch serverbasierten Betrieb geeignet.

---

## Was KompetenzHub ist und was nicht

### Was die Software gut abdeckt

- strukturierte Abbildung von Kompetenzen pro Modul
- Zuordnung von Lernaufgaben und Leistungsnachweisen zu Kompetenzen
- transparente Lern- und Bewertungsstände pro Klasse
- dokumentierte Bewertungen mit Feedback und Historie
- Export- und Archivierungsprozesse
- gezielte KI-Unterstützung in klar begrenzten Bereichen

### Was die Software bewusst nicht ersetzen will

- kein vollumfängliches LMS wie Moodle oder itslearning
- kein generisches Dateiablagesystem
- kein umfassendes Prüfungsverwaltungssystem für alle denkbaren Prüfungsszenarien

In der Praxis eignet sich KompetenzHub deshalb gut als spezialisierte Fachanwendung für kompetenzorientierte Beurteilung und Lernbegleitung, nicht als alleinige Schulplattform.

---

## Funktionsumfang im Schulalltag

## 1. Kompetenzmatrizen verwalten

Lehrpersonen können Module, Handlungsziele, Kompetenzbänder, Kompetenzfelder und Deskriptoren digital pflegen. Die Matrix ist damit nicht nur eine Referenz, sondern die fachliche Grundlage für Nachweise, Lernpfade und Bewertungen.

Nützliche Eigenschaften:

- Modulnummer, Titel, Beschreibung und Sprache erfassen
- Handlungsziele fachlich sauber zuordnen
- Deskriptoren pro Gütestufe hinterlegen
- Matrizen duplizieren, importieren und exportieren
- Versionierung und Wiederverwendung über Schuljahre hinweg

**Platzhalter für Printscreen:** Matrix-Übersicht

## 2. Klassen führen

Klassen können angelegt und mit einer oder mehreren Matrizen verbunden werden. Lernende treten über einen Beitrittscode bei oder werden durch die Lehrperson verwaltet.

Relevant für den Alltag:

- eine Klasse kann mehrere Matrizen enthalten
- Beitrittscodes reduzieren administrativen Aufwand
- Lehrpersonen sehen jederzeit Mitglieder und Status
- die Klassenstruktur ist direkt mit Nachweisen und Bewertungen verbunden

**Platzhalter für Printscreen:** Klassenverwaltung

## 3. Kompetenznachweise definieren

Nachweise können gezielt an Kompetenzen oder Kompetenzfelder gebunden werden. Dadurch ist sichtbar, warum eine Aufgabe existiert und worauf sie einzahlt.

Aktuell vorgesehene bzw. implementierte Nachweisformen:

- Quiz
- Datei-Upload
- Upload mit KI-Feedback oder KI-Vorbewertung
- Fachgespräch / Expert Talk

Zusätzlich lassen sich konfigurieren:

- Sichtbarkeit
- Start- und Endzeit
- Abgabefrist
- Kriterien oder Bewertungsraster
- mehrere Nachweise pro Kompetenzbereich

**Platzhalter für Printscreen:** Nachweis-Konfiguration

## 4. Lernfortschritt sichtbar machen

Lehrpersonen und Lernende sehen, welche Kompetenzen offen, eingereicht, bewertet oder zurückgewiesen sind. Das ist besonders nützlich in Modulen, in denen mehrere Nachweise parallel laufen oder unterschiedliche Bearbeitungsstände innerhalb einer Klasse üblich sind.

Praktischer Nutzen:

- weniger manuelle Listenpflege
- schneller Überblick über offene Bewertungen
- sichtbarere Selbststeuerung für Lernende
- bessere Grundlage für Standortgespräche oder Lerncoaching

**Platzhalter für Printscreen:** Dashboard oder Heatmap

## 5. Bewertungen dokumentieren

Bewertungen werden direkt am jeweiligen Nachweis erfasst. Neben Gütestufen und Punkten können auch Begründungen, Kriterienbezug und Rückmeldungen dokumentiert werden.

Besonders relevant:

- Rückweisung zur Überarbeitung mit Begründung
- nachvollziehbare Bewertungshistorie
- Kriterienorientierung statt reiner Punktelogik
- mehrere Korrektur- und Feedbackschritte möglich

**Platzhalter für Printscreen:** Bewertungsdetail

## 6. Lernpfade abbilden

Neben der Matrixsicht können Kompetenzen als didaktisch sinnvoller Lernpfad dargestellt werden. Das ist hilfreich, wenn die Reihenfolge der Bearbeitung nicht der reinen Tabellenlogik folgen soll.

Geeignet für:

- geführte Moduleinstiege
- schrittweise Kompetenzentwicklung
- selbstorganisierte Lernphasen mit klarer Reihenfolge

**Platzhalter für Printscreen:** Lernpfad-Ansicht

## 7. KI gezielt einsetzen 🤖

Die KI-Funktionen sind als Unterstützung gedacht, nicht als Ersatz für professionelle Beurteilung.

Aktuell relevant:

- KI-Bewertungsvorschläge für geeignete Nachweise
- KI-Feedback für Lernende
- KI-gestützte Fachgespräche
- konfigurierbare OpenAI-kompatible Endpunkte
- lokaler Stub-Modus für Tests ohne externe KI

Wichtig für Schulen:

- die Lehrperson behält die Entscheidungshoheit
- KI-Schlüssel werden verschlüsselt gespeichert
- der Betrieb kann auch mit eigenen oder kompatiblen Endpunkten erfolgen

**Platzhalter für Printscreen:** KI-Konfiguration oder Fachgespräch

## 8. Import, Export und Archiv

KompetenzHub ist nicht nur für laufende Klassen gedacht, sondern auch für Wiederverwendung und dokumentierte Abschlüsse.

Vorhandene bzw. vorgesehene Bereiche:

- Matrix-Export und Matrix-Import
- Klassenarchiv mit zugehörigen Nachweisen
- Wiederherstellung im Reklamations- oder Einsichtsfall
- S3-basierte Ablage für Anhänge und Assets

**Platzhalter für Printscreen:** Export/Import oder Archivfunktion

---

## Technischer Überblick 🔧

## Architektur

Das Projekt ist als Monorepo aufgebaut und besteht aus zwei Hauptanwendungen:

- `apps/web`: Next.js-Web-App für Lehrpersonen und Lernende
- `apps/api`: NestJS-API mit Prisma und Fachmodulen

Dazu kommen externe oder lokal bereitgestellte Infrastrukturkomponenten:

- PostgreSQL für relationale Daten
- Redis für Queue- und Hintergrundprozesse
- S3-kompatibler Objektspeicher für Uploads und Assets

Im lokalen Setup wird standardmässig Folgendes verwendet:

- PostgreSQL 16
- Redis 7
- MinIO als S3-kompatibler Speicher

## Wichtige technische Eigenschaften

- Web-Frontend mit Next.js 14 und React 18
- API mit NestJS und globalem Präfix `/api/v1`
- Prisma als ORM und Migrationswerkzeug
- CORS-Konfiguration zwischen Web und API
- Health-Endpunkt für Betriebsprüfung
- direkte Uploads über presigned URLs statt Dateitransfer durch die API

## Vorhandene API- und Betriebsmerkmale

- Health-Check unter `/api/v1/health`
- API-Port standardmässig `3001`
- Web-Port standardmässig `3000`
- `.env` im Projektwurzelverzeichnis als gemeinsame Konfigurationsquelle

---

## Installation lokal 💻

## Zielbild

Für eine lokale Entwicklungs- oder Testumgebung werden gestartet:

- Web-App auf Port `3000`
- API auf Port `3001`
- PostgreSQL auf Port `5432`
- Redis auf Port `6379`
- MinIO auf Port `9000`
- MinIO-Konsole auf Port `9001`

## Voraussetzungen

- Node.js ab Version 20
- npm
- Docker Desktop oder eine kompatible Docker-Umgebung

## 1. Repository vorbereiten

```bash
npm install
```

## 2. Umgebungsvariablen anlegen

Auf Unix/macOS:

```bash
cp .env.example .env
```

Auf Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Wichtige Standardwerte in `.env`:

- `DATABASE_URL=postgresql://kompetenzhub:kompetenzhub@localhost:5432/kompetenzhub?schema=public`
- `REDIS_URL=redis://localhost:6379`
- `S3_ENDPOINT=http://localhost:9000`
- `NEXT_PUBLIC_API_URL=http://localhost:3001`
- `NEXT_PUBLIC_WEB_URL=http://localhost:3000`

Für einen rein lokalen Start reichen diese Werte normalerweise aus.

## 3. Infrastruktur starten

```bash
docker compose up -d
```

Dadurch werden PostgreSQL, Redis und MinIO gestartet.

## 4. Datenbank vorbereiten

```bash
npm run prisma:generate
npm run prisma:migrate
```

Optional kann zusätzlich ein Seed-Lauf ausgeführt werden:

```bash
npm run prisma:seed --workspace apps/api
```

## 5. Web und API starten

```bash
npm run dev
```

Danach sind standardmässig erreichbar:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Health: `http://localhost:3001/api/v1/health`
- MinIO-Konsole: `http://localhost:9001`

## 6. Funktion prüfen

Sinnvolle erste Checks:

```bash
npm run build
npm run typecheck
```

Zusätzlich gibt es fachliche Smoke-Skripte in `apps/api/scripts`, zum Beispiel:

```bash
npm run smoke --workspace apps/api
npm run smoke:matrix --workspace apps/api
npm run smoke:classes --workspace apps/api
```

## Typische Stolpersteine lokal

- Wenn Port `3000`, `3001`, `5432`, `6379`, `9000` oder `9001` bereits belegt ist, müssen die Ports in `.env` angepasst werden.
- Unter Windows kann `prisma:migrate` bei laufendem Dev-Server eine gesperrte Prisma-DLL melden. Dann den Dev-Server kurz stoppen und `npm run prisma:generate` erneut ausführen.
- Wenn Uploads fehlschlagen, zuerst `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` und den MinIO-Status prüfen.

---

## Installation auf einem Server oder in der Cloud ☁️

## Grundsatz

KompetenzHub kann auf einer VM, einem Schulserver, einer Managed-Container-Plattform oder auf Kubernetes betrieben werden. Für den Produktivbetrieb sollten Web, API, Datenbank und Speicher logisch getrennt und über Umgebungsvariablen verbunden werden.

## Empfohlenes Zielbild für Produktion

- Web-App als eigener Node.js-Prozess oder Container
- API als eigener Node.js-Prozess oder Container
- PostgreSQL als Managed-Datenbank oder eigener Datenbankserver
- Redis als Managed-Instanz oder separater Dienst
- S3-kompatibler Speicher, z. B. AWS S3, Cloudflare R2, MinIO oder ein schulinterner Objektstore
- Reverse Proxy mit HTTPS, z. B. Nginx, Traefik oder Cloud Load Balancer

## Wichtiger Hinweis zum aktuellen Repo-Stand

Im Repository ist aktuell ein Dockerfile für die API vorhanden. Für die Web-App ist derzeit kein Dockerfile im Projekt enthalten. Für den Serverbetrieb gibt es deshalb zwei pragmatische Wege:

- Web-App direkt mit `next build` und `next start` als Node.js-Prozess betreiben
- oder ein eigenes Dockerfile für die Web-App ergänzen

Die folgende Anleitung beschreibt den Betrieb ohne zusätzlichen Web-Container, weil das mit dem aktuellen Stand sofort umsetzbar ist.

## Variante A: Betrieb auf einer Linux-VM

### Voraussetzungen

- Ubuntu oder Debian mit aktuellem Patch-Stand
- Node.js 20
- npm
- Docker oder externe Services für PostgreSQL, Redis und S3
- Nginx oder ein anderer Reverse Proxy

### 1. Code bereitstellen

```bash
git clone <REPOSITORY-URL>
cd Kompetenzmatrix
npm install
```

### 2. Produktions-`.env` erstellen

Zwingend anzupassen sind mindestens:

- `DATABASE_URL`
- `REDIS_URL`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `JWT_SIGNING_KEY`
- `AI_CONFIG_ENC_KEY`
- `AUTH_EXCHANGE_SECRET`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WEB_URL`
- `DEV_LOGIN_ENABLED=false`

Beispiel:

```dotenv
DATABASE_URL=postgresql://appuser:starkespasswort@db.example.internal:5432/kompetenzhub?schema=public
REDIS_URL=redis://redis.example.internal:6379
S3_ENDPOINT=https://s3.example.org
S3_BUCKET=kompetenzhub-prod
S3_ACCESS_KEY=<access-key>
S3_SECRET_KEY=<secret-key>
API_PORT=3001
NEXT_PUBLIC_API_URL=https://kompetenzhub.example.ch/api
NEXT_PUBLIC_WEB_URL=https://kompetenzhub.example.ch
JWT_SIGNING_KEY=<starker-geheimer-wert>
AI_CONFIG_ENC_KEY=<starker-geheimer-wert>
AUTH_EXCHANGE_SECRET=<starker-geheimer-wert>
DEV_LOGIN_ENABLED=false
```

### 3. Datenbank-Migration ausführen

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Anwendungen bauen

```bash
npm run build
```

### 5. Prozesse starten

API:

```bash
npm run start --workspace apps/api
```

Web:

```bash
npm run start --workspace apps/web
```

Für den dauerhaften Betrieb empfiehlt sich `systemd`, `pm2` oder eine Container-Plattform.

### 6. Reverse Proxy einrichten

Bewährtes Routing:

- `/` an die Web-App auf Port `3000`
- `/api/` an die API auf Port `3001`

Wichtig:

- HTTPS erzwingen
- Request-Grössen für Uploads passend setzen
- Timeouts für grössere Uploads und Exportprozesse nicht zu knapp wählen

## Variante B: Container-/Cloud-Betrieb

### API als Container

Für die API ist bereits ein Dockerfile vorhanden:

- Build-Stage auf Basis `node:20-alpine`
- Runtime-Stage mit kompakter Production-Installation

Beispiel:

```bash
docker build -f apps/api/Dockerfile -t kompetenzhub-api .
docker run --env-file .env -p 3001:3001 kompetenzhub-api
```

### Web-App ohne vorhandenes Dockerfile

Mit dem aktuellen Repo-Stand gibt es zwei sinnvolle Optionen:

- Web ausserhalb von Docker mit Node.js betreiben
- oder ein eigenes Dockerfile ergänzen und die Web-App ebenfalls containerisieren

Wenn eine Schule oder Organisation vollständig containerbasiert deployen will, ist ein eigenes Web-Dockerfile der nächste saubere Schritt.

### Externe Dienste in der Cloud

Für einen robusten Betrieb empfehlen sich:

- Managed PostgreSQL
- Managed Redis
- S3-kompatibler Objektspeicher mit Backups und Lifecycle-Regeln
- TLS-Zertifikate über Reverse Proxy oder Cloud-Plattform

---

## Konfiguration, Sicherheit und Betrieb 🔐

## Besonders wichtige Umgebungsvariablen

| Variable               | Bedeutung                                                    |
| ---------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`         | Verbindung zur PostgreSQL-Datenbank                          |
| `REDIS_URL`            | Verbindung zu Redis                                          |
| `S3_ENDPOINT`          | URL des S3-/MinIO-Endpunkts                                  |
| `S3_BUCKET`            | Bucket für Uploads und Assets                                |
| `NEXT_PUBLIC_API_URL`  | öffentliche Basis-URL der API aus Sicht des Browsers         |
| `NEXT_PUBLIC_WEB_URL`  | öffentliche URL der Web-App, auch relevant für CORS          |
| `JWT_SIGNING_KEY`      | Signaturschlüssel für API-JWTs                               |
| `AI_CONFIG_ENC_KEY`    | Schlüssel zur Verschlüsselung gespeicherter KI-API-Schlüssel |
| `AUTH_EXCHANGE_SECRET` | Secret für den Exchange zwischen Frontend und API            |
| `DEV_LOGIN_ENABLED`    | Dev-Login in Produktion auf `false` setzen                   |

## Mindestanforderungen für Produktion

- starke Secrets statt Entwicklungsdefaults
- HTTPS für Web und API
- regelmässige Backups von Datenbank und Objektspeicher
- Trennung von Test-, Staging- und Produktivumgebung
- Monitoring für API, Datenbank, Redis und Speicher

## Betriebsprüfung

Der Endpunkt

```text
/api/v1/health
```

liefert einen einfachen Überblick über den Zustand von:

- Datenbank
- Redis
- S3/MinIO

Das ist besonders für Schulserver, Docker-Deployments oder Cloud-Monitoring nützlich.

---

## Einführung in einer Schule: praktische Hinweise 📋

Für eine Einführung im Schulbetrieb sind erfahrungsgemäss weniger die UI-Fragen kritisch als diese Punkte:

- Wer pflegt Matrizen zentral, wer lokal pro Lehrperson?
- Welche Module sollen zuerst digitalisiert werden?
- Welche Nachweistypen sind tatsächlich gewünscht?
- Wie soll KI schulisch geregelt werden?
- Wo werden Archive abgelegt und wie lange aufbewahrt?
- Soll die Schule eigene Logins, eigene KI-Endpunkte oder eigenen Speicher nutzen?

Ein realistischer Start ist oft:

1. mit einem Modul oder einer Pilotklasse beginnen
2. eine Fachschaftsvorlage für Matrix und Bewertungsraster erstellen
3. Upload- und Bewertungsprozess zuerst ohne komplexe KI-Regeln einführen
4. Archivierung und Export früh testen, nicht erst am Ende des Schuljahres

---

## Glossar 📚

| Begriff                        | Bedeutung                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| **Modul**                      | Inhaltliche Einheit der beruflichen Grundbildung, z. B. ein ICT-Modul.             |
| **Handlungsziel (HZ)**         | Fachlich definierte Zielbeschreibung einer beruflichen Handlungssituation.         |
| **Kompetenzmatrix**            | Strukturierte Darstellung von Kompetenzen pro Modul.                               |
| **Kompetenzband**              | Thematische Gruppe von Kompetenzen, z. B. A1 oder B1.                              |
| **Gütestufe**                  | Niveaustufe einer Kompetenz, typischerweise Beginner, Intermediate oder Advanced.  |
| **Kompetenzfeld**              | Kombination aus Kompetenzband und Gütestufe.                                       |
| **Deskriptor**                 | Konkrete Beschreibung einer Kompetenz, meist im Stil „Ich kann …“.                 |
| **Kompetenznachweis**          | Aufgabe oder Leistung, mit der eine Kompetenz belegt wird.                         |
| **Bewertungsraster**           | Kriterien- und Indikatorenlogik zur Beurteilung eines Nachweises.                  |
| **Kriterium**                  | Einzelaspekt, der in einem Nachweis beurteilt wird.                                |
| **Indikator**                  | Beobachtbare Formulierung, wie sich eine Leistung innerhalb einer Gütestufe zeigt. |
| **Lernpfad**                   | Didaktisch geordnete Reihenfolge von Kompetenzen oder Schritten.                   |
| **Expert Talk / Fachgespräch** | Gesprächsformat mit KI-Unterstützung für Übung oder Bewertung.                     |
| **Matrix-Import/-Export**      | Austauschformat für fachliche Matrixdaten ohne Klassenkontext.                     |
| **Klassenarchiv**              | Export einer Klasse mit Nachweisen, Bewertungen und zugehörigen Daten.             |
| **S3**                         | Standardisierte Schnittstelle für Objektspeicher, lokal oft via MinIO genutzt.     |
| **MinIO**                      | S3-kompatibler Objektspeicher für lokale oder eigene Installationen.               |
| **Prisma**                     | ORM und Migrationswerkzeug der API.                                                |
| **NestJS**                     | Backend-Framework der API.                                                         |
| **Next.js**                    | React-basiertes Framework der Web-Anwendung.                                       |
| **Health-Check**               | Technischer Endpunkt zur Prüfung, ob zentrale Dienste erreichbar sind.             |

### Gütestufen und Richtwerte

| Gütestufe    | Kürzel | Richtwert |
| ------------ | ------ | --------- |
| Beginner     | B      | 3.0       |
| Intermediate | I      | 4.5       |
| Advanced     | A      | 6.0       |

Die konkrete Gewichtung und Notenlogik bleibt eine pädagogische Entscheidung des Lernorts.

---

## Screenshots

An den markierten Stellen können gezielt Screenshots ergänzt werden. Für diese Dokumentation sind besonders sinnvoll:

- Matrix-Übersicht
- Klassenverwaltung
- Nachweis-Konfiguration
- Bewertungsansicht
- Lernpfad
- KI-Konfiguration oder Expert Talk
- Export-/Archivdialog

---

## Was KompetenzHub besonders macht

KompetenzHub unterscheidet sich von allgemeinen Lernplattformen oder reinen Dateiablagen dadurch, dass die Software konsequent von der Kompetenzlogik her gedacht ist.

Die Plattform verbindet:

- fachliche Struktur ueber Kompetenzmatrizen
- operative Unterrichtsarbeit ueber Klassen und Nachweise
- transparente Beurteilung ueber Kriterien, Historien und Feedback
- didaktische Fuehrung ueber Lernpfade
- Innovation ueber KI-gestuetzte Funktionen
- schulische Verlaesslichkeit ueber Archivierung und nachvollziehbare Prozesse

Dadurch entsteht eine Loesung, die nicht nur digitalisiert, sondern Unterricht und Bewertung inhaltlich besser stuetzt.

---

## Einladung zum Ausprobieren

KompetenzHub richtet sich an Schulen und Lehrpersonen, die kompetenzorientierte Beurteilung digital, transparent und zukunftsfaehig umsetzen moechten.

Die Software eignet sich besonders fuer Schulen,

- die ihre Kompetenzmatrizen aus Tabellen und Einzeldokumenten herausloesen wollen
- die den Lernfortschritt ihrer Klassen sichtbarer machen moechten
- die den Bewertungsaufwand besser strukturieren wollen
- die KI verantwortungsvoll und praxistauglich in den Unterrichtsalltag integrieren moechten
- die eine saubere Grundlage fuer Archivierung, Nachvollziehbarkeit und schulische Skalierung suchen

Wer kompetenzorientiertes Lernen nicht nur planen, sondern im Alltag wirksam umsetzen will, findet mit KompetenzHub eine Plattform, die fachliche Klarheit, didaktische Unterstuetzung und moderne Technologie in einer Anwendung zusammenbringt.

---

## Hinweise fuer diese Dokumentation

Diese Datei ist bewusst als ausfuehrliche, lesbare Produktbeschreibung mit werblicher Ausrichtung geschrieben. Sie eignet sich als Grundlage fuer:

- eine Projekt- oder Produktvorstellung gegenueber Schulen
- eine Broschuere oder Praesentation fuer Lehrpersonen
- eine Landingpage oder einen ausfuehrlichen Produkttext
- Unterlagen fuer Pilotierungen und Erstgespraeche

Printscreens koennen an den markierten Stellen ergaenzt werden, um die beschriebenen Funktionen visuell zu unterstuetzen.
