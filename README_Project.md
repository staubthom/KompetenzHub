# KompetenzHub

Planung und interaktive UI-Mockups für **KompetenzHub** – eine Software, mit der **Berufsfachschul-Lehrpersonen**
die **Kompetenzmatrix** pro Modul abbilden, **Kompetenznachweise** erfassen und den
**Kompetenzerwerb** ihrer Lernenden begleiten und bewerten können.

Die Lösung orientiert sich am offiziellen Konzept _„Kompetenzmatrix für die berufliche
Grundbildung in der ICT"_ von **ICT-Berufsbildung Schweiz** (in Kraft seit 01.06.2025).

---

## 🔗 Schnellzugriff

- **🖥️ Live-Mockups (GitHub Pages):** https://staubthom.github.io/KompetenzHub/
- **📁 Mockups (Quellcode):** [`mockups/`](./mockups/index.html)
- **📚 Planungsdokumentation:** [`docs/`](./docs/00-README.md)

---

## 📚 Dokumentation

Die vollständige Planung liegt im Ordner [`docs/`](./docs/00-README.md). Einstieg über das
[Dokumentations-README](./docs/00-README.md) mit Navigation und Glossar.

| Nr. | Dokument                                                                        | Inhalt                                      |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------- |
| 00  | [README](./docs/00-README.md)                                                   | Navigation, Glossar, Konventionen           |
| 01  | [Vision & Ziele](./docs/01-vision-und-ziele.md)                                 | Problemstellung, Zielgruppen, Nutzen, Scope |
| 02  | [Rollen & Use Cases](./docs/02-rollen-und-use-cases.md)                         | Rollen, User Stories, Berechtigungen        |
| 03  | [Fachkonzept Kompetenzmatrix](./docs/03-fachkonzept-kompetenzmatrix.md)         | Übersetzung des ICT-BBCH-Konzepts           |
| 04  | [Funktionale Anforderungen](./docs/04-funktionale-anforderungen.md)             | Detaillierte Features                       |
| 05  | [Datenmodell](./docs/05-datenmodell.md)                                         | Entitäten, ER-Diagramm, Statusmodelle       |
| 06  | [Architektur](./docs/06-architektur.md)                                         | Systemarchitektur, Tech-Stack, Storage      |
| 07  | [API-Design](./docs/07-api-design.md)                                           | REST-Endpoints, Payloads                    |
| 08  | [Authentifizierung](./docs/08-authentifizierung.md)                             | OAuth/OIDC, Rollen                          |
| 09  | [KI-Konzept](./docs/09-ki-konzept.md)                                           | KI-Bewertung, Fachgespräch, Override        |
| 10  | [Export & Import](./docs/10-export-import.md)                                   | Matrix-Export, Klassen-Archivierung         |
| 11  | [UI/UX-Konzept](./docs/11-ui-ux-konzept.md)                                     | Hauptscreens, Dashboards                    |
| 12  | [Nicht-funktionale Anforderungen](./docs/12-nicht-funktionale-anforderungen.md) | Datenschutz, Sicherheit, Performance, i18n  |
| 13  | [Roadmap & MVP](./docs/13-roadmap-und-mvp.md)                                   | Phasen, Meilensteine, Aufwand               |

---

## 🖥️ Mockups

Klickbare HTML/CSS-Mockups (ohne Build-Schritt, reines HTML/CSS/JS) im Ordner
[`mockups/`](./mockups/index.html). Funktionen: Light/Dark/Gray-Theme, Sprachumschaltung,
Schul-Branding (Live-Farbwechsel) und responsives Layout.

**Einstieg:** [`mockups/index.html`](./mockups/index.html)

| Lernende                       | Lehrperson                    |
| ------------------------------ | ----------------------------- |
| Meine Matrix · Lernpfad        | Dashboard · Module & Matrizen |
| Nachweis · Quiz · Fachgespräch | Klassen · Bewerten            |
| Einstellungen                  | KI-Einstellungen · Branding   |

---

## 🚀 Lokal ansehen

Keine Installation nötig — die Mockups sind statisch:

```bash
# einfach die Startseite im Browser öffnen
mockups/index.html
```

Optional mit lokalem Webserver (empfohlen, damit relative Pfade sauber laden):

```bash
# Python 3
python -m http.server 8000
# danach im Browser: http://localhost:8000/mockups/
```

---

## 🛠️ Entwicklung (App-Stack)

Das Projekt ist ein **npm-Workspaces-Monorepo** mit einer NestJS-API und einer Next.js-Web-App.

**Voraussetzungen:** Node.js ≥ 20, Docker Desktop.

```bash
# 1) Abhängigkeiten installieren
npm install

# 2) Umgebungsvariablen vorbereiten
cp .env.example .env

# 3) Infrastruktur starten (Postgres, Redis, MinIO)
docker compose up -d

# 4) Prisma-Client generieren + Migration anlegen
npm run prisma:generate
npm run prisma:migrate

# 5) Dev-Server starten (API + Web parallel)
npm run dev
```

| Dienst        | URL                          |
| ------------- | ---------------------------- |
| Web (Next.js) | http://localhost:3000        |
| API (NestJS)  | http://localhost:3001        |
| Health-Check  | http://localhost:3001/health |
| MinIO-Konsole | http://localhost:9001        |

**Nützliche Skripte:** `npm run build`, `npm run lint`, `npm run format`, `npm run format:check`, `npm run prisma:studio`.

> **Hinweis (Windows):** Läuft der Dev-Server bereits, kann `prisma:migrate` beim
> abschließenden Client-Generieren einen `EPERM: operation not permitted, rename`-Fehler
> zeigen, weil die Prisma-Engine-DLL gesperrt ist. Die Migration wird dennoch angewendet.
> Stoppe vor dem Migrieren kurz den Dev-Server oder führe danach `npm run prisma:generate` aus.

---

## 📦 Repository-Struktur

```
.
├── index.html          # Pages-Einstieg (Weiterleitung zu den Mockups)
├── .nojekyll           # Pages: kein Jekyll-Processing
├── docker-compose.yml  # lokale Infrastruktur (Postgres/Redis/MinIO)
├── apps/
│   ├── api/            # NestJS-API (+ Prisma-Schema)
│   └── web/            # Next.js-Web-App
├── docs/               # Planungsdokumentation (Markdown)
├── mockups/            # klickbare HTML/CSS-Mockups
└── Archiv/             # internes Quellmaterial (per .gitignore ausgeschlossen)
```

> Der Ordner `Archiv/` wird **nicht** veröffentlicht (siehe [`.gitignore`](./.gitignore)).

---

## 📄 Status

| Version       | Datum      | Anmerkung                                        |
| ------------- | ---------- | ------------------------------------------------ |
| 0.1 (Entwurf) | 2026-06-20 | Erste vollständige Planungsfassung inkl. Mockups |
