# Multi-Tenant-Betrieb (mehrere Schulen / Abteilungen in einer Instanz)

> Stand: 2026-07-01

KompetenzHub kann eine einzelne Instanz für **mehrere Schulen bzw. Abteilungen**
betreiben. Jede Schule ist ein **Mandant (Tenant)** und wird über ihre
**Subdomain** angesprochen:

```
schule-a.kompetenzhub.ch   → Mandant "schule-a"
schule-b.kompetenzhub.ch   → Mandant "schule-b"
```

Die Datentrennung erfolgt strikt auf Datenbankebene (jeder Datensatz hängt an
einer `tenantId`, zentrale Scoping-Schicht in `apps/api/src/prisma/prisma.service.ts`).
Ein Anmelde-Token gilt nur auf der Subdomain seines Mandanten.

---

## 1. Funktionsweise

1. Der Reverse-Proxy leitet alle `*.basisdomain` auf die Instanz und setzt den
   `Host`- (bzw. `X-Forwarded-Host`-)Header.
2. Die **TenantMiddleware** (`apps/api/src/common/tenant.middleware.ts`) löst aus
   der Subdomain den Mandanten auf und legt ihn in den Request-Kontext.
3. Login/Token-Exchange binden den Nutzer an genau diesen Mandanten.
4. Der **JwtAuthGuard** weist ein Token ab, dessen Mandant nicht zur Subdomain
   passt (kein Cross-Tenant-Zugriff).
5. Unbekannte Subdomain → `404 Unbekannte Schule`.

Die SPA sendet den aus dem Browser-Host abgeleiteten Slug zusätzlich als
`X-Tenant-Slug`-Header (nötig, weil die API unter einem festen Host läuft).

---

## 2. Umgebungsvariablen

| Variable | Zweck | Beispiel |
| --- | --- | --- |
| `TENANT_BASE_DOMAIN` | Basisdomain zum Abschneiden der Subdomain (API) | `kompetenzhub.ch` |
| `NEXT_PUBLIC_TENANT_BASE_DOMAIN` | dito für den Browser (Web) | `kompetenzhub.ch` |
| `DEFAULT_TENANT_SLUG` | Fallback-Mandant, wenn keine Subdomain ableitbar ist | `default` |
| `SUPERADMIN_EMAILS` | Plattform-Admins (dürfen Schulen anlegen/verwalten) | `it@trägerschaft.ch` |

Bleiben die Basisdomain-Variablen **leer**, verhält sich die Instanz wie bisher
(Single-Tenant, alles läuft auf dem Default-Mandanten) – ideal für lokale
Entwicklung (`localhost`).

---

## 3. DNS & TLS

- **Wildcard-DNS**: `*.kompetenzhub.ch` → IP der Instanz (A/AAAA-Record).
- **Wildcard-Zertifikat**: `*.kompetenzhub.ch` (Let's Encrypt via **DNS-01**-
  Challenge – HTTP-01 kann keine Wildcards ausstellen).

---

## 4. Reverse-Proxy

Im mitgelieferten `docker-compose.yml` ist noch **kein** Reverse-Proxy enthalten.
Für den Multi-Tenant-Betrieb einen vorschalten. Beispiel **Caddy** (übernimmt
Wildcard-TLS automatisch, hier mit Cloudflare-DNS-Plugin):

```caddyfile
*.kompetenzhub.ch {
    tls {
        dns cloudflare {env.CF_API_TOKEN}
    }

    # API unter /api/* an den API-Container
    handle /api/* {
        reverse_proxy api:3001
    }

    # alles andere an die Web-App (Next.js)
    handle {
        reverse_proxy web:3000
    }
}
```

Caddy setzt `X-Forwarded-Host` automatisch. Wird ein anderer Proxy (nginx/Traefik)
genutzt, muss sichergestellt sein, dass der ursprüngliche Host durchgereicht wird.

> Wichtig: Läuft die API unter derselben Subdomain (`/api/*`), trägt schon der
> `Host` den Mandanten – `X-Tenant-Slug` ist dann nur noch für den internen
> NextAuth-Exchange nötig (siehe unten) und wird von der Web-App gesetzt.

