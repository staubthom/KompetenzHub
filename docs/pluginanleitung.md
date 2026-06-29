# Entwickler-Handbuch: Plugin-Entwicklung für KompetenzHub

> **Zielgruppe:** Lehrpersonen, Kern-Entwickler und Drittanbieter, die neue Funktionen als isolierte, updatefähige Module beisteuern möchten.
> **Das Kern-Prinzip:** Ein Plugin greift **NIE** in den Core (Kern) ein. Es läuft vollständig isoliert über deklarierte Verträge.
> Als durchgehendes Beispiel dient das mitgelieferte Plugin **`memo`**
> („Dossier- & Memo-Assistent“) unter `plugins/packages/memo/`. Jeder Abschnitt verweist
> auf die entsprechende Stelle dieses Plugins.

---

## 1. Architektur & Das wichtigste Prinzip

Die Plattform basiert in der aktuellen Pilotstufe auf **Modell A (Build-time gebündelt, Laufzeit-aktiviert)**. Der Code wird im Monorepo unter `plugins/packages/<pluginId>/` abgelegt und mitkompiliert. Die Aktivierung, Konfiguration und Datenlöschung erfolgen rein dynamisch zur Laufzeit pro Mandant (Tenant) über die Admin-Oberfläche.

### Die goldene Regel

Du editierst **keine** einzige Datei in `apps/api` oder `apps/web`. Jede Interaktion mit dem Kern geschieht ausschliesslich über drei Verträge:

1. Das **Manifest** (`manifest.json`) – Deklaration von Beiträgen, Rechten und Ressourcen.
2. Das **Server-Modul** (`server/index.ts`) – Backend-Logik gegen eine strikt gescopte API.
3. **Web-Komponenten** (`web/*.tsx`) – Benutzeroberfläche, die über feste Erweiterungspunkte (Slots) injiziert wird.

Der Core stellt dafür feste **Erweiterungspunkte** bereit (Menü, Seiten, Widgets,
Aktions-Buttons, Tabs) und eine **gescopte Laufzeit-API**. Mehr kann (und soll) ein Plugin
nicht. Das hält Schul-Daten sicher und Plugins updatefähig.

> **Wenn dir ein Erweiterungspunkt fehlt:** Dann ist das eine Core-Aufgabe (neuer Slot /
> neue `ctx.core`-Methode). Plugins können solche Punkte nicht selbst schaffen. Liste sie
> separat auf – sie müssen einmalig im Core ergänzt werden.

---

## 2. Dateistruktur eines Plugins

Jedes Plugin muss exakt der folgenden Struktur entsprechen. Unvollständige oder falsch benannte Strukturen werden vom System-Validator abgewiesen. Eine Vorlage gibt es unter /plugins/packages/\_example

```
plugins/packages/<deinPlugin>/
├── manifest.json          # Pflicht – Der Installations- und Sicherheitsvertrag
├── package.json           # Name: @kompetenzhub/plugin-<id>, baut server/ nach dist/
├── tsconfig.json          # Kompiliert NUR server/** (CommonJS) nach dist/
├── server/
│   └── index.ts           # Backend-Logik via definePlugin({ routes })
├── web/
│   ├── <Component>.tsx    # UI-Komponenten (Namen müssen exakt dem Manifest entsprechen)
│   └── …
└── i18n/
    ├── de.json            # Flache Übersetzungsdateien (Namespace: plugin.<id>.*)
    ├── fr.json
    ├── it.json
    └── en.json

```

---

## 3. Das Manifest (`manifest.json`)

Das Manifest ist die Vertrauensbasis des Plugins. Es wird beim Build und beim Systemstart mittels **Zod** streng validiert. Fehler führen zum sofortigen Ausschluss des Plugins.

### 3.1 Harte Namens- und Validierungsregeln

- **`pluginId`**: Muss der Regex `^[a-z][a-z0-9-]{2,40}$` entsprechen. Sie ist global eindeutig und unveränderlich.
- **`capabilities`**: Jedes deklarierte Recht muss dem Format `plugin:<pluginId>:<scope>` folgen (z. B. `plugin:attendance:manage`).
- **`nav[].href`**: Muss zwingend unter `/plugins/<pluginId>` liegen.
- **`translations.namespaces`**: Müssen exakt mit `plugin.<pluginId>` beginnen.
- **`storage.prefixes`**: Falls genutzt, müssen sie mit `plugins/<pluginId>/` starten.
- **Komponenten-Mapping**: Der Wert des Feldes `"component"` im Manifest muss **exakt buchstabengetreu** dem Dateinamen unter `web/<Component>.tsx` entsprechen.

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

