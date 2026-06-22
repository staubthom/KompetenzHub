-- CreateTable
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPathStep" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LearningPathStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningPath_matrixId_idx" ON "LearningPath"("matrixId");

-- CreateIndex
CREATE INDEX "LearningPathStep_pathId_sortOrder_idx" ON "LearningPathStep"("pathId", "sortOrder");

-- CreateIndex
CREATE INDEX "LearningPathStep_fieldId_idx" ON "LearningPathStep"("fieldId");

-- AddForeignKey
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "CompetenceMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPathStep" ADD CONSTRAINT "LearningPathStep_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPathStep" ADD CONSTRAINT "LearningPathStep_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CompetenceField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
