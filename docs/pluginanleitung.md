# Entwickler-Handbuch: Plugin-Entwicklung für KompetenzHub

> **Zielgruppe:** Lehrpersonen, Kern-Entwickler und Drittanbieter, die neue Funktionen als isolierte, updatefähige Module beisteuern möchten.
> **Das Kern-Prinzip:** Ein Plugin greift **NIE** in den Core (Kern) ein. Es läuft vollständig isoliert über deklarierte Verträge.

---

## 1. Architektur & Das wichtigste Prinzip

Die Plattform basiert in der aktuellen Pilotstufe auf **Modell A (Build-time gebündelt, Laufzeit-aktiviert)**. Der Code wird im Monorepo unter `plugins/packages/<pluginId>/` abgelegt und mitkompiliert. Die Aktivierung, Konfiguration und Datenlöschung erfolgen rein dynamisch zur Laufzeit pro Mandant (Tenant) über die Admin-Oberfläche.

### Die goldene Regel

Du editierst **keine** einzige Datei in `apps/api` oder `apps/web`. Jede Interaktion mit dem Kern geschieht ausschliesslich über drei Verträge:

1. Das **Manifest** (`manifest.json`) – Deklaration von Beiträgen, Rechten und Ressourcen.
2. Das **Server-Modul** (`server/index.ts`) – Backend-Logik gegen eine strikt gescopte API.
3. **Web-Komponenten** (`web/*.tsx`) – Benutzeroberfläche, die über feste Erweiterungspunkte (Slots) injiziert wird.

---

## 2. Dateistruktur eines Plugins

Jedes Plugin muss exakt der folgenden Struktur entsprechen. Unvollständige oder falsch benannte Strukturen werden vom System-Validator abgewiesen. Eine Vorlage gibt es unter /plugins/packages/_example

```
plugins/packages/<deinPlugin>/
├── manifest.json          # Pflicht – Der Installations- und Sicherheitsvertrag
├── package.json           # Name: @kompetenzhub/plugin-<id>, baut server/ nach dist/
├── tsconfig.json          # Kompiliert NUR server/** (CommonJS) nach dist/
├── server/
│   └── index.ts           # Backend-Logik via definePlugin({ routes })
├── web/
│   ├── <Component>.tsx    # UI-Komponenten (Namen müssen exakt dem Manifest entsprechen)
│   
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

* **`pluginId`**: Muss der Regex `^[a-z][a-z0-9-]{2,40}$` entsprechen. Sie ist global eindeutig und unveränderlich.
* **`capabilities`**: Jedes deklarierte Recht muss dem Format `plugin:<pluginId>:<scope>` folgen (z. B. `plugin:attendance:manage`).
* **`nav[].href`**: Muss zwingend unter `/plugins/<pluginId>` liegen.
* **`translations.namespaces`**: Müssen exakt mit `plugin.<pluginId>` beginnen.
* **`storage.prefixes`**: Falls genutzt, müssen sie mit `plugins/<pluginId>/` starten.
* **Komponenten-Mapping**: Der Wert des Feldes `"component"` im Manifest muss **exakt buchstabengetreu** dem Dateinamen unter `web/<Component>.tsx` entsprechen.

### 3.2 Vollständiges Referenz-Manifest

```json
{
  "schemaVersion": 1,
  "pluginId": "attendance",
  "displayName": "Anwesenheit",
  "version": "0.1.0",
  "publisher": { 
    "name": "KompetenzHub Core", 
    "url": "https://potenzialentwickler.ch" 
  },
  "license": "AGPL-3.0-or-later",
  "description": { 
    "de": "Anwesenheit pro Sitzung erfassen und auswerten.",
    "fr": "Enregistrer et évaluer la présence par session."
  },
  "core": { 
    "minVersion": "0.1.0", 
    "apiVersion": 1 
  },
  "capabilities": [
    "plugin:attendance:view", 
    "plugin:attendance:manage"
  ],
  "contributions": {
    "apiRoutes": [
      { 
        "method": "GET", 
        "path": "/sessions", 
        "capability": "plugin:attendance:view", 
        "roles": ["TEACHER"] 
      },
      { 
        "method": "POST", 
        "path": "/sessions", 
        "capability": "plugin:attendance:manage", 
        "roles": ["TEACHER"] 
      },
      { 
        "method": "POST", 
        "path": "/sessions/:id/marks", 
        "capability": "plugin:attendance:manage", 
        "roles": ["TEACHER"] 
      }
    ],
    "nav": [
      { 
        "id": "attendance", 
        "labelKey": "plugin.attendance.nav", 
        "icon": "🗓", 
        "href": "/plugins/attendance", 
        "roles": ["TEACHER"] 
      }
    ],
    "pages": [
      { 
        "route": "/", 
        "component": "AttendancePage", 
        "roles": ["TEACHER"] 
      }
    ],
    "widgets": [
      { 
        "slot": "teacher.dashboard", 
        "component": "TodayWidget", 
        "roles": ["TEACHER"] 
      }
    ]
  },
  "data": { 
    "mode": "kv", 
    "collections": ["sessions", "marks"] 
  },
  "translations": { 
    "namespaces": ["plugin.attendance"] 
  },
  "cleanup": { 
    "data": "delete", 
    "storage": "delete", 
    "secrets": "delete" 
  }
}

