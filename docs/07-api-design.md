# 07 – API-Design

REST über HTTPS, JSON. Basis-Pfad `/api/v1`. Auth via Bearer-JWT (Session aus OIDC).
Fehler im Format RFC 7807 (`application/problem+json`). Pagination via `?page=&pageSize=`.

## 1. Konventionen

- Ressourcen in `kebab-case`, Plural.
- Standard-Methoden: `GET` (lesen), `POST` (erstellen), `PATCH` (ändern), `DELETE` (löschen).
- Alle Endpunkte sind tenant-gescoped (aus Token abgeleitet).
- RBAC-Guard pro Endpoint (siehe [02](./02-rollen-und-use-cases.md)).

## 2. Endpoint-Übersicht

### Auth & User

| Methode | Pfad           | Beschreibung              | Rolle |
| ------- | -------------- | ------------------------- | ----- |
| GET     | `/auth/me`     | aktuelles Profil + Rollen | alle  |
| POST    | `/auth/logout` | abmelden                  | alle  |

### Module & Matrix

| Methode          | Pfad                        | Beschreibung                        | Rolle           |
| ---------------- | --------------------------- | ----------------------------------- | --------------- |
| GET/POST         | `/modules`                  | Module listen/erstellen             | teacher         |
| GET/PATCH/DELETE | `/modules/:id`              | Modul-Detail                        | teacher         |
| GET/POST         | `/modules/:id/action-goals` | Handlungsziele                      | teacher         |
| GET              | `/modules/:id/matrix`       | Matrix abrufen                      | teacher/student |
| POST             | `/matrices/:id/bands`       | Kompetenzband anlegen               | teacher         |
| PATCH/DELETE     | `/bands/:id`                | Band ändern (inkl. weight, HZ-Refs) | teacher         |
| PUT              | `/fields/:id/descriptor`    | Deskriptor setzen                   | teacher         |
| POST             | `/matrices/:id/duplicate`   | Matrix duplizieren                  | teacher         |
| POST             | `/matrices/:id/validate`    | 80%/HZ-Regeln prüfen                | teacher         |

### Kompetenznachweise

| Methode          | Pfad                   | Beschreibung                       | Rolle   |
| ---------------- | ---------------------- | ---------------------------------- | ------- |
| GET/POST         | `/evidence`            | Nachweise listen/erstellen         | teacher |
| GET/PATCH/DELETE | `/evidence/:id`        | Detail (inkl. Sichtbarkeit, dueAt) | teacher |
| PUT              | `/evidence/:id/fields` | Kompetenzfeld-Zuordnung            | teacher |
| PUT              | `/evidence/:id/rubric` | Bewertungsraster setzen            | teacher |

### Klassen

| Methode           | Pfad                       | Beschreibung                      | Rolle   |
| ----------------- | -------------------------- | --------------------------------- | ------- |
| GET/POST          | `/classes`                 | Klassen                           | teacher |
| GET/PATCH/DELETE  | `/classes/:id`             | Detail                            | teacher |
| PUT               | `/classes/:id/matrices`    | Matrizen zuordnen                 | teacher |
| POST              | `/classes/:id/join-codes`  | Code generieren                   | teacher |
| POST              | `/classes/join`            | per Code beitreten `{ code }`     | student |
| GET               | `/classes/:id/enrollments` | Mitglieder                        | teacher |
| POST/PATCH/DELETE | `/classes/:id/enrollments` | manuell hinzufügen/ändern/löschen | teacher |

### Einreichungen & Bewertung

| Methode | Pfad                                    | Beschreibung                      | Rolle           |
| ------- | --------------------------------------- | --------------------------------- | --------------- |
| GET     | `/students/me/matrix?classId=`          | eigene Matrix mit Status          | student         |
| POST    | `/evidence/:id/submissions`             | Einreichung starten/aktualisieren | student         |
| POST    | `/submissions/:id/files`                | presigned Upload anfordern        | student         |
| PATCH   | `/submissions/:id/files/:fileId`        | Upload bestätigen                 | student         |
| POST    | `/submissions/:id/submit`               | einreichen                        | student         |
| GET     | `/submissions/:id`                      | Detail (inkl. Files, Eval)        | teacher/student |
| POST    | `/submissions/:id/evaluation`           | bewerten (Punkte/Level/Feedback)  | teacher         |
| POST    | `/submissions/:id/reject`               | zurückweisen `{ reason }`         | teacher         |
| POST    | `/submissions/:id/ai-assessment`        | KI-Vorschlag anfordern            | teacher         |
| POST    | `/submissions/:id/ai-assessment/accept` | KI-Vorschlag übernehmen           | teacher         |

### Lernpfad

| Methode  | Pfad                                  | Beschreibung     | Rolle   |
| -------- | ------------------------------------- | ---------------- | ------- |
| GET/POST | `/matrices/:id/learning-paths`        | Lernpfade        | teacher |
| PUT      | `/learning-paths/:id/steps`           | Schritte ordnen  | teacher |
| GET      | `/students/me/learning-path?classId=` | Lernpfad-Ansicht | student |

### KI & Fachgespräch

| Methode | Pfad                        | Beschreibung                          | Rolle           |
| ------- | --------------------------- | ------------------------------------- | --------------- |
| GET/PUT | `/ai-config`                | eigene KI-Konfig                      | teacher         |
| POST    | `/ai-config/test`           | Verbindung testen                     | teacher         |
| POST    | `/evidence/:id/expert-talk` | Session starten (practice/assessment) | student         |
| POST    | `/expert-talk/:id/messages` | Nachricht senden (Stream)             | student         |
| GET     | `/expert-talk/:id`          | Verlauf einsehen                      | teacher/student |

### Dashboard & Export

| Methode | Pfad                                   | Beschreibung                        | Rolle   |
| ------- | -------------------------------------- | ----------------------------------- | ------- |
| GET     | `/classes/:id/dashboard`               | Fortschritt aggregiert              | teacher |
| GET     | `/classes/:id/dashboard/:enrollmentId` | Drilldown                           | teacher |
| GET     | `/dashboard/grades.csv`                | Notenexport                         | teacher |
| POST    | `/matrices/:id/export`                 | Matrix-Paket erzeugen               | teacher |
| POST    | `/matrices/import`                     | Matrix-Paket importieren            | teacher |
| POST    | `/classes/:id/export`                  | Klassen-Archiv erzeugen (async Job) | teacher |
| POST    | `/classes/import`                      | Klassen-Archiv importieren          | teacher |

## 3. Beispiel-Payloads

### Nachweis erstellen

```jsonc
POST /api/v1/evidence
{
  "title": { "de": "Dockerfile erstellen" },
  "type": "upload_ai",
  "fieldIds": ["<fieldId-A1I>"],
  "maxPoints": 10,
  "targetLevel": "intermediate",
  "isVisible": true,
  "dueAt": "2026-03-15T23:59:00+01:00",
  "evaluationMode": "rubric",
  "config": { "aiPrompt": "Bewerte das Dockerfile auf Best Practices ..." }
}
```

### Bewerten

```jsonc
POST /api/v1/submissions/<id>/evaluation
{ "achievedLevel": "advanced", "points": 9.5, "feedback": "Sauber strukturiert." }
```

### Beitreten

```jsonc
POST /api/v1/classes/join
{ "code": "AB12CD" }
```

### Fehlerformat (RFC 7807)

```jsonc
{
  "type": "https://errors.app/validation",
  "title": "Validation failed",
  "status": 400,
  "errors": [{ "field": "code", "message": "Join code expired" }],
}
```
