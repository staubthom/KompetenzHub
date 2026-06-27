# KompetenzHub – Plugins entwickeln (vollständige Anleitung)

> **Zielgruppe:** Lehrpersonen/Entwickler:innen, die eine eigene Funktion bauen wollen –
> auch mit Hilfe einer KI. Diese Anleitung ist so geschrieben, dass du sie **zusammen mit
> deiner Idee** an eine KI geben kannst und am Ende ein **lauffähiges Plugin** entsteht,
> **ohne den Core (Kern) anzufassen**.
>
> Als durchgehendes Beispiel dient das mitgelieferte Plugin **`memo`**
> („Dossier- & Memo-Assistent“) unter `plugins/packages/memo/`. Jeder Abschnitt verweist
> auf die entsprechende Stelle dieses Plugins.

---

## 0. Die wichtigste Regel

**Ein Plugin greift NIE in den Core ein.** Du erstellst ausschliesslich ein neues Paket
unter `plugins/packages/<deinPlugin>/`. Du editierst **keine** Datei in `apps/api` oder
`apps/web`. Alles, was ein Plugin tun darf, geschieht über **deklarierte Verträge**:

- ein **Manifest** (`manifest.json`) – was das Plugin beiträgt und braucht,
- ein **Server-Modul** (`server/index.ts`) – deine Backend-Logik gegen einen **gescopten
  Kontext** (`ctx`),
- **Web-Komponenten** (`web/*.tsx`) – deine UI, die der Core an definierten **Einhäng-
  punkten (Slots)** rendert.

Der Core stellt dafür feste **Erweiterungspunkte** bereit (Menü, Seiten, Widgets,
Aktions-Buttons, Tabs) und eine **gescopte Laufzeit-API**. Mehr kann (und soll) ein Plugin
nicht. Das hält Schul-Daten sicher und Plugins updatefähig.

> **Wenn dir ein Erweiterungspunkt fehlt:** Dann ist das eine Core-Aufgabe (neuer Slot /
> neue `ctx.core`-Methode). Plugins können solche Punkte nicht selbst schaffen. Liste sie
> separat auf – sie müssen einmalig im Core ergänzt werden (siehe §12).

---

## 1. Was ein Plugin kann (Erweiterungspunkte)

| Punkt                | Manifest-Schlüssel        | Wo es erscheint                                         | Beispiel im `memo`                  |
| -------------------- | ------------------------- | ------------------------------------------------------- | ----------------------------------- |
| **Menüeintrag**      | `contributions.nav`       | Linke Navigation (rollenabhängig)                       | „Memos“ → Übersichtsseite           |
| **Eigene Seite**     | `contributions.pages`     | Unter `/plugins/<id>/…`                                 | `MemoOverviewPage`                  |
| **Widget / Infobox** | `contributions.widgets`   | In einen Karten-Slot (z. B. Dashboard)                  | „Offene To-Dos“-Karte               |
| **Aktions-Button**   | `contributions.actions`   | In eine Tabellenzeile/Toolbar; erhält die **Zeilen-ID** | 📝-Button je Lernende:r             |
| **Tab**              | `contributions.tabs`      | Zusätzlicher Tab auf einer Seite mit Tab-Leiste         | „Notizen“-Tab in der Schüler-Matrix |
| **API-Endpunkte**    | `contributions.apiRoutes` | Backend unter `/plugins/<id>/…`                         | `/notes`, `/summary`, `/modules`    |

**Bekannte Slot-Namen** (nur diese sind erlaubt – siehe
`plugins/contracts/src/schema.ts`):

- Widget-Slots (`KNOWN_WIDGET_SLOTS`): `teacher.dashboard`, `learner.matrix.header`
- Aktions-Slots (`KNOWN_ACTION_SLOTS`): `teacher.classMember.actions`
  _(Zeile in der Mitgliederliste eines Modulanlasses; Kontext: `enrollmentId`,
  `moduleId`, `classId`, `displayName`)_
