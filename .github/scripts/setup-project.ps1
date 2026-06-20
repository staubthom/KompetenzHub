<#
.SYNOPSIS
  Legt Milestones, Labels und das Backlog (Issues) fuer KompetenzHub an (Windows/PowerShell).

.DESCRIPTION
  Native PowerShell-Variante von setup-project.sh - kein bash noetig.
  Idempotent: bereits vorhandene Milestones/Labels/Issues werden uebersprungen.

.PREREQUISITES
  - GitHub CLI installiert (kostenlos):  winget install GitHub.cli
  - Einmalig angemeldet:                 gh auth login

.EXAMPLE
  # Aus dem Repo-Verzeichnis (ggf. Ausfuehrungsrichtlinie fuer die Sitzung lockern):
  powershell -ExecutionPolicy Bypass -File .github\scripts\setup-project.ps1
#>

$ErrorActionPreference = 'Stop'

$Repo = if ($env:REPO) { $env:REPO } else { 'staubthom/KompetenzHub' }
Write-Host "==> Repository: $Repo"

# --- Vorpruefung ------------------------------------------------------------
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "GitHub CLI 'gh' ist nicht installiert. Installiere mit: winget install GitHub.cli"
  exit 1
}
& gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error "Nicht bei GitHub angemeldet. Bitte zuerst 'gh auth login' ausfuehren."
  exit 1
}

$Api = "repos/$Repo"

# --- Hilfsfunktionen --------------------------------------------------------
function New-Label {
  param([string]$Name, [string]$Color, [string]$Desc)
  $existing = gh label list --repo $Repo --limit 200 --json name --jq '.[].name'
  if ($existing -contains $Name) {
    Write-Host "   = Label existiert: $Name"
  } else {
    gh label create $Name --repo $Repo --color $Color --description $Desc | Out-Null
    Write-Host "   + Label: $Name"
  }
}

