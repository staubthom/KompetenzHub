# Smoke-Tests

Smoke-Tests prüfen die laufende API auf grundlegende Korrektheit – sie senden echte HTTP-Anfragen und geben `OK` oder `FAIL` pro Prüfpunkt aus.

## Voraussetzung

Die API muss lokal laufen (Standard: `http://localhost:3001`).  
Die Basis-URL kann über die Umgebungsvariable `API_BASE` überschrieben werden.
Für die KI Test muss die .env Variabel `AI_STUB_MODE=1` sein.

## Alle Tests auf einmal starten

```bash
node --test --test-concurrency=1 apps/api/scripts/*.mjs
```

> **Wichtig – Rate-Limit beim Batch-Lauf:** Die Tests melden sich sehr oft per
> `dev-login` an, und `smoke-security.mjs` feuert allein ~65 Logins ab (es testet
> das Rate-Limiting). Das Auth-Limit liegt standardmässig bei **60 Logins/Minute
> pro IP** (`THROTTLE_AUTH_LIMIT`).
>
> - **Parallel** (Standard von `node --test`) erschöpfen die Skripte das Kontingent
>   gegenseitig → Folgefehler `429`/`401`. Deshalb seriell mit
>   `--test-concurrency=1` ausführen (alphabetisch läuft `smoke-security` zuletzt
>   und hungert die anderen nicht aus).
> - Laufen mehrere Durchläufe **kurz hintereinander**, teilen sie sich dasselbe
>   60-Sekunden-Fenster – ggf. ~1 Minute warten.
> - **Robust (z. B. CI):** die API mit grosszügigem Limit starten:
>   ```bash
>   THROTTLE_AUTH_LIMIT=1000 THROTTLE_LIMIT=2000 npm run dev:api
>   node --test apps/api/scripts/*.mjs
>   ```

## Einzelnen Test starten

```bash
node apps/api/scripts/smoke-auth.mjs
```

## Verfügbare Tests

| Datei                      | Was wird geprüft                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `smoke-admin.mjs`          | Schuladmin-Dashboard: Einladung, Rollenwechsel, Sperre, RBAC                                           |
| `smoke-ai.mjs`             | KI-Konfiguration je Lehrperson                                                                         |
| `smoke-ai-grading.mjs`     | KI-gestützte Bewertung                                                                                 |
| `smoke-auth.mjs`           | Authentifizierung und RBAC-Flow (Token, Rollen, geschützte Routen)                                     |
| `smoke-bewertung.mjs`      | Bewertungslogik                                                                                        |
| `smoke-class-archive.mjs`  | Archivierung von Klassen                                                                               |
| `smoke-classes.mjs`        | Klassenverwaltung                                                                                      |
| `smoke-co-teaching.mjs`    | Co-Teaching-Funktionalität                                                                             |
| `smoke-dashboard.mjs`      | Dashboard-Endpunkte                                                                                    |
| `smoke-evidence.mjs`       | Evidence-/Nachweismanagement                                                                           |
| `smoke-expert-talk.mjs`    | Expert-Talk-Feature                                                                                    |
| `smoke-isolation.mjs`      | Mandanten-/Eigentümer-Isolation: B sieht Module, Modulanlässe, Teilnehmende & Einreichungen von A nicht; Rollen-Isolation (Lernende/Lehrperson dürfen keine Lehrer-/Admin-Routen nutzen) |
| `smoke-learning-paths.mjs` | Lernpfade                                                                                              |
| `smoke-matrix.mjs`         | Kompetenzmatrix                                                                                        |
| `smoke-matrix-io.mjs`      | Import/Export der Kompetenzmatrix                                                                      |
| `smoke-plugins.mjs`        | Plugin-System                                                                                          |
| `smoke-security.mjs`       | Sicherheits-Header (helmet), Eingabevalidierung, Rate Limiting, Auth-Guard, Rollen-Guard, Injection/XSS-Basics, CORS, SVG-Download als Attachment, Selbstregistrierung nur mit erlaubter E-Mail-Domain |

## Hinweise

- `smoke-security.mjs` testet Rate Limiting; für niedrige Limits die API mit `THROTTLE_AUTH_LIMIT=5 THROTTLE_LIMIT=50` starten.
- Die Registrierungs-Domain-Prüfung in `smoke-security.mjs` nutzt `POST /auth/exchange`. Ist auf der API `AUTH_EXCHANGE_SECRET` gesetzt, muss derselbe Wert auch im Testlauf als `AUTH_EXCHANGE_SECRET` verfügbar sein – sonst überspringt der Test diesen Block (kein Fehler).
- Die Tests nutzen den `dev-login`-Endpunkt und sind **nicht für Produktionsumgebungen** geeignet.
- **Aufräumen:** Jeder Test, der per Dev-Login (oder `/auth/exchange`) Test-User anlegt, löscht diese am Schluss wieder über `POST /auth/dev-delete` (siehe `_cleanup.mjs`). Das Löschen kaskadiert die Daten des Users (Memberships, Klassen, Einreichungen, Bewertungen); im Besitz stehende Module werden auf `ownerId = null` gesetzt. Der Endpunkt ist nur bei aktivem Dev-Login (`DEV_LOGIN_ENABLED`) verfügbar.