---

## 4. Zulässige Erweiterungspunkte (Slots)

Plugins können ihre UI nur an Orten einhängen, die der Core explizit freigibt. Folgende Tabellen- und Slot-Namen sind in der `KNOWN_*`-Allowlist fest verankert:

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
> verfügbare Menge. Neue Slots = Core-Änderung können aber gemacht werden.

---

## 5. Backend-Entwicklung (`server/index.ts`)

Das Backend wird framework-neutral über die Funktion `definePlugin` implementiert.

### 5.1 Routen-Deklaration & Fehlerbehandlung

Die Routen-Schlüssel müssen exakt dem Schema `"METHODE /pfad"` entsprechen – synchron zum Manifest. Verwende für HTTP-Fehlermeldungen ausschliesslich die SDK-Helfer, damit diese korrekt gemappt werden.

```ts
import { definePlugin, badRequest, forbidden, notFound } from '@kompetenzhub/plugin-sdk';

export default definePlugin({
  routes: {
    'GET /sessions': async (ctx, req) => {
      // Zugriff auf Query-Parameter: req.query
      const classId = req.query.classId ? String(req.query.classId) : null;
      if (!classId) throw badRequest('Missing classId');

      const sessions = await ctx.data.list('sessions');
      return sessions; // Automatische JSON-Serialisierung (200 OK)
    },

    'POST /sessions': async (ctx, req) => {
      const { date, classId } = req.body;
      const newSession = { id: crypto.randomUUID(), date, classId };

      await ctx.data.put('sessions', newSession.id, newSession);
      await ctx.audit('session.created', { id: newSession.id });

      return newSession;
    },
  },
});
```

Wichtig zu component: Der String ("MemoButton" usw.) ist der Name, unter dem du die Komponente im Web-Registry registrierst. Er muss exakt übereinstimmen.

roles ist die grobe Sichtbarkeits-/Zugriffsstufe (welche Kernrolle den Beitrag sieht bzw. die Route aufrufen darf). Feinere Berechtigungen (z. B. „nur Lehrperson DIESES Modulanlasses“) prüfst du selbst im Server-Handler über ctx.core.

### 5.2 Die gescopte Kontext-API (`ctx`)

Plugins haben keinen direkten Zugriff auf den globalen `PrismaClient` oder den `S3Service`. Alle Aktionen laufen über den gescopten `ServerContext` (`ctx`), welcher die Mandantentrennung (Tenant Isolation) automatisch auf Datenbankebene erzwingt.

| Methode / Eigenschaft      | Beschreibung                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `ctx.pluginId`             | Die ID deines Plugins (schreibgeschützt).                                                        |
| `ctx.tenant.id`            | Die ID des ausführenden Schul-Mandanten (fälschungssicher).                                      |
| `ctx.user`                 | Enthält `{ id, roles, locale }` des angemeldeten Benutzers.                                      |
| `ctx.data`                 | Zugriff auf den Key-Value-Store: `get`, `list`, `put`, `delete` (limitiert auf `collections`).   |
| `ctx.secrets.get(key)`     | Liefert den entschlüsselten Wert eines im Manifest deklarierten Secrets.                         |
| `ctx.storage`              | Gescopter S3-Dateizugriff, hart limitiert auf das Verzeichnis `plugins/<id>/<tenantId>/`.        |
| `ctx.http(url, init)`      | Ein gekapseltes `fetch`. Erlaubt Verbindungen **nur** zu Zielen in `integrations.outboundHosts`. |
| `ctx.audit(event, detail)` | Schreibt einen manipulationssicheren Eintrag in das zentrale Audit-Log der Schule.               |
| `ctx.core`                 | **Schreibgeschützte Lesefassade** auf die Stammdaten des Kerns zwecks Berechtigungsprüfung.      |

### 5.2.1 Warum Plugins (noch) keine E-Mails versenden können

