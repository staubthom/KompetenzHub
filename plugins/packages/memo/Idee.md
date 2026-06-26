
Konzept: Plugin "Dossier- & Memo-Assistent" (Interne Lehrpersonen-Notizen)
1. Grundidee & Zielsetzung
Das Plugin erweitert den KompetenzHub um ein digitales, geschütztes Notizbuch für Lehrpersonen. Es löst das Problem, dass Lehrpersonen administrative To-Dos, Beobachtungen oder organisatorische Details zu einzelnen Lernenden oft auf physischen Zetteln oder in externen Tools (wie OneNote/Excel) festhalten müssen. Alle Notizen sind strikt kontextbezogen (an ein Modul und einen Lernenden gekoppelt) und privat (nur für die unterrichtende Lehrperson und Stellvertretungen sichtbar).

2. Kernfunktionen & User Experience (UX)
Der "Memo-Button" in der Modulanlass Ansicht:
Wenn die Lehrperson den Modulanlass ansieht befindet sich neben dem Namen des Lernenden ein kleines Notiz-Symbol. Ein Klick darauf öffnet ein schnelles Overlay (Sidebar oder Modal) für Notizen, ohne dass man die aktuelle Seite verlassen muss.

Kategorisierung (Tags):
Damit die Notizen strukturiert bleiben, kann man ihnen beim Tippen direkt einen Typ zuweisen:

📌 To-Do / Nachforderung (z. B. "Noch Artefakt XY einfordern")

📅 Absenz / Organisation (z. B. "Am 15.09. im Überbetrieblichen Kurs (ÜK)")

💬 Pädagogische Notiz (z. B. "Fachgespräch abgebrochen – wirkte sehr nervös, Nachholtermin vereinbaren")

Status-Tracking (Erledigt-Haken):
Notizen, die ein To-Do beinhalten, können als "offen" markiert werden. Sobald der Lernende die Aufgabe nachgereicht oder das Gespräch nachgeholt hat, hakt die Lehrperson die Notiz ab.

3. Technische & Datenschutz-Anforderungen (Wichtig für Schulen)
Strikte Rollentrennung (Read/Write ACLs):

Lehrpersonen des Modulanlasses: Vollzugriff (Lesen, Schreiben, Bearbeiten, Löschen).

Co-Teacher / Stellvertretungen: Optionaler Lese- oder Schreibzugriff (konfigurierbar).

Lernende: Haben keinerlei Zugriff. Das Plugin liefert die Daten gar nicht erst an den Client des Lernenden aus (API-Sicherheit), um versehentliches Einsehen im Browser-Code zu verhindern.

Modul-Lebenszyklus:
Wenn ein Modulanlass archiviert wird, werden die Notizen standardmässig mitarchiviert.

4. Mehrwert für den Schulalltag
Kein Informationsverlust: Beim Wechsel zwischen verschiedenen Klassen oder Wochen weiss die Lehrperson sofort wieder, was mit welchem Lernenden vereinbart wurde.

Erleichtertes Co-Teaching: Teilen sich zwei Lehrpersonen eine Klasse (z. B. bei grossen IT-Projekten), sehen beide sofort den organisatorischen Stand der Jugendlichen, ohne sich ständig Absprache-Mails schreiben zu müssen.

Faktenbasierte Bewertung: Bei der finalen Notenabgabe oder Zertifizierung hilft das Protokoll, den Lernfortschritt und das Engagement (z. B. Zuverlässigkeit bei Nachforderungen) gerecht zu beurteilen.

5. Es gibt eine Ansicht in der ich für eine Modulanlass alle Notizen einsehen kann. 
