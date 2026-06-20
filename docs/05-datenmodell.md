# 05 – Datenmodell

Dieses Dokument beschreibt das Datenmodell (Entitäten, Beziehungen, Statusmodelle). Basis ist
das [Fachkonzept](./03-fachkonzept-kompetenzmatrix.md). Zielplattform: **PostgreSQL** mit ORM
(Prisma oder TypeORM, siehe [06-Architektur](./06-architektur.md)).

---

## 1. ER-Überblick (Kern)

```mermaid
erDiagram
  Tenant ||--o{ User : "hat"
  Tenant ||--o{ Module : "besitzt"
  User ||--o{ Membership : "hat Rollen"
  Tenant ||--o{ Membership : ""

  Module ||--|| CompetenceMatrix : "hat"
  Module ||--o{ ActionGoal : "Handlungsziele"
  CompetenceMatrix ||--o{ CompetenceBand : "Bänder"
  CompetenceBand }o--o{ ActionGoal : "referenziert (n:m)"
  CompetenceBand ||--o{ CompetenceField : "B/I/A"
  CompetenceField ||--|| Descriptor : "Ich kann"

  CompetenceField }o--o{ CompetenceEvidence : "abgedeckt durch (n:m)"
  CompetenceEvidence ||--o| AssessmentRubric : "optional"
  AssessmentRubric ||--o{ RubricCriterion : ""
  RubricCriterion ||--o{ RubricIndicator : "je Gütestufe"

  Class ||--o{ ClassMatrix : ""
  CompetenceMatrix ||--o{ ClassMatrix : ""
  Class ||--o{ Enrollment : "Lernende"
  User ||--o{ Enrollment : ""
  Class ||--o{ JoinCode : ""

  CompetenceEvidence ||--o{ Submission : "Einreichungen"
  Enrollment ||--o{ Submission : ""
  Submission ||--o{ SubmissionFile : ""
  Submission ||--o| Evaluation : ""
  Submission ||--o| AiAssessment : "KI-Vorschlag"

  CompetenceMatrix ||--o{ LearningPath : ""
  LearningPath ||--o{ LearningPathStep : ""
  CompetenceField ||--o{ LearningPathStep : "referenziert"

  User ||--o| AiConfig : "pro Lehrperson"
  CompetenceEvidence ||--o{ ExpertTalkSession : "Fachgespräch"
  ExpertTalkSession ||--o{ ExpertTalkMessage : ""
```

---

## 2. Entitäten im Detail

### 2.1 Mandant & Benutzer

#### `Tenant` (Schule/Mandant)

| Feld                  | Typ         | Beschreibung                                    |
| --------------------- | ----------- | ----------------------------------------------- |
| id                    | UUID (PK)   |                                                 |
| name                  | string      | Schulname                                       |
| settings              | jsonb       | globale Einstellungen (Default-Notenskala etc.) |
| createdAt / updatedAt | timestamptz |                                                 |

#### `TenantBranding` (Schul-Branding, 1:1 zu Tenant)

Vom Admin konfigurierbares, leichtgewichtiges Branding (siehe [11-UI/UX](./11-ui-ux-konzept.md) §6.2).

| Feld           | Typ               | Beschreibung                        |
| -------------- | ----------------- | ----------------------------------- |
| id             | UUID (PK)         |                                     |
| tenantId       | FK → Tenant (1:1) |                                     |
| primaryColor   | string            | Hex-Akzentfarbe (Kontrast-geprüft)  |
| secondaryColor | string?           | optionale Akzentfarbe               |
| logoLightKey   | string?           | S3-Key Logo für helle Hintergründe  |
| logoDarkKey    | string?           | S3-Key Logo für dunkle Hintergründe |
| faviconKey     | string?           | optionales Favicon                  |
| displayName    | string?           | Schul-/App-Anzeigename              |
| updatedById    | FK → User?        | letzte Änderung durch               |
| updatedAt      | timestamptz       |                                     |

#### `User`

| Feld         | Typ                             | Beschreibung                               |
| ------------ | ------------------------------- | ------------------------------------------ |
| id           | UUID (PK)                       |                                            |
| email        | string (unique)                 |                                            |
| displayName  | string                          |                                            |
| authProvider | enum(microsoft, google)         |                                            |
| externalId   | string                          | sub/oid aus OIDC                           |
| avatarUrl    | string?                         |                                            |
| locale       | enum(de, fr, it, en)            | bevorzugte Sprache                         |
| theme        | enum(system, light, dark, gray) | bevorzugter Anzeige-Modus (Default system) |
| createdAt    | timestamptz                     |                                            |

