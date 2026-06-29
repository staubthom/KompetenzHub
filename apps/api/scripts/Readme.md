# Smoke-Tests

Smoke-Tests prüfen die laufende API auf grundlegende Korrektheit – sie senden echte HTTP-Anfragen und geben `OK` oder `FAIL` pro Prüfpunkt aus.

## Voraussetzung

Die API muss lokal laufen (Standard: `http://localhost:3001`).  
Die Basis-URL kann über die Umgebungsvariable `API_BASE` überschrieben werden.
Für die KI Test muss die .env Variabel  `AI_STUB_MODE=1` sein. 

## Alle Tests auf einmal starten

```bash
node --test apps/api/scripts/*.mjs
```

## Einzelnen Test starten

```bash
node apps/api/scripts/smoke-auth.mjs
```

## Verfügbare Tests

| Datei | Was wird geprüft |
|---|---|
| `smoke-admin.mjs` | Schuladmin-Dashboard: Einladung, Rollenwechsel, Sperre, RBAC |
| `smoke-ai.mjs` | KI-Konfiguration je Lehrperson |
| `smoke-ai-grading.mjs` | KI-gestützte Bewertung |
| `smoke-auth.mjs` | Authentifizierung und RBAC-Flow (Token, Rollen, geschützte Routen) |
| `smoke-bewertung.mjs` | Bewertungslogik |
| `smoke-class-archive.mjs` | Archivierung von Klassen |
| `smoke-classes.mjs` | Klassenverwaltung |
| `smoke-co-teaching.mjs` | Co-Teaching-Funktionalität |
| `smoke-dashboard.mjs` | Dashboard-Endpunkte |
| `smoke-evidence.mjs` | Evidence-/Nachweismanagement |
| `smoke-expert-talk.mjs` | Expert-Talk-Feature |
| `smoke-isolation.mjs` | Mandanten-Isolation: Lehrperson B darf Daten von A nicht sehen |
| `smoke-learning-paths.mjs` | Lernpfade |
| `smoke-matrix.mjs` | Kompetenzmatrix |
| `smoke-matrix-io.mjs` | Import/Export der Kompetenzmatrix |
| `smoke-plugins.mjs` | Plugin-System |
| `smoke-security.mjs` | Sicherheits-Header (helmet), Eingabevalidierung, Rate Limiting, Auth-Guard, Injection/XSS-Basics, CORS |

## Hinweise

- `smoke-security.mjs` testet Rate Limiting; für niedrige Limits die API mit `THROTTLE_AUTH_LIMIT=5 THROTTLE_LIMIT=50` starten.
- Die Tests nutzen den `dev-login`-Endpunkt und sind **nicht für Produktionsumgebungen** geeignet.
