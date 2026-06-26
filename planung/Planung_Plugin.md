# Umsetzungsplanung: Plugin-Plattform für KompetenzHub

> **Verhältnis zu [Plugins.md](Plugins.md):** `Plugins.md` beschreibt das **Zielbild** (offenes,
> signiertes Drittanbieter-Ökosystem mit voller Isolation). Dieses Dokument ist der **technische
> Umsetzungsplan**, der das Zielbild auf die reale Architektur von KompetenzHub (NestJS-API +
> Next.js-Web, Prisma/PostgreSQL, Multi-Tenant, JWT/RBAC) herunterbricht und einen konkreten,
> in Wochen baubaren Pilot definiert, der **vorwärtskompatibel** zum vollen Zielbild ist.

Stand: 2026-06-26 · Zielgruppe: Entwickler:innen, die das Feature umsetzen.

---

## 1. Zielsetzung in einem Satz

Lehrpersonen (und später Drittanbieter) sollen **eigene Funktionen** als isolierte, pro Tenant
aktivierbare Erweiterungen bereitstellen können, ohne den Kern zu verändern – über ein formales
**Manifest**, klar definierte **Extension Points**, ein **Capability-Modell** und einen sauberen
**Lifecycle** mit nachweisbarem Cleanup.

---

## 2. Die zentrale Designentscheidung (das „Durchdenken")

Der schwierigste Punkt jeder Plugin-Plattform in Node/Next.js ist **das Laden von fremdem Code zur
Laufzeit**. Das muss man ehrlich entscheiden, sonst scheitert das Projekt an dieser Stelle:

- **Next.js** kompiliert Seiten/Bundles zur **Build-Zeit**. Neue UI-Seiten kann man nicht einfach
  „installieren", ohne neu zu bauen – oder man lädt UI als Remote-Bundle / via iframe (Micro-Frontend).
- **NestJS** verdrahtet Module/Controller beim **Boot** (siehe statische `imports`-Liste in
  [app.module.ts](../apps/api/src/app.module.ts)). Neue Controller zur Laufzeit zu registrieren ist
  möglich, aber fragil.
- **Node hat keine echte In-Process-Sandbox.** `vm`/`vm2` sind nicht sicherheitsdicht. Echte Isolation
  von Fremdcode braucht **Worker-Threads oder Kindprozesse** mit RPC-Brücke, Ressourcenlimits und einem
  Egress-Proxy für Netzwerk – das ist erheblicher Aufwand.

Daraus folgen **zwei Betriebsmodelle**. Wir bauen Modell A als Pilot und halten alle Verträge
(Manifest, Registry, Capabilities, Lifecycle, Datenmodell) so, dass Modell B **ohne Neubau der
Verträge** nachgerüstet werden kann.

| | **Modell A — Build-time gebündelt, Laufzeit-aktiviert (PILOT)** | **Modell B — Side-loaded signierte Pakete (ZIEL)** |
|---|---|---|
| Plugin-Code liegt | im Monorepo unter `plugins/packages/<id>` und wird **mitkompiliert** | als signiertes Artefakt, zur Laufzeit in ein Daten-Verzeichnis installiert |
| „Installation" | = Teil des Deployments (Code ist da) | = Upload + Signaturprüfung + Entpacken zur Laufzeit |
| Aktivierung / Konfiguration / Deaktivierung / Daten-Uninstall | **Laufzeit, pro Tenant, über DB** | Laufzeit, pro Tenant, über DB |
| Server-Ausführung | **In-Process**, aber strikt über das SDK + Capability-Guards gekapselt | **Out-of-Process** (Worker/Kindprozess) mit RPC-Brücke + Limits |
| Vertrauen | First-Party / kuratiert (Code-Review beim Merge) | Signatur + Publisher-Trust + Kompatibilitätsprüfung |
| Sandbox-Stärke | mittel (Konvention + Guards + gescopte APIs) | hoch (Prozessisolation, Egress-Allowlist) |
| Aufwand | Wochen | Monate |

**Empfehlung:** Pilot = **Modell A**. Es liefert echten Mehrwert (Extension Points, Per-Tenant-
Aktivierung, sauberes Disable/Uninstall, Capability-Gating, Namespacing) bei vertretbarem Risiko und
entspricht exakt der „empfohlenen ersten Pilotstufe" aus `Plugins.md`. Modell B ist Phase 4+.

> **Konsequenz für die erste Stufe:** „Installieren/Upgraden" eines Plugins bedeutet im Pilot ein
> Deployment (PR → Merge → Build). Die **operativen Laufzeit-Aktionen** (Enable, Disable, Konfigurieren,
> Daten-Uninstall) laufen vollständig über die Admin-UI und die DB. Das ist für ein selbst-gehostetes
> AGPL-Projekt, in dem Lehrpersonen ihre Plugins beisteuern, der pragmatisch richtige Schnitt.

---

## 3. Zielarchitektur im Überblick

```
                          ┌──────────────────────────────────────────────┐
   Build-Zeit             │  plugins/packages/<id>/                        │
   (Monorepo)             │    manifest.json · server/ · web/ · i18n/      │
                          └───────────────┬───────────────┬───────────────┘
                                          │               │
                 ┌────────────────────────┘               └───────────────────────┐
                 ▼ (server bundle)                                  (web bundle)    ▼
   ┌──────────────────────────────────┐                    ┌──────────────────────────────────┐
   │ API (NestJS)                      │                    │ Web (Next.js)                     │
   │  PluginsCoreModule               │                    │  pluginRegistry (statisch importiert)│
   │   ├─ PluginRegistryService       │   /plugins/        │   ├─ pages  (slot)                 │
   │   ├─ PluginManifestValidator     │   contributions    │   ├─ widgets(slot)                 │
   │   ├─ PluginLifecycleService      │◄──────────────────►│   ├─ navItems                      │
   │   ├─ PluginPermissionResolver    │   (welche Plugins  │   └─ i18n-Bundles                  │
   │   ├─ PluginDataService (KV)      │    enabled+erlaubt)│  AppShell merged Core-NAV + Plugin │
   │   ├─ PluginSecretService (AES)   │                    │  catch-all /plugins/[id]/[[...]]   │
   │   └─ PluginGuard / @Capability   │                    └──────────────────────────────────┘
   │  Plugin-Controller unter         │
   │   /api/v1/plugins/:id/...        │
   └───────────────┬──────────────────┘
                   ▼
   PostgreSQL: PluginInstallation · PluginTenantActivation · PluginRecord · PluginSecret
   + AuditLog (action = "plugin.*")            S3: plugins/<id>/<tenantId>/...
```

