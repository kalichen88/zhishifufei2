-- CreateEnum
CREATE TYPE "ViewerOrderType" AS ENUM ('MEMBERSHIP_PLAN', 'CONTENT_PURCHASE');

-- CreateEnum
CREATE TYPE "ViewerOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED');

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "viewerAccountId" TEXT NOT NULL,
    "orderType" "ViewerOrderType" NOT NULL,
    "status" "ViewerOrderStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "membershipPlanId" TEXT,
    "contentItemId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewerOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembershipPlan_isActive_idx" ON "MembershipPlan"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ViewerOrder_orderNo_key" ON "ViewerOrder"("orderNo");

-- CreateIndex
CREATE INDEX "ViewerOrder_viewerAccountId_status_idx" ON "ViewerOrder"("viewerAccountId", "status");

-- CreateIndex
CREATE INDEX "ViewerOrder_membershipPlanId_idx" ON "ViewerOrder"("membershipPlanId");

-- CreateIndex
CREATE INDEX "ViewerOrder_contentItemId_idx" ON "ViewerOrder"("contentItemId");

-- AddForeignKey
ALTER TABLE "ViewerOrder" ADD CONSTRAINT "ViewerOrder_viewerAccountId_fkey" FOREIGN KEY ("viewerAccountId") REFERENCES "ViewerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerOrder" ADD CONSTRAINT "ViewerOrder_membershipPlanId_fkey" FOREIGN KEY ("membershipPlanId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerOrder" ADD CONSTRAINT "ViewerOrder_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
