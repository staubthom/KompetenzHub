<#
.SYNOPSIS
  Ersetzt die Beschreibung (Body) bestehender Issues durch ausformulierte Versionen
  mit User Story + Akzeptanzkriterien. Aendert NICHT Titel, Labels, Milestone oder
  die Sprint-/Project-Zuordnung.

.DESCRIPTION
  Liest alle Bodies aus docs/issues/bodies.md. Jeder Abschnitt beginnt mit
  "### " + EXAKTER Issue-Titel; der Text bis zum naechsten "### " ist der Body.
  Das Matching erfolgt ueber den Issue-Titel; aktualisiert wird per `gh issue edit`.
  Idempotent: Re-Run setzt einfach denselben Body erneut.

.PREREQUISITES
  - GitHub CLI:  winget install GitHub.cli
  - Angemeldet:  gh auth login

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .github\scripts\update-issue-bodies.ps1

.PARAMETER WhatIf
  Zeigt nur, welche Issues aktualisiert wuerden, ohne Aenderung.
#>

param([switch]$WhatIf)

$ErrorActionPreference = 'Stop'

$Repo = if ($env:REPO) { $env:REPO } else { 'staubthom/KompetenzHub' }
Write-Host "==> Repository: $Repo"

# gh finden: zuerst im PATH, sonst Standard-Installationspfade (frische Installation
# ist evtl. noch nicht im PATH der aktuellen Sitzung).
$ghLookup = Get-Command gh -ErrorAction SilentlyContinue
$ghCmd = if ($ghLookup) { $ghLookup.Source } else { $null }
if (-not $ghCmd) {

  $candidates = @(
    "$env:ProgramFiles\GitHub CLI\gh.exe",
    "${env:ProgramFiles(x86)}\GitHub CLI\gh.exe",
    "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe"
  )
  $ghCmd = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $ghCmd) {
  Write-Error "GitHub CLI 'gh' nicht gefunden. Installiere mit 'winget install GitHub.cli' und/oder oeffne ein neues Terminal."; exit 1
}
& $ghCmd auth status 2>$null | Out-Null

if ($LASTEXITCODE -ne 0) { Write-Error "Bitte zuerst 'gh auth login' ausfuehren."; exit 1 }


# --- Bodies-Datei einlesen und in Abschnitte zerlegen -----------------------
$RepoRoot   = (git rev-parse --show-toplevel).Trim()
$BodiesFile = Join-Path $RepoRoot 'docs/issues/bodies.md'
if (-not (Test-Path $BodiesFile)) { Write-Error "Bodies-Datei fehlt: $BodiesFile"; exit 1 }

$lines = Get-Content -LiteralPath $BodiesFile -Encoding UTF8
$bodies = [ordered]@{}     # Titel -> Body-Text
$curTitle = $null
$sb = $null
foreach ($line in $lines) {
  if ($line -match '^###\s+(.+?)\s*$') {
    if ($curTitle) { $bodies[$curTitle] = ($sb -join "`n").Trim() }
    $curTitle = $Matches[1]
    $sb = @()
  } elseif ($curTitle) {
    $sb += $line
  }
}
if ($curTitle) { $bodies[$curTitle] = ($sb -join "`n").Trim() }
Write-Host "==> $($bodies.Count) Bodies aus bodies.md geladen."

# --- Bestehende Issues laden (Titel -> Nummer) ------------------------------
Write-Host "==> Lade bestehende Issues ..."
$issuesJson = & $ghCmd issue list --repo $Repo --state all --limit 500 --json number,title | ConvertFrom-Json

$byTitle = @{}
foreach ($i in $issuesJson) { $byTitle[$i.title] = $i.number }

# --- Aktualisieren ----------------------------------------------------------
$updated = 0; $missingIssue = 0
$tmp = New-TemporaryFile
try {
  foreach ($title in $bodies.Keys) {
    if (-not $byTitle.ContainsKey($title)) {
      Write-Host "   ! Issue nicht gefunden: $title (uebersprungen)" -ForegroundColor Yellow
      $missingIssue++; continue
    }
    $num = $byTitle[$title]
    if ($WhatIf) {
      Write-Host "   (WhatIf) wuerde aktualisieren: #$num  $title"
      continue
    }
    Set-Content -LiteralPath $tmp -Value $bodies[$title] -Encoding UTF8
    & $ghCmd issue edit $num --repo $Repo --body-file $tmp | Out-Null

    Write-Host "   ~ #$num aktualisiert: $title"
    $updated++
  }
} finally {
  Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
}

Write-Host ""
if ($WhatIf) {
  Write-Host "==> WhatIf: keine Aenderungen vorgenommen."
} else {
  Write-Host "==> Fertig. Aktualisiert: $updated | Issue fehlt: $missingIssue"
  Write-Host "    Sprint-/Project-Zuordnung, Labels und Nummern blieben unveraendert."
}
