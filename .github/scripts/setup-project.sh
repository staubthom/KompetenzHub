#!/usr/bin/env bash
#
# setup-project.sh – Legt Milestones, Labels und das Backlog (Issues) für KompetenzHub an.
#
# Voraussetzungen:
#   - GitHub CLI installiert:  https://cli.github.com/   (kostenlos)
#     Windows:  winget install GitHub.cli
#   - Einmalig angemeldet:     gh auth login
#
# Aufruf (aus dem Repo-Verzeichnis):
#   bash .github/scripts/setup-project.sh
#
# Idempotent: bereits existierende Milestones/Labels/Issues werden übersprungen.
# ---------------------------------------------------------------------------

set -euo pipefail

REPO="${REPO:-staubthom/KompetenzHub}"
echo "==> Repository: $REPO"

# --- Vorprüfung -------------------------------------------------------------
if ! command -v gh >/dev/null 2>&1; then
  echo "FEHLER: GitHub CLI 'gh' ist nicht installiert. Siehe https://cli.github.com/" >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "FEHLER: Nicht bei GitHub angemeldet. Bitte zuerst 'gh auth login' ausführen." >&2
  exit 1
fi

API="repos/$REPO"

# --- Hilfsfunktionen --------------------------------------------------------

# Label anlegen (überspringt, falls vorhanden)
make_label () {
  local name="$1" color="$2" desc="$3"
  if gh label list --repo "$REPO" --limit 200 | awk -F '\t' '{print $1}' | grep -Fxq "$name"; then
    echo "   = Label existiert: $name"
  else
    gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" >/dev/null
    echo "   + Label: $name"
  fi
}

# Milestone anlegen (überspringt, falls vorhanden) -> setzt MS_NUMBER
declare -A MS_NUMBER
make_milestone () {
  local title="$1" desc="$2" due="$3"   # due: YYYY-MM-DD oder ""
  local existing
  existing=$(gh api "$API/milestones?state=all&per_page=100" --jq \
    ".[] | select(.title==\"$title\") | .number" 2>/dev/null || true)
  if [ -n "$existing" ]; then
    MS_NUMBER["$title"]="$existing"
    echo "   = Milestone existiert: $title (#$existing)"
  else
    local num
    if [ -n "$due" ]; then
      num=$(gh api -X POST "$API/milestones" -f title="$title" -f description="$desc" \
            -f due_on="${due}T23:59:59Z" --jq '.number')
    else
      num=$(gh api -X POST "$API/milestones" -f title="$title" -f description="$desc" --jq '.number')
    fi
    MS_NUMBER["$title"]="$num"
    echo "   + Milestone: $title (#$num)"
  fi
}

# Issue anlegen (überspringt, falls Titel bereits existiert)
make_issue () {
  local title="$1" body="$2" milestone="$3" labels="$4"
  if gh issue list --repo "$REPO" --state all --limit 500 --json title \
       --jq '.[].title' | grep -Fxq "$title"; then
    echo "   = Issue existiert: $title"
    return
  fi
  gh issue create --repo "$REPO" \
    --title "$title" \
    --body "$body" \
    --milestone "$milestone" \
    --label "$labels" >/dev/null
  echo "   + Issue: $title"
}

# ===========================================================================
echo "==> 1/3  Labels"
# Typ
make_label "type:feature" "1d76db" "Neues Feature / User Story"
make_label "type:bug"     "d73a4a" "Fehler"
make_label "type:chore"   "fef2c0" "Technische Aufgabe / Setup / Refactor"
# Bereich
make_label "area:backend"  "5319e7" "Backend / API / DB"
make_label "area:frontend" "0e8a16" "Frontend / UI"
make_label "area:ki"       "b60205" "KI / LLM"
make_label "area:infra"    "555555" "Infrastruktur / CI / Docker"
# Phasen
make_label "phase:1-mvp"     "0052cc" "Phase 1 – MVP"
make_label "phase:2-ki"      "5319e7" "Phase 2 – KI & Lernpfad"
make_label "phase:3-export"  "006b75" "Phase 3 – Export & i18n"
make_label "phase:4-reife"   "444444" "Phase 4 – Reife"
# Sprints
for s in 0 1 2 3 4 5 6 7 8 9 10; do
  make_label "sprint:$s" "c5def5" "Sprint $s"
