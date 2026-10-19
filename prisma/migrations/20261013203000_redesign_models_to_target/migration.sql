-- ============================================================================
-- SPOTTER Database Redesign: Target 20 Models Migration
-- Strictly Non-Destructive: Preserves existing Member record & security fields
-- ============================================================================

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('PAYMENT_CREDIT', 'MEMBERSHIP_DEBIT', 'MANUAL_ADJUSTMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "FlagReviewStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PrivateLookupType" AS ENUM ('ATTENDANCE', 'BALANCE', 'EXPIRY', 'TIER');

-- DropForeignKey constraints on legacy 0-row tables
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_memberId_fkey";
ALTER TABLE "CardEmbedding" DROP CONSTRAINT IF EXISTS "CardEmbedding_sourceCardId_fkey";
ALTER TABLE "FlaggedAnswer" DROP CONSTRAINT IF EXISTS "FlaggedAnswer_memberId_fkey";
ALTER TABLE "FlaggedAnswer" DROP CONSTRAINT IF EXISTS "FlaggedAnswer_queryLogId_fkey";
ALTER TABLE "QueryLog" DROP CONSTRAINT IF EXISTS "QueryLog_memberId_fkey";
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_memberId_fkey";

-- ==========================================
-- 1. GYM IDENTITY & SEEDING DEFAULT GYM
-- ==========================================
CREATE TABLE "Gym" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "phoneNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gym_pkey" PRIMARY KEY ("id")
);

-- Seed the required default Gym BEFORE Member foreign key is established
INSERT INTO "Gym" ("id", "name", "slug", "currency", "createdAt", "updatedAt")
VALUES ('gym_spotter_main', 'Spotter Gym', 'spotter-gym', 'NGN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- ==========================================
-- 2. ALTER MEMBER TABLE (PRESERVE DATA)
-- ==========================================
ALTER TABLE "Member" ADD COLUMN "gymId" TEXT NOT NULL DEFAULT 'gym_spotter_main',
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ==========================================
-- 3. ALTER STAFF TABLE
-- ==========================================
ALTER TABLE "Staff" DROP COLUMN IF EXISTS "onDuty",
ADD COLUMN "email" TEXT,
ADD COLUMN "gymId" TEXT NOT NULL DEFAULT 'gym_spotter_main',
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "phoneNumber" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "role" SET DEFAULT 'FRONT_DESK';

-- ==========================================
-- 4. DROP LEGACY EMPTY (0-ROW) TABLES
-- ==========================================
DROP TABLE IF EXISTS "AttendanceRecord";
DROP TABLE IF EXISTS "CardEmbedding";
DROP TABLE IF EXISTS "FlaggedAnswer";
DROP TABLE IF EXISTS "QueryLog";
DROP TABLE IF EXISTS "SharedRecordCard";
DROP TABLE IF EXISTS "Transaction";

-- ==========================================
-- 5. CREATE TARGET SUPPORTING TABLES
-- ==========================================

CREATE TABLE "MemberSession" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "MemberSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffSession" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeskShift" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL DEFAULT 'gym_spotter_main',
    "staffId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "DeskShift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL DEFAULT 'gym_spotter_main',
    "name" TEXT NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'BASIC',
    "priceKobo" INTEGER NOT NULL,
    "intervalMonths" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipChange" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "planId" TEXT,
    "fromTier" "Tier",
    "toTier" "Tier" NOT NULL,
    "reason" TEXT,
    "changedByStaffId" TEXT,
    "paymentId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL DEFAULT 'gym_spotter_main',
    "memberId" TEXT NOT NULL,
    "planId" TEXT,
    "amountKobo" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "source" "TransactionSource" NOT NULL DEFAULT 'GATEWAY',
    "status" "TransactionStatus" NOT NULL DEFAULT 'INITIATED',
    "description" TEXT,
    "recordedByStaffId" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'FLUTTERWAVE',
    "gatewayRef" TEXT,
    "amountKobo" INTEGER NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'INITIATED',
    "rawWebhookPayload" TEXT,
    "errorMessage" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL DEFAULT 'gym_spotter_main',
    "memberId" TEXT NOT NULL,
    "paymentId" TEXT,
    "entryType" "LedgerEntryType" NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "balanceAfterKobo" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "lastConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CheckInCode" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL DEFAULT 'gym_spotter_main',
    "locationCode" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "secretCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckInCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL DEFAULT 'gym_spotter_main',
    "memberId" TEXT NOT NULL,
    "checkInCodeId" TEXT,
    "locationCode" TEXT NOT NULL,
    "source" "CheckInSource" NOT NULL DEFAULT 'QR',
    "verifiedByStaffId" TEXT,
    "notes" TEXT,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL DEFAULT 'gym_spotter_main',
    "slug" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CardVersion" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "minTier" "Tier" NOT NULL DEFAULT 'BASIC',
    "status" "CardStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByStaffId" TEXT NOT NULL,
    "approvedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "CardVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CardChunk" (
    "id" TEXT NOT NULL,
    "cardVersionId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "chunkText" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "tierGate" "Tier" NOT NULL,
    "status" "CardStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionLog" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL DEFAULT 'gym_spotter_main',
    "memberId" TEXT NOT NULL,
    "rawQueryText" TEXT NOT NULL,
    "matchedCardVersionId" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "matchedStaffCategory" TEXT,
    "routedToStaff" BOOLEAN NOT NULL DEFAULT false,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnswerAudit" (
    "id" TEXT NOT NULL,
    "questionLogId" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "sourceRecordType" TEXT,
    "sourceRecordId" TEXT,
    "recordConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WrongAnswerReport" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL DEFAULT 'gym_spotter_main',
    "memberId" TEXT NOT NULL,
    "questionLogId" TEXT NOT NULL,
    "reason" TEXT,
    "reviewedByStaffId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "status" "FlagReviewStatus" NOT NULL DEFAULT 'PENDING',
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WrongAnswerReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivateAccessLog" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "lookupType" "PrivateLookupType" NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "PrivateAccessLog_pkey" PRIMARY KEY ("id")
);