---

## 5. OAuth-Anbieter (Microsoft/Google/GitHub/Logto)

OAuth-Redirect-URIs sind pro Anbieter registriert. Bei vielen Subdomains gibt es
zwei Wege:

- **Zentrale Callback-Subdomain** (empfohlen): Alle Logins laufen über z. B.
  `login.kompetenzhub.ch/api/auth/callback/...`; nach erfolgreichem Login wird auf
  die Schul-Subdomain zurückgeleitet. Nur **eine** Redirect-URI pro Anbieter.
- **Pro Subdomain je Redirect-URI**: funktioniert, skaliert aber schlecht (jede
  neue Schule muss beim Anbieter nachgetragen werden).

Der interne Token-Exchange (`/auth/exchange`) bekommt den Mandanten von der
Web-App via `X-Tenant-Slug` (aus dem Host des Login-Requests, siehe
`apps/web/src/lib/auth.ts`). `AUTH_EXCHANGE_SECRET` sollte gesetzt sein.

---

## 6. Schulen anlegen (Super-Admin)

1. Als Nutzer aus `SUPERADMIN_EMAILS` einloggen.
2. In der Navigation **„Schulen"** öffnen (`/platform`) – oder per API:
   ```
   POST /api/v1/platform/tenants
   { "slug": "schule-a", "name": "Schule A", "adminEmail": "admin@schule-a.ch" }
   ```
3. Die optionale `adminEmail` erhält beim ersten Login automatisch Schuladmin-
   Rechte. Danach verwaltet die Schuladmin ihre Schule wie gewohnt.
4. DNS-Eintrag/Wildcard deckt die neue Subdomain automatisch ab – kein Deploy nötig.

### Schuladmin verwalten

Pro Schule (Knopf **„Admins"** bzw. API):

```
GET    /api/v1/platform/tenants/:id/admins            # Admins + offene Einladungen
POST   /api/v1/platform/tenants/:id/admins            # { "email": "..." } hinzufügen
DELETE /api/v1/platform/tenants/:id/admins?userId=... # Admin entfernen
DELETE /api/v1/platform/tenants/:id/admins?email=...  # Einladung widerrufen
```

Bestehende Konten werden sofort zum Admin befördert, unbekannte E-Mails erhalten
eine Einladung (Einlösung beim ersten Login). Es bleibt stets **mindestens ein
aktiver Admin** bestehen.

### Deaktivieren & Löschen

```
PATCH  /api/v1/platform/tenants/:id   # { "active": false }  → Zugriff sperren
DELETE /api/v1/platform/tenants/:id   # Schule endgültig löschen
```

Deaktivieren sperrt den Zugriff, behält aber alle Daten. Löschen entfernt den
Mandanten **unwiderruflich** samt aller abhängigen Daten (FK-Kaskaden plus
explizite Bereinigung von Plugin-/KI-/Fachgespräch-/Audit-Daten). Der
Default-Mandant ist gegen Löschen geschützt.

---

## 7. Lokale Entwicklung

- Ohne Basisdomain-Variablen → `localhost` nutzt den Default-Mandanten.
- Mehrere Mandanten lokal testen: `TENANT_BASE_DOMAIN=localtest.me` setzen und
  `schule-a.localtest.me:3000` aufrufen (localtest.me löst alles auf 127.0.0.1 auf),
  oder per `X-Tenant-Slug`-Header (z. B. mit curl).

---

## 8. Betrieb: Einzel- vs. Multi-Instanz

| | Eine Instanz pro Schule | Eine Instanz für alle |
| --- | --- | --- |
| Datentrennung | physisch (eigene DB) | logisch (tenantId) |
| Aufwand Betrieb | pro Schule | einmalig |
| Onboarding neue Schule | Deploy | Klick im Super-Admin |
| Blast-Radius | isoliert | geteilt |

Beide Modi werden unterstützt. Für getrennte Trägerschaften mit hohen
Isolationsanforderungen bleibt die Einzelinstanz möglich (Basisdomain-Variablen
einfach leer lassen).
