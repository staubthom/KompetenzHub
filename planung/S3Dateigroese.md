NOch nicht umsetzen: ISt es möglich dass Pro Lehrperson angegeben werden kann wie viel Platz er mit seinen Klassen im S3 Store verbraucht? ICh überlege mir auch ob man ein abrechnungsmodell einführen könnte.

Grundsätzlich: ja, möglich — aber es fehlen zwei Bausteine

1. Dateigrößen werden aktuell nicht gespeichert
   sizeBytes wird beim Upload nur validiert (evidence.service.ts requestUpload), aber nirgends persistiert. In Submission stehen nur fileKey/fileName, und das content-JSON hält files: [{key, name, kind}] — ohne Größe. Für eine verlässliche Abrechnung müsste die Größe pro Objekt in der DB landen (beim Upload-Confirm), sonst muss man den ganzen Bucket scannen und jedes Objekt per HEAD messen.

2. S3-Keys enthalten keine Zuordnung zu Lehrperson/Klasse/Schule
   Die Keys sind evidence/{evidenceId}/uuid-datei, dazu attachments/, files/ (Klassen-Archiv), rte/ (öffentliche Bilder). Kein tenantId, kein Lehrer, keine Klasse im Pfad. totalSize() in s3.service.ts:172 liefert daher nur die Gesamtgröße des ganzen Buckets (alle Schulen gemischt) — nicht mal pro Mandant direkt ableitbar.

Die Zuordnung geht nur über die DB-Join-Kette:

Submission → Enrollment → Class.ownerId (= verantwortliche Lehrperson)
→ ClassTeacher (= Co-Leitungen)
Das ist sauber machbar für Einreichungen von Lernenden. Schwieriger sind:

Lehrer-Anhänge/Aufgaben (evidence/attachments): hängen am Modul (Module.ownerId), nicht an der Klasse — ein Modul kann von mehreren Klassen/Lehrpersonen genutzt werden.
RTE-Bilder (rte/): der Uploader wird nirgends festgehalten → aktuell nicht attribuierbar.
Empfohlener Weg (wenn ihr es angeht)
DB-seitige Verbuchung statt S3-Scan:

sizeBytes pro Objekt beim Upload-Confirm speichern (auf Submission bzw. pro Datei im content).
Aggregation per SQL über die Join-Kette → Verbrauch pro Class.ownerId / pro Klasse / pro Mandant.
Für Alt-Bestände einmalig ein Backfill (S3 listen + HEAD + Key→Submission mappen).
Vorteil: schnelle Abfragen, exakte Zuordnung, keine teuren Bucket-Scans. Ein periodischer Reconcile-Job kann zusätzlich Waisen (gelöschte Submissions, verwaiste RTE-Bilder) erkennen.

Zum Abrechnungsmodell — meine Einschätzung
Die natürliche Abrechnungseinheit ist die Schule (Tenant), nicht die einzelne Lehrperson — die Schule ist der Vertragspartner. „Pro Lehrperson" ist eher eine interne Kostenzuordnung / Quote innerhalb einer Schule.
Ein Speicher-Wert wird nur dann fair, wenn es eine Retention-/Cleanup-Policy gibt (archivierte Klassen, abgewiesene Einreichungen, verwaiste Bilder) — sonst zahlt man für Müll.
Durchsetzung ließe sich elegant am bestehenden presignUpload andocken: dort schon heute maxFileSizeMb — analog eine Quota-Prüfung pro Lehrperson/Mandant vor der Freigabe (soft warning / hard block).
Realistisch als Stufenmodell: Basiskontingent pro Schule + Verbrauch pro Lehrperson als Reporting, optional Quoten.
Offene Entscheidungen (für später)
Zählt Verbrauch nur dem Owner oder anteilig auch Co-Leitungen?
Modul-Anhänge/RTE-Bilder: dem Modul-Owner zurechnen oder als „geteilt/Schule" separat führen?
Abrechnungseinheit: Schule (empfohlen) vs. Lehrperson.
Wenn ihr das später umsetzt, würde ich mit Baustein 1 (Größen persistieren + Backfill) anfangen — das ist die Voraussetzung für alles Weitere und für sich schon nützlich (echte Auslastung pro Schule/Lehrperson im Admin sichtbar). Sag Bescheid, dann skizziere ich Schema-Änderung und Aggregations-Query konkret.