In der obigen Tabelle fehlt bewusst ein `ctx.mail`. **Plugins können derzeit keine
E-Mails über das Schul-Mailsystem versenden** – und das ist eine Design-Entscheidung,
kein Versehen:

- **Isolationsprinzip.** Ein Plugin sieht nie den `PrismaClient`, den `S3Service` – und
  eben auch nicht den Kern-`MailService`. Jede Fähigkeit muss als **explizit gescopte,
  vom Core implementierte** Schnittstelle in den `ctx` gehängt werden. Solange das nicht
  geschehen ist, gibt es schlicht keinen Weg zum Versand.
- **Missbrauchs- und Spam-Risiko.** E-Mail ist ein Ausgangskanal nach aussen. Ein
  ungescopter Versand würde es einem Plugin erlauben, beliebige Adressen anzuschreiben
  (Spam, Phishing über die Schul-Absenderdomain). Ein Eingriffspunkt bräuchte daher harte
  Leitplanken: Empfänger-Begrenzung (z. B. nur Tenant-Mitglieder), Rate-Limit/Quota pro
  Mandant und eine Admin-Freigabe beim Aktivieren.
- **Datenschutz.** Empfängeradressen sind Personendaten. Ein Plugin soll nicht
  unkontrolliert E-Mail-Adressen der Schule abgreifen oder nach aussen tragen können.
- **Keine Umgehung der Schul-Einstellungen.** Der Kern-Mailversand respektiert SMTP-Konfig,
  No-op ohne Mailserver, die **vom Schuladmin anpassbaren Vorlagen** sowie das **Opt-out**
  der Nutzer:innen. Ein direkter Plugin-Versand würde diese Garantien aushebeln.

**Der einzige heute mögliche Weg** ist der Umweg über `ctx.http` zu einem **externen**
Mail-Dienst (z. B. eine eigene API) – aber nur, wenn der Host im Manifest unter
`integrations.outboundHosts` deklariert ist und das Plugin **eigene** Zugangsdaten über
`ctx.secrets` mitbringt. Das läuft dann komplett am Schul-Mailsystem vorbei und liegt in
der Verantwortung des Plugin-Anbieters.

> **Fazit:** „Versand über das Schul-Mailsystem“ ist eine **Core-Aufgabe**. Es bräuchte
> einen neuen, abgesicherten Eingriffspunkt (`ctx.mail`) inkl. Empfänger-Policy, Quota und
> Admin-Permission – analog zur Logik in Abschnitt 1 („Wenn dir ein Erweiterungspunkt
> fehlt“). Bis dahin ist der Mailversand dem Kern vorbehalten.

### 5.3 Datenhaltung: der Key-Value (KV) Store

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

## 6. Sicherheit & Berechtigungen (Pflichtlektüre)

### 6.1 Rollen-Gate (grob, durch den Core)

`apiRoutes[].roles` entscheidet, **wer die Route überhaupt aufrufen darf**. Beispiel
`memo`: alle Routen sind `["TEACHER"]`. **Lernende erreichen die Endpunkte damit gar
nicht** – der Core blockt sie vor deinem Handler (404/403). So gelangen private Daten nie
in den Browser eines Lernenden.

### 6.2 Aktivierung & Capability (durch den Core)

Eine Route ist nur erreichbar, wenn (a) das Plugin im Tenant **aktiviert** ist und (b) die
Route ein im Manifest **deklariertes Capability** trägt. Sonst: 404 (nicht enumerierbar).

### 6.3 Mandantentrennung (automatisch)

KV-Daten, Secrets und Storage sind **immer** auf den aufrufenden Tenant gescopt. Du musst
nichts tun – aber du darfst dich auch nicht darauf verlassen, dass „nur ein Tenant“
existiert.

### 6.4 **Kontext-ACL über `ctx.core`** (deine Verantwortung)

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

### 6.5 Konfigurierbare Feinrechte über `ctx.config`

Der Schuladmin kann pro Tenant eine JSON-Konfiguration setzen (Admin-UI → Erweiterungen →
Konfigurieren). Sie steht als `ctx.config` bereit. `memo` nutzt z. B.
`config.coTeacherAccess` (`"write" | "read" | "none"`), um Co-Leitungen Lese-/Schreibrechte
zu geben:

