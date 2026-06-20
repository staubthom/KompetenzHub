-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('QUIZ', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('OPEN', 'SUBMITTED', 'IN_REVIEW', 'GRADED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "CompetenceEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "title" JSONB NOT NULL DEFAULT '{}',
    "instructions" JSONB NOT NULL DEFAULT '{}',
    "maxPoints" DECIMAL(6,2),
    "targetLevel" "CompetenceLevel",
    "isVisible" BOOLEAN NOT NULL DEFAULT false,
    "availableFrom" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetenceEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceField" (
    "evidenceId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,

    CONSTRAINT "EvidenceField_pkey" PRIMARY KEY ("evidenceId","fieldId")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'OPEN',
    "content" JSONB NOT NULL DEFAULT '{}',
    "points" DECIMAL(6,2),
    "fileKey" TEXT,
    "fileName" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetenceEvidence_tenantId_idx" ON "CompetenceEvidence"("tenantId");

-- CreateIndex
CREATE INDEX "CompetenceEvidence_moduleId_idx" ON "CompetenceEvidence"("moduleId");

-- CreateIndex
CREATE INDEX "EvidenceField_fieldId_idx" ON "EvidenceField"("fieldId");

-- CreateIndex
CREATE INDEX "Submission_evidenceId_enrollmentId_attempt_idx" ON "Submission"("evidenceId", "enrollmentId", "attempt");

-- AddForeignKey
ALTER TABLE "CompetenceEvidence" ADD CONSTRAINT "CompetenceEvidence_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceField" ADD CONSTRAINT "EvidenceField_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "CompetenceEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceField" ADD CONSTRAINT "EvidenceField_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CompetenceField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "CompetenceEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
