# KompetenzHub – Benutzerhandbuch & Installationsanleitung für Schulen 🏫

> Stand: Juni 2026 · Sprache: Deutsch
> Diese Anleitung richtet sich an **Lehrpersonen**, **Schulleitungen** und **technisch interessierte Personen**, die prüfen möchten, ob sich KompetenzHub für ihre Schule eignet – sowie an alle, die die Software selbst betreiben wollen.

---

## Inhaltsverzeichnis

1. [Was ist KompetenzHub?](#1-was-ist-kompetenzhub)
2. [Für wen ist die Software?](#2-für-wen-ist-die-software)
3. [Rollen & Berechtigungen](#3-rollen--berechtigungen)
4. [Schnelleinstieg: Grundbegriffe](#4-schnelleinstieg-grundbegriffe)
5. [Anmeldung, Sprache & Anzeigemodus](#5-anmeldung-sprache--anzeigemodus)
6. [Handbuch für Lehrpersonen](#6-handbuch-für-lehrpersonen)
7. [Handbuch für Lernende](#7-handbuch-für-lernende)
8. [KI-Funktionen im Detail](#8-ki-funktionen-im-detail)
9. [Handbuch für die Schuladministration](#9-handbuch-für-die-schuladministration)
10. [Installation & Betrieb (technisch)](#10-installation--betrieb-technisch)
11. [Konfiguration: Umgebungsvariablen](#11-konfiguration-umgebungsvariablen)
12. [Produktivbetrieb & Sicherheit](#12-produktivbetrieb--sicherheit)
13. [Backup & Wiederherstellung](#13-backup--wiederherstellung)
14. [Aktualisierung & Datenbankmigrationen](#14-aktualisierung--datenbankmigrationen)
15. [Datenschutz](#15-datenschutz)
16. [Fehlerbehebung (FAQ)](#16-fehlerbehebung-faq)
17. [Glossar](#17-glossar)
18. [Lizenz](#18-Lizenz)

---

## 1. Was ist KompetenzHub?

KompetenzHub ist eine Web-Plattform zur **kompetenzorientierten Beurteilung** in der beruflichen Grundbildung (und vergleichbaren Schulformen). Sie bildet das didaktische Konzept einer **Kompetenzmatrix** digital ab:

- Ein **Modul** (z. B. „Modul 293") besitzt eine **Kompetenzmatrix**.
- Die Matrix besteht aus **Kompetenzbändern** (Zeilen) und **Gütestufen** (Spalten: _Beginner_, _Intermediate_, _Advanced_).
- Jede Zelle (= **Kompetenzfeld**) enthält einen **Deskriptor** im „Ich kann …"-Format.
- Zu jedem Feld können **Kompetenznachweise** hinterlegt werden, die Lernende einreichen (Datei, Link, Text, Screenshot oder ein KI-gestütztes Fachgespräch).
- Lehrpersonen **bewerten** die Einreichungen; ein Dashboard zeigt den Lernfortschritt der Klasse.

Zusätzlich bietet KompetenzHub **Lernpfade** (empfohlene Reihenfolge), **KI-Unterstützung** (Bewertungsvorschläge, Feedbacktexte, Übungs-Fachgespräche), **Export/Import** von Modulen und Klassen sowie ein **Schuladmin-Dashboard** für die zentrale Verwaltung.

Die Oberfläche ist vollständig **mehrsprachig** (Deutsch, Französisch, Italienisch, Englisch).

### Demoseite 🌐
[Demo! Keine persönlichen Daten hochladen ⚠️](http://static.160.78.233.167.clients.your-server.de:3000/lehrer/bewerten)
Hier gibt es eine Demo welche immer zur vollen Stunde zurückgesetzt wird. 

---

## 2. Für wen ist die Software?

| Zielgruppe                    | Nutzen                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lehrpersonen 👩‍🏫**              | Eigene Kompetenzraster erstellen, Nachweise definieren, Einreichungen bewerten, Lernfortschritt im Blick behalten, KI als Assistenz nutzen. |
| **Lernende 👩‍🎓**                  | Übersicht über alle zu erbringenden Nachweise, einfache Einreichung, transparentes Feedback, Üben mit KI.                                   |
| **Schulleitung / Schuladmin 🦸🏻** | Zentrale Steuerung: wer darf sich als Lehrperson anmelden, Branding (Logo/Farbe), Sprache, Betrieb/Auslastung, Backups.                     |
| **IT / Betrieb 🧑‍💻**              | Selbst-Hosting auf eigener Infrastruktur (Docker), volle Datenhoheit, Standard-Technologien.                                                |

---

## 3. Rollen & Berechtigungen

KompetenzHub kennt drei Rollen. Jede Person hat genau **eine** aktive Rolle pro Schule.

| Rolle                    | Darf …                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lernende:r** (LEARNER) | Modulanlässen beitreten, Kompetenzmatrix der eigenen Module ansehen, Nachweise einreichen, Lernpfad verfolgen, mit KI üben, eigene Sprache/Anzeige & optional eigene KI konfigurieren.                                                                                                                            |
| **Lehrperson** (TEACHER) | Module & Matrizen erstellen/bearbeiten, Nachweise definieren, Modulanlässe (Klassen) führen, Einreichungen bewerten, Lernpfade pflegen, KI konfigurieren, Module/Klassen exportieren/importieren. Sieht die **eigenen** Module/Modulanlässe sowie Modulanlässe, bei denen sie als **Co-Leitung** eingetragen ist. |
| **Schuladmin** (ADMIN)   | Alles rund um die Verwaltung: Personen (Lehrpersonen & Lernende), Einladungen/Zugänge, Schul-Einstellungen (Branding, Sprache, Anmelde-Anbieter), Betrieb/Gesundheit, Audit-Log, Backup.                                                                                                                          |

> **Wichtig (Zugangssteuerung):** Wer sich neu anmeldet, wird **standardmässig Lernende:r**. Lehrpersonen- und Admin-Rechte vergibt ausschliesslich die Schuladmin – über **Einladung** oder **Beförderung** (siehe [Kapitel 9](#9-handbuch-für-die-schuladministration)).

---

## 4. Schnelleinstieg: Grundbegriffe

| Begriff                | Bedeutung                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **Modul**              | Fachliche Einheit mit einer Kompetenzmatrix (z. B. „Modul 293 – Webauftritt erstellen"). |
| **Kompetenzmatrix**    | Raster aus Bändern × Gütestufen.                                                         |
| **Handlungsziel (HZ)** | Lernziel; jedes Band referenziert mind. ein Handlungsziel.                               |
| **Kompetenzband**      | Zeile der Matrix (thematischer Strang).                                                  |
| **Gütestufe**          | Spalte: Beginner (B), Intermediate (I), Advanced (A).                                    |
| **Kompetenzfeld**      | Schnittpunkt Band × Gütestufe.                                                           |
| **Deskriptor**         | „Ich kann …"-Beschreibung eines Feldes.                                                  |
| **Kompetenznachweis**  | Auftrag, den Lernende zu einem Feld einreichen.                                          |
| **Modulanlass**        | Durchführung eines Moduls mit einer konkreten Klasse (inkl. Beitrittscode).              |
| **Co-Leitung**         | Weitere Lehrperson, die einen Modulanlass mitführt und mitbewertet.                      |
| **Lernpfad**           | Empfohlene Reihenfolge der Kompetenzfelder.                                              |

---

## 5. Anmeldung, Sprache & Anzeigemodus

### Anmelden

KompetenzHub wird im Webbrowser geöffnet (Standard-Adresse im Betrieb: die URL Ihrer Schule, lokal `http://localhost:3000`).

- **Produktiv:** Anmeldung über **Microsoft** oder **Google** (Single Sign-On). Welche Anbieter verfügbar sind, legt die Schuladmin fest.
- **Entwicklung/Test:** ein **Dev-Login** mit Rollenwahl (Lehrperson / Lernende / Administration) steht zur Verfügung, sofern aktiviert.

Nach der Anmeldung werden Sie automatisch auf die zu Ihrer Rolle passende Startseite geleitet.

> 📷 \_Screenshot: Anmeldeseite mit Microsoft/Google und Dev-Login.
>
> ![Screenshot: Anmeldeseite mit Microsoft/Google und Dev-Login](docs/Images/Pasted%20image%2020260623114415.png)

### Sprache umstellen

Oben rechts in der Kopfzeile befindet sich ein **Sprachauswahl-Menü** (DE · FR · IT · EN). Die Wahl wird **dauerhaft im Konto gespeichert** und bleibt nach dem Abmelden erhalten.

### Anzeigemodus (Theme)

Neben der Sprachauswahl lässt sich der Anzeigemodus umschalten: **Hell**, **Dunkel** oder **Grau**. Auch diese Einstellung wird pro Konto gespeichert.

> 📷 \_Screenshot: Kopfzeile mit Sprach- und Theme-Auswahl sowie Nutzer-Menü.
>
> ![Screenshot: Kopfzeile mit Sprach- und Theme-Auswahl sowie Nutzer-Menü](docs/Images/Pasted%20image%2020260623114640.png)

---

## 6. Handbuch für Lehrpersonen 👩‍🏫

Nach der Anmeldung als Lehrperson sehen Sie links die Navigation: **Dashboard**, **Module & Matrizen**, **Modulanlässe**, **Bewerten**, **KI-Einstellungen**.

### 6.1 Dashboard

Das Dashboard zeigt pro Modulanlass den **Lernfortschritt der Klasse** als Heatmap (Lernende × Kompetenzfelder) sowie Kennzahlen (Anzahl Lernende, „zu bewerten", „bewertet", Durchschnittsfortschritt). Ein Klick auf eine Zelle führt direkt zur Bewertung.

> 📷 \_Screenshot: Lehrer-Dashboard mit Fortschritts-Heatmap.
>
> ![Screenshot: Lehrer-Dashboard mit Fortschritts-Heatmap](docs/Images/Pasted%20image%2020260623115232.png)

### 6.2 Module & Matrizen anlegen

1. **Module & Matrizen** öffnen → **„+ Neues Modul"**.
2. **Modulnummer** und **Titel** erfassen (optional Beschreibung). Das Modul wird als **Entwurf** angelegt.
3. Modul öffnen, um die Matrix zu bearbeiten.

> 📷 \_Screenshot: Modul-Liste mit Kennzahlen.
>
> ![Screenshot: Modul-Liste mit Kennzahlen](docs/Images/Pasted%20image%2020260623120316.png)

#### Handlungsziele

Im Modul-Editor zunächst **Handlungsziele** anlegen (Code + Beschreibung). Sie lassen sich umsortieren, bearbeiten und löschen. _Jedes Kompetenzband muss mindestens ein Handlungsziel referenzieren._

#### Kompetenzbänder & Deskriptoren

1. **„+ Band hinzufügen"**: Code (z. B. „A1"), optionale Beschreibung und die referenzierten Handlungsziele wählen. Beim Anlegen entstehen automatisch die drei Felder (B/I/A).
2. In jeder Zelle auf den Deskriptor klicken und im „Ich kann …"-Format formulieren.
3. Bänder lassen sich umsortieren und bearbeiten.

> 📷 \_Screenshot: Matrix-Editor mit Bändern, Feldern und Deskriptoren.
>
> ![Screenshot: Matrix-Editor mit Bändern, Feldern und Deskriptoren](docs/Images/Pasted%20image%2020260623115324.png)

#### Kompetenznachweise definieren

Über die Schaltfläche **„+ Nachweis"** in einem Kompetenzfeld öffnet sich der Nachweis-Dialog:

- **Titel** und **Beschreibung** (Rich-Text mit Bildern/Links).
- **Einreichungsarten** für Lernende: **Datei**, **Link**, **Text**, **Screenshot**, **Fachgespräch/Präsentation**.
- Optionen: erlaubte Dateitypen, max. Grösse, Einfügen (Paste) im Textfeld erlauben/sperren, **max. Punkte**, **Fälligkeitsdatum**, **Sichtbarkeit**.
- Optionaler **Anhang** zum Download (z. B. Aufgabenblatt).

> 📷 _Screenshot: Nachweis-Konfiguration mit Einreichungsarten._
>
> ![Screenshot: Nachweis-Konfiguration mit Einreichungsarten](docs/Images/Pasted%20image%2020260623120435.png)

### 6.3 Lernpfade 

Im Modul können Sie unter **„Lernpfade"** eine **empfohlene Reihenfolge** der Kompetenzfelder definieren (Felder links hinzufügen, rechts in Reihenfolge bringen). Ein Pfad lässt sich **aktiv** schalten; Lernende sehen dann eine Zeitachse statt der reinen Matrix.

> 📷 \_Screenshot: Lernpfad-Editor (verfügbare Felder ↔ Reihenfolge).
>
> ![Screenshot: Lernpfad-Editor (verfügbare Felder ↔ Reihenfolge)](docs/Images/Pasted%20image%2020260623120533.png)
>
> 📷 _Screenshot: Lernpfad-Editor (verfügbare Felder ↔ Reihenfolge)._
>
> ![Screenshot: Lernpfad-Editor (verfügbare Felder ↔ Reihenfolge)](docs/Images/Pasted%20image%2020260623120702.png)

### 6.4 Modulanlässe (Klassen) führen

Unter **Modulanlässe**:

1. **Neuen Modulanlass** anlegen, einem Modul zuordnen und benennen.
2. Einen **Beitrittscode** (bzw. Beitrittslink) erzeugen und an die Klasse weitergeben.
3. Lernende treten mit dem Code bei und sehen sofort die Matrix und die Nachweise.

Sie sehen Ihre **eigenen** sowie die Modulanlässe, bei denen Sie als **Co-Leitung** eingetragen sind (entsprechend markiert), und jeweils nur die zugeordneten Lernenden. Modulanlässe können **archiviert** (schreibgeschützt) und als **ZIP exportiert/importiert** werden (inkl. aller Einreichungen, Bewertungen und Zeitstempel).

> 📷 _Screenshot: Modulanlass mit Beitrittscode._
>
> ![Screenshot: Modulanlass mit Beitrittscode](docs/Images/Pasted%20image%2020260623120925.png)

### 6.5 Co-Leitung (Co-Teaching) 👨‍💼👩‍💼

Ein Modulanlass kann von mehreren Lehrpersonen gemeinsam geführt werden. Im Detailbereich eines Modulanlasses gibt es dafür den Abschnitt **„Co-Leitung"**:

1. E-Mail-Adresse der gewünschten Lehrperson eingeben und **Hinzufügen**.
2. Die Person muss bereits als **Lehrperson** (oder Schuladmin) an der Schule angemeldet/eingeladen sein.
3. Die Co-Leitung sieht den Modulanlass ab sofort in ihrem Login (mit der Markierung **„Co-Leitung"**) und kann dessen **Einreichungen bewerten**, den Fortschritt einsehen, Mitglieder und Beitrittscode verwalten.

**Rechteabgrenzung:** Nur die **besitzende** Lehrperson (die den Modulanlass erstellt hat) kann die Co-Leitung verwalten (hinzufügen/entfernen) und den Modulanlass **löschen**. Co-Leitungen können den Anlass weder löschen noch weitere Co-Leitungen ernennen.

> 📷 \_Screenshot: Abschnitt „Co-Leitung" im Modulanlass.
>
> ![Screenshot: Abschnitt Co-Leitung im Modulanlass](docs/Images/Pasted%20image%2020260623121158.png)

### 6.6 Bewerten

Unter **Bewerten** sehen Sie alle offenen Einreichungen Ihrer Modulanlässe – auch jener, bei denen Sie als Co-Leitung mitwirken:

- Einreichung öffnen (Text/Link/Datei/Screenshot ansehen).
- **Gütestufe**, **Punkte** und **Feedback** erfassen oder die Einreichung **zurückweisen** (mit Begründung → Lernende:r kann erneut einreichen).
- Eine **Historie** dokumentiert jede Bewertungsaktion (inkl. der bewertenden Person).
- Optional: **KI-Bewertungsvorschlag** und **KI-Feedbacktext** als Entwurf erzeugen (Sie entscheiden, ob Sie ihn übernehmen).

> 📷 _Screenshot: Bewertungsansicht mit KI-Vorschlag._
>
> ![Screenshot: Bewertungsansicht mit KI-Vorschlag](docs/Images/Pasted%20image%2020260623121610.png)

### 6.7 Export / Import von Modulen

In der Modul-Detailansicht:

- **Export**: Lädt das Modul samt Matrix und Assets (Bilder, Anhänge) als **ZIP** herunter.
- **Import** (in der Modul-Liste): entpackt ein ZIP und legt ein neues Modul an. Existiert das Original noch, entsteht eine Kopie mit dem Zusatz „(Importiert)".

So lassen sich Module zwischen Lehrpersonen oder Schulen austauschen.

### 6.8 KI-Einstellungen 🤖 (Lehrperson)

Unter **KI-Einstellungen** hinterlegen Sie Ihre eigene KI-Anbindung (Provider/Endpoint und API-Schlüssel). Der Schlüssel wird **verschlüsselt** gespeichert und nie im Klartext angezeigt. Optional können Sie Ihre KI **für Ihre Lernenden freigeben**, damit diese die Übungs-Funktionen nutzen können.

> 📷 _Screenshot: KI-Einstellungen der Lehrperson._
>
> ![Screenshot: KI-Einstellungen der Lehrperson](docs/Images/Pasted%20image%2020260623121719.png)

---

## 7. Handbuch für Lernende 👨‍🎓

Navigation: **Meine Matrix**, **Lernpfad**, **Meine Nachweise**, **Modul mit KI üben**, **Einstellungen**.

### 7.1 Einem Modulanlass beitreten

Auf **Meine Matrix** den **Beitrittscode** der Lehrperson eingeben (oder den Beitrittslink öffnen). Danach erscheint die Kompetenzmatrix des Moduls.

> 📷 _Screenshot: Beitritt mit Code._
>
> ![Screenshot: Beitritt mit Code](docs/Images/Pasted%20image%2020260623122058.png)

### 7.2 Matrix ansehen & Nachweise einreichen

In der Matrix sind die einreichbaren Nachweise als **anklickbare Chips** im jeweiligen Feld sichtbar (mit Status-Symbol). Ein Klick öffnet den Einreichungs-Dialog.

Je nach Vorgabe der Lehrperson stehen zur Verfügung:

- **Datei hochladen**, **Link** angeben, **Text** schreiben, **Screenshot** aufnehmen (vor dem Absenden ansehbar) oder ein **Fachgespräch/Präsentation**.
- Ein einziger Knopf **reicht alle vorhandenen Teile gemeinsam ein**.

Nach der Einreichung sehen Sie den **Status** (eingereicht / bewertet / zurückgewiesen) sowie ggf. **Punkte und Feedback**.

> 📷 _Screenshot: Einreichungs-Dialog mit den verschiedenen Einreichungsarten._
>
> ![Screenshot: Einreichungs-Dialog mit den verschiedenen Einreichungsarten](docs/Images/Pasted%20image%2020260623122231.png)

### 7.3 Meine Nachweise

Die Seite **Meine Nachweise** bündelt alle Aufträge in „zu erledigen" und „erledigt" – unabhängig vom Modul. So sehen Sie auf einen Blick, was noch offen ist.

### 7.4 Lernpfad

Hat die Lehrperson einen Lernpfad aktiviert, zeigt **Lernpfad** die empfohlene Reihenfolge als Zeitachse. Die jeweils nächsten Nachweise sind direkt anklick- und einreichbar.

> 📷 _Screenshot: Lernpfad-Zeitachse._
>
> ![Screenshot: Lernpfad-Zeitachse](docs/Images/Pasted%20image%2020260623122447.png)

### 7.5 Modul mit KI üben 🤖

Unter **Modul mit KI üben** führt die KI ein **Fachgespräch** und prüft verschiedene Themen ab. Als Kontext dienen alle Kompetenzen der Matrix. Die KI gibt **Lernhinweise** und **Rückmeldung zur Qualität** Ihrer Antworten. Das Üben ist unverbindlich und fliesst nicht in die Bewertung ein.

> 📷 _Screenshot: KI-Übungs-Chat._
>
> ![Screenshot: KI-Übungs-Chat](docs/Images/Pasted%20image%2020260623122740.png)

### 7.6 Einstellungen (Lernende)

Unter **Einstellungen** können Sie Sprache/Anzeige festlegen und – falls gewünscht – **eine eigene KI konfigurieren**. Ist eine eigene KI hinterlegt, wird diese verwendet; andernfalls die von der Lehrperson freigegebene.

---

## 8. KI-Funktionen im Detail 🤖

KompetenzHub nutzt KI **assistierend** – nie automatisch entscheidend:

| Funktion                 | Für wen    | Zweck                                                                |
| ------------------------ | ---------- | -------------------------------------------------------------------- |
| **Bewertungsvorschlag**  | Lehrperson | Entwurf für Gütestufe/Punkte zu einer Einreichung.                   |
| **Feedbacktext**         | Lehrperson | Formulierungsvorschlag für die Rückmeldung.                          |
| **Fachgespräch (Übung)** | Lernende   | KI stellt Fragen zum Modul, gibt Lernhinweise und Qualitätsfeedback. |

**Datenschutz/Sicherheit:** API-Schlüssel werden mit **AES-256-GCM verschlüsselt** gespeichert und nie zurückgegeben. Die KI-Anbindung ist **pro Lehrperson** konfigurierbar; Lernende können eigene Schlüssel hinterlegen. Ob eine Lehrperson-KI für Lernende nutzbar ist, steuert die Lehrperson per Freigabe.

---

## 9. Handbuch für die Schuladministration 📔

Die Schuladmin meldet sich an und gelangt zum **Schuladmin-Dashboard** mit der Navigation: **Übersicht**, **Personen**, **Einladungen**, **Betrieb**, **Audit-Log**, **Schul-Einstellungen**.

> Wie man die **erste** Schuladmin einrichtet, steht in [Kapitel 10.6](#106-erste-schuladmin-einrichten).

### 9.1 Übersicht

Kennzahlen auf einen Blick: Anzahl Lehrpersonen, Lernende, Admins, offene Einladungen, gesperrte Konten, Module und Modulanlässe.

> 📷 _Screenshot: Admin-Übersicht._
>
> ![Screenshot: Admin-Übersicht](docs/Images/Pasted%20image%2020260623122920.png)

### 9.2 Personen verwalten

Liste aller Personen der Schule. Möglich sind:

- **Rolle ändern** (Lernende:r ↔ Lehrperson ↔ Schuladmin).
- **Anzeigename bearbeiten**.
- **Sperren / Entsperren** (gesperrte Konten können sich nicht mehr anmelden).
- **Entfernen** (Zugang zur Schule entziehen).

Schutzmechanismen: Man kann **sich nicht selbst sperren/entfernen**, und die **letzte aktive Schuladmin** kann nicht entfernt/degradiert werden.

> 📷 _Screenshot: Personenverwaltung mit Rollen-Auswahl und Aktionen._
>
> ![Screenshot: Personenverwaltung mit Rollen-Auswahl und Aktionen](docs/Images/Pasted%20image%2020260623123106.png)

### 9.3 Einladungen (wer darf Lehrperson werden?)

Da neue Anmeldungen standardmässig Lernende werden, steuert die Schuladmin den Lehrpersonen-Zugang über **Einladungen**:

1. E-Mail-Adresse erfassen, Rolle (Lehrperson oder Schuladmin) wählen, **Einladen**.
2. Beim **ersten Login** mit dieser E-Mail erhält die Person automatisch die eingeladene Rolle; die Einladung gilt als eingelöst.
3. Offene Einladungen lassen sich jederzeit **zurückziehen**.

Bereits vorhandene Personen werden nicht eingeladen, sondern direkt in der Personenverwaltung **befördert**.

> 📷 _Screenshot: Einladungen anlegen und Liste offener Einladungen._
>
> ![Screenshot: Einladungen anlegen und Liste offener Einladungen](docs/Images/Pasted%20image%2020260623123208.png)

### 9.4 Schul-Einstellungen 🏫

- **Schulname** (erscheint im Kontext der App).
- **Standardsprache**: Sprache, die neue Konten beim ersten Login erhalten.
- **Logo hochladen**: erscheint oben links in der Kopfzeile neben dem Schriftzug. Empfohlen: PNG/SVG mit transparentem Hintergrund.
- **Akzentfarbe**: Primärfarbe der App – 7 Vorschläge oder eigener Hex-Wert, mit Live-Vorschau. Statusfarben (grün/orange/grau) bleiben für die Lesbarkeit unverändert.
- **Anmelde-Anbieter**: Microsoft und/oder Google aktivieren/deaktivieren. Ein deaktivierter Anbieter wird beim Login abgewiesen.
- Statusanzeige: ob **Dev-Login** aktiv ist und ob der **Bootstrap-Admin** (`ADMIN_EMAILS`) konfiguriert ist.

> 📷 _Screenshot: Schul-Einstellungen mit Akzentfarben-Auswahl und Logo._
>
> ![Screenshot: Einladungen anlegen und Liste offener Einladungen](docs/Images/image-1782213871616.png)

### 9.5 Betrieb & Gesundheit

- **Gesundheits-Ampel**: Zustand von Datenbank, Redis und Objektspeicher sowie Software-Version.
- **Auslastung**: Anzahl Lehrpersonen/Lernende, Module, Modulanlässe, Einreichungen, **belegter Speicher** sowie **Anmeldungen der letzten 7 / 30 Tage**.

> 📷 _Screenshot: Betriebs-Seite mit Health-Ampel und Kennzahlen._
>
> ![Screenshot: Betriebs-Seite mit Health-Ampel und Kennzahlen](docs/Images/Pasted%20image%2020260623123303.png)

### 9.6 Audit-Log 👁️‍🗨️

Chronologische Liste sicherheitsrelevanter Ereignisse (Anmeldungen, abgewiesene Anmeldungen, Abmeldungen) mit Zeitpunkt, Aktion und Person.

### 9.7 Backup (Beta)

Per Knopfdruck erzeugt die Schuladmin ein **Voll-Backup als ZIP**: die Schuldaten als `backup.json` (Personen, Module, Matrizen, Modulanlässe, Einreichungen, Bewertungen, Audit-Log, Einstellungen) **plus alle Dateien** aus dem Objektspeicher (Logos, Bilder, Anhänge, Belege). Details siehe [Kapitel 13](#13-backup--wiederherstellung).

> 📷 _Screenshot: Backup-Schaltfläche auf der Betriebs-Seite._
>
> ![Screenshot: Backup-Schaltfläche auf der Betriebs-Seite](docs/Images/Pasted%20image%2020260623123404.png)

---

## 10. Installation & Betrieb (technisch)

> Dieser Teil richtet sich an Personen mit IT-Kenntnissen, die KompetenzHub selbst betreiben möchten.

### 10.1 Architektur im Überblick

KompetenzHub ist ein **Monorepo** mit zwei Anwendungen:

| Teil                 | Technologie                             | Aufgabe                                          |
| -------------------- | --------------------------------------- | ------------------------------------------------ |
| **API** (`apps/api`) | NestJS 10, Prisma, REST unter `/api/v1` | Geschäftslogik, Authentifizierung, Datenzugriff. |
| **Web** (`apps/web`) | Next.js 14 (App Router, React)          | Benutzeroberfläche.                              |

**Abhängige Dienste** (per Docker):

| Dienst                    | Zweck                                                        |
| ------------------------- | ------------------------------------------------------------ |
| **PostgreSQL 16**         | Hauptdatenbank.                                              |
| **Redis 7**               | Hintergrund-Jobs / Caching.                                  |
| **MinIO** (S3-kompatibel) | Objektspeicher für Dateien (Bilder, Anhänge, Belege, Logos). |

### 10.2 Systemvoraussetzungen

- **Node.js ≥ 20** und **npm**
- **Docker** und **Docker Compose** (für PostgreSQL, Redis, MinIO)
- ca. 2 GB freier Arbeitsspeicher für die Dienste
- Betriebssystem: Linux, macOS oder Windows

### 10.3 Schnellstart 
#### Zum Ausprobieren in Docker nicht als Produktivumgebung gedacht! 

```bash
# 1) Repository holen
git clone https://github.com/staubthom/KompetenzHub.git
cd KompetenzHub

# 2) Umgebungsdatei anlegen und bei Bedarf anpassen
cp .env.example-dev .env

# 3) Infrastruktur starten (PostgreSQL, Redis, MinIO)
docker compose -f docker-compose_dev.yaml --profile  app up -d --build

```
Im Ordner Vorlagen finden Sie ein Demomodul zum Importieren


#### Für lokale Entwicklung

```bash
# 1) Repository holen
git clone https://github.com/staubthom/KompetenzHub.git
cd KompetenzHub

# 2) Umgebungsdatei anlegen und bei Bedarf anpassen
cp .env.example .env

# 3) Infrastruktur starten (PostgreSQL, Redis, MinIO)
docker compose up -d

# 4) Abhängigkeiten installieren
npm install

# 5) Datenbankschema anlegen (Migrationen) + Prisma-Client generieren
npm run prisma:migrate
npm run prisma:generate

# 6) API und Web gemeinsam starten
npm run dev
```

Danach erreichbar:

- **Weboberfläche:** `http://localhost:3000`
- **API:** `http://localhost:3001` (Health-Check: `http://localhost:3001/api/v1/health`)
- **MinIO-Konsole:** `http://localhost:9001` (Standard-Zugang `minioadmin` / `minioadmin`)

> Die API und Web können auch einzeln gestartet werden: `npm run dev:api` bzw. `npm run dev:web`.

### 10.4 Produktions-Build

```bash
npm run build           # baut API und Web
# API starten:
npm run start --workspace apps/api      # bedient Port 3001 (API_PORT)
# Web starten:
npm run start --workspace apps/web      # bedient Port 3000 (WEB_PORT)
```

Betreiben Sie beide Prozesse dauerhaft (z. B. via systemd, PM2 oder Container) und stellen Sie sie hinter einen **Reverse Proxy mit HTTPS** (z. B. Nginx/Caddy/Traefik).

### 10.5 Deployment per Docker Compose (Voll-Stack)

Am einfachsten lässt sich KompetenzHub komplett mit Docker betreiben. Das `docker-compose.yml` enthält neben der Infrastruktur (PostgreSQL, Redis, MinIO) auch **API** und **Web** – diese liegen im Profil `app` und starten nur bei Bedarf:

```bash
cp .env.example .env          # danach BEARBEITEN (siehe unten)
docker compose --profile app up -d --build
```

Das startet alle fünf Container; die API wendet beim Start automatisch die **Datenbank-Migrationen** an. Erreichbar (Standard): Web `http://localhost:3000`, API `http://localhost:3001`, MinIO-Konsole `http://localhost:9001`.

> Ohne Profil – `docker compose up -d` – startet wie bisher **nur die Infrastruktur** (für die lokale Entwicklung mit `npm run dev`).

**Zwingend in der `.env` setzen** (sonst startet die API bewusst nicht):

| Variable            | Bedeutung                                                        |
| ------------------- | ---------------------------------------------------------------- |
| `JWT_SIGNING_KEY`   | starker, geheimer Schlüssel für die API-Tokens                   |
| `AI_CONFIG_ENC_KEY` | starker, geheimer Schlüssel für die KI-Schlüssel-Verschlüsselung |
| `ADMIN_EMAILS`      | E-Mail(s) der ersten Schuladmin(s)                               |

**Öffentliche URLs** (browser-erreichbar – nicht die internen Container-Namen):

| Variable         | Lokal                   | Produktiv                                  |
| ---------------- | ----------------------- | ------------------------------------------ |
| `API_PUBLIC_URL` | `http://localhost:3001` | z. B. `https://kompetenzhub.schule.ch/api` |
| `WEB_PUBLIC_URL` | `http://localhost:3000` | z. B. `https://kompetenzhub.schule.ch`     |
| `S3_PUBLIC_URL`  | `http://localhost:9000` | öffentlich erreichbare MinIO-/Storage-URL  |

> `API_PUBLIC_URL` wird beim **Web-Build** ins Bundle gebacken – nach Änderung das Web-Image neu bauen (`--build`).

**Produktiv** empfiehlt sich ein vorgelagerter **Reverse Proxy mit HTTPS**, der eine Domain auf Web, API (`/api`) und – für Datei-Downloads – den Objektspeicher routet. So sind alle URLs same-origin und konsistent. Logos/Bilder funktionieren bereits über `S3_PUBLIC_URL`; private Datei-Downloads (Einreichungen, Anhänge) benötigen, dass der Objektspeicher unter derselben Adresse für API **und** Browser erreichbar ist.

### 10.6 Health-Check

Der Endpunkt `GET /api/v1/health` liefert den Zustand der abhängigen Dienste:

```json
{ "status": "ok", "db": "up", "redis": "up", "s3": "up", "version": "…" }
```

Eignet sich für Monitoring/Uptime-Checks. `status: "degraded"` signalisiert, dass mindestens ein Dienst nicht erreichbar ist.

### 10.7 Erste Schuladmin einrichten

Damit überhaupt jemand das Admin-Dashboard öffnen kann, wird die **erste** Schuladmin über eine Umgebungsvariable festgelegt:

1. In der `.env` die gewünschten E-Mail-Adressen eintragen:
   ```
   ADMIN_EMAILS=schulleitung@schule.ch,ict@schule.ch
   ```
2. API neu starten.
3. Wer sich anschliessend mit einer dieser E-Mails anmeldet, erhält automatisch **Admin-Rechte**.

Ab dann können weitere Admins/Lehrpersonen bequem über das Dashboard (Einladungen/Beförderung) verwaltet werden.

> Für lokale Tests genügt der **Dev-Login** mit Rollenwahl „Administration".

---

## 11. Konfiguration: Umgebungsvariablen

Alle Einstellungen liegen in der zentralen Datei **`.env`** (Vorlage: `.env.example`).

### Datenbank / Dienste

| Variable                                              | Bedeutung                  | Beispiel/Default                                                                   |
| ----------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`                                        | PostgreSQL-Verbindungs-URL | `postgresql://kompetenzhub:kompetenzhub@localhost:5432/kompetenzhub?schema=public` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | DB-Zugang (für Docker)     | `kompetenzhub`                                                                     |
| `REDIS_URL`                                           | Redis-Verbindung           | `redis://localhost:6379`                                                           |
| `S3_ENDPOINT`                                         | Objektspeicher-Adresse     | `http://localhost:9000`                                                            |
| `S3_BUCKET`                                           | Bucket-Name                | `kompetenzhub`                                                                     |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY`                     | Objektspeicher-Zugang      | `minioadmin`                                                                       |

### Anwendung

| Variable              | Bedeutung                          | Default                 |
| --------------------- | ---------------------------------- | ----------------------- |
| `API_PORT`            | Port der API                       | `3001`                  |
| `WEB_PORT`            | Port der Weboberfläche             | `3000`                  |
| `NEXT_PUBLIC_API_URL` | API-Adresse für das Frontend       | `http://localhost:3001` |
| `NEXT_PUBLIC_WEB_URL` | erlaubte Web-Origin (CORS/Cookies) | `http://localhost:3000` |

### Authentifizierung & Sicherheit

| Variable               | Bedeutung                                   | Hinweis                                        |
| ---------------------- | ------------------------------------------- | ---------------------------------------------- |
| `JWT_SIGNING_KEY`      | Signaturschlüssel für API-Tokens            | **In Produktion zwingend ändern!**             |
| `JWT_TTL_SECONDS`      | Token-Lebensdauer                           | Default `900` (15 min)                         |
| `DEV_LOGIN_ENABLED`    | Dev-Login-Endpunkt aktiv                    | In Produktion auf **`false`**                  |
| `AUTH_EXCHANGE_SECRET` | Schutz des `/auth/exchange`-Endpunkts (BFF) | In Produktion setzen                           |
| `ADMIN_EMAILS`         | Bootstrap-Admins (kommagetrennt)            | siehe [10.6](#106-erste-schuladmin-einrichten) |
| `DEFAULT_TENANT_ID`    | Standard-Mandant                            | vorbelegt                                      |

### KI

| Variable            | Bedeutung                                               | Hinweis                                         |
| ------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| `AI_CONFIG_ENC_KEY` | Schlüssel zur Verschlüsselung gespeicherter KI-API-Keys | **In Produktion zwingend stark/geheim setzen!** |
| `AI_STUB_MODE`      | deterministische KI-Antworten ohne externen Aufruf      | nur für Tests; in Produktion nicht setzen       |

### OIDC (Microsoft/Google) – optional

`AUTH_MICROSOFT_CLIENT_ID/SECRET`, `AUTH_GOOGLE_CLIENT_ID/SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` – für die produktive Single-Sign-On-Anbindung.

---

## 12. Produktivbetrieb & Sicherheit

Checkliste vor dem produktiven Einsatz:

- [ ] **`JWT_SIGNING_KEY`** und **`AI_CONFIG_ENC_KEY`** auf starke, geheime Werte gesetzt.
- [ ] **`DEV_LOGIN_ENABLED=false`** (kein Dev-Login in Produktion).
- [ ] **`AUTH_EXCHANGE_SECRET`** gesetzt; OIDC-Anbieter (Microsoft/Google) konfiguriert.
- [ ] **HTTPS** über einen Reverse Proxy; Cookies laufen dann sicher (`secure`).
- [ ] Starke Datenbank-/MinIO-Zugangsdaten (nicht die Defaults).
- [ ] **`ADMIN_EMAILS`** mit den realen Schuladmin-Adressen befüllt.
- [ ] Regelmässige **Backups** eingerichtet (siehe Kapitel 13).
- [ ] Monitoring auf `GET /api/v1/health`.

**Sicherheitsmerkmale ab Werk:** rollenbasierte Zugriffskontrolle (RBAC), strikte **Mandanten-/Eigentümer-Trennung** (Lehrpersonen sehen nur eigene Module/Modulanlässe), verschlüsselte KI-Schlüssel, Audit-Log für Anmelde-/Sicherheitsereignisse, Zugangs-Gate (neue Konten werden nicht automatisch Lehrpersonen).

---

## 13. Backup & Wiederherstellung

### Anwendungs-Backup (Schuladmin)

Im Schuladmin-Dashboard unter **Betrieb → Backup** lässt sich ein **Voll-Backup als ZIP** herunterladen:

- `backup.json` – alle Schuldaten (Personen, Module, Matrizen, Modulanlässe, Einreichungen, Bewertungen, Audit-Log, Einstellungen, Branding).
- `files/…` – alle Dateien aus dem Objektspeicher (Logos, Bilder, Anhänge, Belege).

Empfehlung: regelmässig (z. B. wöchentlich) herunterladen und sicher ablegen.

### Infrastruktur-Backup (IT)

==Für ein vollständiges, wiederherstellbares Backup zusätzlich auf Infrastruktur-Ebene sichern:==

- **PostgreSQL**: `pg_dump` (bzw. das Docker-Volume `postgres-data`).
- **MinIO**: das Docker-Volume `minio-data` bzw. den Bucket spiegeln.

> Hinweis: Eine automatische **Rück**-Einspielung des Anwendungs-ZIP über die Oberfläche ist derzeit nicht vorgesehen; das ZIP dient der Datensicherung und -portabilität. Module und Modulanlässe lassen sich zusätzlich gezielt über die jeweiligen **Export/Import-Funktionen** übertragen.

---

## 14. Aktualisierung & Datenbankmigrationen

```bash
git pull
npm install
npm run prisma:migrate     # wendet neue Datenbankmigrationen an
npm run prisma:generate
npm run build
# Dienste neu starten
```

Migrationen liegen versioniert unter `apps/api/prisma/migrations`. Vor einem Update in Produktion ein **Datenbank-Backup** erstellen.

---

## 15. Datenschutz

- Beim Self-Hosting bleiben **alle Daten auf Ihrer Infrastruktur**.
- Personenbezogene Daten beschränken sich im Kern auf Konto (Name, E-Mail) sowie Einreichungen/Bewertungen.
- KI-Aufrufe erfolgen nur, wenn eine KI konfiguriert ist; dabei werden die zur Bewertung/Übung nötigen Inhalte an den gewählten KI-Anbieter übermittelt. Die Wahl des Anbieters und damit der Datenverarbeitung liegt bei der Schule/Lehrperson/Lernenden.
- Beim **Export von Modulen** werden bewusst **keine personenbezogenen Daten** mitgegeben; beim **Modulanlass-Export** hingegen schon (inkl. Einreichungen) – entsprechend vertraulich behandeln.

> Diese Anleitung ersetzt keine rechtliche Beratung. Klären Sie den Einsatz mit der/dem Datenschutzverantwortlichen Ihrer Schule.

---

## 16. Fehlerbehebung (FAQ)

**Ich werde nach dem Login als „Lernende:r" eingestuft, obwohl ich Lehrperson bin.**
Das ist beabsichtigt: neue Konten sind standardmässig Lernende. Die Schuladmin muss Sie **einladen** oder **befördern** (Kapitel 9.2/9.3).

**Niemand kommt ins Admin-Dashboard.**
Stellen Sie sicher, dass Ihre E-Mail in `ADMIN_EMAILS` steht und die API danach neu gestartet wurde (Kapitel 10.6).

**„Dieser Anmelde-Anbieter ist deaktiviert."**
Die Schuladmin hat Microsoft bzw. Google unter **Schul-Einstellungen** deaktiviert. Anbieter wieder aktivieren.

**„Dieses Konto ist deaktiviert."**
Das Konto wurde gesperrt. Die Schuladmin kann es unter **Personen** wieder entsperren.

**Logo/Bilder werden nicht angezeigt.**
Prüfen Sie, ob der Objektspeicher (MinIO) läuft und `S3_ENDPOINT` für Browser erreichbar ist. Health-Check beachten.

**Health zeigt `degraded`.**
Mindestens einer der Dienste DB/Redis/S3 ist nicht erreichbar – Container-Status mit `docker compose ps` prüfen.

**Migrationsfehler beim Start.**
`npm run prisma:migrate` ausführen; sicherstellen, dass `DATABASE_URL` korrekt ist und PostgreSQL läuft.

---

## 17. Glossar

| Begriff              | Erläuterung                                    |
| -------------------- | ---------------------------------------------- |
| **RBAC**             | Rollenbasierte Zugriffskontrolle.              |
| **JWT**              | Signiertes Anmelde-Token der API.              |
| **OIDC / SSO**       | Single Sign-On über Microsoft/Google.          |
| **Tenant / Mandant** | Eine Schule als abgegrenzter Datenraum.        |
| **S3 / MinIO**       | Objektspeicher für Dateien.                    |
| **Stub-Modus**       | KI liefert Testantworten ohne externen Aufruf. |
| **Modulanlass**      | Durchführung eines Moduls mit einer Klasse.    |

### Glossar (ICT-BBCH-Begriffe)

| Begriff                       | Bedeutung                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Modul**                     | Inhaltliche Einheit der Grundbildung (z.B. Modul 293). Grundlage ist die _Modulidentifikation_ aus dem Modulbaukasten. |
| **Modulidentifikation**       | Offizielle Beschreibung eines Moduls inkl. Handlungsziele. Quelle: [modulbaukasten.ch](https://www.modulbaukasten.ch). |
| **Handlungsziel (HZ)**        | Beschreibung dessen, was in einer beruflichen Handlungssituation erreicht werden soll. Grundlage der Kompetenzen.      |
| **Kompetenzmatrix**           | Tabellarische Überführung der Handlungsziele in Kompetenzen. National i.d.R. eine pro Modulidentifikation.             |
| **Kompetenzband**             | Thematisch zusammenhängende Gruppe von Kompetenzen (z.B. A1, B1, C1). Referenziert 1–n Handlungsziele.                 |
| **Gütestufe**                 | Niveaustufe der Kompetenz: Beginner, Intermediate, Advanced, (nicht erfüllt).                                          |
| **Kompetenzfeld**             | Schnittpunkt von Kompetenzband × Gütestufe in der Matrix.                                                              |
| **Deskriptor**                | „Ich kann …"-Beschreibung einer Kompetenz in einem Kompetenzfeld.                                                      |
| **Bewertungsraster**          | Konkretes Beurteilungsinstrument je Lernsituation/Leistungsnachweis: Kriterien + Indikatoren je Gütestufe.             |
| **Kriterium**                 | Kurzbeschreibung der Zielhandlung im Bewertungsraster (z.B. „Container-Umgebung definieren").                          |
| **Indikator**                 | Beobachtbare Beschreibung der erwarteten Leistung je Gütestufe.                                                        |
| **Leistungsbeurteilung (LB)** | Überprüfung des Kompetenzerwerbs anhand der Kompetenzmatrix als Referenz.                                              |
| **Kompetenznachweis**         | In dieser App: konkrete Lernaufgabe, mit der eine Kompetenz belegt wird (Upload, Quiz, Fachgespräch …).                |
| **Lernpfad**                  | Alternative, didaktisch sinnvollere Reihenfolge der Kompetenzen durch die Matrix.                                      |
| **MLP**                       | Modullehrplan der Berufsfachschule.                                                                                    |
| **üK**                        | Überbetrieblicher Kurs.                                                                                                |
| **EFZ**                       | Eidgenössisches Fähigkeitszeugnis.                                                                                     |

### Gütestufen & Noten-Richtwerte

| Gütestufe     | Kürzel | Note (Richtwert) | Beschreibung (verkürzt)                                            |
| ------------- | ------ | ---------------- | ------------------------------------------------------------------ |
| Beginner      | B      | 3.0              | Kann Teile der geforderten Kompetenzen anwenden.                   |
| Intermediate  | I      | 4.5              | Beherrscht die selbständige Anwendung.                             |
| Advanced      | A      | 6.0              | Beherrscht die fachgerechte Anwendung.                             |
| Nicht erfüllt | 0      | –                | Kompetenzband nicht bearbeitet (nur im Bewertungsraster vermerkt). |

> ⚠️ Die **Gewichtung der Kompetenzbänder** und die **Notenvergabe je Gütestufe** wird durch den
> Lernort (die Lehrperson/Schule) festgelegt. Die App stellt die Richtwerte als Default bereit,
> erlaubt aber lernortspezifische Anpassung.

---

## 18 Lizenz

Dieses Projekt steht unter der **GNU Affero General Public License v3.0 (AGPLv3)**.
Details findest du in der Datei [LICENSE](LICENSE).

**Wichtig (AGPL §13 – Netzwerk-Nutzung):** Wird eine **modifizierte Version über ein Netzwerk** betrieben, muss den Nutzer:innen der **Quellcode** zugänglich gemacht werden. In der App ist dafür ein „Quellcode"-Link im Seitenmenü hinterlegt; beim Self-Hosting einer angepassten Variante diesen auf das eigene Repository setzen.

Wenn du Funktionen erweiterst oder Fehler behebst, freuen wir uns über einen Pull Request hier im Haupt-Repository!

---

_KompetenzHub · Benutzerhandbuch · weitere technische Dokumentation siehe Ordner `docs/`._
