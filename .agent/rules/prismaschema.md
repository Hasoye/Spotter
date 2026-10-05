---
trigger: glob
globs: prisma/schema.prisma
---

---
trigger: glob
glob: prisma/schema.prisma
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

model Member {
  id              String            @id @default(cuid())
  fullName        String
  phoneNumber     String            @unique
  tier            Tier              @default(BASIC)
  expiresAt       DateTime?
  balanceKobo     Int               @default(0)
  createdAt       DateTime          @default(now())
  deactivatedAt   DateTime?
  attendanceLogs  AttendanceRecord[]
  transactions    Transaction[]
  queries         QueryLog[]
  flaggedAnswers  FlaggedAnswer[]
}

model Staff {
  id        String    @id @default(cuid())
  fullName  String
  role      StaffRole
  onDuty    Boolean   @default(false)
  createdAt DateTime  @default(now())
}

model SharedRecordCard {
  id                String       @id @default(cuid())
  title             String
  bodyText          String
  minTier           Tier         @default(BASIC)
  status            CardStatus   @default(DRAFT)
  version           Int          @default(1)
  supersedesId      String?
  createdByStaffId  String
  approvedByStaffId String?
  createdAt         DateTime     @default(now())
  approvedAt        DateTime?
  embeddings        CardEmbedding[]
}

model CardEmbedding {
  id           String            @id @default(cuid())
  sourceCardId String
  sourceCard   SharedRecordCard  @relation(fields: [sourceCardId], references: [id])
  embedding    Unsupported("vector(1536)")
  tierGate     Tier
  status       CardStatus
  embeddedAt   DateTime          @default(now())

  @@index([status, tierGate])
}

model AttendanceRecord {
  id           String        @id @default(cuid())
  memberId     String
  member       Member        @relation(fields: [memberId], references: [id], onDelete: Restrict)
  locationCode String
  source       CheckInSource @default(QR)
  checkedInAt  DateTime      @default(now())
}

model Transaction {
  id            String             @id @default(cuid())
  memberId      String
  member        Member             @relation(fields: [memberId], references: [id], onDelete: Restrict)
  amountKobo    Int
  source        TransactionSource  @default(GATEWAY)
  gatewayRef    String?
  status        TransactionStatus  @default(INITIATED)
  initiatedAt   DateTime           @default(now())
  confirmedAt   DateTime?

  @@index([status])
}

model QueryLog {
  id                    String   @id @default(cuid())
  memberId              String
  member                Member   @relation(fields: [memberId], references: [id], onDelete: Restrict)
  rawQueryText          String
  matchedCardId         String?
  confidenceScore       Float?
  matchedStaffCategory  String?
  routedToStaff         Boolean  @default(false)
  askedAt               DateTime @default(now())
  flaggedAnswer         FlaggedAnswer?

  @@index([askedAt])
}

model FlaggedAnswer {
  id                String    @id @default(cuid())
  memberId          String
  member            Member    @relation(fields: [memberId], references: [id], onDelete: Restrict)
  queryLogId        String    @unique
  queryLog          QueryLog  @relation(fields: [queryLogId], references: [id])
  reviewedByOwnerId String?
  reviewedAt        DateTime?
  flaggedAt         DateTime  @default(now())
}
```