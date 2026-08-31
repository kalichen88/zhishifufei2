-- CreateEnum
CREATE TYPE "CloudSyncState" AS ENUM ('ACTIVE', 'OFFLINE', 'DELETED');

-- CreateEnum
CREATE TYPE "PublishState" AS ENUM ('DRAFT', 'REVIEWING', 'PUBLISHED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "WebhookEventType" AS ENUM ('RESOURCE_DELETED', 'RESOURCE_OFFLINE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WebhookProcessState" AS ENUM ('PENDING', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "CsvImportStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "CloudMediaAsset" (
    "id" TEXT NOT NULL,
    "cloudVid" TEXT NOT NULL,
    "cloudInternalId" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL DEFAULT '',
    "categoryName" TEXT NOT NULL DEFAULT '',
    "durationSec" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "sourceMd5" TEXT NOT NULL DEFAULT '',
    "hasStaticCover" BOOLEAN NOT NULL DEFAULT false,
    "hasGifCover" BOOLEAN NOT NULL DEFAULT false,
    "staticCoverUrl" TEXT,
    "gifCoverUrl" TEXT,
    "resourceUrl" TEXT,
    "resourceUrl2" TEXT,
    "playUrl" TEXT,
    "urlExpiresAt" INTEGER NOT NULL DEFAULT 0,
    "cloudStatus" INTEGER NOT NULL DEFAULT 0,
    "cloudSyncState" "CloudSyncState" NOT NULL DEFAULT 'OFFLINE',
    "publishState" "PublishState" NOT NULL DEFAULT 'DRAFT',
    "cloudCreatedAt" INTEGER NOT NULL DEFAULT 0,
    "cloudUpdatedAt" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudSyncCursor" (
    "id" TEXT NOT NULL,
    "cursorKey" TEXT NOT NULL,
    "lastUpdatedAfter" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudSyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventType" "WebhookEventType" NOT NULL,
    "eventKey" TEXT NOT NULL,
    "cloudInternalId" INTEGER NOT NULL DEFAULT 0,
    "cloudVid" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processState" "WebhookProcessState" NOT NULL DEFAULT 'PENDING',
    "processNote" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "CloudWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CsvImportBatch" (
    "id" TEXT NOT NULL,
    "status" "CsvImportStatus" NOT NULL DEFAULT 'PENDING',
    "sourceName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CsvImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CloudMediaAsset_cloudVid_key" ON "CloudMediaAsset"("cloudVid");

-- CreateIndex
CREATE INDEX "CloudMediaAsset_sourceMd5_idx" ON "CloudMediaAsset"("sourceMd5");

-- CreateIndex
CREATE INDEX "CloudMediaAsset_cloudSyncState_idx" ON "CloudMediaAsset"("cloudSyncState");

-- CreateIndex
CREATE INDEX "CloudMediaAsset_urlExpiresAt_idx" ON "CloudMediaAsset"("urlExpiresAt");

-- CreateIndex
CREATE INDEX "CloudMediaAsset_categoryName_idx" ON "CloudMediaAsset"("categoryName");

-- CreateIndex
CREATE INDEX "CloudMediaAsset_cloudUpdatedAt_idx" ON "CloudMediaAsset"("cloudUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CloudSyncCursor_cursorKey_key" ON "CloudSyncCursor"("cursorKey");

-- CreateIndex
CREATE UNIQUE INDEX "CloudWebhookEvent_eventKey_key" ON "CloudWebhookEvent"("eventKey");

-- CreateIndex
CREATE INDEX "CloudWebhookEvent_cloudVid_idx" ON "CloudWebhookEvent"("cloudVid");

-- CreateIndex
CREATE INDEX "CloudWebhookEvent_processState_idx" ON "CloudWebhookEvent"("processState");
