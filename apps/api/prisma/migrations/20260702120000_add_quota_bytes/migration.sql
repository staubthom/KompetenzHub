-- AlterTable: Speicherquota der Schule (null = unbegrenzt)
ALTER TABLE "Tenant" ADD COLUMN "quotaBytes" BIGINT;

-- AlterTable: persönliche Speicherquota je Mitgliedschaft/Lehrperson (null = unbegrenzt)
ALTER TABLE "Membership" ADD COLUMN "quotaBytes" BIGINT;