- Tab-Slots (`KNOWN_TAB_SLOTS`): `teacher.studentMatrix.tabs`
  _(in der Schüler-Matrix-Ansicht; Kontext: `enrollmentId`, `moduleId`, `displayName`)_

> Slots passieren **nicht** automatisch überall – der Core muss den Slot an der
> jeweiligen Stelle platziert haben. Die obige Liste ist die **vollständige** aktuell
> verfügbare Menge. Neue Slots = Core-Änderung (§12).

---

## 2. Dateistruktur eines Plugins

```
plugins/packages/<deinPlugin>/
├── manifest.json          # Pflicht – der Installationsvertrag
├── package.json           # Name @kompetenzhub/plugin-<id>, baut server/ nach dist/
├── tsconfig.json          # kompiliert NUR server/** (CommonJS) nach dist/
├── server/
│   └── index.ts           # definePlugin({ routes }) – deine Backend-Logik
├── web/
│   ├── <Component>.tsx     # deine UI-Komponenten (vom Web-App transpiliert)
│   └── …
└── i18n/
    ├── de.json            # plugin.<id>.* Übersetzungen (flach)
    ├── fr.json
    ├── it.json
    └── en.json
```

Kopiervorlage: nimm `plugins/packages/memo/` und passe es an. `package.json` und
`tsconfig.json` können fast unverändert übernommen werden (nur `name`/`description`).

---

## 3. Das Manifest (`manifest.json`)

Das Manifest wird beim Start **streng validiert** (zod + semantische Regeln,
`plugins/contracts/src/schema.ts`). Verstösst etwas, wird das Plugin **gar nicht geladen**.

### 3.1 Harte Namens-Regeln (sonst ungültig)

- `pluginId`: `^[a-z][a-z0-9-]{2,40}$`, **global eindeutig & unveränderlich**.
- `capabilities`: jeweils `plugin:<pluginId>:<scope>` (z. B. `plugin:memo:read`).
- `nav[].href`: muss unter `/plugins/<pluginId>` liegen.
- `translations.namespaces`: müssen mit `plugin.<pluginId>` beginnen.
- `storage.prefixes` (falls genutzt): müssen mit `plugins/<pluginId>/` beginnen.
- `widgets/actions/tabs[].slot`: müssen **bekannte** Slots sein (§1).
- `apiRoutes[].capability`: muss in `capabilities` deklariert sein; `path` beginnt mit `/`.

### 3.2 Beispiel (gekürzt aus `memo`)

```jsonc
{
  "schemaVersion": 1,
  "pluginId": "memo",
  "displayName": "Dossier- & Memo-Assistent",
  "version": "0.1.0",
  "publisher": { "name": "…", "url": "…" },
  "license": "AGPL-3.0-or-later",
  "description": { "de": "…", "fr": "…", "it": "…", "en": "…" },
  "core": { "minVersion": "0.0.0", "apiVersion": 1 },
  "capabilities": ["plugin:memo:read", "plugin:memo:write"],
  "contributions": {
    "apiRoutes": [
      { "method": "GET", "path": "/notes", "capability": "plugin:memo:read", "roles": ["TEACHER"] },
      {
        "method": "POST",
        "path": "/notes",
        "capability": "plugin:memo:write",
        "roles": ["TEACHER"],
      },
      {
        "method": "PATCH",
        "path": "/notes/:id",
        "capability": "plugin:memo:write",
        "roles": ["TEACHER"],
      },
      {
        "method": "DELETE",
        "path": "/notes/:id",
        "capability": "plugin:memo:write",
        "roles": ["TEACHER"],
      },
    ],
    "nav": [
      {
        "id": "memo",
        "labelKey": "plugin.memo.nav",
        "icon": "📝",
        "href": "/plugins/memo",
        "roles": ["TEACHER"],
      },
    ],
    "pages": [{ "route": "/", "component": "MemoOverviewPage", "roles": ["TEACHER"] }],
    "widgets": [
      { "slot": "teacher.dashboard", "component": "MemoDashboardWidget", "roles": ["TEACHER"] },
    ],
    "actions": [
      {
        "slot": "teacher.classMember.actions",
        "component": "MemoButton",
        "labelKey": "plugin.memo.action",
        "icon": "📝",
        "roles": ["TEACHER"],
      },
    ],
    "tabs": [
      {
        "slot": "teacher.studentMatrix.tabs",
        "component": "MemoTab",
        "labelKey": "plugin.memo.tab",
        "icon": "📝",
        "roles": ["TEACHER"],
      },
    ],
  },
  "data": { "mode": "kv", "collections": ["notes"] },
  "translations": { "namespaces": ["plugin.memo"] },
  "audit": { "events": ["note.create", "note.update", "note.delete"] },
  "cleanup": { "data": "delete", "storage": "keep", "secrets": "delete" },
}
```

