# KompetenzHub – Security-Review (OWASP Top 10)

> Stand: Juni 2026 · Bezug: OWASP Top 10 (2021)
> Dieser Bericht dokumentiert die Sicherheitsmassnahmen und den Review-Status. Er begleitet die Härtungs-Massnahmen (Rate Limiting, Eingabevalidierung, sichere Header, Secrets-Handling).

## Zusammenfassung

| Bereich                                   | Status                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| Rate Limiting (global + Auth)             | ✅ aktiv (`@nestjs/throttler`)                                            |
| Eingabevalidierung                        | ✅ globale `ValidationPipe` + `class-validator`-DTOs                      |
| Sichere HTTP-Header                       | ✅ `helmet`                                                               |
| Secrets-Handling                          | ✅ `.env` (gitignored), Verschlüsselung at rest, Produktions-Startprüfung |
| Mandanten-/Eigentümer-Isolation           | ✅ durchgängig erzwungen (Smoke-getestet)                                 |
| Einheitliche Fehler ohne Informationsleck | ✅ RFC-7807-Filter                                                        |

**Keine kritischen Findings offen.** Verbleibende Punkte sind Deployment-Aufgaben (HTTPS-Terminierung, Reverse-Proxy-Trust, IdP-Anbindung) und in [docs/21-Anleitung.md, Kap. 12](21-Anleitung.md) als Checkliste hinterlegt.

---

## OWASP Top 10 (2021) – Bewertung

### A01: Broken Access Control

**Massnahmen**

- Rollenbasierte Zugriffskontrolle über globale Guards (`JwtAuthGuard` → `RolesGuard`), Routen mit `@Roles(...)`.
- Strikte **Mandanten-Isolation**: tenant-gescopte Prisma-Schicht für `Module`, `Class`, `CompetenceEvidence`; alle übrigen Zugriffe filtern explizit nach `tenantId`.
- **Eigentümer-Scoping**: Lehrpersonen sehen nur eigene Module/Modulanlässe; Co-Leitung explizit über `ClassTeacher` modelliert; Löschen/Co-Verwaltung nur durch Besitzer:in.
- **Zugangs-Gate** beim Login: neue Konten werden standardmässig `LEARNER`; erhöhte Rechte nur per Einladung/`ADMIN_EMAILS`. Gesperrte Konten werden abgewiesen.
- Self-Schutz: Admin kann sich nicht selbst sperren/entfernen; letzte Admin geschützt.

**Tests:** `smoke:isolation` (17/17), `smoke:admin`, `smoke:co-teaching` prüfen 401/403-Grenzen.

### A02: Cryptographic Failures

- API-JWT signiert (HS256) mit `JWT_SIGNING_KEY`; httpOnly-Cookie, `secure` in Produktion, `sameSite=lax`.
- KI-API-Schlüssel werden **AES-256-GCM verschlüsselt** gespeichert (`AI_CONFIG_ENC_KEY`) und nie im Klartext zurückgegeben.
- **Produktions-Startprüfung**: Boot bricht ab, wenn `JWT_SIGNING_KEY`/`AI_CONFIG_ENC_KEY` die unsicheren Defaults sind oder `DEV_LOGIN_ENABLED=true`.
- TLS/HTTPS erfolgt über den vorgelagerten Reverse Proxy (Deployment-Aufgabe).

### A03: Injection

- **Prisma ORM** mit parametrisierten Queries – kein dynamisches SQL.
- **Eingabevalidierung** global via `ValidationPipe({ whitelist: true, transform: true })`: unbekannte Felder werden entfernt, Typen erzwungen. Sensible Endpunkte nutzen `class-validator`-DTOs (Auth, Admin-Einladung, Klassen-Beitritt/Co-Leitung).
- Rich-Text wird im Frontend kontrolliert gerendert; Ausgabe-Encoding durch React.

### A04: Insecure Design

- Klares Rollen-/Rechtemodell, Least-Privilege-Defaults (neue Nutzer = Lernende).
- KI ist **assistierend**, nie automatisch entscheidend (Bewertung trifft immer die Lehrperson).
- Append-only Bewertungshistorie (Nachvollziehbarkeit).

