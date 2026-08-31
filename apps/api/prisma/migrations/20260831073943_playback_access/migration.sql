-- CreateEnum
CREATE TYPE "ContentAccessType" AS ENUM ('FREE', 'VIP', 'PAID');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELED');

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cloudVid" TEXT NOT NULL,
    "accessType" "ContentAccessType" NOT NULL DEFAULT 'FREE',
    "previewDurationSec" INTEGER NOT NULL DEFAULT 0,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "publishState" "PublishState" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerAccount" (
    "id" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerMembership" (
    "id" TEXT NOT NULL,
    "viewerAccountId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAtUnix" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewerMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybackEntitlement" (
    "id" TEXT NOT NULL,
    "viewerAccountId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "expiresAtUnix" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybackEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_cloudVid_key" ON "ContentItem"("cloudVid");

-- CreateIndex
CREATE INDEX "ContentItem_publishState_idx" ON "ContentItem"("publishState");

-- CreateIndex
CREATE INDEX "ContentItem_accessType_idx" ON "ContentItem"("accessType");

-- CreateIndex
CREATE UNIQUE INDEX "ViewerAccount_viewerKey_key" ON "ViewerAccount"("viewerKey");

-- CreateIndex
CREATE INDEX "ViewerMembership_viewerAccountId_status_expiresAtUnix_idx" ON "ViewerMembership"("viewerAccountId", "status", "expiresAtUnix");

-- CreateIndex
CREATE INDEX "PlaybackEntitlement_viewerAccountId_idx" ON "PlaybackEntitlement"("viewerAccountId");

-- CreateIndex
CREATE INDEX "PlaybackEntitlement_contentItemId_idx" ON "PlaybackEntitlement"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaybackEntitlement_viewerAccountId_contentItemId_key" ON "PlaybackEntitlement"("viewerAccountId", "contentItemId");

-- AddForeignKey
ALTER TABLE "ViewerMembership" ADD CONSTRAINT "ViewerMembership_viewerAccountId_fkey" FOREIGN KEY ("viewerAccountId") REFERENCES "ViewerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybackEntitlement" ADD CONSTRAINT "PlaybackEntitlement_viewerAccountId_fkey" FOREIGN KEY ("viewerAccountId") REFERENCES "ViewerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybackEntitlement" ADD CONSTRAINT "PlaybackEntitlement_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