```ts
const access = ctx.config.coTeacherAccess ?? 'write';
if (member.teacherRelation === 'coTeacher' && access === 'none') throw forbidden();
```

---

## 7. Web: deine UI (`web/*.tsx`)

### 7.1 Komponentenvertrag

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

### 7.2 Slot-Kontext nutzen (Zeilen-ID!)

Aktions- und Tab-Komponenten bekommen den Kontext der Stelle, an der sie hängen:

```tsx
const enrollmentId = String(ctx.slot?.context.enrollmentId ?? '');
const name = String(ctx.slot?.context.displayName ?? '');
```

So weiss der 📝-Button, **für welche:n Lernende:n** er Notizen anzeigt – ohne eigenes
Routing. Genau das meint „Der Extension Point übergibt dem Plugin-Button die ID der Zeile“.

### 7.3 Registrierung im Web-Registry — **automatisch (Codegen)**

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

### 7.4 Übersetzungen

`i18n/<locale>.json` enthält **flache** Schlüssel `plugin.<id>.<key>`. Im Code:
`ctx.t('plugin.memo.add', 'Hinzufügen')` (zweites Argument = Fallback). Fehlt eine Sprache,
greift automatisch Deutsch, sonst der Fallback.

---

## 8. Lebenszyklus & Daten-Cleanup

Wenn ein Schul-Administrator ein Plugin deinstalliert, verlangt die Plattform einen deterministischen **Cleanup-Nachweis**. Das Verhalten wird deklarativ im Manifest gesteuert (`cleanup`-Objekt).

Der `PluginLifecycleService` führt bei einer Deinstallation folgende Schritte automatisiert aus:

1. Prüfen, ob das Plugin für den Mandanten deaktiviert (`disabled`) ist.
2. Löschen aller Einträge in der Tabelle `PluginSecret` für diesen Tenant.
3. Vollständiges Löschen des S3-Ordner-Prefixes `plugins/<pluginId>/<tenantId>/`.
4. Verarbeitung der `PluginRecord`-Tabelle (KV-Daten):

- Bei `"data": "delete"`: Radikales `deleteMany` auf der DB.
- Bei `"data": "archive"`: Export der Daten als JSON-Archiv nach S3, anschliessend Löschung aus der operativen Tabelle.

5. **Nachweis-Verifikation:** Das System zählt alle verbliebenen Records mit deiner `pluginId`. Ist die Summe ungleich Null, schlägt die Deinstallation fehl (`plugin.uninstall.incomplete`).

---

## 9. Build-, Test- und Prüf-Befehle

Führe vor jedem Commit die Validierungskette lokal in der CLI aus. Das Codegen-Skript fängt fehlerhafte Manifeste bereits vor dem eigentlichen Kompilieren ab.

```bash
# 1. Verträge und Typdefinitionen bauen
npm run build:packages

# 2. Neues Workspace-Paket im Monorepo registrieren (nur nach der Neuanlage nötig)
npm install

# 3. Nur das Server-Backend des eigenen Plugins kompilieren
npm run build --workspace plugins/packages/<deinPlugin>

# 4. Gesamtes Projekt prüfen (generiert die Web-Registry automatisch)
npm run typecheck
npm run lint

```

---

## 10. QS-Checkliste für den Entwickler (Definition of Done)

Vor dem Erstellen eines Pull Requests müssen alle Punkte dieser Checkliste mit **Ja** beantwortet werden können:

- [ ] Erfüllt die `pluginId` die Namenskonvention (`^[a-z][a-z0-9-]{2,40}$`)?
- [ ] Werden alle API-Routen durch ein deklariertes `capability` geschützt und sind die Rollen passend eingeschränkt?
- [ ] Wird auf jeder Backend-Route, die IDs verarbeitet, die Autorisierung mittels `ctx.core.getClassMember` oder `listModuleMembers` validiert?
- [ ] Stimmen die Gehäuse- und Dateinamen der UI-Komponenten exakt mit den `"component"`-Strings im Manifest überein?
- [ ] Sind flache i18n-Dateien vorhanden und beginnen alle Schlüssel mit `plugin.<pluginId>.`?
- [ ] Wurden Core-Dateien in `apps/api` oder `apps/web` modifiziert? (Sollte **Nein** sein!)
- [ ] Läuft `npm run typecheck` ohne Fehler durch?
