-- CreateTable
CREATE TABLE "AiConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "apiKeyEnc" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiConfig_tenantId_idx" ON "AiConfig"("tenantId");

-- CreateIndex
CREATE INDEX "AiConfig_userId_idx" ON "AiConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AiConfig_tenantId_userId_key" ON "AiConfig"("tenantId", "userId");