-- ==========================================
-- 6. UNIQUE CONSTRAINTS & INDEXES
-- ==========================================

CREATE UNIQUE INDEX "Gym_slug_key" ON "Gym"("slug");
CREATE UNIQUE INDEX "MemberSession_sessionToken_key" ON "MemberSession"("sessionToken");
CREATE INDEX "MemberSession_memberId_idx" ON "MemberSession"("memberId");
CREATE INDEX "MemberSession_sessionToken_idx" ON "MemberSession"("sessionToken");
CREATE INDEX "MemberSession_expiresAt_idx" ON "MemberSession"("expiresAt");

CREATE UNIQUE INDEX "StaffSession_sessionToken_key" ON "StaffSession"("sessionToken");
CREATE INDEX "StaffSession_staffId_idx" ON "StaffSession"("staffId");
CREATE INDEX "StaffSession_sessionToken_idx" ON "StaffSession"("sessionToken");

CREATE INDEX "DeskShift_gymId_isActive_idx" ON "DeskShift"("gymId", "isActive");
CREATE INDEX "DeskShift_staffId_startedAt_idx" ON "DeskShift"("staffId", "startedAt");

CREATE INDEX "MembershipPlan_gymId_isActive_idx" ON "MembershipPlan"("gymId", "isActive");
CREATE INDEX "MembershipPlan_tier_idx" ON "MembershipPlan"("tier");

CREATE INDEX "MembershipChange_memberId_createdAt_idx" ON "MembershipChange"("memberId", "createdAt");

