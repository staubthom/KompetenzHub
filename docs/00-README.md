# KompetenzHub – Planungsdokumentation

Diese Dokumentensammlung beschreibt die detaillierte Planung einer Software, mit der
Berufsfachschul-Lehrpersonen die **Kompetenzmatrix** pro Modul abbilden, **Lernaufgaben /
Kompetenznachweise** erfassen und den **Kompetenzerwerb** ihrer Lernenden begleiten und
bewerten können. Die Software orientiert sich am offiziellen Konzept *„Kompetenzmatrix für
die berufliche Grundbildung in der ICT"* von ICT-Berufsbildung Schweiz (Stand 18.09.2024,
aktualisiert 05.08.2025, in Kraft seit 01.06.2025).


---

## Dokumentübersicht

| Nr. | Dokument | Inhalt |
|----|----------|--------|
| 00 | [README](./00-README.md) | Navigation, Glossar, Konventionen |
| 01 | [Vision & Ziele](./01-vision-und-ziele.md) | Problemstellung, Zielgruppen, Nutzen, Scope |
| 02 | [Rollen & Use Cases](./02-rollen-und-use-cases.md) | Rollen, User Stories, Berechtigungen |
| 03 | [Fachkonzept Kompetenzmatrix](./03-fachkonzept-kompetenzmatrix.md) | Übersetzung des ICT-BBCH-Konzepts in die App |
| 04 | [Funktionale Anforderungen](./04-funktionale-anforderungen.md) | Detaillierte Features |
| 05 | [Datenmodell](./05-datenmodell.md) | Entitäten, ER-Diagramm, Statusmodelle |
| 06 | [Architektur](./06-architektur.md) | Systemarchitektur, Tech-Stack, Storage |
| 07 | [API-Design](./07-api-design.md) | REST-Endpoints, Payloads |
| 08 | [Authentifizierung](./08-authentifizierung.md) | OAuth/OIDC (Microsoft, Google), Rollen |
| 09 | [KI-Konzept](./09-ki-konzept.md) | KI-Bewertung, Fachgespräch, Override |
| 10 | [Export & Import](./10-export-import.md) | Matrix-Export, Klassen-Archivierung |
| 11 | [UI/UX-Konzept](./11-ui-ux-konzept.md) | Hauptscreens, Dashboards |
| 12 | [Nicht-funktionale Anforderungen](./12-nicht-funktionale-anforderungen.md) | Datenschutz, Sicherheit, Performance, i18n |
| 13 | [Roadmap & MVP](./13-roadmap-und-mvp.md) | Phasen, Meilensteine, Aufwand |

---

## Glossar (ICT-BBCH-Begriffe)

| Begriff | Bedeutung |
|---------|-----------|
| **Modul** | Inhaltliche Einheit der Grundbildung (z.B. Modul 293). Grundlage ist die *Modulidentifikation* aus dem Modulbaukasten. |
| **Modulidentifikation** | Offizielle Beschreibung eines Moduls inkl. Handlungsziele. Quelle: [modulbaukasten.ch](https://www.modulbaukasten.ch). |
| **Handlungsziel (HZ)** | Beschreibung dessen, was in einer beruflichen Handlungssituation erreicht werden soll. Grundlage der Kompetenzen. |
| **Kompetenzmatrix** | Tabellarische Überführung der Handlungsziele in Kompetenzen. National i.d.R. eine pro Modulidentifikation. |
| **Kompetenzband** | Thematisch zusammenhängende Gruppe von Kompetenzen (z.B. A1, B1, C1). Referenziert 1–n Handlungsziele. |
| **Gütestufe** | Niveaustufe der Kompetenz: Beginner, Intermediate, Advanced, (nicht erfüllt). |
| **Kompetenzfeld** | Schnittpunkt von Kompetenzband × Gütestufe in der Matrix. |
| **Deskriptor** | „Ich kann …"-Beschreibung einer Kompetenz in einem Kompetenzfeld. |
| **Bewertungsraster** | Konkretes Beurteilungsinstrument je Lernsituation/Leistungsnachweis: Kriterien + Indikatoren je Gütestufe. |
| **Kriterium** | Kurzbeschreibung der Zielhandlung im Bewertungsraster (z.B. „Container-Umgebung definieren"). |
| **Indikator** | Beobachtbare Beschreibung der erwarteten Leistung je Gütestufe. |
| **Leistungsbeurteilung (LB)** | Überprüfung des Kompetenzerwerbs anhand der Kompetenzmatrix als Referenz. |
| **Kompetenznachweis** | In dieser App: konkrete Lernaufgabe, mit der eine Kompetenz belegt wird (Upload, Quiz, Fachgespräch …). |
| **Lernpfad** | Alternative, didaktisch sinnvollere Reihenfolge der Kompetenzen durch die Matrix. |
| **MLP** | Modullehrplan der Berufsfachschule. |
| **üK** | Überbetrieblicher Kurs. |
| **EFZ** | Eidgenössisches Fähigkeitszeugnis. |

### Gütestufen & Noten-Richtwerte

| Gütestufe | Kürzel | Note (Richtwert) | Beschreibung (verkürzt) |
|-----------|--------|------------------|--------------------------|
| Beginner | B | 3.0 | Kann Teile der geforderten Kompetenzen anwenden. |
| Intermediate | I | 4.5 | Beherrscht die selbständige Anwendung. |
| Advanced | A | 6.0 | Beherrscht die fachgerechte Anwendung. |
| Nicht erfüllt | 0 | – | Kompetenzband nicht bearbeitet (nur im Bewertungsraster vermerkt). |

> ⚠️ Die **Gewichtung der Kompetenzbänder** und die **Notenvergabe je Gütestufe** wird durch den
> Lernort (die Lehrperson/Schule) festgelegt. Die App stellt die Richtwerte als Default bereit,
> erlaubt aber lernortspezifische Anpassung.

---

## Konventionen in dieser Dokumentation

- Diagramme sind als **[Mermaid](https://mermaid.js.org/)** notiert (in VS Code / GitHub direkt renderbar).
- `MUSS` / `SOLL` / `KANN` kennzeichnen Anforderungspriorität (in Anlehnung an RFC 2119 / MoSCoW).
- Datenmodell-Entitäten werden in `PascalCase` geschrieben, Felder in `camelCase`.
- API-Pfade in `kebab-case`.

---

## Status

| Version | Datum | Autor | Anmerkung |
|---------|-------|-------|-----------|
| 0.1 (Entwurf) | 2026-06-20 | Planung | Erste vollständige Planungsfassung |