**Wichtig zu `component`:** Der String (`"MemoButton"` usw.) ist der **Name**, unter dem du
die Komponente im Web-Registry registrierst (§6.3). Er muss exakt übereinstimmen.

**`roles`** ist die **grobe** Sichtbarkeits-/Zugriffsstufe (welche Kernrolle den Beitrag
sieht bzw. die Route aufrufen darf). **Feinere** Berechtigungen (z. B. „nur Lehrperson
DIESES Modulanlasses“) prüfst du selbst im Server-Handler über `ctx.core` (§5.4).

---

## 4. Server: Endpunkte schreiben (`server/index.ts`)

```ts
import { definePlugin, badRequest, forbidden, notFound } from '@kompetenzhub/plugin-sdk';

export default definePlugin({
  routes: {
    // Schlüssel = "METHODE /pfad" – exakt wie im Manifest deklariert.
    'GET /notes': async (ctx, req) => {
      const enrollmentId = String(req.query.enrollmentId ?? '');
      // … siehe ACL-Muster §5.4 …
      return await ctx.data.list('notes'); // Rückgabe wird als JSON gesendet
    },
  },
});
```

- **`req`**: `{ params, query, body }` (framework-neutral). `params.id` für `/notes/:id`.
- **Rückgabewert**: wird als JSON serialisiert (Status 200).
- **Fehler/Statuscodes**: wirf `badRequest()/forbidden()/notFound()/conflict()` aus dem
  SDK. Der Core mappt sie auf 400/403/404/409. Andere Fehler → 500.

### 4.1 Der gescopte `ctx` (ServerContext)

Alles, was dein Backend darf, kommt aus `ctx` (`plugins/sdk/src/context.ts`). Du siehst
**nie** Prisma/S3 direkt:

| `ctx.…`                                           | Zweck                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `pluginId`, `tenant.id`, `user.{id,roles,locale}` | Identität (vom Core gesetzt, nicht fälschbar)                                   |
| `data`                                            | **KV-/Doc-Store** je `(plugin, tenant)`: `get/list/put/delete(collection, key)` |
| `secrets.get(key)`                                | im Manifest deklarierte Secrets (entschlüsselt)                                 |
| `storage`                                         | Datei-Uploads, hart auf `plugins/<id>/<tenant>/` begrenzt                       |
| `http(url, init)`                                 | `fetch`, **nur** zu deklarierten `integrations.outboundHosts`                   |
| `logger`, `audit(event, detail)`                  | Logging & zentrales Audit-Log                                                   |
| `config`                                          | vom Schuladmin gesetzte, **tenant-spezifische** Konfiguration (read-only)       |
| `core`                                            | **schreibgeschützte Lesefassade auf Kern-Stammdaten** (für ACLs)                |

### 4.2 Datenhaltung: der Key-Value (KV) Store

Pilot-Stand: **`data.mode: "kv"`**. Du speicherst JSON-Dokumente pro `collection` unter
einem `key` (z. B. einer UUID). `(pluginId, tenantId)` setzt **immer der Core** – ein
Plugin kann weder aus seinem Tenant noch aus seinem Namespace ausbrechen.

