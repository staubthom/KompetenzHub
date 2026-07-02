-- CreateTable
CREATE TABLE "ConsumedHandoff" (
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumedHandoff_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "ConsumedHandoff_expiresAt_idx" ON "ConsumedHandoff"("expiresAt");
