-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('BASIC', 'PREMIUM');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('DRAFT', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('INITIATED', 'PENDING_VERIFICATION', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('GATEWAY', 'MANUAL_STAFF');

-- CreateEnum
CREATE TYPE "CheckInSource" AS ENUM ('QR', 'STAFF_MANUAL');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('FRONT_DESK', 'OWNER');

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'BASIC',
    "expiresAt" TIMESTAMP(3),
    "balanceKobo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "onDuty" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedRecordCard" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "minTier" "Tier" NOT NULL DEFAULT 'BASIC',
    "status" "CardStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "createdByStaffId" TEXT NOT NULL,
    "approvedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "SharedRecordCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardEmbedding" (
    "id" TEXT NOT NULL,
    "sourceCardId" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "tierGate" "Tier" NOT NULL,
    "status" "CardStatus" NOT NULL,
    "embeddedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "locationCode" TEXT NOT NULL,
    "source" "CheckInSource" NOT NULL DEFAULT 'QR',
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'GATEWAY',
    "gatewayRef" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'INITIATED',
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryLog" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "rawQueryText" TEXT NOT NULL,
    "matchedCardId" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "matchedStaffCategory" TEXT,
    "routedToStaff" BOOLEAN NOT NULL DEFAULT false,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlaggedAnswer" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "queryLogId" TEXT NOT NULL,
    "reviewedByOwnerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlaggedAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_phoneNumber_key" ON "Member"("phoneNumber");

-- CreateIndex
CREATE INDEX "CardEmbedding_status_tierGate_idx" ON "CardEmbedding"("status", "tierGate");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "QueryLog_askedAt_idx" ON "QueryLog"("askedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FlaggedAnswer_queryLogId_key" ON "FlaggedAnswer"("queryLogId");

-- AddForeignKey
ALTER TABLE "CardEmbedding" ADD CONSTRAINT "CardEmbedding_sourceCardId_fkey" FOREIGN KEY ("sourceCardId") REFERENCES "SharedRecordCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryLog" ADD CONSTRAINT "QueryLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlaggedAnswer" ADD CONSTRAINT "FlaggedAnswer_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlaggedAnswer" ADD CONSTRAINT "FlaggedAnswer_queryLogId_fkey" FOREIGN KEY ("queryLogId") REFERENCES "QueryLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