> Hinweis: `User` ist global; Rollen/Zugehörigkeit pro Tenant via `Membership`.

#### `Membership`

| Feld     | Typ                             | Beschreibung |
| -------- | ------------------------------- | ------------ |
| id       | UUID (PK)                       |              |
| userId   | FK → User                       |              |
| tenantId | FK → Tenant                     |              |
| role     | enum(admin, teacher, student)   |              |
| status   | enum(active, invited, disabled) |              |

### 2.2 Modul & Matrix

#### `Module`

| Feld        | Typ                              | Beschreibung             |
| ----------- | -------------------------------- | ------------------------ |
| id          | UUID (PK)                        |                          |
| tenantId    | FK → Tenant                      |                          |
| ownerId     | FK → User (Lehrperson)           |                          |
| number      | string                           | z.B. „293"               |
| title       | i18n                             | mehrsprachiger Titel     |
| description | i18n                             |                          |
| profession  | string?                          | Berufsbild (INF, MED, …) |
| status      | enum(draft, published, archived) |                          |

#### `ActionGoal` (Handlungsziel)

| Feld     | Typ         | Beschreibung  |
| -------- | ----------- | ------------- |
| id       | UUID (PK)   |               |
| moduleId | FK → Module |               |
| code     | string      | z.B. „1", „2" |
| text     | i18n        | Beschreibung  |

#### `CompetenceMatrix`

| Feld     | Typ                              | Beschreibung             |
| -------- | -------------------------------- | ------------------------ |
| id       | UUID (PK)                        |                          |
| moduleId | FK → Module (1:1)                |                          |
| version  | int                              | für Export/Versionierung |
| status   | enum(draft, published, archived) |                          |

#### `CompetenceBand` (Kompetenzband)

| Feld        | Typ                   | Beschreibung                |
| ----------- | --------------------- | --------------------------- |
| id          | UUID (PK)             |                             |
| matrixId    | FK → CompetenceMatrix |                             |
| code        | string                | z.B. „A1"                   |
| description | i18n                  | thematische Zusammenfassung |
| weight      | decimal               | Gewichtung (Default 1.0)    |
| sortOrder   | int                   |                             |

#### `BandActionGoal` (n:m Band ↔ HZ)

| Feld         | Typ                 |
| ------------ | ------------------- |
| bandId       | FK → CompetenceBand |
| actionGoalId | FK → ActionGoal     |

#### `CompetenceField` (Kompetenzfeld = Band × Gütestufe)

| Feld   | Typ                                    | Beschreibung          |
| ------ | -------------------------------------- | --------------------- |
| id     | UUID (PK)                              |                       |
| bandId | FK → CompetenceBand                    |                       |
| level  | enum(beginner, intermediate, advanced) | Gütestufe             |
| code   | string                                 | generiert, z.B. „A1B" |

#### `Descriptor` (Deskriptor „Ich kann …")

| Feld    | Typ                        | Beschreibung |
| ------- | -------------------------- | ------------ |
| id      | UUID (PK)                  |              |
| fieldId | FK → CompetenceField (1:1) |              |
| text    | i18n                       | „Ich kann …" |

### 2.3 Kompetenznachweise & Bewertungsraster

#### `CompetenceEvidence` (Kompetenznachweis / Lernaufgabe)

| Feld           | Typ                                             | Beschreibung                                               |
| -------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| id             | UUID (PK)                                       |                                                            |
| title          | i18n                                            |                                                            |
| instructions   | i18n                                            | Aufgabenstellung                                           |
| type           | enum(quiz, file_upload, upload_ai, expert_talk) | Nachweistyp                                                |
| maxPoints      | decimal?                                        |                                                            |
| targetLevel    | enum(beginner, intermediate, advanced)?         | Ziel-Gütestufe                                             |
| isVisible      | boolean                                         | Sichtbarkeit                                               |
| availableFrom  | timestamptz?                                    | Freischaltung Start                                        |
| dueAt          | timestamptz?                                    | Ablaufdatum                                                |
| maxAttempts    | int?                                            | Versuche                                                   |
| evaluationMode | enum(rubric, learning_goals, points)            |                                                            |
| config         | jsonb                                           | typ-spezifisch (Quizfragen, KI-Prompt, Thema Fachgespräch) |

