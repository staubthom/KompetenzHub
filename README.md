# KompetenzHub

Planung und interaktive UI-Mockups für **KompetenzHub** – eine Software, mit der **Berufsfachschul-Lehrpersonen**
die **Kompetenzmatrix** pro Modul abbilden, **Kompetenznachweise** erfassen und den
**Kompetenzerwerb** ihrer Lernenden begleiten und bewerten können.

Die Lösung orientiert sich am offiziellen Konzept *„Kompetenzmatrix für die berufliche
Grundbildung in der ICT"* von **ICT-Berufsbildung Schweiz** (in Kraft seit 01.06.2025).


---

## 🔗 Schnellzugriff

- **🖥️ Live-Mockups (GitHub Pages):** https://staubthom.github.io/KompetenzHub/ 
- **📁 Mockups (Quellcode):** [`mockups/`](./mockups/index.html)
- **📚 Planungsdokumentation:** [`docs/`](./docs/00-README.md)

---

## 📚 Dokumentation

Die vollständige Planung liegt im Ordner [`docs/`](./docs/00-README.md). Einstieg über das
[Dokumentations-README](./docs/00-README.md) mit Navigation und Glossar.

| Nr. | Dokument | Inhalt |
|----|----------|--------|
| 00 | [README](./docs/00-README.md) | Navigation, Glossar, Konventionen |
| 01 | [Vision & Ziele](./docs/01-vision-und-ziele.md) | Problemstellung, Zielgruppen, Nutzen, Scope |
| 02 | [Rollen & Use Cases](./docs/02-rollen-und-use-cases.md) | Rollen, User Stories, Berechtigungen |
| 03 | [Fachkonzept Kompetenzmatrix](./docs/03-fachkonzept-kompetenzmatrix.md) | Übersetzung des ICT-BBCH-Konzepts |
| 04 | [Funktionale Anforderungen](./docs/04-funktionale-anforderungen.md) | Detaillierte Features |
| 05 | [Datenmodell](./docs/05-datenmodell.md) | Entitäten, ER-Diagramm, Statusmodelle |
| 06 | [Architektur](./docs/06-architektur.md) | Systemarchitektur, Tech-Stack, Storage |
| 07 | [API-Design](./docs/07-api-design.md) | REST-Endpoints, Payloads |
| 08 | [Authentifizierung](./docs/08-authentifizierung.md) | OAuth/OIDC, Rollen |
| 09 | [KI-Konzept](./docs/09-ki-konzept.md) | KI-Bewertung, Fachgespräch, Override |
| 10 | [Export & Import](./docs/10-export-import.md) | Matrix-Export, Klassen-Archivierung |
| 11 | [UI/UX-Konzept](./docs/11-ui-ux-konzept.md) | Hauptscreens, Dashboards |
| 12 | [Nicht-funktionale Anforderungen](./docs/12-nicht-funktionale-anforderungen.md) | Datenschutz, Sicherheit, Performance, i18n |
| 13 | [Roadmap & MVP](./docs/13-roadmap-und-mvp.md) | Phasen, Meilensteine, Aufwand |

---

## 🖥️ Mockups

Klickbare HTML/CSS-Mockups (ohne Build-Schritt, reines HTML/CSS/JS) im Ordner
[`mockups/`](./mockups/index.html). Funktionen: Light/Dark/Gray-Theme, Sprachumschaltung,
Schul-Branding (Live-Farbwechsel) und responsives Layout.

**Einstieg:** [`mockups/index.html`](./mockups/index.html)

| Lernende | Lehrperson |
|----------|------------|
| Meine Matrix · Lernpfad | Dashboard · Module & Matrizen |
| Nachweis · Quiz · Fachgespräch | Klassen · Bewerten |
| Einstellungen | KI-Einstellungen · Branding |

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

## 📦 Repository-Struktur

```
.
├── index.html        # Pages-Einstieg (Weiterleitung zu den Mockups)
├── .nojekyll         # Pages: kein Jekyll-Processing
├── docs/             # Planungsdokumentation (Markdown)
├── mockups/          # klickbare HTML/CSS-Mockups
└── Archiv/           # internes Quellmaterial (per .gitignore ausgeschlossen)
```

> Der Ordner `Archiv/` wird **nicht** veröffentlicht (siehe [`.gitignore`](./.gitignore)).

---

## 📄 Status

| Version | Datum | Anmerkung |
|---------|-------|-----------|
| 0.1 (Entwurf) | 2026-06-20 | Erste vollständige Planungsfassung inkl. Mockups |
