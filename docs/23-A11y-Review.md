# KompetenzHub – Accessibility-Review (WCAG 2.1 AA)

> Stand: Juni 2026 · Ziel: WCAG 2.1 Level AA für die Kernscreens
> Phase 2 der Härtung (nach Security). Adressiert das Akzeptanzkriterium **„A11y-Audit (axe) der Kernscreens ohne kritische Verstösse"**.

## Ergebnis

**axe-core-Audit (WCAG 2.0/2.1 A & AA) der 14 Kernscreens: 0 Verstösse.**

| Rolle      | Geprüfte Screens                                                                            |
| ---------- | ------------------------------------------------------------------------------------------- |
| Anonym     | `/login`                                                                                    |
| Lernende   | `/lernende`, `/lernende/nachweise`, `/lernende/einstellungen`                               |
| Lehrperson | `/lehrer`, `/modules`, `/lehrer/klassen`, `/lehrer/bewerten`, `/lehrer/ki`                  |
| Schuladmin | `/admin`, `/admin/personen`, `/admin/einladungen`, `/admin/betrieb`, `/admin/einstellungen` |

Geprüfte Regel-Tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. Schwellwert für Blocker: Impact `serious` + `critical`.

## Werkzeuge

**1. Statische Prüfung in CI – `eslint-plugin-jsx-a11y` (recommended)**
Bei jedem PR via `npm run lint` (Web). Fängt fehlende Alt-Texte, Labels, Rollen, Tastatur-Handler u. v. m. bereits beim Build ab.

**2. Laufzeit-Audit mit axe-core – `npm run a11y:audit`**
Playwright + `@axe-core/playwright` ([apps/web/scripts/a11y-audit.mjs](../apps/web/scripts/a11y-audit.mjs)). Meldet sich je Rolle per Dev-Login an, lädt jeden Kernscreen und führt axe aus. Exit-Code 1 bei kritischen/schweren Verstössen.

Voraussetzungen (lokal, nicht in CI – analog zu den Smoke-Tests):

```bash
docker compose up -d           # DB/Redis/MinIO
npm run dev                    # API (3001) + Web (3000)
npx playwright install chromium
npm run a11y:audit --workspace apps/web
```

## Umgesetzte Massnahmen (WCAG-Bezug)

### Wahrnehmbarkeit

- **Kontrast (1.4.3):** Akzentfarbe (Default und alle 7 Presets) auf **≥ 4.5:1** ausgelegt; eigener Hex bleibt möglich (Hinweistext). Sekundärtext (`--fg-muted`) abgedunkelt, damit er auch auf getönten Flächen AA erreicht. **Status-Badges** haben eigene, pro Theme (hell/dunkel) AA-taugliche Textfarben.
- **Text-Alternativen (1.1.1):** dekorative Icons/Emojis mit `aria-hidden`; Logo mit leerem `alt` (dekorativ); Status wird nie nur über Farbe transportiert (immer Text/Symbol).

### Bedienbarkeit

- **Tastatur (2.1.1):** klickbare Heatmap-Zellen sind echte `<button>`; keine click-only-Handler auf nicht-interaktiven Elementen mehr.
- **Sichtbarer Fokus (2.4.7):** globaler `:focus-visible`-Ring auf allen interaktiven Elementen; Contenteditable-Editor erhält Fokus-Stil.
- **Skip-Link (2.4.1):** „Zum Inhalt springen" springt zum `<main id="main">`.
- **Benannte Bedienelemente (4.1.2 / 2.4.6):** Icon-Buttons, Sprach-/Theme-Auswahl, Akzent-Swatches, Rollen-/Sprach-Selects und sonst nur per Platzhalter beschriftete Felder (Beitrittscode, Einladungs-/Co-Leitungs-E-Mail, Schulname) haben `aria-label`.

### Verständlichkeit / Robustheit

- **Sprache (3.1.1):** `<html lang>` folgt der gewählten Sprache (DE/FR/IT/EN).
- **Rollen & Zustände:** Dialoge mit `role="dialog"` + `aria-modal` + Label und Escape; Menüs/Toggles mit `aria-expanded`/`aria-pressed`; aktiver Navigationspunkt mit `aria-current="page"`; Toasts als `aria-live`-Region.
- **Statische Garantie:** `eslint-plugin-jsx-a11y` (recommended) ist im Web-Lint aktiv → CI-geprüft.

## Bekannte Einschränkungen / Hinweise

- Das automatische Audit läuft im **Hell-Modus** (Standard). Dunkel-/Grau-Modus nutzen dieselben, pro Theme definierten kontrastsicheren Tokens.
- **Eigene Akzentfarbe:** Die Schuladmin kann einen beliebigen Hex-Wert wählen; sehr helle Werte können den Kontrast unterschreiten. Die 7 Presets sind AA-konform; ein Hinweis steht in den Einstellungen.
- Reduzierte Bewegung wird respektiert (`prefers-reduced-motion`).
