# API selbst testen

Die KompetenzHub-API läuft unter **`http://localhost:3001`**, alle Routen liegen unter dem Präfix **`/api/v1`**.

## 0. Vorbereitung (einmalig pro Session)

Datenbank muss laufen (Docker), dann die API starten:

```cmd
docker compose up -d db
npm run start --workspace apps/api
```

> Beim Start erscheint: `KompetenzHub API laeuft auf http://localhost:3001`.
> Den Terminal offen lassen – die API läuft im Vordergrund.

---

## 1. Schnellster Weg: automatischer Smoke-Test

In einem **zweiten** Terminal (die API muss laufen):

```cmd
npm run smoke --workspace apps/api
```

Erwartete Ausgabe: **`Ergebnis: 12 OK, 0 FAIL`**. Der Test prüft den
kompletten Flow (Login, /me, RBAC, 400/401/403-Fehler).

---

## 2. Im Browser anschauen (GET-Routen)

- Healthcheck: <http://localhost:3001/api/v1/health>
- Module ohne Login: <http://localhost:3001/api/v1/modules>
  → liefert bewusst **401** (geschützt). Das ist korrekt.

---

## 3. Manuell mit `curl` (Windows cmd)

### a) Als Lehrperson einloggen und Token holen
```cmd
curl -s -X POST http://localhost:3001/api/v1/auth/dev-login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"lehrer@demo.ch\",\"role\":\"TEACHER\"}"
```
Aus der Antwort das Feld `token` kopieren.

### b) Eigenes Profil abrufen (Token einsetzen)
```cmd
curl -s http://localhost:3001/api/v1/auth/me ^
  -H "Authorization: Bearer DEIN_TOKEN_HIER"
```

### c) Modul anlegen (nur TEACHER/ADMIN erlaubt)
```cmd
curl -s -X POST http://localhost:3001/api/v1/modules ^
  -H "Authorization: Bearer DEIN_TOKEN_HIER" ^
  -H "Content-Type: application/json" ^
  -d "{\"number\":\"293\",\"title\":{\"de\":\"Webauftritt erstellen\"}}"
```

### d) Module auflisten
```cmd
curl -s http://localhost:3001/api/v1/modules ^
  -H "Authorization: Bearer DEIN_TOKEN_HIER"
```

---

## 4. Gültige Rollen

Beim `dev-login` sind nur diese Werte für `role` erlaubt:

| Rolle     | Schreibrechte (POST /modules) |
|-----------|-------------------------------|
| `ADMIN`   | ja                            |
| `TEACHER` | ja                            |
| `LEARNER` | nein → liefert **403**        |

---

## 5. Was du erwarten solltest (Soll-Verhalten)

| Aktion                                   | Erwartetes Ergebnis |
|------------------------------------------|---------------------|
| GET /modules ohne Token                  | 401                 |
| dev-login (TEACHER)                       | 201 + `token`       |
| GET /auth/me mit Token                    | 200 + eigenes Profil|
| POST /modules (TEACHER) mit `number`      | 201                 |
| POST /modules ohne `number`               | 400                 |
| POST /modules als LEARNER                 | 403                 |
| GET /auth/me mit kaputtem Token           | 401                 |
