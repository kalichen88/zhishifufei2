-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CommissionLevel" AS ENUM ('LEVEL_1', 'LEVEL_2');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('CREDITED', 'REVERSED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "AgentAccount" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "inviteCode" TEXT NOT NULL,
    "commissionRateL1" INTEGER NOT NULL DEFAULT 3000,
    "commissionRateL2" INTEGER NOT NULL DEFAULT 1000,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "referredByAgentId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentReferral" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "viewerAccountId" TEXT NOT NULL,
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCommission" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "viewerAccountId" TEXT NOT NULL,
    "level" "CommissionLevel" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'CREDITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentWithdrawal" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "accountInfo" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT NOT NULL DEFAULT '',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentAccount_username_key" ON "AgentAccount"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAccount_inviteCode_key" ON "AgentAccount"("inviteCode");

-- CreateIndex
CREATE INDEX "AgentAccount_referredByAgentId_idx" ON "AgentAccount"("referredByAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentReferral_viewerAccountId_key" ON "AgentReferral"("viewerAccountId");

-- CreateIndex
CREATE INDEX "AgentReferral_agentId_idx" ON "AgentReferral"("agentId");

-- CreateIndex
CREATE INDEX "AgentCommission_agentId_createdAt_idx" ON "AgentCommission"("agentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCommission_agentId_orderId_level_key" ON "AgentCommission"("agentId", "orderId", "level");

-- CreateIndex
CREATE INDEX "AgentWithdrawal_agentId_status_idx" ON "AgentWithdrawal"("agentId", "status");

-- AddForeignKey
ALTER TABLE "AgentAccount" ADD CONSTRAINT "AgentAccount_referredByAgentId_fkey" FOREIGN KEY ("referredByAgentId") REFERENCES "AgentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentReferral" ADD CONSTRAINT "AgentReferral_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCommission" ADD CONSTRAINT "AgentCommission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWithdrawal" ADD CONSTRAINT "AgentWithdrawal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
