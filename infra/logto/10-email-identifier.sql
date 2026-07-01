-- KompetenzHub: Logto so vorkonfigurieren, dass bei der Selbst-Registrierung eine
-- E-Mail-Adresse erfasst wird (KompetenzHub identifiziert Nutzer:innen ueber die E-Mail;
-- ohne E-Mail schlaegt /auth/exchange mit "email must be an email" fehl).
--
-- Wird vom Init-Service `logto-init` nach dem ersten Logto-Seed ausgefuehrt.
-- Greift NUR den nutzer-seitigen Tenant `default` (NICHT den Admin-Konsolen-Login `admin`)
-- und NUR solange dort noch der unveraenderte Logto-Standard (`username`) steht – damit
-- spaetere Anpassungen der Schuladmin in der Logto-Konsole bei Neustarts erhalten bleiben.
--
-- `verify: false` = keine E-Mail-Verifikation noetig (Logto braucht sonst SMTP).
UPDATE sign_in_experiences
SET
  sign_up = '{"verify": false, "password": true, "identifiers": ["email"]}'::jsonb,
  sign_in = '{"methods": [{"password": true, "identifier": "email", "verificationCode": false, "isPasswordPrimary": true}]}'::jsonb
WHERE tenant_id = 'default'
  AND sign_up = '{"verify": false, "password": true, "identifiers": ["username"]}'::jsonb;
