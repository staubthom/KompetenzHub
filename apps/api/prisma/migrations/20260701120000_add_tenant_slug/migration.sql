-- Multi-Tenant: Subdomain-Slug + Aktiv-Flag für Tenants.
-- Additive Migration mit Backfill (kein Datenverlust).

-- 1) Neue Spalten zunächst nullable/mit Default hinzufügen.
ALTER TABLE "Tenant" ADD COLUMN "slug" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- 2) Bestehende Zeilen befüllen: der bekannte Default-Tenant bekommt den
--    sprechenden Slug "default", alle übrigen fallen auf ihre id zurück
--    (garantiert eindeutig).
UPDATE "Tenant" SET "slug" = 'default'
  WHERE "id" = '00000000-0000-0000-0000-000000000001';
UPDATE "Tenant" SET "slug" = "id" WHERE "slug" IS NULL;

-- 3) Jetzt NOT NULL + eindeutigen Index erzwingen.
ALTER TABLE "Tenant" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