---

## 4. Repo-/Ordnerstruktur (auf dieses Monorepo gemünzt)

Wir nutzen die bestehenden npm-Workspaces. Neuer Top-Level-Ordner `plugins/`:

```
plugins/
  contracts/        → @kompetenzhub/plugin-contracts  (Manifest-, Capability-, Slot-, Lifecycle-Typen; framework-frei)
  sdk/              → @kompetenzhub/plugin-sdk         (öffentliche API für Plugin-Autoren: ServerContext, DataStore, Secret, Logger, http())
  registry/         → wird in apps/api als PluginsCoreModule eingebunden (Loader, Validator, Lifecycle)
  web-runtime/      → wird in apps/web eingebunden (Nav-/Page-/Widget-Registry, i18n-Loader)
  templates/        → Vorlage „neues Plugin" (CLI/Copy-Vorlage)
  packages/
    attendance/     → Pilot-Plugin (siehe §15)
      manifest.json
      server/        index.ts (exportiert PluginServerModule)
      web/           index.ts (exportiert { pages, widgets, navItems, translations })
      i18n/          de.json, fr.json, it.json, en.json
      migrations/    (erst Modell B / Schema-Plugins – im Pilot leer)
      assets/
      tests/         contract.spec.ts · lifecycle.spec.ts · cleanup.spec.ts
```

**Workspace-Verdrahtung:**
- `package.json` (root) → `"workspaces"` um `plugins/*` und `plugins/packages/*` erweitern.
- `apps/api` importiert `@kompetenzhub/plugin-contracts`, `plugins/registry` und **statisch** alle
  `plugins/packages/*/server`. → eine generierte `plugins/registry/discovered.ts` (Codegen beim Build,
  siehe §7.1) listet die gebündelten Plugins auf.
- `apps/web` importiert `@kompetenzhub/plugin-contracts`, `plugins/web-runtime` und statisch alle
  `plugins/packages/*/web`.

**Prinzip (aus `Plugins.md` übernommen):** Kern und Plugins physisch getrennt; SDK/Verträge getrennt
von einzelnen Plugins; Frontend+Backend eines Plugins liegen zusammen; jedes Plugin bringt Tests,
Übersetzungen und Cleanup-Definition mit.

---

## 5. Das Manifest (formaler Installationsvertrag)

Ohne gültiges, vollständiges Manifest darf ein Plugin weder geladen noch aktiviert werden. Konkreter
Typ in `plugins/contracts/manifest.ts`:

```ts
export interface PluginManifest {
  schemaVersion: 1;                       // Version des Manifest-Formats
  pluginId: string;                       // global eindeutig, unveränderlich, regex ^[a-z][a-z0-9-]{2,40}$
  displayName: string;
  version: string;                        // SemVer des Plugins
  publisher: { name: string; contact?: string; url?: string };
  license: string;                        // SPDX, z. B. "AGPL-3.0-or-later"
  description: Record<string, string>;    // i18n {de,fr,it,en}

  core: { minVersion: string; maxVersion?: string; apiVersion: 1 };  // Kompatibilität (siehe §13)

  capabilities: PluginCapability[];       // angeforderte Rechte, NUR diese sind nutzbar (§6)

  contributions: {
    apiRoutes?: ApiRouteContribution[];   // Backend-Endpunkte (relativ zu /plugins/:id)
    nav?: NavContribution[];              // Sidebar-Einträge je Rolle
    pages?: PageContribution[];           // gemountete Web-Seiten
    widgets?: WidgetContribution[];       // Dashboard-/Kontext-Widgets in definierten Slots
    adminPages?: PageContribution[];      // Admin-Bereich
  };

  data?: {
    mode: 'kv' | 'schema';               // Pilot: nur 'kv'. 'schema' = eigene Tabellen (Modell B/Phase 4)
    collections?: string[];              // bei 'kv': deklarierte Sammlungen
  };

  storage?: { prefixes: string[] };       // erlaubte S3-Prefixe (immer unter plugins/<id>/)
  secrets?: { key: string; scope: 'tenant' | 'global'; description: string }[];
  integrations?: { outboundHosts: string[]; description: string }[]; // erlaubte Outbound-Ziele
  backgroundJobs?: { key: string; schedule: string; description: string }[]; // Phase 3+

  translations: { namespaces: string[] }; // i18n-Namespaces, immer plugin.<id>.*
  audit?: { events: string[] };           // Ereignisse, die das Plugin protokolliert
  cleanup: {                              // DEKLARATIV – Basis der Uninstall-Prüfung (§12)
    data: 'delete' | 'archive';
    storage: 'delete' | 'keep';
    secrets: 'delete';
  };
}

export type PluginCapability = `plugin:${string}:${string}`; // z. B. "plugin:attendance:manage"

export interface ApiRouteContribution {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;                           // z. B. "/sessions/:sessionId"
  capability: PluginCapability;           // erforderliches Capability
  roles: ('ADMIN' | 'TEACHER' | 'LEARNER')[]; // erlaubte Kernrollen
}

export interface NavContribution {
  id: string; labelKey: string; icon: string;
  href: string;                           // immer unter /plugins/<id>/...
  roles: ('ADMIN' | 'TEACHER' | 'LEARNER')[];
}

export interface PageContribution { route: string; component: string; roles: string[]; }
export interface WidgetContribution { slot: 'teacher.dashboard' | 'learner.matrix.header' | string; component: string; roles: string[]; }
```