### A05: Security Misconfiguration

- **`helmet`** setzt sichere HTTP-Header (u. a. `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS hinter HTTPS). CSP für die reine JSON-API deaktiviert (Web-App liefert eigene CSP-Strategie).
- **CORS** restriktiv auf `NEXT_PUBLIC_WEB_URL` mit `credentials`.
- Fehlerantworten einheitlich (RFC 7807) **ohne Stacktraces/Interna**; Server-Fehler werden geloggt, dem Client nur generisch gemeldet.
- Default-Secrets werden in Produktion verweigert (siehe A02).

### A06: Vulnerable & Outdated Components

- Aktuelle Hauptversionen (NestJS 10, Next.js 14, Prisma 5).
- CI baut & lintet bei jedem PR. **Empfehlung:** `npm audit` / Dependabot im Repo aktivieren (Deployment-/Repo-Aufgabe).

### A07: Identification & Authentication Failures

- Produktiv über **OIDC (Microsoft/Google)**; Anbieter pro Schule schaltbar.
- `/auth/exchange` zusätzlich per `AUTH_EXCHANGE_SECRET` geschützt (BFF-Muster).
- **Rate Limiting** auf Anmelde-Endpunkten (`@Throttle`, Default 60/min·IP, tunebar) als Brute-Force-Bremse.
- Kurze Token-Lebensdauer (`JWT_TTL_SECONDS`, Default 15 min); `dev-login` nur in Entwicklung.

### A08: Software & Data Integrity Failures

- Import/Export (Module, Modulanlässe, Backup) über kontrollierte ZIP-Strukturen mit Schema-Version.
- Keine Ausführung hochgeladener Inhalte; Dateien liegen im Objektspeicher und werden nur via presignte URLs ausgeliefert.

### A09: Security Logging & Monitoring Failures

- **Audit-Log** für sicherheitsrelevante Ereignisse (`auth.login`, `auth.denied`, `auth.logout`, Bewertungs-Aktionen), im Schuladmin-Dashboard einsehbar.
- **Health-Endpoint** (`/api/v1/health`) für Monitoring (DB/Redis/S3/Version).
- _Folgephase (Beobachtbarkeit):_ strukturiertes Request-Logging + Basis-Metriken.

### A10: Server-Side Request Forgery (SSRF)

- Keine server-seitigen Abrufe anhand nutzerkontrollierter URLs. KI-Endpunkte sind fix konfigurierte Provider-Endpoints (pro Lehrperson), keine beliebigen Ziel-URLs aus Nutzereingaben.

---

## Rate Limiting – Konfiguration

| Variable              | Default | Wirkung                                      |
| --------------------- | ------- | -------------------------------------------- |
| `THROTTLE_TTL`        | `60000` | Zeitfenster (ms)                             |
| `THROTTLE_LIMIT`      | `300`   | Anfragen pro IP & Fenster (global)           |
| `THROTTLE_AUTH_LIMIT` | `60`    | Anfragen pro IP & Fenster für Auth-Endpunkte |

> Hinweis Schul-Kontext: Da ganze Klassen hinter einer **NAT-IP** arbeiten, sind die Limits bewusst grosszügig. Hinter einem Reverse Proxy muss `trust proxy`/`X-Forwarded-For` korrekt gesetzt sein, damit die IP-Erkennung greift. Überschreitung → HTTP **429** (RFC-7807).

## Eingabevalidierung

- Global: `ValidationPipe({ whitelist: true, transform: true })` – entfernt unbekannte Felder still, wandelt Typen.
- DTOs mit `class-validator` u. a. für: `dev-login`, `exchange`, `PATCH /auth/me`, `POST /admin/invitations`, `POST /classes/join`, `POST /classes/:id/co-teachers`.

## Secrets-Handling

- `.env` ist gitignored; nur `.env.example` ist versioniert.
- Produktions-Startprüfung (`assertSecureSecrets`) bricht bei unsicheren Defaults ab.
- KI-Schlüssel verschlüsselt at rest; JWT-Cookie httpOnly/secure.