#### `EvidenceField` (n:m Nachweis ↔ Kompetenzfeld)

| Feld       | Typ                     |
| ---------- | ----------------------- |
| evidenceId | FK → CompetenceEvidence |
| fieldId    | FK → CompetenceField    |

#### `AssessmentRubric` (Bewertungsraster)

| Feld       | Typ                           |
| ---------- | ----------------------------- |
| id         | UUID (PK)                     |
| evidenceId | FK → CompetenceEvidence (1:1) |

#### `RubricCriterion` (Kriterium)

| Feld     | Typ                   | Beschreibung |
| -------- | --------------------- | ------------ |
| id       | UUID (PK)             |              |
| rubricId | FK → AssessmentRubric |              |
| title    | i18n                  | Zielhandlung |
| bandRef  | FK → CompetenceBand?  | Referenz     |

#### `RubricIndicator` (Indikator je Gütestufe)

| Feld        | Typ                                    | Beschreibung              |
| ----------- | -------------------------------------- | ------------------------- |
| id          | UUID (PK)                              |                           |
| criterionId | FK → RubricCriterion                   |                           |
| level       | enum(beginner, intermediate, advanced) |                           |
| text        | i18n                                   | beobachtbare Beschreibung |
| points      | decimal?                               |                           |

### 2.4 Klassen & Einschreibung

#### `Class` (Klasse)

| Feld       | Typ                    | Beschreibung   |
| ---------- | ---------------------- | -------------- |
| id         | UUID (PK)              |                |
| tenantId   | FK → Tenant            |                |
| ownerId    | FK → User (Lehrperson) |                |
| name       | string                 |                |
| year       | int?                   | Lehrjahr       |
| schoolYear | string?                | z.B. „2025/26" |
| status     | enum(active, archived) |                |

#### `ClassMatrix` (n:m Klasse ↔ Matrix)

| Feld     | Typ                   |
| -------- | --------------------- |
| classId  | FK → Class            |
| matrixId | FK → CompetenceMatrix |

#### `JoinCode` (Beitrittscode)

| Feld      | Typ             | Beschreibung |
| --------- | --------------- | ------------ |
| id        | UUID (PK)       |              |
| classId   | FK → Class      |              |
| code      | string (unique) | kurzer Code  |
| expiresAt | timestamptz?    |              |
| isActive  | boolean         |              |

#### `Enrollment` (Einschreibung Lernende:r in Klasse)

| Feld        | Typ                            | Beschreibung                |
| ----------- | ------------------------------ | --------------------------- |
| id          | UUID (PK)                      |                             |
| classId     | FK → Class                     |                             |
| userId      | FK → User?                     | null bei manuell ohne Login |
| displayName | string                         |                             |
| status      | enum(active, pending, removed) |                             |
| joinedAt    | timestamptz                    |                             |

### 2.5 Einreichungen & Bewertungen

#### `Submission` (Einreichung)

| Feld         | Typ                                                         | Beschreibung                   |
| ------------ | ----------------------------------------------------------- | ------------------------------ |
| id           | UUID (PK)                                                   |                                |
| evidenceId   | FK → CompetenceEvidence                                     |                                |
| enrollmentId | FK → Enrollment                                             |                                |
| attempt      | int                                                         | Versuchsnummer                 |
| status       | enum(open, submitted, in_review, graded, rejected, expired) |                                |
| content      | jsonb                                                       | Quiz-Antworten / Textantworten |
| submittedAt  | timestamptz?                                                |                                |

#### `SubmissionFile` (hochgeladene Datei)

| Feld         | Typ             | Beschreibung       |
| ------------ | --------------- | ------------------ |
| id           | UUID (PK)       |                    |
| submissionId | FK → Submission |                    |
| storageKey   | string          | S3-Objektschlüssel |
| fileName     | string          |                    |
| mimeType     | string          |                    |
| sizeBytes    | bigint          |                    |

#### `Evaluation` (Bewertung durch Lehrperson)

| Feld                  | Typ                                              | Beschreibung |
| --------------------- | ------------------------------------------------ | ------------ |
| id                    | UUID (PK)                                        |              |
| submissionId          | FK → Submission (1:1)                            |              |
| evaluatorId           | FK → User                                        |              |
| achievedLevel         | enum(not_met, beginner, intermediate, advanced)? |              |
| points                | decimal?                                         |              |
| feedback              | text                                             |              |
| rejectionReason       | text?                                            |              |
| createdAt / updatedAt | timestamptz                                      |              |