```ts
await ctx.data.put('notes', note.id, note); // anlegen/überschreiben
const one = await ctx.data.get('notes', id); // ein Dokument oder null
const all = await ctx.data.list('notes'); // [{ key, data }]
await ctx.data.delete('notes', id);
```

> Eigene Tabellen (`data.mode: "schema"`) sind **noch nicht** verfügbar (geplant). Für
> grosse Datenmengen oder komplexe Queries ist das eine Core-Erweiterung.

---

## 5. Sicherheit & Berechtigungen (Pflichtlektüre)

### 5.1 Rollen-Gate (grob, durch den Core)

`apiRoutes[].roles` entscheidet, **wer die Route überhaupt aufrufen darf**. Beispiel
`memo`: alle Routen sind `["TEACHER"]`. **Lernende erreichen die Endpunkte damit gar
nicht** – der Core blockt sie vor deinem Handler (404/403). So gelangen private Daten nie
in den Browser eines Lernenden.

### 5.2 Aktivierung & Capability (durch den Core)

Eine Route ist nur erreichbar, wenn (a) das Plugin im Tenant **aktiviert** ist und (b) die
Route ein im Manifest **deklariertes Capability** trägt. Sonst: 404 (nicht enumerierbar).

### 5.3 Mandantentrennung (automatisch)

KV-Daten, Secrets und Storage sind **immer** auf den aufrufenden Tenant gescopt. Du musst
nichts tun – aber du darfst dich auch nicht darauf verlassen, dass „nur ein Tenant“
existiert.

### 5.4 **Kontext-ACL über `ctx.core`** (deine Verantwortung)

Das Rollen-Gate sagt „ist Lehrperson“ – nicht „ist Lehrperson **dieses** Modulanlasses“.
Diese feine Prüfung machst du mit der Kern-Lesefassade:

```ts
// Auflösung einer Zeilen-ID (enrollmentId) inkl. Beziehung der aufrufenden Person:
const member = await ctx.core.getClassMember(enrollmentId);
// member: { enrollmentId, classId, moduleId, displayName, classStatus,
//           teacherRelation: 'owner'|'coTeacher'|'admin'|'none', teacherHasAccess }
if (!member || !member.teacherHasAccess) throw forbidden();

// Alle (zugreifbaren!) Mitglieder eines Moduls – bereits ACL-gefiltert:
const members = await ctx.core.listModuleMembers(moduleId);

// Module der aufrufenden Lehrperson (für Auswahl-Dropdowns):
const myModules = await ctx.core.listMyModules();
```

`ctx.core` setzt die Berechtigung der aufrufenden Person **serverseitig** durch –
Plugin-Eingaben können sie nicht aushebeln. **Muster:** Jede Route, die mit einer
`enrollmentId` arbeitet, ruft zuerst `getClassMember` und prüft `teacherHasAccess`.

### 5.5 Konfigurierbare Feinrechte über `ctx.config`

Der Schuladmin kann pro Tenant eine JSON-Konfiguration setzen (Admin-UI → Erweiterungen →
Konfigurieren). Sie steht als `ctx.config` bereit. `memo` nutzt z. B.
`config.coTeacherAccess` (`"write" | "read" | "none"`), um Co-Leitungen Lese-/Schreibrechte
zu geben:

```ts
const access = ctx.config.coTeacherAccess ?? 'write';
if (member.teacherRelation === 'coTeacher' && access === 'none') throw forbidden();
```

---

## 6. Web: deine UI (`web/*.tsx`)

### 6.1 Komponentenvertrag

Jede Plugin-Komponente erhält **genau eine** Prop: `ctx: PluginWebContext`
(`plugins/contracts/src/web-context.ts`).

