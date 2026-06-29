So testest du das Ganze
1. Lokalen Mailserver starten (empfohlen: Mailpit)
Damit du Mails real siehst, ohne echten SMTP:


`docker run -d --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit`

Web-Oberfläche mit allen empfangenen Mails: http://localhost:8025

2. SMTP in deiner .env setzen (Repo-Root) und API neu starten

`SMTP_HOST=localhost`
`SMTP_PORT=1025`
`SMTP_SECURE=false`
`MAIL_FROM=KompetenzHub <no-reply@schule.ch>`
API neu starten, damit die Variablen greifen.

3. Features durchklicken (als Admin angemeldet)
Einladung: Admin → Einladungen → Lehrperson einladen → Mail erscheint in Mailpit.
Tages-Digest / Wochenbericht / Reminder: Admin → E-Mail-Vorlagen → Buttons unter „Manuell auslösen". Der Toast zeigt die Anzahl versendeter Mails. (Für Digest-Inhalt vorher als Lernende:r etwas abgeben und als Lehrperson bewerten.)
Template anpassen: auf derselben Seite Typ + Sprache wählen, Betreff/Text ändern, speichern → erneut auslösen → die Mail nutzt deinen Text. „Zurücksetzen" stellt den Standard wieder her.
Einladungs-Reminder mit Inhalt: der Reminder verschickt nur Einladungen, die älter als 7 Tage sind. Zum Sofort-Test in Prisma Studio (npm run prisma:studio --workspace apps/api) bei einer offenen Einladung createdAt zurückdatieren und remindedAt leeren, dann Button erneut drücken.
Security-Alert: greift nur beim echten IdP-Login (/auth/exchange) von einer neuen IP — lokal mit Dev-Login nicht auslösbar. Die Logik ist per Smoke/Code abgedeckt.
4. Automatischer Smoke-Test
Bei laufender API:


npm run smoke:mail --workspace apps/api
Prüft Einladungs-Mailpfad, Opt-out, alle drei Läufe und die komplette Template-Verwaltung inkl. RBAC.

Soll ich die geplanten Cron-Zeiten (04:00 / Mo 06:00 / 05:00) noch über Env-Variablen konfigurierbar machen, oder passt das fix so?