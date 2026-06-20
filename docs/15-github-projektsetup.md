# 15 – GitHub-Projektsetup (Sprints planen & tracken)

Diese Anleitung zeigt, wie du die [Sprintplanung (Doc 14)](./14-sprintplan.md) in GitHub
umsetzt – mit **Issues**, **Milestones** (= Phasen) und **Projects v2 / Iterations** (= Sprints).
Alles ist in **GitHub Free / Education** kostenlos enthalten.

> **Mapping:** Milestone = Phase · Iteration = Sprint · Issue = Backlog-Item · Label = Typ/Bereich.

---

## Variante A – Automatisch per Skript (empfohlen)

Legt **Milestones, Labels und alle Issues** in einem Rutsch an.

### 1. GitHub CLI installieren (einmalig, kostenlos)

```powershell
winget install GitHub.cli
```

> `gh` ist ein freies Tool und unabhängig vom GitHub-Plan (funktioniert mit Education).

### 2. Anmelden (einmalig)

```powershell
gh auth login
```

(GitHub.com → HTTPS → im Browser bestätigen.)

### 3. Skript ausführen (aus dem Repo-Verzeichnis)

**Windows (empfohlen, PowerShell-Variante – kein bash nötig):**

```powershell
powershell -ExecutionPolicy Bypass -File .github\scripts\setup-project.ps1
```

> Öffne dazu **PowerShell** im Repo-Ordner (in VS Code: Terminal → „PowerShell"; oder im
> Datei-Explorer im Ordner `Umschalt`+Rechtsklick → „PowerShell-Fenster hier öffnen").

**Falls du lieber das bash-Skript nutzt** (Git Bash oder WSL erforderlich):

```bash
bash .github/scripts/setup-project.sh
```

> Git Bash kommt mit „Git for Windows" und ist meist schon installiert. In Git Bash
> ins Repo wechseln (`cd /c/Users/staubt/OneDrive/KI_Spielplatz/Kompetenzmatrix`) und obigen
> Befehl ausführen.

Beide Skripte sind **idempotent** – ein erneuter Lauf legt nichts doppelt an.
Danach existieren 4 Milestones, alle Labels und ~38 Issues mit `sprint:*`-Labels.

---

## Issue-Beschreibungen nachträglich ausformulieren (User Story + Akzeptanzkriterien)

Die per Setup-Skript angelegten Issues haben zunächst nur einen kurzen Body. Mit dem
**Update-Skript** werden sie um **User Story** und **Akzeptanzkriterien** ergänzt – ohne
Titel, Labels, Milestone oder **Sprint-/Project-Zuordnung** zu verändern (Matching per Titel,
Aktualisierung via `gh issue edit`).

Die ausformulierten Texte stehen zentral in [`docs/issues/bodies.md`](./issues/bodies.md)
(ein Abschnitt je Issue, beginnend mit `### <exakter Titel>`).

```powershell
# Vorschau (zeigt nur, was aktualisiert würde):
powershell -ExecutionPolicy Bypass -File .github\scripts\update-issue-bodies.ps1 -WhatIf

# Tatsächlich anwenden:
powershell -ExecutionPolicy Bypass -File .github\scripts\update-issue-bodies.ps1
```

> Das Skript ist **idempotent** und **sicher für bereits in Sprints geplante Issues**:
> Es setzt nur den Body. Texte anpassen → einfach `bodies.md` editieren und erneut ausführen.

---

## Variante B – Ohne CLI, per Klick / CSV-Import

Falls du `gh` nicht installieren möchtest:

1. **Milestones anlegen:** Repo → **Issues → Milestones → New milestone**: je einen für
   „Phase 1 – MVP", „Phase 2 – KI & Lernpfad", „Phase 3 – Export & i18n", „Phase 4 – Reife".
2. **Labels anlegen:** Repo → **Issues → Labels**: `type:feature/bug/chore`,
   `area:backend/frontend/ki/infra`, `phase:1-mvp … 4-reife`, `sprint:0 … 10`.
3. **Issues importieren:** Nutze die Tabelle [`docs/backlog.csv`](./backlog.csv) als Vorlage und
   lege die Issues an (manuell oder mit einem CSV-Import-Tool wie der „GitHub Issue Importer"-
   Browser-Erweiterung). Spalten: Sprint, Phase, Title, Type, Area, Milestone, FA.

---

## Project (Board mit echten Sprints) anlegen

GitHub Projects v2 kann **nicht** vollständig per CLI mit Iterationen erstellt werden – das
machst du einmalig im Browser (5 Minuten):

1. Repo → Tab **Projects → New project → Board** (oder „Team planning").
2. **Felder anlegen** (rechts „+" → New field):
   - `Status` (Single select): `Todo`, `In Progress`, `Review`, `Done` _(meist vorhanden)_.
   - `Sprint` (**Iteration**): Startdatum wählen, Dauer **2 Wochen** → GitHub erzeugt
     automatisch fortlaufende Sprints (Sprint 1, 2, 3 …). **Das ist dein Sprint-Mechanismus.**
   - `Estimate` (Number): Story Points.
   - optional `Area` (Single select): Backend/Frontend/KI/Infra.
3. **Issues ins Project ziehen:** Im Project „+ Add items" → alle Issues des Repos hinzufügen
   (oder über das Repo-Issue „Projects" zuweisen).
4. **Sprint zuweisen:** Pro Issue im Board das Feld `Sprint` auf die passende Iteration setzen
   (Orientierung: das `sprint:*`-Label aus dem Skript).
5. **Views:**
   - „Board by Status" für die tägliche Arbeit.
   - „Table by Sprint" für die Sprintplanung.
   - **Insights** (im Project) zeigt Burnup/Velocity automatisch.

---

## Empfohlener Arbeits-Flow (Solo + Vibe-Coding)

1. **Sprint-Planning (Anfang):** Issues des aktuellen Sprints auf `Todo`, Estimate setzen.
2. **Arbeiten:** Issue → `In Progress`. Branch `feature/FA-XX-kurz`, mit KI umsetzen.
3. **PR:** PR mit `Closes #<Issuenummer>` → Issue schließt sich beim Merge automatisch.
4. **Automatisierung (optional):** Project → **Workflows** → „Item closed → Status = Done"
   und „Pull request merged → Done" aktivieren.
5. **Sprint-Review (Ende):** Velocity in Insights prüfen, nächsten Sprint füllen.

---

## Tipp: Velocity ehrlich messen

Erst nach **2–3 Sprints** hast du eine realistische Velocity. Bis dahin Planung bewusst
konservativ halten und nach jedem Sprint die Sprintzuordnung im Board nachjustieren.

| Version | Datum      | Anmerkung                                |
| ------- | ---------- | ---------------------------------------- |
| 0.1     | 2026-06-20 | Erstfassung (gh-Skript + Klick-Fallback) |
