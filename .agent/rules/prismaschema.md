---
trigger: glob
globs: prisma/schema.prisma
---

# Prisma Schema

## Job of this file
Hold the exact, current content of the project's `prisma/schema.prisma`. This is the only place table structure is decided. Never change the code below without asking first, per `git.md` and `AGENTS.md`. When the real `prisma/schema.prisma` file is created in the project, its content must match this file exactly. If they ever disagree, this file is the source of truth and the code file must be corrected to match it.

Design rationale for the decisions below lives in `schema.md`, not here. This file holds the structure only.

## Note on the vector index
pgvector's IVFFlat index, named in `vectorsearch.md`, cannot be declared through Prisma's schema syntax below. It must be created through a separate raw SQL migration, applied after this schema is migrated, not as part of it.

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

// ==========================================
// ENUMS
// ==========================================

enum Tier {
  BASIC
  PREMIUM
}

enum CardStatus {
  DRAFT
  APPROVED
  SUPERSEDED
}

enum TransactionStatus {
  INITIATED
  PENDING_VERIFICATION
  CONFIRMED
  FAILED
}

enum TransactionSource {
  GATEWAY
  MANUAL_STAFF
}

enum CheckInSource {
  QR
  STAFF_MANUAL
}

enum StaffRole {
  FRONT_DESK
  OWNER
}

enum LedgerEntryType {
  PAYMENT_CREDIT
  MEMBERSHIP_DEBIT
  MANUAL_ADJUSTMENT
  REFUND
}

enum FlagReviewStatus {
  PENDING
  REVIEWED
  DISMISSED
  RESOLVED
}

enum PrivateLookupType {
  ATTENDANCE
  BALANCE
  EXPIRY
  TIER
}

// ==========================================
// 1. GYM IDENTITY & MULTI-TENANCY
// ==========================================

model Gym {
  id              String           @id @default(cuid())
  name            String
  slug            String           @unique
  address         String?
  phoneNumber     String?
  currency        String           @default("NGN")
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @default(now()) @updatedAt

  members         Member[]
  staff           Staff[]
  deskShifts      DeskShift[]
  membershipPlans MembershipPlan[]
  cards           Card[]
  checkInCodes    CheckInCode[]
  checkIns        CheckIn[]
  payments        Payment[]
  ledgerEntries   LedgerEntry[]
  questionLogs    QuestionLog[]
  wrongAnswerReports WrongAnswerReport[]
}

// ==========================================
// 2. MEMBER & AUTHENTICATION
// ==========================================

model Member {
  id                 String              @id @default(cuid())
  gymId              String              @default("gym_spotter_main")
  gym                Gym                 @relation(fields: [gymId], references: [id], onDelete: Restrict)
  fullName           String
  phoneNumber        String              @unique
  passwordHash       String?
  tier               Tier                @default(BASIC)
  expiresAt          DateTime?
  balanceKobo        Int                 @default(0)
  isActive           Boolean             @default(true)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @default(now()) @updatedAt
  deactivatedAt      DateTime?

  sessions           MemberSession[]
  checkIns           CheckIn[]
  payments           Payment[]
  membershipChanges  MembershipChange[]
  ledgerEntries      LedgerEntry[]
  questionLogs       QuestionLog[]
  wrongAnswerReports WrongAnswerReport[]
  privateAccessLogs  PrivateAccessLog[]

  @@index([gymId])
  @@index([phoneNumber])
  @@index([tier])
}

model MemberSession {
  id           String    @id @default(cuid())
  memberId     String
  member       Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)
  sessionToken String    @unique
  ipAddress    String?
  userAgent    String?
  expiresAt    DateTime
  createdAt    DateTime  @default(now())
  lastActiveAt DateTime  @default(now())
  revokedAt    DateTime?

  @@index([memberId])
  @@index([sessionToken])
  @@index([expiresAt])
}

// ==========================================
// 3. STAFF & SHIFTS
// ==========================================

model Staff {
  id                   String              @id @default(cuid())
  gymId                String              @default("gym_spotter_main")
  gym                  Gym                 @relation(fields: [gymId], references: [id], onDelete: Restrict)
  fullName             String
  email                String?             @unique
  phoneNumber          String?             @unique
  passwordHash         String?
  role                 StaffRole           @default(FRONT_DESK)
  isActive             Boolean             @default(true)
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @default(now()) @updatedAt

  sessions             StaffSession[]
  deskShifts           DeskShift[]
  createdCardVersions  CardVersion[]       @relation("CardVersionCreatedBy")
  approvedCardVersions CardVersion[]       @relation("CardVersionApprovedBy")
  membershipChanges    MembershipChange[]  @relation("MembershipChangedBy")
  verifiedCheckIns     CheckIn[]           @relation("CheckInVerifiedBy")
  recordedPayments     Payment[]           @relation("PaymentRecordedBy")
  reviewedReports      WrongAnswerReport[] @relation("ReportReviewedBy")

  @@index([gymId])
  @@index([role])
}