**JSON-Beispiel (Pilot „Anwesenheit"):** siehe §15.

**Validierung** (`PluginManifestValidator`): per **zod**-Schema (neue Dev-Dependency; sauberer als
class-validator für freie JSON-Strukturen). Prüft Format, ID-Regex, SemVer, dass jedes referenzierte
Capability im `capabilities`-Array deklariert ist, dass alle `href`/`path` korrekt namespaciert sind,
dass `cleanup` vollständig ist. **Harte Regel:** Referenziert eine `apiRoute`/`nav`/`widget` ein nicht
deklariertes Capability oder einen falschen Namespace → Plugin wird **abgelehnt** (nicht geladen).

---

## 6. Capability-/Permission-Modell

Die bestehenden Kern-Rollen (`@Roles(...)` + [RolesGuard](../apps/api/src/auth/roles.guard.ts))
reichen nicht – sie kennen keine Plugins. Wir ergänzen sie **additiv** (Kern bleibt unverändert):

- **Capability-String:** `plugin:<pluginId>:<scope>`, z. B. `plugin:attendance:manage`,
  `plugin:attendance:view`.
- **Wer hat ein Capability?** Im Pilot leiten wir Capabilities **aus der Kernrolle + Manifest** ab:
  eine `apiRoute` deklariert `capability` **und** `roles`. Der `PluginGuard` lässt den Zugriff zu,
  wenn (a) das Plugin für den Tenant **enabled** ist, (b) das Manifest die Route+Capability deklariert
  und (c) die Kernrolle des Users in `roles` enthalten ist. → Keine separate Rechtevergabe-UI nötig
  für den Start; später optional feingranular pro User (Phase 3).
- **`PluginPermissionResolver`** kapselt diese Logik (eine Stelle, testbar, später erweiterbar auf
  per-User-Grants ohne Vertragänderung).

**Neuer Guard + Decorator** (analog zu `roles.guard.ts`), in `plugins/registry`:

```ts
export const PLUGIN_CAP_KEY = 'pluginCapability';
export const RequireCapability = (cap: PluginCapability) => SetMetadata(PLUGIN_CAP_KEY, cap);

@Injectable()
export class PluginGuard implements CanActivate {
  constructor(private reflector: Reflector, private resolver: PluginPermissionResolver) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const cap = this.reflector.get<PluginCapability>(PLUGIN_CAP_KEY, ctx.getHandler());
    if (!cap) return true;
    const req = ctx.switchToHttp().getRequest<Request & { user?: RequestContext; pluginId?: string }>();
    const user = req.user!;
    return this.resolver.allows(user, req.pluginId!, cap); // prüft enabled + manifest + rolle
  }
}
```

`PluginGuard` läuft **nach** dem `JwtAuthGuard`, damit `req.user` (der `RequestContext`) gesetzt ist.

---

## 7. Backend-Integration (NestJS)

### 7.1 Discovery & Registry (Boot)

Neuer `PluginsCoreModule` in `apps/api`, importiert in [app.module.ts](../apps/api/src/app.module.ts)
**nach** den Kern-Modulen. Ablauf beim Boot:

1. **Codegen (Build-Schritt):** ein kleines Script scannt `plugins/packages/*/manifest.json` und
   generiert `plugins/registry/discovered.ts` mit statischen `import`s der Server-Bundles +
   Manifest-Objekte. (Static imports, damit Tree-Shaking/Bundling funktioniert.)
2. **`PluginRegistryService.onModuleInit()`:** validiert jedes Manifest (`PluginManifestValidator`),
   prüft Kompatibilität (`core.apiVersion`/`minVersion`, §13), prüft auf **Konflikte** (doppelte
   `pluginId`, kollidierende Routen-/Nav-/Slot-IDs), und legt/aktualisiert je Plugin eine
   `PluginInstallation`-Zeile (Status `INSTALLED` / `INCOMPATIBLE` / `CONFLICT`).
3. **Dynamische Route-Registrierung:** Plugin-Controller werden **nicht** klassisch über `@Module`
   eingebunden, sondern die Registry mountet die deklarierten `apiRoutes` über einen generischen
   **Dispatcher-Controller**:

```ts
@Controller('plugins/:pluginId')
export class PluginDispatcherController {
  constructor(private registry: PluginRegistryService) {}

  @All('*')
  @UseGuards(PluginGuard)          // Capability-Prüfung
  async dispatch(@Param('pluginId') pluginId, @Req() req, @Res() res, @CurrentUser() user) {
    // 1. Plugin installed? enabled für user.tenantId? (sonst 404/403)
    // 2. Route im Manifest? Methode passt? Capability/Role ok? (PluginGuard hat geprüft)
    // 3. ServerContext bauen (gescopt auf pluginId + tenantId) und Handler aufrufen:
    return this.registry.invoke(pluginId, req.method, subPath(req), buildServerContext(pluginId, user), req, res);
  }
}
```

Das hält den **globalen Prefix** `/api/v1` (siehe [main.ts](../apps/api/src/main.ts)) bei: Plugin-
Endpunkte liegen unter `/api/v1/plugins/<id>/...` → sauberes Namespacing wie in `Plugins.md` gefordert.

### 7.2 Das, was ein Plugin sieht: `ServerContext` (SDK)

Ein Plugin bekommt **niemals** den `PrismaClient` oder `S3Service` direkt. Es erhält einen **gescopten
Kontext** aus `@kompetenzhub/plugin-sdk`:

```ts
export interface ServerContext {
  pluginId: string;
  tenant: { id: string };
  user: { id: string; roles: Role[]; locale: string };
  data: DataStore;          // KV/Doc-Store, hart auf (pluginId, tenantId) gescopt
  secrets: SecretStore;     // nur deklarierte Secrets (AES-GCM at rest)
  storage: ScopedStorage;   // nur Prefix plugins/<id>/<tenantId>/
  http: FetchLike;          // nur deklarierte outboundHosts; sonst Fehler
  logger: PluginLogger;     // schreibt in AuditLog/PluginEventLog mit pluginId
  audit(event: string, detail?: object): Promise<void>;
}
```

`DataStore`, `SecretStore`, `ScopedStorage`, `http` werden vom Kern implementiert und **erzwingen** die
Grenzen (Defense-in-Depth, nicht nur Konvention). So kann In-Process-Code (Modell A) trotzdem nicht aus
seinem Tenant/Namespace ausbrechen, ohne den Kern zu umgehen.

### 7.3 Kernservices (neu)

| Service | Aufgabe |
|---|---|
| `PluginRegistryService` | Discovery, Validierung, Konfliktprüfung, Dispatch/Invoke |
| `PluginManifestValidator` | zod-Validierung + semantische Regeln (§5) |
| `PluginLifecycleService` | enable/disable/configure/upgrade/uninstall (§12) |
| `PluginPermissionResolver` | Capability-Auflösung (§6) |
| `PluginDataService` | KV/Doc-Store hinter `DataStore` (§8) |
| `PluginSecretService` | Secrets (Reuse AES-GCM aus [ai/crypto.util.ts](../apps/api/src/ai/crypto.util.ts)) |
| `PluginStorageService` | gescopte S3-Prefixe über bestehenden `S3Service` |
| `PluginActivationService` | liest/cached Aktivierungsstatus pro Tenant (heiss im Request-Pfad) |

---

## 8. Datenhaltung für Plugins

**Zwei Stufen, Pilot nutzt nur Stufe 1:**

### Stufe 1 (Pilot): generischer KV/Doc-Store — keine Plugin-Migrationen nötig

Eine **Kern-Tabelle** speichert alle Plugin-Daten als JSON-Dokumente, hart gescopt:

```prisma
model PluginRecord {
  id         String   @id @default(uuid())
  pluginId   String
  tenantId   String
  collection String                       // im Manifest deklariert (data.collections)
  key        String                       // fachlicher Schlüssel des Plugins
  data       Json     @default("{}")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([pluginId, tenantId, collection, key])
  @@index([pluginId, tenantId, collection])
}
```

`PluginDataService` setzt `pluginId` + `tenantId` **immer** selbst (aus dem `ServerContext`), nie aus
Plugin-Eingaben. Vorteile: **kein Schema-Migrationspfad** im Pilot, Tenant-Isolation trivial, Cleanup =
`deleteMany({ pluginId })`. Nachteil: keine relationalen Joins/Constraints – für die meisten
Lehrpersonen-Plugins (Listen, Notizen, Tracker, einfache Auswertungen) völlig ausreichend.

> **Wichtige Regel aus `Plugins.md`:** Plugin-Daten dürfen **nie** unkontrolliert in freie JSON-Felder
> des Kerns diffundieren. Deshalb eine **eigene** Tabelle (nicht `Tenant.settings` o. ä.).

### Stufe 2 (Phase 4): eigene Tabellen via Postgres-Schema-Namespace

Plugins mit echtem Datenbedarf bekommen ein **eigenes Postgres-Schema** `plugin_<id>` und liefern
Migrationen (`migrations/`), ausgeführt von `PluginMigrationService` über `$executeRawUnsafe` mit
Historie in `PluginMigration`. **Cleanup = `DROP SCHEMA plugin_<id> CASCADE`** → garantiert spurlos.
Das entkoppelt Plugin-Migrationen vom Kern-Prisma-Pfad (genau die Forderung aus `Plugins.md`, Phase 3).
Erst freischalten, wenn Stufe 1 stabil ist.

---

## 9. Storage & Secrets

- **Storage:** Plugins schreiben ausschließlich unter `plugins/<pluginId>/<tenantId>/...` über
  `ScopedStorage` (intern der bestehende [S3Service](../apps/api/src/storage/s3.service.ts)). Prefix
  wird vom Kern erzwungen; Manifest `storage.prefixes` ist nur Doku/Deklaration. Cleanup = Prefix-Delete.
- **Secrets:** `PluginSecret`-Tabelle, Wert **verschlüsselt at rest** mit demselben AES-256-GCM-Muster
  wie `AiConfig.apiKeyEnc` ([crypto.util.ts](../apps/api/src/ai/crypto.util.ts), Key `AI_CONFIG_ENC_KEY`
  bzw. neuer `PLUGIN_SECRET_ENC_KEY`). Nie im Klartext zurückgeben; nur dem Plugin-Server-Code über
  `SecretStore.get(key)` zur Laufzeit.

```prisma
model PluginSecret {
  id        String   @id @default(uuid())
  pluginId  String
  tenantId  String?                       // null = global
  key       String                        // muss in manifest.secrets deklariert sein
  valueEnc  String
  updatedAt DateTime @updatedAt
  @@unique([pluginId, tenantId, key])
}
```

---

## 10. Frontend-Integration (Next.js)

Modell A = **statisch gebündelte** Plugin-Web-Beiträge, **datengesteuerte Sichtbarkeit**.

### 10.1 Web-Registry (Build-Zeit)

`plugins/web-runtime` exportiert eine `pluginWebRegistry: Record<pluginId, PluginWebModule>`, generiert
analog §7.1 aus `plugins/packages/*/web/index.ts`. Jedes `PluginWebModule` liefert:
`{ navItems, pages: Record<route, Component>, widgets: Record<slot, Component[]>, translations }`.

Das Problem: Wenn apps/web statisch alle Plugin-Web-Module importiert (import { AttendancePage } from '...'), landen alle Plugins im Haupt-Bundle von Next.js. Das ruiniert die Performance (Bundle Size) der Core-App, selbst wenn ein Tenant die Plugins gar nicht aktiviert hat.

Lösung: Die Web-Registry darf nicht die Komponenten direkt importieren, sondern muss mit Next.js Dynamic Imports (next/dynamic) arbeiten.

```TypeScript
// In der generierten registry/discovered.ts (Frontend)
import dynamic from 'next/dynamic';

export const pluginWebRegistry = {
  attendance: {
    pages: {
      '/': dynamic(() => import('@plugins/attendance/web/AttendancePage'), { ssr: true })
    }
  }
};
```

### 10.2 Sichtbarkeit zur Laufzeit

Neuer Endpunkt **`GET /api/v1/plugins/contributions`** liefert für den aktuellen User (Tenant + Rolle)
die Liste der **enabled + erlaubten** Plugins mit deren `nav`/`pages`/`widgets`-IDs und i18n-Bundles.
Die Web-App filtert ihre **statische** Registry damit. → Server entscheidet *ob*, Client weiß *wie*
gerendert wird.

### 10.3 Konkrete Änderungen am Web-Kern

- **[AppShell.tsx](../apps/web/src/components/AppShell.tsx):** Die hartkodierten `TEACHER_NAV`/
  `STUDENT_NAV`/`ADMIN_NAV` bleiben, werden aber **gemerged** mit den Plugin-Nav-Items aus der
  Contributions-Antwort (gefiltert nach Rolle). Ein neuer Abschnitt „Erweiterungen" in der Sidebar.
- **Catch-all-Route** `apps/web/src/app/plugins/[pluginId]/[[...rest]]/page.tsx`: rendert die in der
  Web-Registry registrierte Plugin-Seite für `route`, eingebettet in `AppShell`. Unbekannt/ nicht
  enabled → 404.
- **Widget-Slots:** an definierten Stellen (z. B. Lehrer-Dashboard [lehrer/page.tsx](../apps/web/src/app/lehrer/page.tsx),
  Lernenden-Matrix-Header) ein `<PluginSlot name="teacher.dashboard" />`, das alle enabled Widgets dieses
  Slots rendert. Nur **deklarierte** Slot-Namen sind gültig.
- **i18n:** `PluginTranslationLoader` merged Plugin-Bundles unter Namespace `plugin.<id>.<key>` in das
  bestehende Fallback-System ([i18n.tsx](../apps/web/src/lib/i18n.tsx)). Plugins dürfen nur ihren eigenen
  Namespace schreiben.
- **API-Client:** `apps/web/src/lib/api.ts` bekommt einen generischen `plugin(pluginId).fetch(path, opts)`
  Helfer, der auf `/plugins/<id>/...` zeigt und die bestehende Auth/Fehlerbehandlung wiederverwendet.

### 10.4 Bewusste Grenze (aus `Plugins.md`, Nicht-Ziele)

Keine globalen CSS-Overrides, keine direkten AppShell-Eingriffe. Plugins rendern **innerhalb** ihres
Seiten-/Widget-Containers; Styling über vorgegebene Utility-Klassen/Tokens.

---

## 11. Prisma-Kernmodelle (Pilot, minimal)

In [schema.prisma](../apps/api/prisma/schema.prisma) ergänzen (eine reguläre Kern-Migration):

```prisma
enum PluginInstallStatus { INSTALLED INCOMPATIBLE CONFLICT DISABLED }
enum PluginTenantStatus  { ENABLED DISABLED ERROR }

model PluginInstallation {        // global pro Instanz (Modell A: = im Deployment vorhanden)
  id              String   @id @default(uuid())
  pluginId        String   @unique
  installedVersion String
  manifestHash    String
  status          PluginInstallStatus @default(INSTALLED)
  lastError       String?
  installedAt     DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model PluginTenantActivation {    // Aktivierung pro Tenant
  id            String   @id @default(uuid())
  pluginId      String
  tenantId      String
  enabled       Boolean  @default(false)
  enabledVersion String?
  config        Json     @default("{}")
  configVersion Int      @default(1)
  status        PluginTenantStatus @default(DISABLED)
  lastError     String?
  enabledAt     DateTime?
  disabledAt    DateTime?
  @@unique([pluginId, tenantId])
  @@index([tenantId])
}

// + PluginRecord (§8) und PluginSecret (§9)
```

**Lifecycle-/Audit-Ereignisse** laufen über das bestehende `AuditLog` mit `action = "plugin.install"`,
`"plugin.enable"`, `"plugin.disable"`, `"plugin.uninstall"` usw. (kein separates `PluginEventLog` im
Pilot nötig; bei Bedarf später ergänzen). Damit ist die Forderung „Installation/Aktivierung/Entfernung
bleiben in der Historie" (`Plugins.md`) erfüllt, ohne neues Subsystem.

> Hinweis: `PluginRecord`/`PluginSecret`/`PluginTenantActivation` werden **nicht** in
> `TENANT_SCOPED_MODELS` der [prisma.service.ts](../apps/api/src/prisma/prisma.service.ts) aufgenommen –
> das Scoping erfolgt **explizit** im `PluginDataService` (klarer, testbarer, kein Magie-Verhalten).

---

## 12. Lifecycle-Algorithmen (konkret)

`PluginLifecycleService`. Jeder Schritt schreibt AuditLog. Pilot-relevant: **Enable, Disable, Configure,
Uninstall(Daten)**. Install/Upgrade sind im Pilot Deploy-getrieben (Registry registriert beim Boot).

**Enable (pro Tenant):**
1. Plugin `INSTALLED` & kompatibel? sonst Fehler.
2. Tenant-Konfiguration gegen Manifest validieren (Pflicht-Config/Secrets vorhanden?).
3. Deklarierte Secrets vorhanden / setzbar? Integrationen (outboundHosts) bestätigt?
4. `PluginTenantActivation` upsert → `enabled=true`, `status=ENABLED`, `enabledVersion`, `enabledAt`.
5. Aktivierungs-Cache invalidieren. AuditLog `plugin.enable`.
→ Sichtbar: Nav/Pages/Widgets erscheinen (Contributions-Endpoint), API-Routen werden zugelassen.

**Disable (pro Tenant):** `enabled=false`, `status=DISABLED`, `disabledAt`; **Daten/Config bleiben
unangetastet**; Jobs/Webhooks (Phase 3) stoppen; Cache invalidieren; AuditLog `plugin.disable`.
→ UI-Beiträge verschwinden, API-Routen liefern 403/404.

**Configure:** Config gegen Manifest-Schema validieren, `config`/`configVersion` setzen, AuditLog.

**Upgrade (Modell A = neue Version im Deployment):** Registry erkennt neue `installedVersion`,
wertet `core`-Kompatibilität + Breaking-Change-Regeln (SemVer-Major) aus, re-validiert alle
`PluginTenantActivation` (bei Inkompatibilität → `status=ERROR`, Plugin für betroffene Tenants
automatisch deaktiviert, Admin-Hinweis). Bei Schema-Plugins (Phase 4): Migrationen ausführen, im
Fehlerfall zurückrollen.

**Uninstall (Daten-Uninstall, pro Tenant ODER global):**
1. **Vorbedingung:** Plugin ist für den Ziel-Scope **disabled** (nicht enabled). Sonst Abbruch.
2. Cleanup-Plan aus `manifest.cleanup` laden.
3. `PluginSecretService.deleteAll(pluginId, tenantId?)`.
4. `PluginStorageService.deletePrefix(plugins/<id>/<tenantId>/)` (oder global).
5. `PluginDataService.purge(pluginId, tenantId?)` → `data: 'delete'` löscht, `'archive'` exportiert
   nach S3 und löscht dann aus der Live-Tabelle.
6. `PluginTenantActivation` entfernen (bzw. bei globalem Uninstall alle).
7. **Cleanup-Verifikation:** Re-Scan: keine `PluginRecord`/`PluginSecret`/aktiven Activations/Storage-
   Objekte mehr → erst dann `plugin.uninstall.success`, sonst `plugin.uninstall.incomplete` + Fehler.
8. AuditLog bleibt erhalten (gewollte Historie, vgl. `Plugins.md`).

> **„Sauber deinstalliert" = keine aktive technische/fachliche Rückwirkung** (keine Routen, Widgets,
> Jobs, Secrets, Storage, lebenden Daten) – Historie im AuditLog bleibt bewusst erhalten.

