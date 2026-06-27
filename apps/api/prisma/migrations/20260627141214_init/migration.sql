-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER', 'LEARNER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('MICROSOFT', 'GOOGLE', 'GITHUB');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('de', 'fr', 'it', 'en');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CompetenceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PENDING', 'REMOVED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('QUIZ', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('OPEN', 'SUBMITTED', 'IN_REVIEW', 'GRADED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AchievedLevel" AS ENUM ('NOT_MET', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "EvaluationChangeType" AS ENUM ('CREATED', 'UPDATED', 'REJECTED', 'REOPENED');

-- CreateEnum
CREATE TYPE "EvaluationSource" AS ENUM ('TEACHER', 'AI');

-- CreateEnum
CREATE TYPE "PluginInstallStatus" AS ENUM ('INSTALLED', 'INCOMPATIBLE', 'CONFLICT', 'DISABLED');

-- CreateEnum
CREATE TYPE "PluginTenantStatus" AS ENUM ('ENABLED', 'DISABLED', 'ERROR');

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
    "theme" TEXT NOT NULL DEFAULT 'light',
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
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER,
    "schoolYear" TEXT,
    "moduleId" TEXT,
    "status" "ClassStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassTeacher" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoinCode" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

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
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE "PluginInstallation" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "installedVersion" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "status" "PluginInstallStatus" NOT NULL DEFAULT 'INSTALLED',
    "lastError" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginTenantActivation" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledVersion" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "PluginTenantStatus" NOT NULL DEFAULT 'DISABLED',
    "lastError" TEXT,
    "enabledAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "PluginTenantActivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginRecord" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginSecret" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "tenantId" TEXT,
    "key" TEXT NOT NULL,
    "valueEnc" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginSecret_pkey" PRIMARY KEY ("id")
);

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
    "shareWithLearners" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConfig_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "ExpertTalkSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '',
    "mode" TEXT NOT NULL DEFAULT 'topic',
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
CREATE INDEX "Invitation_tenantId_idx" ON "Invitation"("tenantId");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tenantId_email_key" ON "Invitation"("tenantId", "email");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

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

-- CreateIndex
CREATE INDEX "Class_tenantId_idx" ON "Class"("tenantId");

-- CreateIndex
CREATE INDEX "Class_ownerId_idx" ON "Class"("ownerId");

-- CreateIndex
CREATE INDEX "ClassTeacher_classId_idx" ON "ClassTeacher"("classId");

-- CreateIndex
CREATE INDEX "ClassTeacher_userId_idx" ON "ClassTeacher"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassTeacher_classId_userId_key" ON "ClassTeacher"("classId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "JoinCode_code_key" ON "JoinCode"("code");

-- CreateIndex
CREATE INDEX "JoinCode_classId_isActive_idx" ON "JoinCode"("classId", "isActive");

-- CreateIndex
CREATE INDEX "Enrollment_classId_idx" ON "Enrollment"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_classId_userId_key" ON "Enrollment"("classId", "userId");

-- CreateIndex
CREATE INDEX "CompetenceEvidence_tenantId_idx" ON "CompetenceEvidence"("tenantId");

-- CreateIndex
CREATE INDEX "CompetenceEvidence_moduleId_idx" ON "CompetenceEvidence"("moduleId");

-- CreateIndex
CREATE INDEX "EvidenceField_fieldId_idx" ON "EvidenceField"("fieldId");

-- CreateIndex
CREATE INDEX "Submission_evidenceId_enrollmentId_attempt_idx" ON "Submission"("evidenceId", "enrollmentId", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_submissionId_key" ON "Evaluation"("submissionId");

-- CreateIndex
CREATE INDEX "EvaluationHistory_submissionId_createdAt_idx" ON "EvaluationHistory"("submissionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PluginInstallation_pluginId_key" ON "PluginInstallation"("pluginId");

-- CreateIndex
CREATE INDEX "PluginTenantActivation_tenantId_idx" ON "PluginTenantActivation"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PluginTenantActivation_pluginId_tenantId_key" ON "PluginTenantActivation"("pluginId", "tenantId");

-- CreateIndex
CREATE INDEX "PluginRecord_pluginId_tenantId_collection_idx" ON "PluginRecord"("pluginId", "tenantId", "collection");

-- CreateIndex
CREATE UNIQUE INDEX "PluginRecord_pluginId_tenantId_collection_key_key" ON "PluginRecord"("pluginId", "tenantId", "collection", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PluginSecret_pluginId_tenantId_key_key" ON "PluginSecret"("pluginId", "tenantId", "key");

-- CreateIndex
CREATE INDEX "AiConfig_tenantId_idx" ON "AiConfig"("tenantId");

-- CreateIndex
CREATE INDEX "AiConfig_userId_idx" ON "AiConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AiConfig_tenantId_userId_key" ON "AiConfig"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AiAssessment_submissionId_createdAt_idx" ON "AiAssessment"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "ExpertTalkSession_tenantId_idx" ON "ExpertTalkSession"("tenantId");

-- CreateIndex
CREATE INDEX "ExpertTalkSession_userId_idx" ON "ExpertTalkSession"("userId");

-- CreateIndex
CREATE INDEX "ExpertTalkMessage_sessionId_createdAt_idx" ON "ExpertTalkMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "LearningPath_matrixId_idx" ON "LearningPath"("matrixId");

-- CreateIndex
CREATE INDEX "LearningPathStep_pathId_sortOrder_idx" ON "LearningPathStep"("pathId", "sortOrder");

-- CreateIndex
CREATE INDEX "LearningPathStep_fieldId_idx" ON "LearningPathStep"("fieldId");

-- AddForeignKey
ALTER TABLE "TenantBranding" ADD CONSTRAINT "TenantBranding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacher" ADD CONSTRAINT "ClassTeacher_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacher" ADD CONSTRAINT "ClassTeacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinCode" ADD CONSTRAINT "JoinCode_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationHistory" ADD CONSTRAINT "EvaluationHistory_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationHistory" ADD CONSTRAINT "EvaluationHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertTalkMessage" ADD CONSTRAINT "ExpertTalkMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExpertTalkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "CompetenceMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPathStep" ADD CONSTRAINT "LearningPathStep_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPathStep" ADD CONSTRAINT "LearningPathStep_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CompetenceField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