```tsx
import type { PluginWebContext } from '@kompetenzhub/plugin-contracts';

export default function MyWidget({ ctx }: { ctx: PluginWebContext }) {
  // ctx.apiFetch(path, init)  → ruft NUR Endpunkte DEINES Plugins (/plugins/<id><path>)
  // ctx.t(key, fallback)      → Plugin-Übersetzung (plugin.<id>.*)
  // ctx.user                  → { id, roles }
  // ctx.locale                → 'de' | 'fr' | 'it' | 'en'
  // ctx.slot?.context         → Slot-Kontext (nur in action/tab/widget-Slots), z. B. enrollmentId
  return <div className="card">…</div>;
}
```

**Datenfluss:** UI ruft `ctx.apiFetch('/notes', { query: { enrollmentId } })` → das geht an
deinen Server-Handler `GET /notes`. Du redest **nie** mit Core-Endpunkten.

### 6.2 Slot-Kontext nutzen (Zeilen-ID!)

Aktions- und Tab-Komponenten bekommen den Kontext der Stelle, an der sie hängen:

```tsx
const enrollmentId = String(ctx.slot?.context.enrollmentId ?? '');
const name = String(ctx.slot?.context.displayName ?? '');
```

So weiss der 📝-Button, **für welche:n Lernende:n** er Notizen anzeigt – ohne eigenes
Routing. Genau das meint „Der Extension Point übergibt dem Plugin-Button die ID der Zeile“.

### 6.3 Registrierung im Web-Registry — **automatisch (Codegen)**

Damit der Core deine Komponenten findet, müssen sie zur Build-Zeit aufgezählt werden
(Next.js/Turbopack braucht statische Import-Pfade). Das passiert **automatisch**: ein
Generator liest die Manifeste und erzeugt die Registrierung. **Du editierst weder
`registry.ts` noch `next.config.mjs`.**

Erzeugt werden (nicht von Hand bearbeiten):

- `apps/web/src/plugins/registry.generated.ts` – `pluginWebRegistry` (Seiten/Widgets/
  Komponenten/Übersetzungen aller Plugins),
- `apps/web/src/plugins/transpile-packages.generated.json` – die `transpilePackages`-Liste,
  die `next.config.mjs` einliest.

Der Generator (`scripts/generate-plugin-registry.mjs`) läuft automatisch über
`predev`/`prebuild`/`pretypecheck` von `apps/web`. Manuell:

```bash
npm run generate:plugins --workspace apps/web
```

**Verbindliche Konvention, damit das funktioniert:** Der `component`-Name im Manifest
**entspricht exakt dem Dateinamen** unter `web/<Component>.tsx`. Beispiele aus `memo`:
`"MemoButton"` → `web/MemoButton.tsx`, `"MemoOverviewPage"` → `web/MemoOverviewPage.tsx`.
Fehlt eine referenzierte Datei, **bricht der Generator mit Fehler ab** (Tippfehler werden
sofort erkannt). Übersetzungen kommen aus `i18n/<locale>.json` (de/fr/it/en), sofern
vorhanden.

**Was der Generator aus dem Manifest ableitet:**

| Manifest                                  | Registry                            |
| ----------------------------------------- | ----------------------------------- |
| `pages[].route` + `.component`            | `pages[route] = <Komponente>`       |
| `widgets[].slot` + `.component`           | `widgets[slot] = [<Komponente>, …]` |
| `actions[].component`, `tabs[].component` | `components[name] = <Komponente>`   |
| `translations` + `i18n/*.json`            | `translations[locale]`              |

> Ergebnis: **Neues Plugin anlegen → `npm install` (einmal, fürs Workspace-Linking) →
> fertig.** Keine Hand-Edits an Core-Dateien. Die generierten Dateien sind von ESLint/
> Prettier ausgenommen und werden bei jedem Build neu erzeugt.

### 6.4 Übersetzungen