model StaffSession {
  id           String    @id @default(cuid())
  staffId      String
  staff        Staff     @relation(fields: [staffId], references: [id], onDelete: Cascade)
  sessionToken String    @unique
  ipAddress    String?
  userAgent    String?
  expiresAt    DateTime
  createdAt    DateTime  @default(now())
  lastActiveAt DateTime  @default(now())
  revokedAt    DateTime?

  @@index([staffId])
  @@index([sessionToken])
}

model DeskShift {
  id        String    @id @default(cuid())
  gymId     String    @default("gym_spotter_main")
  gym       Gym       @relation(fields: [gymId], references: [id], onDelete: Restrict)
  staffId   String
  staff     Staff     @relation(fields: [staffId], references: [id], onDelete: Restrict)
  startedAt DateTime  @default(now())
  endedAt   DateTime?
  isActive  Boolean   @default(true)
  notes     String?

  @@index([gymId, isActive])
  @@index([staffId, startedAt])
}

// ==========================================
// 4. MEMBERSHIP PLANS & CHANGES
// ==========================================

model MembershipPlan {
  id             String             @id @default(cuid())
  gymId          String             @default("gym_spotter_main")
  gym            Gym                @relation(fields: [gymId], references: [id], onDelete: Restrict)
  name           String
  tier           Tier               @default(BASIC)
  priceKobo      Int
  intervalMonths Int                @default(1)
  description    String?
  isActive       Boolean            @default(true)
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @default(now()) @updatedAt

  payments          Payment[]
  membershipChanges MembershipChange[]

  @@index([gymId, isActive])
  @@index([tier])
}

model MembershipChange {
  id               String          @id @default(cuid())
  memberId         String
  member           Member          @relation(fields: [memberId], references: [id], onDelete: Restrict)
  planId           String?
  plan             MembershipPlan? @relation(fields: [planId], references: [id], onDelete: SetNull)
  fromTier         Tier?
  toTier           Tier
  reason           String?
  changedByStaffId String?
  changedByStaff   Staff?          @relation("MembershipChangedBy", fields: [changedByStaffId], references: [id], onDelete: SetNull)
  paymentId        String?
  payment          Payment?        @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  effectiveFrom    DateTime        @default(now())
  effectiveUntil   DateTime?
  createdAt        DateTime        @default(now())

  @@index([memberId, createdAt])
}

// ==========================================
// 5. PAYMENTS & LEDGER
// ==========================================

model Payment {
  id                String             @id @default(cuid())
  gymId             String             @default("gym_spotter_main")
  gym               Gym                @relation(fields: [gymId], references: [id], onDelete: Restrict)
  memberId          String
  member            Member             @relation(fields: [memberId], references: [id], onDelete: Restrict)
  planId            String?
  plan              MembershipPlan?    @relation(fields: [planId], references: [id], onDelete: SetNull)
  amountKobo        Int
  currency          String             @default("NGN")
  source            TransactionSource  @default(GATEWAY)
  status            TransactionStatus  @default(INITIATED)
  description       String?
  recordedByStaffId String?
  recordedByStaff   Staff?             @relation("PaymentRecordedBy", fields: [recordedByStaffId], references: [id], onDelete: SetNull)
  initiatedAt       DateTime           @default(now())
  confirmedAt       DateTime?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @default(now()) @updatedAt

  attempts          PaymentAttempt[]
  ledgerEntries     LedgerEntry[]
  membershipChanges MembershipChange[]

  @@index([memberId])
  @@index([status])
  @@index([gymId, createdAt])
}

model PaymentAttempt {
  id                String            @id @default(cuid())
  paymentId         String
  payment           Payment           @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  gateway           String            @default("FLUTTERWAVE")
  gatewayRef        String?           @unique
  amountKobo        Int
  status            TransactionStatus @default(INITIATED)
  rawWebhookPayload String?
  errorMessage      String?
  initiatedAt       DateTime          @default(now())
  verifiedAt        DateTime?
  createdAt         DateTime          @default(now())

  @@index([paymentId])
  @@index([gatewayRef])
  @@index([status])
}

model LedgerEntry {
  id               String          @id @default(cuid())
  gymId            String          @default("gym_spotter_main")
  gym              Gym             @relation(fields: [gymId], references: [id], onDelete: Restrict)
  memberId         String
  member           Member          @relation(fields: [memberId], references: [id], onDelete: Restrict)
  paymentId        String?
  payment          Payment?        @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  entryType        LedgerEntryType
  amountKobo       Int
  balanceAfterKobo Int
  description      String
  lastConfirmedAt  DateTime        @default(now())
  createdAt        DateTime        @default(now())

  @@index([memberId, createdAt])
  @@index([gymId])
}

// ==========================================
// 6. CHECK-IN SYSTEM
// ==========================================

model CheckInCode {
  id           String    @id @default(cuid())
  gymId        String    @default("gym_spotter_main")
  gym          Gym       @relation(fields: [gymId], references: [id], onDelete: Restrict)
  locationCode String
  locationName String
  secretCode   String    @unique
  isActive     Boolean   @default(true)
  expiresAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @default(now()) @updatedAt

  checkIns CheckIn[]

  @@index([gymId, isActive])
  @@index([locationCode])
}

