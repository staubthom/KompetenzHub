Plan: Prisma-Migrationen konsolidieren
Ja, für diesen Repo-Stand ist das Zusammenfassen der Prisma-Migrationen sehr wahrscheinlich sinnvoll. Die Migrationskette unter apps/api/prisma/migrations ist jung, schnell gewachsen, rein additiv und die Software läuft laut deiner Aussage noch nirgends produktiv. Das spricht für einen einmaligen Squash auf eine neue Baseline-Migration, bevor erste echte langlebige Deployments existieren. Der kritische Vorbehalt ist nur: Sobald irgendeine lauffähige Umgebung bereits auf genau dieser Kette basiert und später weiter migriert werden soll, darf nicht mehr blind gesquasht werden.

Steps

Verifizieren, dass keine produktive oder langlebige Staging-/Demo-Datenbank existiert, die bereits mit der aktuellen Kette migriert wurde. Das ist die wichtigste Gate-Bedingung.
Den aktuellen Endzustand des Schemas in apps/api/prisma/schema.prisma als neue Wahrheit behandeln und die vorhandenen Einzelschritte nur noch als Historie ansehen, nicht mehr als dauerhaft wertvolle Upgrade-Pipeline.
Die bestehende Migrationskette archivieren oder in Git-Historie belassen und im Arbeitsbaum durch genau eine neue Baseline-Migration ersetzen. Ziel ist: neue Entwickler und neue Umgebungen bauen die gesamte Datenbank aus einem initialen Snapshot statt aus vielen schnellen Inkrementen auf.
Seed und frische Datenbankinitialisierung gegen die Baseline prüfen. Die vorhandene Seed-Strategie wirkt auf den ersten Blick kompatibel, muss aber nach dem Squash einmal sauber gegen eine leere DB validiert werden.
Alle Betriebs- und Setup-Dokumente knapp aktualisieren, damit klar ist, dass vor dem ersten echten Produktivbetrieb eine Migration-Konsolidierung vorgenommen wurde.
Nach dem Squash die nächste Schemaänderung wieder normal als neue einzelne Migration auf die neue Baseline aufsetzen.
Relevant files

apps/api/prisma/schema.prisma — maßgeblicher Zielzustand für die neue Baseline
apps/api/prisma/migrations — aktuelle Kette mit 17 Migrationsordnern
apps/api/prisma/migrations/migration_lock.toml — Provider-Lock für Prisma-Migrationen
apps/api/prisma/seed.ts — nach dem Squash gegen leere DB prüfen
apps/api/package.json — Prisma-Skripte für den operativen Ablauf
apps/api/Dockerfile — falls Deployments prisma migrate deploy nutzen, muss die Baseline dort weiterhin sauber funktionieren
README.md — knappe Doku für Setup/Baseline-Entscheid
Verification

Auf einer komplett leeren Datenbank prisma migrate deploy gegen die neue Baseline laufen lassen.
Danach prisma db seed ausführen und prüfen, dass Seed und App-Start sauber funktionieren.
Die vorhandenen Smoke-Skripte mindestens für Auth und ein bis zwei zentrale Fachbereiche laufen lassen, um sicherzustellen, dass die Baseline wirklich den bisherigen Endzustand repräsentiert.
Falls irgendeine bestehende Nicht-Dev-Datenbank existiert, dort vorab prüfen, ob diese verworfen und neu aufgebaut werden darf. Wenn nicht, Squash verschieben.
Decisions

Ein Squash ist jetzt sinnvoller als später, weil die Kette noch kurzlebige Entwicklungs-Historie statt wertvoller Betriebs-Historie ist.
Der Squash sollte nur einmalig als Baseline-Neustart passieren, nicht regelmässig nach jeder kleinen Änderung.
Entscheidend ist nicht nur „nicht produktiv“, sondern „keine erhaltenswerte bestehende Datenbank mit Upgrade-Pfad“.
Nach dem Baseline-Squash wieder normal mit einzelnen Migrationen weiterarbeiten.
Further Considerations

Wenn ihr bald Demo-, Test- oder Pilotumgebungen habt, ist jetzt der beste letzte Zeitpunkt für eine Konsolidierung.
Wenn später Plugin-Systeme geplant sind, ist eine saubere Baseline heute besonders hilfreich, weil künftige Plugin-Migrationen ohnehin komplexer werden.
Falls du willst, sollte der nächste Schritt nicht sofort der Squash sein, sondern zuerst ein kurzer Nachweis, dass keine bestehende Umgebung auf der aktuellen Kette hängt.