```

---

## 4. Zulässige Erweiterungspunkte (Slots)

Plugins können ihre UI nur an Orten einhängen, die der Core explizit freigibt. Folgende Tabellen- und Slot-Namen sind in der `KNOWN_*`-Allowlist fest verankert:

| Slot-Schlüssel | Typ | Beschreibung / Kontext-Übergabe |
| --- | --- | --- |
| `teacher.dashboard` | Widget | Haupt-Dashboard der Lehrpersonen. |
| `learner.matrix.header` | Widget | Kopfzeile der Lernenden-Matrix. |
| `teacher.classMember.actions` | Action | Tabellenzeile der Mitgliederliste. Kontext: `enrollmentId`, `moduleId`, `classId`, `displayName`. |
| `teacher.studentMatrix.tabs` | Tab | Zusätzlicher Reiter in der Schüler-Matrix. Kontext: `enrollmentId`, `moduleId`, `displayName`. |

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
    }
  }
});

```

### 5.2 Die gescopte Kontext-API (`ctx`)

Plugins haben keinen direkten Zugriff auf den globalen `PrismaClient` oder den `S3Service`. Alle Aktionen laufen über den gescopten `ServerContext` (`ctx`), welcher die Mandantentrennung (Tenant Isolation) automatisch auf Datenbankebene erzwingt.

| Methode / Eigenschaft | Beschreibung |
| --- | --- |
| `ctx.pluginId` | Die ID deines Plugins (schreibgeschützt). |
| `ctx.tenant.id` | Die ID des ausführenden Schul-Mandanten (fälschungssicher). |
| `ctx.user` | Enthält `{ id, roles, locale }` des angemeldeten Benutzers. |
| `ctx.data` | Zugriff auf den Key-Value-Store: `get`, `list`, `put`, `delete` (limitiert auf `collections`). |
| `ctx.secrets.get(key)` | Liefert den entschlüsselten Wert eines im Manifest deklarierten Secrets. |
| `ctx.storage` | Gescopter S3-Dateizugriff, hart limitiert auf das Verzeichnis `plugins/<id>/<tenantId>/`. |
| `ctx.http(url, init)` | Ein gekapseltes `fetch`. Erlaubt Verbindungen **nur** zu Zielen in `integrations.outboundHosts`. |
| `ctx.audit(event, detail)` | Schreibt einen manipulationssicheren Eintrag in das zentrale Audit-Log der Schule. |
| `ctx.core` | **Schreibgeschützte Lesefassade** auf die Stammdaten des Kerns zwecks Berechtigungsprüfung. |

---

## 6. Sicherheit & Zugriffskontrolle (ACL)

Die Sicherheit beruht auf einem zweistufigen System. Das **Rollen-Gate** des Cores blockiert unberechtigte Rollen (z. B. Schüler) vorab anhand der Manifest-Definition. Die **feingranulare Berechtigung** liegt in der Verantwortung des Plugin-Entwicklers.

### Strikte Kontext-Prüfung über `ctx.core`

Dass ein User die Rolle `TEACHER` besitzt, bedeutet nicht, dass er berechtigt ist, die Daten *jedes* Lernenden einzusehen. Jede Route, die eine personenbezogene ID (`enrollmentId`) verarbeitet, muss zwingend folgendes Muster implementieren:

```ts
'POST /sessions/:id/marks': async (ctx, req) => {
  const enrollmentId = req.body.enrollmentId;

  // 1. Hole die Kern-Daten inklusive des serverseitig berechneten Beziehungsstatus
  const member = await ctx.core.getClassMember(enrollmentId);

  // 2. Sicherheits-Guard abfragen: Hat diese Lehrperson administrativen Zugriff auf diesen Lernenden?
  if (!member || !member.teacherHasAccess) {
    throw forbidden('Sie sind nicht die Lehrperson dieses Modulanlasses.');
  }

  // 3. Optionale Auswertung feingranularer Admin-Konfigurationen (ctx.config)
  const coTeacherAccess = ctx.config.coTeacherAccess ?? 'write';
  if (member.teacherRelation === 'coTeacher' && coTeacherAccess === 'none') {
    throw forbidden('Co-Lehrpersonen haben für diesen Tenant keine Schreibrechte.');
  }

  // Datenverarbeitung
  await ctx.data.put('marks', `${req.params.id}:${enrollmentId}`, { present: req.body.present });
  return { success: true };
}

```

