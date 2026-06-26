-- CreateEnum
CREATE TYPE "PluginInstallStatus" AS ENUM ('INSTALLED', 'INCOMPATIBLE', 'CONFLICT', 'DISABLED');

-- CreateEnum
CREATE TYPE "PluginTenantStatus" AS ENUM ('ENABLED', 'DISABLED', 'ERROR');

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