done

echo "==> 2/3  Milestones (= Phasen)"
make_milestone "Phase 1 – MVP"            "Auth, Matrix, Klassen, Nachweise, Bewertung, Dashboard" "2026-09-30"
make_milestone "Phase 2 – KI & Lernpfad"  "KI-Grading, Fachgespräch, Lernpfade"                    "2026-10-31"
make_milestone "Phase 3 – Export & i18n"  "Export/Import, Klassen-Archiv, FR/IT/EN"                "2026-11-30"
make_milestone "Phase 4 – Reife"          "Excel-Import, Reporting, Härtung, A11y, Performance"    "2026-12-31"

P1="Phase 1 – MVP"
P2="Phase 2 – KI & Lernpfad"
P3="Phase 3 – Export & i18n"
P4="Phase 4 – Reife"

echo "==> 3/3  Issues (Backlog)"

# --- Sprint 0 – Setup ------------------------------------------------------
make_issue "[Chore] Repo-Struktur & Tooling (Lint/Format)" \
  "Monorepo-Struktur (backend/frontend/infra), ESLint/Prettier, EditorConfig." \
  "$P1" "type:chore,area:infra,phase:1-mvp,sprint:0"
make_issue "[Chore] CI-Pipeline (GitHub Actions)" \
  "Build + Lint + Test bei Push/PR." \
  "$P1" "type:chore,area:infra,phase:1-mvp,sprint:0"
make_issue "[Chore] Docker-Compose (App + DB)" \
  "Lokale Entwicklungsumgebung per docker compose up; .env-Schema." \
  "$P1" "type:chore,area:infra,phase:1-mvp,sprint:0"
make_issue "[Chore] Prisma-Schema-Grundgerüst & erste Migration" \
  "Datenmodell aus docs/05-datenmodell.md ableiten; erste Migration." \
  "$P1" "type:chore,area:backend,phase:1-mvp,sprint:0"
make_issue "[Chore] Walking-Skeleton: Health-Endpoint + leere Startseite" \
  "End-to-End über alle Schichten lauffähig." \
  "$P1" "type:chore,area:backend,phase:1-mvp,sprint:0"

# --- Sprint 1 – Auth & RBAC ------------------------------------------------
make_issue "[FA-08] OAuth/OIDC Login (Microsoft & Google)" \
  "Login via Microsoft und Google gemäß docs/08-authentifizierung.md." \
  "$P1" "type:feature,area:backend,phase:1-mvp,sprint:1"
make_issue "[FA-08] Rollenmodell & RBAC-Middleware" \
  "Rollen Lehrperson/Lernende:r/Admin; geschützte Routen." \
  "$P1" "type:feature,area:backend,phase:1-mvp,sprint:1"
make_issue "[FA-08] Multi-Tenant-Schema & Tenant-Scope" \
  "Mandantenfähiges Schema (1 Tenant aktiv), Scope in allen Queries." \
  "$P1" "type:feature,area:backend,phase:1-mvp,sprint:1"

# --- Sprint 2 – Matrix-Editor ----------------------------------------------
make_issue "[FA-01] Modul & Modulidentifikation verwalten" \
  "Modul anlegen/bearbeiten inkl. Modulidentifikation." \
  "$P1" "type:feature,area:backend,phase:1-mvp,sprint:2"
make_issue "[FA-02] Handlungsziele verwalten" \
  "Handlungsziele je Modul erfassen." \
  "$P1" "type:feature,area:backend,phase:1-mvp,sprint:2"