`i18n/<locale>.json` enthält **flache** Schlüssel `plugin.<id>.<key>`. Im Code:
`ctx.t('plugin.memo.add', 'Hinzufügen')` (zweites Argument = Fallback). Fehlt eine Sprache,
greift automatisch Deutsch, sonst der Fallback.

---

## 7. Konfiguration, Lebenszyklus & Cleanup

- **Aktivieren/Deaktivieren/Konfigurieren/Deinstallieren** macht der Schuladmin in der
  Admin-UI (`/admin/erweiterungen`). Ein deaktiviertes Plugin liefert **keine** Beiträge
  und seine Routen sind 404.
- **`cleanup`** im Manifest beschreibt, was beim **Deinstallieren** passiert
  (`data: delete|archive`, `storage: delete|keep`, `secrets: delete`). Der Core verifiziert
  die Löschung. Plane Cleanup so, dass keine verwaisten Daten bleiben.
- **Archivierte Modulanlässe**: Im Pilot gibt es **keinen** separaten „Archiv-Hook“ für
  Plugins. Deine Daten bleiben einfach bestehen (an die `enrollmentId` gekoppelt). Ob ein
  Modulanlass archiviert ist, erkennst du an `member.classStatus` und kannst dann z. B.
  read-only schalten.

---

## 8. Bauen, installieren, prüfen

```bash
# 1) Verträge & SDK bauen (liefern Typen für dein Plugin)
npm run build:packages

# 2) Neues Workspace-Paket verlinken (nach dem Anlegen des Plugins einmal nötig)
npm install

# 3) Server deines Plugins kompilieren (server/ → dist/server/index.js)
npm run build --workspace plugins/packages/<deinPlugin>

# 4) Gesamtprüfung (die Web-Registry wird automatisch generiert: pretypecheck/prebuild)
npm run typecheck      # baut packages + generiert Registry + prüft apps
npm run lint
```

> Die Web-Registrierung (`registry.generated.ts`, `transpilePackages`) erzeugt der Codegen
> automatisch vor `dev`/`build`/`typecheck` (§6.3). Nach dem **erstmaligen** Anlegen eines
> Plugins ist `npm install` nötig, damit das Workspace-Paket verlinkt wird; danach genügt
> ein **Neustart** des Dev-Servers (Next liest `next.config.mjs` nur beim Start).

Discovery passiert beim **API-Start**: der Core scannt `plugins/packages/*/manifest.json`,
validiert und lädt `dist/server/index.js`. **Manifest-Änderungen erfordern einen
API-Neustart** (Manifeste werden beim Boot gecacht).

Aktivieren: als ADMIN unter `/admin/erweiterungen` → „Aktivieren“. Danach erscheinen
Menü/Widgets/Buttons/Tabs für berechtigte Rollen.

---

## 9. Wie `memo` jeden Erweiterungspunkt nutzt (Soll-Ist-Abgleich)

| Anforderung aus der Idee                                       | Umsetzung im `memo`                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Notiz-Symbol neben Lernenden-Namen, Overlay ohne Seitenwechsel | **Action** `MemoButton` im Slot `teacher.classMember.actions` → Modal mit `MemoPanel` |
| Kategorien (📌 To-Do / 📅 Absenz / 💬 Notiz)                   | `type`-Feld, im UI als Auswahl + Icons                                                |
| Erledigt-Haken für To-Dos                                      | `done`-Flag, Checkbox + `PATCH /notes/:id`                                            |
| Strikte ACL (nur Lehrperson des Modulanlasses)                 | Rollen-Gate `["TEACHER"]` + `ctx.core.getClassMember` je Route                        |
| Co-Leitung optional lesen/schreiben                            | `ctx.config.coTeacherAccess`                                                          |
| Lernende sehen nichts (auch nicht im Browser-Code)             | Routen `["TEACHER"]` → Lernende erreichen die API nicht                               |
| Gesamtsicht je Modulanlass (Anf. §5)                           | **Page** `MemoOverviewPage` (Menüeintrag) + `GET /notes?moduleId=`                    |
| Schnellzugriff in der Schüler-Matrix                           | **Tab** `MemoTab` im Slot `teacher.studentMatrix.tabs`                                |
| Kennzahl auf dem Dashboard                                     | **Widget** `MemoDashboardWidget` im Slot `teacher.dashboard`                          |

