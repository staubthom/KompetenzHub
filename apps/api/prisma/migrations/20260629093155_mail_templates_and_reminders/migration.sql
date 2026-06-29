-- CreateEnum
CREATE TYPE "MailTemplateType" AS ENUM ('INVITE', 'INVITE_REMINDER', 'DIGEST', 'WEEKLY_REPORT', 'SECURITY_ALERT');

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "remindedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MailTemplate" (
    "tenantId" TEXT NOT NULL,
    "type" "MailTemplateType" NOT NULL,
    "locale" "Locale" NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailTemplate_pkey" PRIMARY KEY ("tenantId","type","locale")
);

-- CreateIndex
CREATE INDEX "MailTemplate_tenantId_idx" ON "MailTemplate"("tenantId");

-- AddForeignKey
ALTER TABLE "MailTemplate" ADD CONSTRAINT "MailTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