make_issue "[FA-03] Kompetenzbänder × Gütestufen (Matrix-Struktur)" \
  "Bänder und Gütestufen als Matrixraster." \
  "$P1" "type:feature,area:frontend,phase:1-mvp,sprint:2"
make_issue "[FA-04] Kompetenzfelder & Deskriptoren ('Ich kann …')" \
  "Deskriptoren je Kompetenzfeld erfassen; UI-Vorlage mockups/lehrer-module.html." \
  "$P1" "type:feature,area:frontend,phase:1-mvp,sprint:2"

# --- Sprint 3 – Klassen ----------------------------------------------------
make_issue "[FA-20] Klasse anlegen & Matrix zuordnen" \
  "Klasse erstellen und eine Matrix zuordnen." \
  "$P1" "type:feature,area:backend,phase:1-mvp,sprint:3"
make_issue "[FA-23] Beitrittscode generieren & beitreten" \
  "Code generieren; Lernende:r tritt per Code bei." \
  "$P1" "type:feature,area:backend,phase:1-mvp,sprint:3"
make_issue "[FA-25] Mitgliederliste & Verwaltung" \
  "Mitglieder anzeigen/entfernen; UI-Vorlage mockups/lehrer-klassen.html." \
  "$P1" "type:feature,area:frontend,phase:1-mvp,sprint:3"

# --- Sprint 4 – Nachweise --------------------------------------------------
make_issue "[FA-30] Kompetenznachweis: Upload-Typ" \
  "Upload-Nachweis definieren (Datei + Beschreibung)." \
  "$P1" "type:feature,area:backend,phase:1-mvp,sprint:4"
make_issue "[FA-32] Kompetenznachweis: Quiz-Typ" \
  "Quiz mit Fragen und automatischer Auswertung; UI mockups/lernende-quiz.html." \
  "$P1" "type:feature,area:frontend,phase:1-mvp,sprint:4"
make_issue "[FA-36] Sichtbarkeit & Ablaufdatum" \
  "Nachweis sichtbar/unsichtbar, Fälligkeitsdatum." \
  "$P1" "type:feature,area:backend,phase:1-mvp,sprint:4"
make_issue "[FA-40] Punktevergabe-Schema (X/Y)" \
  "Punkteschema je Nachweis konfigurieren." \
  "$P1" "type:feature,area:backend,phase:1-mvp,sprint:4"

# --- Sprint 5 – Einreichung & Bewertung ------------------------------------
make_issue "[FA-50] Lernende:r reicht Nachweis ein" \
  "Einreichen von Upload/Quiz; UI mockups/lernende-nachweis.html." \
  "$P1" "type:feature,area:frontend,phase:1-mvp,sprint:5"
make_issue "[FA-53] Statusanzeige für Lernende" \
  "Offen/eingereicht/bewertet/zurückgewiesen sichtbar." \
  "$P1" "type:feature,area:frontend,phase:1-mvp,sprint:5"
make_issue "[FA-60] Lehrperson bewertet (Punkte/Level + Feedback)" \
  "Bewerten mit Punkten/Gütestufe und Feedback; UI mockups/lehrer-bewerten.html." \
  "$P1" "type:feature,area:frontend,phase:1-mvp,sprint:5"
make_issue "[FA-62] Einreichung zurückweisen" \
  "Mit Begründung zurückweisen; Lernende:r kann überarbeiten." \
  "$P1" "type:feature,area:backend,phase:1-mvp,sprint:5"
make_issue "[FA-65] Bewertungshistorie / Audit" \
  "Nachvollziehbare Historie aller Bewertungsschritte." \
  "$P1" "type:feature,area:backend,phase:1-mvp,sprint:5"

# --- Sprint 6 – Dashboard --------------------------------------------------
make_issue "[FA-90] Fortschritts-Heatmap (Basis)" \
  "Klassenübersicht als Heatmap; UI mockups/lehrer-dashboard.html." \
  "$P1" "type:feature,area:frontend,phase:1-mvp,sprint:6"
