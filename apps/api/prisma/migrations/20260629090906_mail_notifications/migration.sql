-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyDigest" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "DigestState" (
    "tenantId" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigestState_pkey" PRIMARY KEY ("tenantId")
);

-- AddForeignKey
ALTER TABLE "DigestState" ADD CONSTRAINT "DigestState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