---

## 7. Frontend-Entwicklung (`web/*.tsx`)

Das Frontend wird in React/Next.js geschrieben. Jede Komponente erhält exakt eine Prop namens `ctx` (Typ: `PluginWebContext`).

### 7.1 Datenfluss und i18n im UI

UI-Komponenten kommunizieren **niemals** direkt mit den Endpunkten des Kerns. Sie nutzen ausschliesslich die gekapselte Fetch-Methode des Kontextes.

```tsx
import type { PluginWebContext } from '@kompetenzhub/plugin-contracts';
import { useState, useEffect } from 'react';

export default function TodayWidget({ ctx }: { ctx: PluginWebContext }) {
  const [sessions, setSessions] = useState([]);
  
  // Extraktion des Slot-Kontextes bei Tab- oder Action-Injektionen (falls vorhanden)
  const enrollmentId = ctx.slot?.context?.enrollmentId;

  useEffect(() => {
    // Ruft automatisch /api/v1/plugins/<pluginId>/sessions auf
    ctx.apiFetch('/sessions')
      .then(res => res.json())
      .then(data => setSessions(data));
  }, [ctx]);

  return (
    <div className="card p-4 bg-white shadow rounded">
      <h3 className="text-lg font-bold">
        {/* Übersetzung über den flachen JSON-Namespace */}
        {ctx.t('plugin.attendance.title', 'Heutige Sitzungen')}
      </h3>
      <p>Benutzer-Sprache: {ctx.locale}</p>
      <div className="mt-2">
        Anzahl Sitzungen: {sessions.length}
      </div>
    </div>
  );
}

```

### 7.2 Automatischer Next.js Code-Generator (Codegen)

Damit neue Plugins die Bundle-Grösse und Performance der Core-App nicht negativ beeinflussen, dürfen Web-Komponenten nicht statisch importiert werden. Die Plattform nutzt einen automatischen Build-Generator.

Der Generator (`scripts/generate-plugin-registry.mjs`) scannt alle Manifeste und erzeugt zur Build-Zeit asynchrone Dynamic Imports (`next/dynamic`):

```ts
// VOM SYSTEM GENERIERT - NICHT MANUELL EDITIEREN
import dynamic from 'next/dynamic';

export const pluginWebRegistry = {
  attendance: {
    pages: {
      '/': dynamic(() => import('@plugins/attendance/web/AttendancePage'), { ssr: true })
    }
  }
};

```

**Regel:** Bearbeite niemals die Dateien `registry.generated.ts` oder `next.config.mjs`. Erstelle einfach deine Datei in `web/` gemäss dem Namen im Manifest und starte den Dev-Server neu.

---

## 8. Lebenszyklus & Daten-Cleanup

Wenn ein Schul-Administrator ein Plugin deinstalliert, verlangt die Plattform einen deterministischen **Cleanup-Nachweis**. Das Verhalten wird deklarativ im Manifest gesteuert (`cleanup`-Objekt).

Der `PluginLifecycleService` führt bei einer Deinstallation folgende Schritte automatisiert aus:

1. Prüfen, ob das Plugin für den Mandanten deaktiviert (`disabled`) ist.
2. Löschen aller Einträge in der Tabelle `PluginSecret` für diesen Tenant.
3. Vollständiges Löschen des S3-Ordner-Prefixes `plugins/<pluginId>/<tenantId>/`.
4. Verarbeitung der `PluginRecord`-Tabelle (KV-Daten):
* Bei `"data": "delete"`: Radikales `deleteMany` auf der DB.
* Bei `"data": "archive"`: Export der Daten als JSON-Archiv nach S3, anschliessend Löschung aus der operativen Tabelle.


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

* [ ] Erfüllt die `pluginId` die Namenskonvention (`^[a-z][a-z0-9-]{2,40}$`)?
* [ ] Werden alle API-Routen durch ein deklariertes `capability` geschützt und sind die Rollen passend eingeschränkt?
* [ ] Wird auf jeder Backend-Route, die IDs verarbeitet, die Autorisierung mittels `ctx.core.getClassMember` oder `listModuleMembers` validiert?
* [ ] Stimmen die Gehäuse- und Dateinamen der UI-Komponenten exakt mit den `"component"`-Strings im Manifest überein?
* [ ] Sind flache i18n-Dateien vorhanden und beginnen alle Schlüssel mit `plugin.<pluginId>.`?
* [ ] Wurden Core-Dateien in `apps/api` oder `apps/web` modifiziert? (Sollte **Nein** sein!)
* [ ] Läuft `npm run typecheck` ohne Fehler durch?