make_issue "[FA-91] Kennzahlen-Karten" \
  "Lernende, zu bewerten, bewertet, Ø Fortschritt." \
  "$P1" "type:feature,area:frontend,phase:1-mvp,sprint:6"
make_issue "[FA-92] Bewertungs-Queue ('Wartet auf Bewertung')" \
  "Liste offener Einreichungen mit Schnellzugriff." \
  "$P1" "type:feature,area:frontend,phase:1-mvp,sprint:6"
make_issue "[Chore] MVP-Polish & Pilotvorbereitung (Modul 293)" \
  "Bugfixing, Feinschliff, Pilot vorbereiten." \
  "$P1" "type:chore,area:infra,phase:1-mvp,sprint:6"

# --- Sprint 7 – KI-Grading -------------------------------------------------
make_issue "[FA-34] KI-Konfiguration (Endpoint je Lehrperson)" \
  "KI-Provider/Endpoint konfigurieren; UI mockups/lehrer-ki.html." \
  "$P2" "type:feature,area:ki,phase:2-ki,sprint:7"
make_issue "[FA-70] KI-Bewertungsvorschlag" \
  "KI schlägt Punkte/Level vor (Override durch Lehrperson)." \
  "$P2" "type:feature,area:ki,phase:2-ki,sprint:7"
make_issue "[FA-72] KI-Feedbacktext generieren" \
  "Automatischer Feedbackvorschlag, editierbar." \
  "$P2" "type:feature,area:ki,phase:2-ki,sprint:7"

# --- Sprint 8 – Fachgespräch & Lernpfade -----------------------------------
make_issue "[FA-80] KI-Fachgespräch (Übungsmodus)" \
  "Dialog-Übung mit KI; UI mockups/lernende-fachgespraech.html." \
  "$P2" "type:feature,area:ki,phase:2-ki,sprint:8"
make_issue "[FA-84] Lernpfade (alternative Reihenfolge)" \
  "Didaktische Reihenfolge durch die Matrix; UI mockups/lernende-lernpfad.html." \
  "$P2" "type:feature,area:frontend,phase:2-ki,sprint:8"

# --- Sprint 9 – Export & i18n ----------------------------------------------
make_issue "[FA-100] Matrix-Export/-Import" \
  "Export und Re-Import einer Matrix; siehe docs/10-export-import.md." \
  "$P3" "type:feature,area:backend,phase:3-export,sprint:9"
make_issue "[FA-103] Klassen-Archivierung" \
  "Klassen archivieren/wiederherstellen." \
  "$P3" "type:feature,area:backend,phase:3-export,sprint:9"
make_issue "[FA-10] Mehrsprachigkeit FR/IT/EN" \
  "UI-Übersetzungen ergänzen (DE bereits vorhanden)." \
  "$P3" "type:feature,area:frontend,phase:3-export,sprint:9"

# --- Sprint 10 – Reife -----------------------------------------------------
make_issue "[FA-11] Excel-Import (ICT-BBCH-Template)" \
  "Import aus dem offiziellen Excel-Template." \
  "$P4" "type:feature,area:backend,phase:4-reife,sprint:10"
make_issue "[FA-93] Erweitertes Reporting & Filter" \
  "Filter/Reports über Bänder und Klassen." \
  "$P4" "type:feature,area:frontend,phase:4-reife,sprint:10"
make_issue "[Chore] Härtung: Sicherheit, A11y, Performance" \
  "NFR gemäß docs/12-nicht-funktionale-anforderungen.md." \
  "$P4" "type:chore,area:infra,phase:4-reife,sprint:10"

echo ""
echo "==> Fertig. Milestones, Labels und Issues sind angelegt."
echo "    Nächster Schritt: GitHub Project (v2) mit Iteration-Feld anlegen –"
echo "    Anleitung in docs/15-github-projektsetup.md."