---

## 13. Kompatibilität & Versionierung

- Kern exportiert zwei Konstanten: `CORE_VERSION` (App-Version) und `PLUGIN_API_VERSION` (z. B. `1`).
- Manifest deklariert `core.apiVersion` + `core.minVersion`/`maxVersion`. Registry lehnt ab bei
  `apiVersion`-Mismatch oder Versions-Range-Verletzung (Status `INCOMPATIBLE`).
- Das **SDK** (`@kompetenzhub/plugin-sdk`) ist eigenständig versioniert; Breaking Changes am `ServerContext`
  erhöhen `PLUGIN_API_VERSION`. So bleiben alte Plugins erkennbar inkompatibel statt still zu brechen.

---

## 14. Sicherheits-/Isolations-Matrix (auf den Code gemünzt)

| Bereich | **Erlaubt (über SDK)** | **Verboten / unmöglich gemacht** |
|---|---|---|
| Daten | `ctx.data` (gescopt auf pluginId+tenantId) | direkter `PrismaClient`, Kern-Tabellen, fremde Plugin-Daten |
| Storage | `ctx.storage` unter `plugins/<id>/<tenant>/` | beliebige S3-Keys, fremde Prefixe |
| Secrets | `ctx.secrets.get(deklarierterKey)` | Lesen anderer Secrets, Klartext-Persistenz |
| Netzwerk | `ctx.http` nur zu `integrations.outboundHosts` | beliebige Outbound-Requests, `fetch`/`http` direkt (Phase 4: Egress-Proxy) |
| API | nur Routen aus `contributions.apiRoutes`, Guard-geprüft | neue Top-Level-Routen, Kern-Endpunkte überschreiben |
| UI | Plugin-Seiten/Widgets in deklarierten Slots | AppShell-Eingriff, globales CSS, fremde Slots |
| Rollen | `RequireCapability` + Manifest-`roles` | RolesGuard/Kern-RBAC umgehen |
| Auth/Tenant | `ctx.user`, `ctx.tenant` (read-only) | Tenant wechseln, fremde Tenants lesen |