---

## 10. Checkliste vor dem Commit

- [ ] `pluginId` eindeutig; alle Namens-Regeln aus §3.1 erfüllt.
- [ ] Jede `apiRoute` hat ein deklariertes `capability` und passende `roles`.
- [ ] Jede Route, die mit `enrollmentId`/`moduleId` arbeitet, prüft `ctx.core`.
- [ ] Keine sensiblen Daten an Rollen ausliefern, die sie nicht sehen dürfen.
- [ ] `component`-Name im Manifest == Dateiname `web/<Component>.tsx` (Codegen-Konvention §6.3).
- [ ] Übersetzungen für de/fr/it/en vorhanden (mindestens de).
- [ ] `cleanup` deklariert; Deinstallation hinterlässt keine Daten.
- [ ] `npm run typecheck` & `npm run lint` grün (Registry wird automatisch generiert).
- [ ] **Kein** hand-geschriebener Diff in `apps/api`/`apps/web` (die generierten Dateien
      `registry.generated.ts` / `transpile-packages.generated.json` erzeugt der Codegen).

---

## 11. Prompt-Vorlage für die KI

> Kopiere den folgenden Block, ersetze die **Idee** und gib ihn samt dieser Anleitung an
> die KI.

```
Baue ein KompetenzHub-Plugin nach der Anleitung „Anleitung_Plugin_Entwicklung.md“.

HARTE REGELN:
- Lege NUR ein neues Paket unter plugins/packages/<id>/ an. Editiere KEINE Core-Datei.
  Die Web-Registrierung wird automatisch generiert (Codegen, §6.3) – Voraussetzung:
  component-Name im Manifest == Dateiname web/<Component>.tsx.
- Nutze nur die bekannten Slots (§1) und die ctx-APIs (§4.1, §5.4). Brauchst du einen
  nicht vorhandenen Slot oder eine fehlende ctx.core-Methode, dann LISTE sie separat als
  „benötigte Core-Erweiterung“ auf und baue das Plugin so weit wie möglich ohne sie.
- Jede Route mit Personenbezug muss ctx.core.getClassMember/listModuleMembers für die
  Berechtigung verwenden. Lernende dürfen sensible Daten nie erhalten (roles setzen!).

LIEFERE:
- manifest.json, package.json, tsconfig.json (Vorlage: plugins/packages/memo)
- server/index.ts (definePlugin mit Routen + ACL)
- web/*.tsx (Komponenten mit { ctx }-Prop)
- i18n/{de,fr,it,en}.json
- eine kurze Liste benötigter Core-Erweiterungen (falls vorhanden)

MEINE IDEE:
<hier deine Idee – Zweck, Rollen, Datenfelder, wo im UI es erscheinen soll>
```

---

## 12. Grenzen des Pilots (was nur der Core ändern kann)

- **Neue Slots** (z. B. Aktions-Button in einer anderen Tabelle, neuer Tab-Host): müssen
  im Core platziert und in `KNOWN_*_SLOTS` aufgenommen werden.
- **Neue `ctx.core`-Methoden** (weitere Kern-Lesezugriffe): im SDK-Vertrag + im
  `PluginCoreService` ergänzen.
- **Eigene DB-Tabellen** (`data.mode: "schema"`): noch nicht implementiert; bis dahin
  KV-Store nutzen.
- **Archiv-/Hintergrund-Hooks** pro Lebenszyklus-Ereignis: noch nicht vorhanden.

Diese Punkte sind bewusst zentralisiert: So bleibt die **Sicherheits- und Datenhoheit** im
Core, und Plugins bleiben klein, prüfbar und updatefähig.

```

```
