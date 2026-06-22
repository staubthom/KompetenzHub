-- CreateTable
CREATE TABLE "AiAssessment" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "suggestedPoints" DECIMAL(6,2),
    "suggestedLevel" "AchievedLevel",
    "feedback" TEXT NOT NULL DEFAULT '',
    "reasoning" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAssessment_submissionId_createdAt_idx" ON "AiAssessment"("submissionId", "createdAt");