Modell A erzwingt diese Grenzen über **gescopte SDK-APIs + Guards** (Defense-in-Depth, nicht nur
Konvention). Modell B ergänzt **Prozessisolation + Egress-Proxy** für nicht vertrauenswürdigen Code.

---

## 15. Pilot-Plugin „Anwesenheit" (end-to-end)

Realer Use-Case einer Lehrperson: pro Modulanlass-Sitzung Anwesenheit erfassen, mit Dashboard-Widget
„heute anwesend". Nutzt **nur** Modell A / KV-Store → ideal als erster Durchstich.

**`plugins/packages/attendance/manifest.json`:**
```json
{
  "schemaVersion": 1,
  "pluginId": "attendance",
  "displayName": "Anwesenheit",
  "version": "0.1.0",
  "publisher": { "name": "KompetenzHub Core", "url": "https://potenzialentwickler.ch" },
  "license": "AGPL-3.0-or-later",
  "description": { "de": "Anwesenheit pro Sitzung erfassen und auswerten." },
  "core": { "minVersion": "0.1.0", "apiVersion": 1 },
  "capabilities": ["plugin:attendance:manage", "plugin:attendance:view"],
  "contributions": {
    "apiRoutes": [
      { "method": "GET",  "path": "/sessions",            "capability": "plugin:attendance:view",   "roles": ["TEACHER"] },
      { "method": "POST", "path": "/sessions",            "capability": "plugin:attendance:manage", "roles": ["TEACHER"] },
      { "method": "POST", "path": "/sessions/:id/marks",  "capability": "plugin:attendance:manage", "roles": ["TEACHER"] }
    ],
    "nav": [
      { "id": "attendance", "labelKey": "plugin.attendance.nav", "icon": "🗓", "href": "/plugins/attendance", "roles": ["TEACHER"] }
    ],
    "pages":   [ { "route": "/", "component": "AttendancePage", "roles": ["TEACHER"] } ],
    "widgets": [ { "slot": "teacher.dashboard", "component": "TodayWidget", "roles": ["TEACHER"] } ]
  },
  "data": { "mode": "kv", "collections": ["sessions", "marks"] },
  "translations": { "namespaces": ["plugin.attendance"] },
  "cleanup": { "data": "delete", "storage": "delete", "secrets": "delete" }
}
```