function New-Milestone {
  param([string]$Title, [string]$Desc, [string]$Due)  # Due: YYYY-MM-DD oder ''
  $existing = gh api "$Api/milestones?state=all&per_page=100" --jq "[.[] | select(.title==`"$Title`")] | length"
  if ([int]$existing -gt 0) {
    Write-Host "   = Milestone existiert: $Title"
  } else {
    if ($Due) {
      gh api -X POST "$Api/milestones" -f title="$Title" -f description="$Desc" -f due_on="${Due}T23:59:59Z" | Out-Null
    } else {
      gh api -X POST "$Api/milestones" -f title="$Title" -f description="$Desc" | Out-Null
    }
    Write-Host "   + Milestone: $Title"
  }
}

function New-Issue {
  param([string]$Title, [string]$Body, [string]$Milestone, [string]$Labels)
  $titles = gh issue list --repo $Repo --state all --limit 500 --json title --jq '.[].title'
  if ($titles -contains $Title) {
    Write-Host "   = Issue existiert: $Title"
    return
  }
  gh issue create --repo $Repo --title $Title --body $Body --milestone $Milestone --label $Labels | Out-Null
  Write-Host "   + Issue: $Title"
}

# ===========================================================================
Write-Host "==> 1/3  Labels"
New-Label 'type:feature' '1d76db' 'Neues Feature / User Story'
New-Label 'type:bug'     'd73a4a' 'Fehler'
New-Label 'type:chore'   'fef2c0' 'Technische Aufgabe / Setup / Refactor'
New-Label 'area:backend'  '5319e7' 'Backend / API / DB'
New-Label 'area:frontend' '0e8a16' 'Frontend / UI'
New-Label 'area:ki'       'b60205' 'KI / LLM'
New-Label 'area:infra'    '555555' 'Infrastruktur / CI / Docker'
New-Label 'phase:1-mvp'    '0052cc' 'Phase 1 - MVP'
New-Label 'phase:2-ki'     '5319e7' 'Phase 2 - KI & Lernpfad'
New-Label 'phase:3-export' '006b75' 'Phase 3 - Export & i18n'
New-Label 'phase:4-reife'  '444444' 'Phase 4 - Reife'
foreach ($s in 0..10) { New-Label "sprint:$s" 'c5def5' "Sprint $s" }

Write-Host "==> 2/3  Milestones (= Phasen)"
New-Milestone 'Phase 1 - MVP'           'Auth, Matrix, Klassen, Nachweise, Bewertung, Dashboard' '2026-09-30'
New-Milestone 'Phase 2 - KI & Lernpfad' 'KI-Grading, Fachgespraech, Lernpfade'                   '2026-10-31'
New-Milestone 'Phase 3 - Export & i18n' 'Export/Import, Klassen-Archiv, FR/IT/EN'                '2026-11-30'
New-Milestone 'Phase 4 - Reife'         'Excel-Import, Reporting, Haertung, A11y, Performance'   '2026-12-31'

$P1 = 'Phase 1 - MVP'
$P2 = 'Phase 2 - KI & Lernpfad'
$P3 = 'Phase 3 - Export & i18n'
$P4 = 'Phase 4 - Reife'

Write-Host "==> 3/3  Issues (Backlog)"

# Sprint 0 - Setup
New-Issue '[Chore] Repo-Struktur & Tooling (Lint/Format)' 'Monorepo-Struktur (backend/frontend/infra), ESLint/Prettier, EditorConfig.' $P1 'type:chore,area:infra,phase:1-mvp,sprint:0'
New-Issue '[Chore] CI-Pipeline (GitHub Actions)' 'Build + Lint + Test bei Push/PR.' $P1 'type:chore,area:infra,phase:1-mvp,sprint:0'
New-Issue '[Chore] Docker-Compose (App + DB)' 'Lokale Entwicklungsumgebung per docker compose up; .env-Schema.' $P1 'type:chore,area:infra,phase:1-mvp,sprint:0'
New-Issue '[Chore] Prisma-Schema-Grundgeruest & erste Migration' 'Datenmodell aus docs/05-datenmodell.md ableiten; erste Migration.' $P1 'type:chore,area:backend,phase:1-mvp,sprint:0'
New-Issue '[Chore] Walking-Skeleton: Health-Endpoint + leere Startseite' 'End-to-End ueber alle Schichten lauffaehig.' $P1 'type:chore,area:backend,phase:1-mvp,sprint:0'

# Sprint 1 - Auth & RBAC
New-Issue '[FA-08] OAuth/OIDC Login (Microsoft & Google)' 'Login via Microsoft und Google gemaess docs/08-authentifizierung.md.' $P1 'type:feature,area:backend,phase:1-mvp,sprint:1'
New-Issue '[FA-08] Rollenmodell & RBAC-Middleware' 'Rollen Lehrperson/Lernende/Admin; geschuetzte Routen.' $P1 'type:feature,area:backend,phase:1-mvp,sprint:1'
New-Issue '[FA-08] Multi-Tenant-Schema & Tenant-Scope' 'Mandantenfaehiges Schema (1 Tenant aktiv), Scope in allen Queries.' $P1 'type:feature,area:backend,phase:1-mvp,sprint:1'

# Sprint 2 - Matrix-Editor
New-Issue '[FA-01] Modul & Modulidentifikation verwalten' 'Modul anlegen/bearbeiten inkl. Modulidentifikation.' $P1 'type:feature,area:backend,phase:1-mvp,sprint:2'
New-Issue '[FA-02] Handlungsziele verwalten' 'Handlungsziele je Modul erfassen.' $P1 'type:feature,area:backend,phase:1-mvp,sprint:2'
New-Issue '[FA-03] Kompetenzbaender x Guetestufen (Matrix-Struktur)' 'Baender und Guetestufen als Matrixraster.' $P1 'type:feature,area:frontend,phase:1-mvp,sprint:2'
New-Issue '[FA-04] Kompetenzfelder & Deskriptoren (Ich kann)' 'Deskriptoren je Kompetenzfeld erfassen; UI-Vorlage mockups/lehrer-module.html.' $P1 'type:feature,area:frontend,phase:1-mvp,sprint:2'

# Sprint 3 - Klassen
New-Issue '[FA-20] Klasse anlegen & Matrix zuordnen' 'Klasse erstellen und eine Matrix zuordnen.' $P1 'type:feature,area:backend,phase:1-mvp,sprint:3'
New-Issue '[FA-23] Beitrittscode generieren & beitreten' 'Code generieren; Lernende tritt per Code bei.' $P1 'type:feature,area:backend,phase:1-mvp,sprint:3'
New-Issue '[FA-25] Mitgliederliste & Verwaltung' 'Mitglieder anzeigen/entfernen; UI-Vorlage mockups/lehrer-klassen.html.' $P1 'type:feature,area:frontend,phase:1-mvp,sprint:3'

# Sprint 4 - Nachweise
New-Issue '[FA-30] Kompetenznachweis: Upload-Typ' 'Upload-Nachweis definieren (Datei + Beschreibung).' $P1 'type:feature,area:backend,phase:1-mvp,sprint:4'
New-Issue '[FA-32] Kompetenznachweis: Quiz-Typ' 'Quiz mit Fragen und automatischer Auswertung; UI mockups/lernende-quiz.html.' $P1 'type:feature,area:frontend,phase:1-mvp,sprint:4'
New-Issue '[FA-36] Sichtbarkeit & Ablaufdatum' 'Nachweis sichtbar/unsichtbar, Faelligkeitsdatum.' $P1 'type:feature,area:backend,phase:1-mvp,sprint:4'
New-Issue '[FA-40] Punktevergabe-Schema (X/Y)' 'Punkteschema je Nachweis konfigurieren.' $P1 'type:feature,area:backend,phase:1-mvp,sprint:4'

# Sprint 5 - Einreichung & Bewertung
New-Issue '[FA-50] Lernende reicht Nachweis ein' 'Einreichen von Upload/Quiz; UI mockups/lernende-nachweis.html.' $P1 'type:feature,area:frontend,phase:1-mvp,sprint:5'
New-Issue '[FA-53] Statusanzeige fuer Lernende' 'Offen/eingereicht/bewertet/zurueckgewiesen sichtbar.' $P1 'type:feature,area:frontend,phase:1-mvp,sprint:5'
New-Issue '[FA-60] Lehrperson bewertet (Punkte/Level + Feedback)' 'Bewerten mit Punkten/Guetestufe und Feedback; UI mockups/lehrer-bewerten.html.' $P1 'type:feature,area:frontend,phase:1-mvp,sprint:5'
New-Issue '[FA-62] Einreichung zurueckweisen' 'Mit Begruendung zurueckweisen; Lernende kann ueberarbeiten.' $P1 'type:feature,area:backend,phase:1-mvp,sprint:5'
New-Issue '[FA-65] Bewertungshistorie / Audit' 'Nachvollziehbare Historie aller Bewertungsschritte.' $P1 'type:feature,area:backend,phase:1-mvp,sprint:5'

# Sprint 6 - Dashboard
New-Issue '[FA-90] Fortschritts-Heatmap (Basis)' 'Klassenuebersicht als Heatmap; UI mockups/lehrer-dashboard.html.' $P1 'type:feature,area:frontend,phase:1-mvp,sprint:6'
New-Issue '[FA-91] Kennzahlen-Karten' 'Lernende, zu bewerten, bewertet, Durchschnitt Fortschritt.' $P1 'type:feature,area:frontend,phase:1-mvp,sprint:6'
New-Issue '[FA-92] Bewertungs-Queue (Wartet auf Bewertung)' 'Liste offener Einreichungen mit Schnellzugriff.' $P1 'type:feature,area:frontend,phase:1-mvp,sprint:6'
New-Issue '[Chore] MVP-Polish & Pilotvorbereitung (Modul 293)' 'Bugfixing, Feinschliff, Pilot vorbereiten.' $P1 'type:chore,area:infra,phase:1-mvp,sprint:6'

# Sprint 7 - KI-Grading
New-Issue '[FA-34] KI-Konfiguration (Endpoint je Lehrperson)' 'KI-Provider/Endpoint konfigurieren; UI mockups/lehrer-ki.html.' $P2 'type:feature,area:ki,phase:2-ki,sprint:7'
New-Issue '[FA-70] KI-Bewertungsvorschlag' 'KI schlaegt Punkte/Level vor (Override durch Lehrperson).' $P2 'type:feature,area:ki,phase:2-ki,sprint:7'
New-Issue '[FA-72] KI-Feedbacktext generieren' 'Automatischer Feedbackvorschlag, editierbar.' $P2 'type:feature,area:ki,phase:2-ki,sprint:7'

# Sprint 8 - Fachgespraech & Lernpfade
New-Issue '[FA-80] KI-Fachgespraech (Uebungsmodus)' 'Dialog-Uebung mit KI; UI mockups/lernende-fachgespraech.html.' $P2 'type:feature,area:ki,phase:2-ki,sprint:8'
New-Issue '[FA-84] Lernpfade (alternative Reihenfolge)' 'Didaktische Reihenfolge durch die Matrix; UI mockups/lernende-lernpfad.html.' $P2 'type:feature,area:frontend,phase:2-ki,sprint:8'

# Sprint 9 - Export & i18n
New-Issue '[FA-100] Matrix-Export/-Import' 'Export und Re-Import einer Matrix; siehe docs/10-export-import.md.' $P3 'type:feature,area:backend,phase:3-export,sprint:9'
New-Issue '[FA-103] Klassen-Archivierung' 'Klassen archivieren/wiederherstellen.' $P3 'type:feature,area:backend,phase:3-export,sprint:9'
New-Issue '[FA-10] Mehrsprachigkeit FR/IT/EN' 'UI-Uebersetzungen ergaenzen (DE bereits vorhanden).' $P3 'type:feature,area:frontend,phase:3-export,sprint:9'

# Sprint 10 - Reife
New-Issue '[FA-11] Excel-Import (ICT-BBCH-Template)' 'Import aus dem offiziellen Excel-Template.' $P4 'type:feature,area:backend,phase:4-reife,sprint:10'
New-Issue '[FA-93] Erweitertes Reporting & Filter' 'Filter/Reports ueber Baender und Klassen.' $P4 'type:feature,area:frontend,phase:4-reife,sprint:10'
New-Issue '[Chore] Haertung: Sicherheit, A11y, Performance' 'NFR gemaess docs/12-nicht-funktionale-anforderungen.md.' $P4 'type:chore,area:infra,phase:4-reife,sprint:10'

Write-Host ""
Write-Host "==> Fertig. Milestones, Labels und Issues sind angelegt."
Write-Host "    Naechster Schritt: GitHub Project (v2) mit Iteration-Feld anlegen -"
Write-Host "    Anleitung in docs/15-github-projektsetup.md."