#### `AiAssessment` (KI-Bewertungsvorschlag)

| Feld            | Typ             | Beschreibung            |
| --------------- | --------------- | ----------------------- |
| id              | UUID (PK)       |                         |
| submissionId    | FK → Submission |                         |
| suggestedLevel  | enum?           |                         |
| suggestedPoints | decimal?        |                         |
| feedback        | text            | KI-Feedback             |
| rawResponse     | jsonb           | vollständige KI-Antwort |
| model           | string          | verwendetes Modell      |
| createdAt       | timestamptz     |                         |
| acceptedBy      | FK → User?      | wenn übernommen         |

### 2.6 Lernpfad

#### `LearningPath`

| Feld        | Typ                   |
| ----------- | --------------------- |
| id          | UUID (PK)             |
| matrixId    | FK → CompetenceMatrix |
| title       | i18n                  |
| isPublished | boolean               |

#### `LearningPathStep`

| Feld               | Typ                    | Beschreibung            |
| ------------------ | ---------------------- | ----------------------- |
| id                 | UUID (PK)              |                         |
| pathId             | FK → LearningPath      |                         |
| fieldId            | FK → CompetenceField   | referenzierte Kompetenz |
| sortOrder          | int                    | Reihenfolge             |
| prerequisiteStepId | FK → LearningPathStep? | optionale Voraussetzung |

### 2.7 KI-Konfiguration & Fachgespräch

#### `AiConfig` (pro Lehrperson)

| Feld                 | Typ                    | Beschreibung          |
| -------------------- | ---------------------- | --------------------- |
| id                   | UUID (PK)              |                       |
| ownerId              | FK → User (1:1)        |                       |
| baseUrl              | string                 | OpenAI-kompatible URL |
| apiKey               | string (verschlüsselt) | Token                 |
| model                | string                 |                       |
| temperature          | decimal                |                       |
| extraParams          | jsonb                  | weitere Parameter     |
| enabledForGrading    | boolean                |                       |
| enabledForExpertTalk | boolean                |                       |

#### `ExpertTalkSession` (Fachgespräch)

| Feld                   | Typ                        | Beschreibung       |
| ---------------------- | -------------------------- | ------------------ |
| id                     | UUID (PK)                  |                    |
| evidenceId             | FK → CompetenceEvidence    |                    |
| enrollmentId           | FK → Enrollment            |                    |
| mode                   | enum(practice, assessment) | üben oder Prüfung  |
| topic                  | i18n                       | vorgegebenes Thema |
| status                 | enum(running, finished)    |                    |
| startedAt / finishedAt | timestamptz                |                    |

#### `ExpertTalkMessage`

| Feld      | Typ                    | Beschreibung |
| --------- | ---------------------- | ------------ |
| id        | UUID (PK)              |              |
| sessionId | FK → ExpertTalkSession |              |
| role      | enum(ai, student)      |              |
| content   | text                   |              |
| createdAt | timestamptz            |              |

### 2.8 Audit & Nachvollziehbarkeit (FA-65)

> **Anforderung FA-65 (MUSS):** Bewertungshistorie/Audit – _wer, wann, was_ – nachvollziehbar
> und revisionssicher. Umsetzung über zwei **append-only** Tabellen (keine Updates/Deletes):
> eine fachliche **Bewertungshistorie** und ein generisches **Audit-Log**.

#### `EvaluationHistory` (Bewertungshistorie, append-only)

Jede Änderung an einer `Evaluation` (Anlegen, Override, Rückweisung, KI-Übernahme) erzeugt
einen unveränderlichen Snapshot.

| Feld          | Typ                                                     | Beschreibung                    |
| ------------- | ------------------------------------------------------- | ------------------------------- |
| id            | UUID (PK)                                               |                                 |
| submissionId  | FK → Submission                                         |                                 |
| evaluationId  | FK → Evaluation                                         |                                 |
| changedById   | FK → User                                               | wer die Änderung vornahm        |
| changeType    | enum(created, updated, override_ai, rejected, reopened) | Art der Änderung                |
| achievedLevel | enum(not_met, beginner, intermediate, advanced)?        | Wert nach Änderung              |
| points        | decimal?                                                | Wert nach Änderung              |
| feedback      | text?                                                   | Wert nach Änderung              |
| source        | enum(teacher, ai)                                       | Herkunft des Werts              |
| diff          | jsonb?                                                  | Vorher/Nachher-Delta (optional) |
| createdAt     | timestamptz                                             | Zeitpunkt (immutable)           |