**`server/index.ts`** (gegen das SDK, kein direkter Prisma-Zugriff):
```ts
export default definePlugin({
  routes: {
    'GET /sessions': async (ctx) => ctx.data.list('sessions'),
    'POST /sessions': async (ctx, req) => {
      const s = { id: crypto.randomUUID(), date: req.body.date, classId: req.body.classId };
      await ctx.data.put('sessions', s.id, s);
      await ctx.audit('session.created', { id: s.id });
      return s;
    },
    'POST /sessions/:id/marks': async (ctx, req) =>
      ctx.data.put('marks', `${req.params.id}:${req.body.enrollmentId}`, { present: req.body.present }),
  },
});
```

**`web/index.ts`** exportiert `AttendancePage` + `TodayWidget` + lädt `i18n/de.json`
(`plugin.attendance.nav = "Anwesenheit"` …). Datenzugriff über `plugin('attendance').fetch('/sessions')`.

**Lifecycle-Durchstich:** Admin aktiviert „Anwesenheit" für seinen Tenant → Nav + Dashboard-Widget
erscheinen für Lehrpersonen → Daten landen in `PluginRecord(pluginId='attendance')` → Disable blendet
alles aus, Daten bleiben → Uninstall löscht alle `attendance`-Records + verifiziert Leere.

