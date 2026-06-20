-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER', 'LEARNER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('MICROSOFT', 'GOOGLE');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('de', 'fr', 'it', 'en');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CompetenceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantBranding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#2563eb',
    "secondaryColor" TEXT,
    "logoLightKey" TEXT,
    "logoDarkKey" TEXT,
    "faviconKey" TEXT,
    "displayName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "authProvider" "AuthProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'de',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT,
    "number" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL DEFAULT '{}',
    "profession" TEXT,
    "status" "ModuleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionGoal" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "text" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetenceMatrix" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ModuleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetenceMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetenceBand" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" JSONB NOT NULL DEFAULT '{}',
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetenceBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandActionGoal" (
    "bandId" TEXT NOT NULL,
    "actionGoalId" TEXT NOT NULL,

    CONSTRAINT "BandActionGoal_pkey" PRIMARY KEY ("bandId","actionGoalId")
);

-- CreateTable
CREATE TABLE "CompetenceField" (
    "id" TEXT NOT NULL,
    "bandId" TEXT NOT NULL,
    "level" "CompetenceLevel" NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetenceField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Descriptor" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "text" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Descriptor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantBranding_tenantId_key" ON "TenantBranding"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_authProvider_externalId_key" ON "User"("authProvider", "externalId");

-- CreateIndex
CREATE INDEX "Membership_tenantId_idx" ON "Membership"("tenantId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_userId_role_key" ON "Membership"("tenantId", "userId", "role");

-- CreateIndex
CREATE INDEX "Module_tenantId_idx" ON "Module"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Module_tenantId_number_key" ON "Module"("tenantId", "number");

-- CreateIndex
CREATE INDEX "ActionGoal_moduleId_idx" ON "ActionGoal"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetenceMatrix_moduleId_key" ON "CompetenceMatrix"("moduleId");

-- CreateIndex
CREATE INDEX "CompetenceBand_matrixId_idx" ON "CompetenceBand"("matrixId");

-- CreateIndex
CREATE INDEX "BandActionGoal_actionGoalId_idx" ON "BandActionGoal"("actionGoalId");

-- CreateIndex
CREATE INDEX "CompetenceField_bandId_idx" ON "CompetenceField"("bandId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetenceField_bandId_level_key" ON "CompetenceField"("bandId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Descriptor_fieldId_key" ON "Descriptor"("fieldId");

-- AddForeignKey
ALTER TABLE "TenantBranding" ADD CONSTRAINT "TenantBranding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionGoal" ADD CONSTRAINT "ActionGoal_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetenceMatrix" ADD CONSTRAINT "CompetenceMatrix_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetenceBand" ADD CONSTRAINT "CompetenceBand_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "CompetenceMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandActionGoal" ADD CONSTRAINT "BandActionGoal_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "CompetenceBand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandActionGoal" ADD CONSTRAINT "BandActionGoal_actionGoalId_fkey" FOREIGN KEY ("actionGoalId") REFERENCES "ActionGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetenceField" ADD CONSTRAINT "CompetenceField_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "CompetenceBand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Descriptor" ADD CONSTRAINT "Descriptor_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CompetenceField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