#### `AuditLog` (generisches Audit, append-only)

Protokolliert sicherheits-/datenschutzrelevante Aktionen (Login, Export, Löschung,
Sichtbarkeitsänderung, KI-Aufruf) – tenant-bezogen.

| Feld       | Typ         | Beschreibung                                                     |
| ---------- | ----------- | ---------------------------------------------------------------- |
| id         | UUID (PK)   |                                                                  |
| tenantId   | FK → Tenant |                                                                  |
| actorId    | FK → User?  | handelnde Person (null = System)                                 |
| action     | string      | z.B. „login", „submission.grade", „class.export", „class.delete" |
| entityType | string      | betroffene Entität (z.B. „Submission")                           |
| entityId   | UUID?       | betroffene Instanz                                               |
| metadata   | jsonb?      | Kontext (IP, alte/neue Werte, Begründung)                        |
| createdAt  | timestamptz | Zeitpunkt (immutable)                                            |

> **Revisionssicherheit:** Append-only erzwingen (DB-Trigger/Berechtigungen verbieten
> UPDATE/DELETE); Aufbewahrung gemäss Schul-Vorgaben; bei Tenant-/Klassen-Löschung wird das
> Audit-Log gemäss DSG-Vorgaben separat behandelt (Archiv statt Hard-Delete).

---

## 3. Mehrsprachigkeit (`i18n`-Felder)

Übersetzbare Texte werden als **JSONB** gespeichert (pragmatisch) oder als separate
`Translation`-Tabelle (normalisiert). Empfehlung MVP: **JSONB** je Feld.

```jsonc
// Beispiel i18n-Feld "title"
{
  "de": "Container-Umgebung definieren",
  "fr": "Définir l'environnement de conteneur",
  "it": "Definire l'ambiente del container",
  "en": "Define the container environment",
}
```

> Alternative (Vollausbau): Tabelle `Translation(entityType, entityId, field, locale, text)`
> für Volltextsuche und Teil-Übersetzungen.

---

## 4. Bewertung & Noten (Berechnungslogik)

### Strategie (konfigurierbar pro Tenant/Modul)

1. **Gütestufen-Mapping** (Default ICT-BBCH): `beginner=3.0`, `intermediate=4.5`, `advanced=6.0`.
2. **Punktebasiert**: Punkte je Nachweis → Schwellen → Note.
3. **Mischform**.

### Aggregation (Beispiel Gütestufen-Mapping)

```
proBand_note   = noteAusErreichterGütestufe(band)
modulNote      = Σ(proBand_note × band.weight) / Σ(band.weight)
```

### Settings-Beispiel (`Tenant.settings` / `Module`-Override)

```jsonc
{
  "gradingStrategy": "level_mapping",
  "levelGrades": { "not_met": 1.0, "beginner": 3.0, "intermediate": 4.5, "advanced": 6.0 },
  "rounding": 0.1,
}
```

---

## 5. Indizes & Constraints (Auswahl)

| Tabelle           | Index/Constraint                                                      |
| ----------------- | --------------------------------------------------------------------- |
| User              | unique(email), unique(authProvider, externalId)                       |
| JoinCode          | unique(code), Index(classId, isActive)                                |
| Membership        | unique(userId, tenantId, role)                                        |
| CompetenceField   | unique(bandId, level)                                                 |
| Descriptor        | unique(fieldId)                                                       |
| Submission        | Index(evidenceId, enrollmentId, attempt)                              |
| Enrollment        | unique(classId, userId)                                               |
| EvaluationHistory | Index(submissionId, createdAt) – append-only                          |
| AuditLog          | Index(tenantId, createdAt), Index(entityType, entityId) – append-only |

---

## 6. Soft-Delete & Archivierung

- Klassen/Module nutzen `status = archived` statt Hard-Delete im Normalbetrieb.
- Für „Klasse löschen, um Platz zu sparen" → vorher **Klassen-Archiv-Export** (siehe
  [10-Export & Import](./10-export-import.md)), dann Hard-Delete inkl. zugehöriger
  `Submission`/`SubmissionFile` (S3-Objekte werden mitgelöscht).
- Audit-Felder (`createdAt`, `updatedAt`, optional `deletedAt`) überall.