---

## 16. Teststrategie

Jedes Plugin bringt eigene Tests mit (`tests/`):
- **Contract-Test:** Manifest valide? Alle referenzierten Capabilities deklariert? Namespaces korrekt?
- **Lifecycle-Test:** enable → Routen/Nav sichtbar; disable → 403/404, Daten unverändert.
- **Cleanup-Test:** nach Uninstall **0** `PluginRecord`/`PluginSecret`/Storage-Objekte (automatisierte
  Verifikation – das ist der „Cleanup-Nachweis" aus `Plugins.md`).

Kern-Tests: `PluginManifestValidator` (gültig/ungültig), `PluginPermissionResolver` (enabled/role-Matrix),
`PluginGuard` (Zugriff erlaubt/verweigert), Tenant-Isolation des `PluginDataService` (Plugin A sieht nie
Daten von Plugin B oder von Tenant X).

---

## 17. Phasen- & Rollout-Plan (mit DoD und betroffenen Dateien)

| Phase | Inhalt | Definition of Done | Betroffene Stellen |
|---|---|---|---|
| **P0 Fundament** | `plugins/contracts` (Manifest-Typen, zod-Schema), `plugin-sdk`-Skelett (`ServerContext`-Typen), Workspaces verdrahten | `npm run typecheck` grün; Manifest-Validator hat Unit-Tests | root `package.json`, neuer `plugins/` |
| **P1 Backend-Registry** | `PluginsCoreModule`, Discovery/Codegen, Validator, `PluginRegistryService`, Dispatcher-Controller, `PluginGuard`, `PluginPermissionResolver` | Ein Dummy-Plugin antwortet unter `/api/v1/plugins/<id>/ping`, Guard verweigert bei disabled | [app.module.ts](../apps/api/src/app.module.ts), neue `plugins/registry` |
| **P2 Datenmodell + Lifecycle** | Prisma-Modelle (§11), `PluginDataService`, `PluginSecretService`, `PluginStorageService`, `PluginLifecycleService` (enable/disable/configure/uninstall) + Admin-Endpunkte | Enable/Disable/Uninstall über API; Cleanup-Verifikation grün | [schema.prisma](../apps/api/prisma/schema.prisma), [s3.service.ts](../apps/api/src/storage/s3.service.ts), [crypto.util.ts](../apps/api/src/ai/crypto.util.ts) |
| **P3 Frontend-Extension-Points** | `plugins/web-runtime` (Nav-/Page-/Widget-Registry), Contributions-Endpoint, AppShell-Merge, catch-all-Route, `PluginSlot`, i18n-Loader, `plugin()`-API-Client | Plugin-Nav + Seite + Widget erscheinen nur bei aktivem Plugin | [AppShell.tsx](../apps/web/src/components/AppShell.tsx), [i18n.tsx](../apps/web/src/lib/i18n.tsx), [api.ts](../apps/web/src/lib/api.ts), neue Route |
| **P4 Admin-UI** | Admin-Seite „Erweiterungen": Liste installierter Plugins, je Tenant Enable/Disable/Konfig/Uninstall, Status/Fehler, Audit | Schuladmin verwaltet Plugins ohne Entwickler | neu unter `app/admin/erweiterungen` |
| **P5 Pilot „Anwesenheit"** | Plugin vollständig + Tests (§15/§16) | End-to-end-Durchstich + Cleanup-Test grün | `plugins/packages/attendance` |
| **P6 (später) Schema-Plugins** | Postgres-Schema-Namespace, `PluginMigrationService`, `PluginMigration` | Plugin mit eigenen Tabellen, `DROP SCHEMA`-Cleanup | DB/Migrationen |
| **P7 (Ziel) Modell B** | Signierte side-loaded Pakete, Out-of-Process-Ausführung (Worker/Kindprozess), Egress-Proxy, Publisher-Trust | Drittanbieter-Plugin ohne Redeploy installierbar | Infrastruktur |

---

## 18. Risiken & offene Entscheidungen (mit Empfehlung)

1. **Runtime-Code-Isolation (größtes Risiko).** *Empfehlung:* Pilot bewusst **Modell A** (kuratiert,
   In-Process, gescopte SDK-APIs). Modell B erst, wenn echter Drittanbieter-Bedarf besteht.
2. **„Installieren" ohne Redeploy.** Im Pilot nicht möglich (Code muss gebaut werden). *Empfehlung:*
   bewusst akzeptieren und in der Admin-UI klar kommunizieren („verfügbare Erweiterungen" = im Build).
3. **Per-User-Rechte vs. Rolle.** Pilot leitet Capabilities aus Kernrolle ab. *Empfehlung:* genügt; der
   `PluginPermissionResolver` kapselt es, feingranulare Grants sind später additiv nachrüstbar.
4. **KV-Store vs. echte Tabellen.** *Empfehlung:* mit KV starten (kein Migrationspfad-Risiko), Schema-
   Plugins erst in P6.
5. **Neue Dependency `zod`.** *Empfehlung:* annehmen – sauberste Manifest-Validierung; Alternative
   class-validator wäre umständlicher für freie JSON-Strukturen.
6. **AGPL-Pflichten für Plugins.** Plugins, die mitkompiliert werden, sind Teil des kombinierten Werks.
   *Empfehlung:* Manifest-`license` verpflichtend; First-Party-Plugins AGPL; Drittanbieter-Lizenzfrage
   in P7 klären.

---

## 19. Nicht-Ziele der ersten Ausbaustufe (aus `Plugins.md` bestätigt)

- Keine freie Codeausführung ohne Signierung/Review.
- Keine direkten Änderungen am Kernschema durch Plugins ohne Regeln.
- Keine globalen CSS-Overrides, keine AppShell-Eingriffe.
- Keine undeklarierten Outbound-Netzwerkzugriffe.
- Keine stillen Hintergrundjobs ohne Registry/Ownership.
- Keine Deinstallation ohne Cleanup-Nachweis.

---
## 20 Offene Punkte und ihre Lösung

###  Problem 1: Next.js Server-Side Rendering (SSR) & API-Mocks
Der ServerContext stellt dem Backend-Code ein gescooptes ctx.http oder ctx.data bereit. Was passiert, wenn eine Plugin-Webkomponente (AttendancePage) auf dem Next.js-Server vorgerendert wird (SSR)?

Das Problem: Im Next.js-Frontend-Kontext gibt es diesen ServerContext standardmässig nicht. Wenn das Plugin beim SSR Daten laden möchte, darf es nicht direkt auf die DB zugreifen.

Lösung: Es muss im Frontend strikt erzwungen werden, dass Datenkomponenten im Client-Side Rendering (CSR) über den erwähnten API-Client plugin('attendance').fetch() laufen, oder der Next.js-Server muss die Anfrage transparent an die NestJS-API weiterleiten.

### Problem 2: Der NestJS Dispatcher-All-Catch und Route-Spezifität
Der PluginDispatcherController fängt alle Requests unter /api/v1/plugins/:pluginId/* ab.

Das Problem: Express/Fastify (die NestJS-Unterbauten) matchen Routen nach der Reihenfolge der Registrierung. Wenn du später globale Core-Routen hast, die ähnlich aufgebaut sind, oder wenn NestJS die Wildcard @All('*') zu gierig interpretiert, kann es zu Konflikten kommen.

Lösung: Stelle sicher, dass das PluginsCoreModule in der app.module.ts wirklich als letztes Modul importiert wird, damit die Core-Routen Vorrang beim Matching haben.

### Problem 3: KV-Store Performance und Abfragen (Stufe 1)
Das Datenmodell nutzt ein einzelnes Json-Feld in PluginRecord.

Das Problem: Für das Pilot-Plugin „Anwesenheit" reicht das vollkommen. Sobald aber eine Lehrperson nach „allen ungültigen Absenzen aus dem Monat Mai" filtern möchte, muss die Datenbank das JSON zur Laufzeit parsen. Bei vielen Tenants und Millionen Einträgen wird das ohne spezialisierte Indexe (z. B. PostgreSQL jsonb_path_ops) extrem langsam.

Lösung: Definiere in Prisma das Feld explizit als Json (was in Postgres als jsonb gemappt wird) und füge bei Bedarf über eine rohe SQL-Migration einen Gin-Index auf das data-Feld hinzu, falls innerhalb des JSONs gesucht werden muss.

---

## 21. Nicht-Ziele der ersten Ausbaustufe (aus `Plugins.md` bestätigt)

- Keine freie Codeausführung ohne Signierung/Review.
- Keine direkten Änderungen am Kernschema durch Plugins ohne Regeln.
- Keine globalen CSS-Overrides, keine AppShell-Eingriffe.
- Keine undeklarierten Outbound-Netzwerkzugriffe.
- Keine stillen Hintergrundjobs ohne Registry/Ownership.
- Keine Deinstallation ohne Cleanup-Nachweis.

---

## 20. Konkrete nächste Schritte (Sprint 1 = P0 + Start P1)

Zod-Validierung im Build-Schritt: Lasst das Codegen-Skript (das discovered.ts erzeugt) bereits die zod-Validierung der Manifeste durchlaufen. Wenn ein Entwickler ein kaputtes Manifest einreicht, sollte bereits der Anwendungs-Build fehlschlagen, nicht erst der Boot-Vorgang des Servers in der Produktion.

Eindeutige CSS-Klassen (Tailwind): Da globale CSS-Overrides verboten sind, einigt euch darauf, dass Plugins im Frontend ihre Elemente in ein gemeinsames Wrapper-Div packen, um CSS-Kollisionen zu vermeiden (z.B. Nutzung von Tailwind-Scoping falls nötig).

1. Top-Level `plugins/` anlegen, Workspaces in root-`package.json` erweitern.
2. `@kompetenzhub/plugin-contracts`: `manifest.ts` (Typen aus §5) + zod-Schema + Unit-Tests.
3. `@kompetenzhub/plugin-sdk`: `ServerContext`-Interface (§7.2) + `definePlugin()`-Helfer (Typen, noch
   ohne Laufzeit).
4. `PluginManifestValidator` (zod + semantische Regeln) mit Tests gültig/ungültig.
5. Skelett `PluginsCoreModule` + `PluginRegistryService.onModuleInit()` (Discovery + Validierung,
   noch ohne Dispatch) und in [app.module.ts](../apps/api/src/app.module.ts) einhängen.
6. Dummy-Plugin `plugins/packages/_example` mit `/ping`-Route → erster grüner Durchstich.

> Danach P2 (DB + Lifecycle) und P3 (Frontend) gemäß §17. Der Pilot „Anwesenheit" (§15) ist die
> Abnahme-Demo der gesamten Stufe.
