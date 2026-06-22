-- CreateTable
CREATE TABLE "ExpertTalkSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertTalkSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertTalkMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpertTalkMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpertTalkSession_tenantId_idx" ON "ExpertTalkSession"("tenantId");

-- CreateIndex
CREATE INDEX "ExpertTalkSession_userId_idx" ON "ExpertTalkSession"("userId");

-- CreateIndex
CREATE INDEX "ExpertTalkMessage_sessionId_createdAt_idx" ON "ExpertTalkMessage"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ExpertTalkMessage" ADD CONSTRAINT "ExpertTalkMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExpertTalkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
