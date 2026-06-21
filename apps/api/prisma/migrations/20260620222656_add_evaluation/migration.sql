-- CreateEnum
CREATE TYPE "AchievedLevel" AS ENUM ('NOT_MET', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "EvaluationChangeType" AS ENUM ('CREATED', 'UPDATED', 'REJECTED', 'REOPENED');

-- CreateEnum
CREATE TYPE "EvaluationSource" AS ENUM ('TEACHER', 'AI');

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "achievedLevel" "AchievedLevel",
    "points" DECIMAL(6,2),
    "feedback" TEXT NOT NULL DEFAULT '',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationHistory" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changeType" "EvaluationChangeType" NOT NULL,
    "achievedLevel" "AchievedLevel",
    "points" DECIMAL(6,2),
    "feedback" TEXT,
    "source" "EvaluationSource" NOT NULL DEFAULT 'TEACHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_submissionId_key" ON "Evaluation"("submissionId");

-- CreateIndex
CREATE INDEX "EvaluationHistory_submissionId_createdAt_idx" ON "EvaluationHistory"("submissionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationHistory" ADD CONSTRAINT "EvaluationHistory_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationHistory" ADD CONSTRAINT "EvaluationHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