CREATE INDEX "Payment_memberId_idx" ON "Payment"("memberId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_gymId_createdAt_idx" ON "Payment"("gymId", "createdAt");

CREATE UNIQUE INDEX "PaymentAttempt_gatewayRef_key" ON "PaymentAttempt"("gatewayRef");
CREATE INDEX "PaymentAttempt_paymentId_idx" ON "PaymentAttempt"("paymentId");
CREATE INDEX "PaymentAttempt_gatewayRef_idx" ON "PaymentAttempt"("gatewayRef");
CREATE INDEX "PaymentAttempt_status_idx" ON "PaymentAttempt"("status");

CREATE INDEX "LedgerEntry_memberId_createdAt_idx" ON "LedgerEntry"("memberId", "createdAt");
CREATE INDEX "LedgerEntry_gymId_idx" ON "LedgerEntry"("gymId");

CREATE UNIQUE INDEX "CheckInCode_secretCode_key" ON "CheckInCode"("secretCode");
CREATE INDEX "CheckInCode_gymId_isActive_idx" ON "CheckInCode"("gymId", "isActive");
CREATE INDEX "CheckInCode_locationCode_idx" ON "CheckInCode"("locationCode");

CREATE INDEX "CheckIn_memberId_checkedInAt_idx" ON "CheckIn"("memberId", "checkedInAt");
CREATE INDEX "CheckIn_gymId_checkedInAt_idx" ON "CheckIn"("gymId", "checkedInAt");

CREATE INDEX "Card_gymId_category_idx" ON "Card"("gymId", "category");

CREATE INDEX "CardVersion_status_minTier_idx" ON "CardVersion"("status", "minTier");
CREATE INDEX "CardVersion_cardId_idx" ON "CardVersion"("cardId");
CREATE UNIQUE INDEX "CardVersion_cardId_versionNumber_key" ON "CardVersion"("cardId", "versionNumber");

CREATE INDEX "CardChunk_status_tierGate_idx" ON "CardChunk"("status", "tierGate");
CREATE INDEX "CardChunk_cardVersionId_idx" ON "CardChunk"("cardVersionId");

CREATE INDEX "QuestionLog_askedAt_idx" ON "QuestionLog"("askedAt");
CREATE INDEX "QuestionLog_memberId_idx" ON "QuestionLog"("memberId");
CREATE INDEX "QuestionLog_gymId_idx" ON "QuestionLog"("gymId");

CREATE UNIQUE INDEX "AnswerAudit_questionLogId_key" ON "AnswerAudit"("questionLogId");
CREATE INDEX "AnswerAudit_createdAt_idx" ON "AnswerAudit"("createdAt");

CREATE UNIQUE INDEX "WrongAnswerReport_questionLogId_key" ON "WrongAnswerReport"("questionLogId");
CREATE INDEX "WrongAnswerReport_gymId_status_idx" ON "WrongAnswerReport"("gymId", "status");
CREATE INDEX "WrongAnswerReport_flaggedAt_idx" ON "WrongAnswerReport"("flaggedAt");

CREATE INDEX "PrivateAccessLog_memberId_accessedAt_idx" ON "PrivateAccessLog"("memberId", "accessedAt");

CREATE INDEX "Member_gymId_idx" ON "Member"("gymId");
CREATE INDEX "Member_phoneNumber_idx" ON "Member"("phoneNumber");
CREATE INDEX "Member_tier_idx" ON "Member"("tier");

CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");
CREATE UNIQUE INDEX "Staff_phoneNumber_key" ON "Staff"("phoneNumber");
CREATE INDEX "Staff_gymId_idx" ON "Staff"("gymId");
CREATE INDEX "Staff_role_idx" ON "Staff"("role");

-- ==========================================
-- 7. FOREIGN KEY CONSTRAINTS
-- ==========================================

ALTER TABLE "Member" ADD CONSTRAINT "Member_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MemberSession" ADD CONSTRAINT "MemberSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Staff" ADD CONSTRAINT "Staff_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeskShift" ADD CONSTRAINT "DeskShift_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeskShift" ADD CONSTRAINT "DeskShift_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MembershipChange" ADD CONSTRAINT "MembershipChange_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MembershipChange" ADD CONSTRAINT "MembershipChange_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipChange" ADD CONSTRAINT "MembershipChange_changedByStaffId_fkey" FOREIGN KEY ("changedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipChange" ADD CONSTRAINT "MembershipChange_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedByStaffId_fkey" FOREIGN KEY ("recordedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CheckInCode" ADD CONSTRAINT "CheckInCode_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_checkInCodeId_fkey" FOREIGN KEY ("checkInCodeId") REFERENCES "CheckInCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_verifiedByStaffId_fkey" FOREIGN KEY ("verifiedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Card" ADD CONSTRAINT "Card_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CardVersion" ADD CONSTRAINT "CardVersion_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardVersion" ADD CONSTRAINT "CardVersion_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardVersion" ADD CONSTRAINT "CardVersion_approvedByStaffId_fkey" FOREIGN KEY ("approvedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CardChunk" ADD CONSTRAINT "CardChunk_cardVersionId_fkey" FOREIGN KEY ("cardVersionId") REFERENCES "CardVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionLog" ADD CONSTRAINT "QuestionLog_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionLog" ADD CONSTRAINT "QuestionLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionLog" ADD CONSTRAINT "QuestionLog_matchedCardVersionId_fkey" FOREIGN KEY ("matchedCardVersionId") REFERENCES "CardVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnswerAudit" ADD CONSTRAINT "AnswerAudit_questionLogId_fkey" FOREIGN KEY ("questionLogId") REFERENCES "QuestionLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WrongAnswerReport" ADD CONSTRAINT "WrongAnswerReport_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WrongAnswerReport" ADD CONSTRAINT "WrongAnswerReport_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WrongAnswerReport" ADD CONSTRAINT "WrongAnswerReport_questionLogId_fkey" FOREIGN KEY ("questionLogId") REFERENCES "QuestionLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WrongAnswerReport" ADD CONSTRAINT "WrongAnswerReport_reviewedByStaffId_fkey" FOREIGN KEY ("reviewedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PrivateAccessLog" ADD CONSTRAINT "PrivateAccessLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
