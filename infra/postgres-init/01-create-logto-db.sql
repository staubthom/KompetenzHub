-- Eigene Datenbank fuer den Identity-Provider (Logto) im selben Postgres-Server.
-- Wird nur beim ERSTEN Start (leeres Daten-Volume) automatisch ausgefuehrt.
-- Bei bestehendem Volume einmalig manuell anlegen:
--   docker compose -f docker-compose_dev.yaml exec postgres createdb -U kompetenzhub logto
SELECT 'CREATE DATABASE logto'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'logto') \gexec