Ich ziehe noch die paar operativen Stellen heran, damit die Befehle exakt zu eurem Prisma- und Docker-Setup passen und nicht generisch bleiben.

Read [](file:///c%3A/Entwicklung/KompetenzHub/apps/api/Dockerfile)

Read [](file:///c%3A/Entwicklung/KompetenzHub/apps/api/prisma/seed.ts)

Read [](file:///c%3A/Entwicklung/KompetenzHub/apps/api/prisma/migrations/migration_lock.toml)

Read [](file:///c%3A/Entwicklung/KompetenzHub/README.md#520-520), lines 520 to 620

Ich formuliere das jetzt als ausführungstauglichen Runbook mit konkreten Prisma- und Git-Befehlen für euer Setup, inklusive sicherer Abzweigung falls doch schon eine erhaltenswerte DB existiert.

Deleted memory [](file:///c%3A/Users/staubt/AppData/Roaming/Code/User/workspaceStorage/fc34a4b80c3c692a92ee35616eeaad3a/GitHub.copilot-chat/memory-tool/memories/NGIzMmNiZjUtMGU2Ni00OWM0LWE3ZjktMzVkMTY1YmU0NjI2/plan.md)

Created memory file [](file:///c%3A/Users/staubt/AppData/Roaming/Code/User/workspaceStorage/fc34a4b80c3c692a92ee35616eeaad3a/GitHub.copilot-chat/memory-tool/memories/NGIzMmNiZjUtMGU2Ni00OWM0LWE3ZjktMzVkMTY1YmU0NjI2/plan.md)

Unten ist der konkrete Ablauf, so wie ich ihn für euer Repo machen würde. Ich gehe dabei von eurem aktuellen Setup in apps/api/package.json, apps/api/prisma/schema.prisma, apps/api/prisma/seed.ts und apps/api/Dockerfile aus.

## Ziel

Die vielen bisherigen Migrationen in apps/api/prisma/migrations werden durch genau eine neue Baseline-Migration ersetzt. Diese Baseline bildet den aktuellen Stand aus schema.prisma ab. Danach laufen neue Änderungen wieder als normale Einzelmigrationen weiter.

## Vorbedingung

Nur so vorgehen, wenn keine erhaltenswerte Datenbank existiert, die bereits mit der alten Migrationskette betrieben wird und später weiter migriert werden soll.

Wenn doch schon eine solche DB existiert, dann nicht squashen, sondern die alte Kette für diese Umgebung beibehalten.

## Konkrete Schritte

### 1. Schutznetz einziehen

Im Repo-Wurzelverzeichnis:

```powershell
git status
git checkout -b chore/prisma-baseline-squash
git add .
git commit -m "chore: snapshot before prisma migration squash"
```

Wenn es noch uncommittete Arbeiten gibt, die nicht in diesen Schritt gehören, zuerst sauber trennen.

### 2. Alte Migrationen einmal sichtbar machen

Nur zur Kontrolle:

```powershell
Get-ChildItem c:\Entwicklung\KompetenzHub\apps\api\prisma\migrations
```

Du solltest danach weiterhin nur mit schema.prisma als Wahrheit arbeiten, nicht mit manuell zusammenkopierten alten SQL-Dateien.

### 3. Neue Baseline-Migration aus dem aktuellen Schema erzeugen

Ins API-Verzeichnis wechseln:

```powershell
Set-Location c:\Entwicklung\KompetenzHub\apps\api
```

Neuen Baseline-Ordner anlegen:

```powershell
New-Item -ItemType Directory -Path .\prisma\migrations\20260625_baseline -Force
```

Baseline-SQL direkt aus dem aktuellen Prisma-Schema generieren:

```powershell
npx prisma migrate diff --from-empty --to-schema-datamodel .\prisma\schema.prisma --script | Out-File -Encoding utf8 .\prisma\migrations\20260625_baseline\migration.sql
```

Das ist der wichtigste Schritt. So entsteht die Baseline aus dem finalen Schema statt aus einer fehleranfälligen manuellen SQL-Zusammenführung.

### 4. Alte Migrationsordner aus dem Arbeitsbaum entfernen

Vorher am besten einmal sichern, falls du lokal schnell zurückspringen willst:

```powershell
New-Item -ItemType Directory -Path .\prisma\migrations_backup -Force
Copy-Item .\prisma\migrations\* .\prisma\migrations_backup\ -Recurse -Force
```

Dann in apps/api/prisma/migrations alle alten Migrationsordner löschen, aber migration_lock.toml behalten und den neuen Baseline-Ordner natürlich auch behalten.

In PowerShell:

```powershell
Get-ChildItem .\prisma\migrations -Directory | Where-Object { $_.Name -ne '20260625_baseline' } | Remove-Item -Recurse -Force
```

Danach prüfen:

```powershell
Get-ChildItem .\prisma\migrations
```

Erwartet:

- `20260625_baseline`
- migration_lock.toml

### 5. Gegen eine leere Datenbank validieren

Jetzt brauchst du eine frische leere Datenbank. Wenn eure lokale DB verworfen werden darf, ist das einfach. Falls nicht, nimm eine separate Test-DB.

Dann:

```powershell
npm run prisma:generate
npx dotenv -e ../../.env -- prisma migrate deploy
```

Wichtig: Der zweite Befehl muss allein mit der neuen Baseline funktionieren. Genau das macht später auch euer Container in Dockerfile.

### 6. Seed laufen lassen

```powershell
npm run prisma:seed
```

Da euer Seed in seed.ts per `upsert` arbeitet, ist das für diesen Test passend.

### 7. Kurze Funktionsvalidierung

Mindestens zwei Smoke-Checks:

```powershell
npm run smoke
npm run smoke:classes
```

Oder alternativ:

```powershell
npm run smoke
npm run smoke:admin
```

Ich würde mindestens `smoke-auth` und noch einen fachlichen Check laufen lassen, damit nicht nur die Tabellen existieren, sondern die Beziehungen auch stimmen.

### 8. Ergebnis prüfen und committen

Wenn alles sauber ist:

```powershell
git status
git add apps/api/prisma/migrations apps/api/prisma/schema.prisma
git commit -m "chore(api): squash prisma migrations into baseline"
```

Falls du noch Doku ergänzen willst, zum Beispiel in README.md, dann diese gleich mit committen.

## Optional: Docker-Validierung

Da euer Container beim Start `npx prisma migrate deploy` ausführt, ist ein kurzer Docker-Test sinnvoll.

Wenn ihr lokal per Compose arbeitet, kann ein typischer Check so aussehen:

```powershell
docker compose up --build
```

Oder mit eurer Dev-Datei:

```powershell
docker compose -f docker-compose_dev.yaml up --build
```

Danach prüfen, ob API-Start und Migration ohne Fehler durchlaufen.

## Was du nicht tun solltest

1. Die alten `migration.sql` Dateien manuell zu einem langen SQL-File zusammenkopieren.
2. Den Squash auf eine bestehende wichtige DB anwenden, die noch entlang der alten Kette weiter migriert werden muss.
3. migration_lock.toml löschen.
4. Direkt nach dem Squash weitere Schemaänderungen hineinmischen. Erst Baseline stabilisieren, dann neue Migrationen.

## Wenn doch schon eine relevante DB existiert

Dann nicht in-place squashen. In dem Fall ist der bessere Plan:

1. Alte Migrationskette für bestehende Umgebungen beibehalten.
2. Squash nur als neuer Startpunkt für komplett neue Umgebungen vorbereiten.
3. Erst später mit bewusstem Cutover entscheiden, ob Altumgebungen neu aufgebaut werden.

## Kurzfassung der Befehle

```powershell
git checkout -b chore/prisma-baseline-squash
git add .
git commit -m "chore: snapshot before prisma migration squash"

Set-Location c:\Entwicklung\KompetenzHub\apps\api

New-Item -ItemType Directory -Path .\prisma\migrations\20260625_baseline -Force

npx prisma migrate diff --from-empty --to-schema-datamodel .\prisma\schema.prisma --script | Out-File -Encoding utf8 .\prisma\migrations\20260625_baseline\migration.sql

New-Item -ItemType Directory -Path .\prisma\migrations_backup -Force
Copy-Item .\prisma\migrations\* .\prisma\migrations_backup\ -Recurse -Force

Get-ChildItem .\prisma\migrations -Directory | Where-Object { $_.Name -ne '20260625_baseline' } | Remove-Item -Recurse -Force

npm run prisma:generate
npx dotenv -e ../../.env -- prisma migrate deploy
npm run prisma:seed
npm run smoke
npm run smoke:classes

git add apps/api/prisma/migrations
git commit -m "chore(api): squash prisma migrations into baseline"
```

Wenn du willst, formuliere ich dir als Nächstes noch die „saubere Variante mit exakter Reihenfolge für lokale DB zurücksetzen, neu aufbauen und kontrollieren“, also wirklich als Checkliste für planung/Datenmigration.md.