model CheckIn {
  id                String        @id @default(cuid())
  gymId             String        @default("gym_spotter_main")
  gym               Gym           @relation(fields: [gymId], references: [id], onDelete: Restrict)
  memberId          String
  member            Member        @relation(fields: [memberId], references: [id], onDelete: Restrict)
  checkInCodeId     String?
  checkInCode       CheckInCode?  @relation(fields: [checkInCodeId], references: [id], onDelete: SetNull)
  locationCode      String
  source            CheckInSource @default(QR)
  verifiedByStaffId String?
  verifiedByStaff   Staff?        @relation("CheckInVerifiedBy", fields: [verifiedByStaffId], references: [id], onDelete: SetNull)
  notes             String?
  checkedInAt       DateTime      @default(now())

  @@index([memberId, checkedInAt])
  @@index([gymId, checkedInAt])
}

// ==========================================
// 7. KNOWLEDGE CARDS & CHUNKS
// ==========================================

model Card {
  id        String   @id @default(cuid())
  gymId     String   @default("gym_spotter_main")
  gym       Gym      @relation(fields: [gymId], references: [id], onDelete: Restrict)
  slug      String?
  category  String   @default("GENERAL")
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  versions CardVersion[]

  @@index([gymId, category])
}

model CardVersion {
  id                String        @id @default(cuid())
  cardId            String
  card              Card          @relation(fields: [cardId], references: [id], onDelete: Cascade)
  versionNumber     Int           @default(1)
  title             String
  bodyText          String
  minTier           Tier          @default(BASIC)
  status            CardStatus    @default(DRAFT)
  createdByStaffId  String
  createdByStaff    Staff         @relation("CardVersionCreatedBy", fields: [createdByStaffId], references: [id], onDelete: Restrict)
  approvedByStaffId String?
  approvedByStaff   Staff?        @relation("CardVersionApprovedBy", fields: [approvedByStaffId], references: [id], onDelete: SetNull)
  createdAt         DateTime      @default(now())
  approvedAt        DateTime?

  chunks       CardChunk[]
  questionLogs QuestionLog[]

  @@unique([cardId, versionNumber])
  @@index([status, minTier])
  @@index([cardId])
}

model CardChunk {
  id            String                      @id @default(cuid())
  cardVersionId String
  cardVersion   CardVersion                 @relation(fields: [cardVersionId], references: [id], onDelete: Cascade)
  chunkIndex    Int                         @default(0)
  chunkText     String
  embedding     Unsupported("vector(1536)")
  tierGate      Tier
  status        CardStatus
  createdAt     DateTime                    @default(now())

  @@index([status, tierGate])
  @@index([cardVersionId])
}

// ==========================================
// 8. RETRIEVAL & AUDIT LOGS
// ==========================================

model QuestionLog {
  id                   String       @id @default(cuid())
  gymId                String       @default("gym_spotter_main")
  gym                  Gym          @relation(fields: [gymId], references: [id], onDelete: Restrict)
  memberId             String
  member               Member       @relation(fields: [memberId], references: [id], onDelete: Restrict)
  rawQueryText         String
  matchedCardVersionId String?
  matchedCardVersion   CardVersion? @relation(fields: [matchedCardVersionId], references: [id], onDelete: SetNull)
  confidenceScore      Float?
  matchedStaffCategory String?
  routedToStaff        Boolean      @default(false)
  askedAt              DateTime     @default(now())

  answerAudit       AnswerAudit?
  wrongAnswerReport WrongAnswerReport?

  @@index([askedAt])
  @@index([memberId])
  @@index([gymId])
}

model AnswerAudit {
  id                String      @id @default(cuid())
  questionLogId     String      @unique
  questionLog       QuestionLog @relation(fields: [questionLogId], references: [id], onDelete: Cascade)
  answerText        String
  sourceRecordType  String?
  sourceRecordId    String?
  recordConfirmedAt DateTime?
  createdAt         DateTime    @default(now())

  @@index([createdAt])
}

model WrongAnswerReport {
  id                String           @id @default(cuid())
  gymId             String           @default("gym_spotter_main")
  gym               Gym              @relation(fields: [gymId], references: [id], onDelete: Restrict)
  memberId          String
  member            Member           @relation(fields: [memberId], references: [id], onDelete: Restrict)
  questionLogId     String           @unique
  questionLog       QuestionLog      @relation(fields: [questionLogId], references: [id], onDelete: Cascade)
  reason            String?
  reviewedByStaffId String?
  reviewedByStaff   Staff?           @relation("ReportReviewedBy", fields: [reviewedByStaffId], references: [id], onDelete: SetNull)
  reviewedAt        DateTime?
  status            FlagReviewStatus @default(PENDING)
  flaggedAt         DateTime         @default(now())

  @@index([gymId, status])
  @@index([flaggedAt])
}

model PrivateAccessLog {
  id         String            @id @default(cuid())
  memberId   String
  member     Member            @relation(fields: [memberId], references: [id], onDelete: Restrict)
  lookupType PrivateLookupType
  accessedAt DateTime          @default(now())
  ipAddress  String?

  @@index([memberId, accessedAt])
}
```