# 01 – Vision & Ziele

## 1. Problemstellung

Mit der Einführung der **Kompetenzmatrix** in der beruflichen Grundbildung ICT (in Kraft seit
01.06.2025) müssen Berufsfachschul-Lehrpersonen pro Modul:

- die Kompetenzmatrix (Kompetenzbänder × Gütestufen) abbilden,
- Leistungsnachweise/Kompetenznachweise definieren,
- den individuellen Kompetenzerwerb der Lernenden formativ und summativ erfassen,
- transparent und nachvollziehbar bewerten und benoten.

Heute geschieht dies oft in **Excel-Vorlagen** (`Kompetenzmatrix_..._TEMPLATE_ICTBBCH.xltx`),
PowerPoint, PDFs oder verstreut über mehrere Tools (LMS, Cloud-Storage, Mail). Das führt zu:

- **Medienbrüchen** zwischen Matrix, Aufgaben, Abgaben und Bewertung,
- **fehlender Transparenz** für Lernende (Wo stehe ich? Was fehlt mir noch?),
- **hohem Korrekturaufwand** für Lehrpersonen,
- **schwieriger Archivierung** abgeschlossener Klassen (Streitfälle, Aufbewahrungspflicht),
- **keiner Wiederverwendbarkeit** einmal erstellter Matrizen und Bewertungsraster.

## 2. Vision

> Eine zentrale, kompetenzorientierte Lern- und Beurteilungsplattform, in der die
> Kompetenzmatrix das verbindende Element zwischen **Planung**, **Umsetzung** und
> **Beurteilung** ist – konform zum ICT-BBCH-Konzept, didaktisch sinnvoll durch Lernpfade,
> und unterstützt durch KI für Feedback und Fachgespräche, ohne die Bewertungshoheit der
> Lehrperson zu ersetzen.

## 3. Ziele

| # | Ziel | Messbar an |
|---|------|------------|
| Z1 | Kompetenzmatrizen pro Modul digital abbilden | Lehrperson kann eine vollständige Matrix erfassen/bearbeiten |
| Z2 | Kompetenznachweise je Kompetenz definieren | ≥ 1 Aufgabe pro Kompetenz möglich, mehrere Aufgabentypen |
| Z3 | Lernende belegen Kompetenzen transparent | Lernende sehen Fortschritt in Echtzeit |
| Z4 | Effiziente Bewertung inkl. KI-Unterstützung | Reduktion Korrekturaufwand; KI-Vorschlag + Override |
| Z5 | Didaktische Führung via Lernpfad | Lernende wählbar: Matrix- oder Lernpfad-Ansicht |
| Z6 | Wiederverwendung & Archivierung | Export/Import von Matrizen und Klassen-Archiven |
| Z7 | Datenschutzkonforme Verwaltung | DSG-konform; Löschen mit Archiv-Wiederherstellung |

## 4. Zielgruppen / Personas

### Persona A – Lehrperson „Markus"
Berufsfachschul-Lehrperson, unterrichtet mehrere Module und Klassen. Will Matrizen einmal
erstellen, wiederverwenden, Aufgaben definieren, effizient bewerten und einen Überblick über
den Fortschritt aller Lernenden haben. Technisch versiert, aber zeitknapp.

### Persona B – Lernende:r „Sara"
Lernende im 1.–4. Lehrjahr. Will klar sehen, welche Kompetenzen sie nachweisen muss, Aufgaben
erledigen, Dokumente hochladen, Feedback erhalten und ihren Fortschritt verfolgen. Nutzt oft
das Smartphone/Tablet.

### Persona C – Administrator:in „IT der Schule"
Verwaltet Mandanten/Schulen, Benutzer, Auth-Provider-Konfiguration, übergeordnete
Einstellungen. (Optional / je nach Betriebsmodell.)

## 5. Scope (MVP & Vollausbau)

### In Scope (Vollausbau)
- Kompetenzmatrix-Editor pro Modul (Bänder, Gütestufen, Deskriptoren, Handlungsziele)
- Klassenverwaltung mit Beitrittscode, Zuordnung von Matrizen
- Kompetenznachweise: Quiz, Dateiupload, Upload + KI-Korrektur, Fachgespräch (KI)
- Sichtbarkeits- und Ablaufsteuerung pro Nachweis
- Bewertung mit Punkten/Noten, Bewertungsraster, Rückweisung
- KI-Konfiguration pro Lehrperson (OpenAI-kompatibel)
- Lernpfade
- Lehrer-Dashboard mit Klassen- und Lernfortschritt
- Export/Import von Matrizen und Klassen-Archiven
- Mehrsprachigkeit (DE/FR/IT/EN)
- Login via Microsoft & Google (OIDC)

### Out of Scope (vorerst)
- Vollständiges LMS (Stundenplan, Notenadministration der Schule, Absenzen)
- Schnittstelle zu kantonalen Schulverwaltungssystemen (späterer Ausbau)
- Native Mobile-Apps (zunächst responsive Web-App / PWA)
- Synchroner Live-Unterricht / Videokonferenz

## 6. Nutzen / Wertversprechen

| Stakeholder | Nutzen |
|-------------|--------|
| Lehrperson | Weniger Verwaltungs-/Korrekturaufwand, Wiederverwendung, Übersicht, KI-Entlastung |
| Lernende | Transparenz, Selbststeuerung, schnelles Feedback, Fachgespräch üben |
| Schule | Konformität zum ICT-BBCH-Konzept, Nachvollziehbarkeit, datenschutzkonforme Archivierung |

## 7. Annahmen & Risiken

| Typ | Beschreibung | Massnahme |
|-----|--------------|-----------|
| Annahme | Lehrpersonen besitzen Microsoft- oder Google-Konten | OIDC-Provider beide unterstützen |
| Annahme | Matrizen folgen der ICT-BBCH-Struktur | Datenmodell direkt am Konzept ausgerichtet |
| Risiko | Datenschutz bei KI-Nutzung (Lernenden-Daten an externe KI) | Opt-in, Anonymisierung, lernort-eigene KI-Endpoints |
| Risiko | Akzeptanz der KI-Bewertung | KI nur als Vorschlag, Lehrperson behält Hoheit |
| Risiko | Komplexität des Matrix-Editors | Import aus Excel-Template, gute UX, MVP-Fokus |
