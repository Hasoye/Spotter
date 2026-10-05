# Spotter — Product Requirements Document (Revised)

## Pre-Build Blockers
These must be resolved before any build work starts. They are not open questions to answer later, they are conditions that make the rest of this PRD buildable.

1. Where does the gym's existing payment history and balance data live today (spreadsheet, notebook, memory)? A migration plan into `Member.balanceKobo` must exist before launch, or every balance answer the app gives on day one is unverified.
2. Confirm whether the gym has one owner or more than one. The owner screen in this PRD assumes a single owner.
3. Confirm which payment gateway the gym will use, Paystack or Flutterwave, and whether a merchant account already exists.

## 1. Product Summary
Spotter is a member-facing app for a gym with 400 members. It answers questions from two kinds of record: shared records (timetable, prices, rules, guest policy, training plans) and private records (attendance, tier, expiry, balance). Members ask questions in plain language. The app answers from a record and shows the date that record was last confirmed, or it refuses and names the staff member on duty. Members also check in via QR code and pay or renew inside the app through a Nigerian payment gateway.

## 2. Problem
The gym runs on a paper timetable and two staff sharing one desk that closes at 8pm. Members ask the same five questions repeatedly (class times, guest policy, card failures before 6am, attendance count, balance owed). Staff either answer from memory, guess, or cannot answer at all because the ledger is not in front of them. Wrong or missing answers happen in public, in front of other members, and cost the gym trust it does not get a chance to repair.

Before build starts, the gym must count how many of these interruptions happen at the desk over a two-week window. This baseline number is required by Section 12 to set a real success target, not an assumed one.

## 3. Goals
1. Cut the volume of the five recurring desk questions by giving members self-serve, trustworthy answers, measured against the two-week baseline in Section 2.
2. Make attendance provable within the limits of QR-only check-in, with device-level verification (confirming the phone doing the scan belongs to the member) deferred to v2. This is not full proof against sharing a code, and Section 13 names that risk directly.
3. Reduce manual reconciliation of card payments. Cash payments taken at the desk still require a manual staff step in v1; this goal does not claim to eliminate manual work entirely.
4. Enforce, through Functional Requirements 4 and 13 specifically, that the app never states a financial fact without a backing record and a confirmation timestamp.
5. Collect enough usage data in v1 to justify and design v2 automation (reminders, follow ups).

## 4. Users and Personas
**Primary user: the member.**

Persona A, Bisi, trains four times a week after work around 7pm. Opens the app 12 to 16 times a month, mostly to check in at the door. Occasionally asks a real question. Has an inexpensive Android phone, buys mobile data in small bundles, and has unreliable power at home.

Persona B, a lower-frequency member who trains twice a week. Opens the app far less often, closer to 8 times a month. The argument that frequent app use naturally surfaces questions is weaker for this member, which matters directly for Goal 1: this member is more likely to miss a rule change or forget a renewal deadline simply because they open the app less.

**Not users of the app: staff.** Staff interact with the gym's records through a separate staff screen. They draft shared record cards and correct check-ins or payments that failed to sync. They appear to members only as a named person the app hands off to when it cannot or should not answer.

ASSUMPTION: the idea states the gym has two front desk staff sharing one desk. This is stated directly in the source idea.

ASSUMPTION: this PRD assumes a single owner approving all shared record cards. This is invented, not stated in the source idea, and is listed as a Pre-Build Blocker above.

**Not a user of the app in the retrieval flow: the owner.** The owner approves every shared record card before it goes live and reviews flagged wrong answers.

## 5. Scope

**In v1** (customer facing, capped at five features per the idea):
1. Ask a shared-record question, answered by meaning search over rule cards, filtered by tier.
2. Ask a private-record question, answered by exact fetch on the member's own ID.
3. Check in via QR code scan at the front desk, with a defined fallback if the scan fails (see Functional Requirements).
4. Pay or renew inside the app through a Nigerian payment gateway.
5. View written training plan (Premium tier only).

**Explicitly out of v1:**
- Class booking or reservation (needs live capacity tracking, a different system).
- Push notifications, reminders, or any automated follow up.
- Any agent that acts without a human confirming first.
- Social features or leaderboards.
- Refund processing, billing dispute resolution, or medical guidance, all of which route to staff regardless of what the records say.
- Device-level check-in verification (deferred to v2, see Goal 2).

**Staff and owner screens (input, not features, listed separately per the idea):**
- Staff: draft and edit shared record cards.
- Staff: manually confirm or correct a check-in or payment.
- Staff: log a real-time manual check-in when a member's QR scan fails.
- Owner: approve a staff-drafted card before it goes live.
- Owner: review flagged wrong answers and the full question log.

## 6. Functional Requirements
1. A member must authenticate before the app shows any private record, using SMS one-time password (OTP, a short numeric code sent by text message) tied to the member's registered phone number.
2. The app must fetch private records using the authenticated member's own ID only. It must never accept a member ID as a search parameter from user input.
3. The app must search shared records by meaning (semantic search) and return the single best-matching card, not a list of unrelated matches.
4. Every answer drawn from a private record must display the record's `lastConfirmedAt` timestamp next to the answer.
5. Before any question reaches shared-record search or private lookup, the app must first run it through a classifier that checks whether it matches one of the fixed staff-routed categories in Requirement 6. Only questions that do not match proceed further. The classification result (matched category or none) is written to `QueryLog`.
6. The app must maintain a fixed list of query categories that always route to staff regardless of record content: refunds, billing disputes, medical or injury questions, one-off exceptions to freeze or cancellation policy, and physical access card or turnstile faults.
7. If a question contains more than one detected intent, for example a private lookup and a staff-routed topic in the same sentence, the app answers only the part it can resolve with confidence and explicitly tells the member to ask the staff-routed part separately, naming staff.
8. If a shared-record query returns no card above the confidence threshold, the app must refuse and display the name of the staff member currently on duty.
   ASSUMPTION: the confidence threshold is a placeholder value of cosine similarity 0.75. It must be tuned against a labeled set of real gym questions and known-correct answers before launch. This number must not ship untested.
9. A member must be able to check in only by scanning a QR code physically present at the gym. The app must not accept a manual "I'm here" tap as a substitute.
10. If a QR scan fails for any reason (camera fault, no signal, damaged code), the app must show a message directing the member to staff, and staff must be able to log a real-time manual check-in at that moment, not only correct it later.
11. Each check-in must write one `AttendanceRecord` row with the member ID, timestamp, the QR code's location identifier, and a `source` field of either `QR` or `STAFF_MANUAL`.
12. A member must be able to initiate a payment (new membership or renewal) from inside the app, routed to the gateway's hosted checkout.
13. The app must not update a member's balance or expiry date based on the client's report of payment success. It must wait for the gateway's server-to-server webhook confirmation before writing any change.
14. If a webhook is not received within 10 minutes of checkout redirect, the app must mark the transaction `PENDING_VERIFICATION` and show the member a message that the payment is being confirmed, not a success or failure state.
15. Staff must be able to record a cash or in-person payment against a member's account. This creates a `Transaction` row with `source = MANUAL_STAFF` and `status = CONFIRMED`, entered directly by staff, separate from the gateway-driven flow.
16. Basic tier members must see: timetable, prices, rules, access hours, their own attendance, their own balance.
17. Premium tier members must see everything Basic sees plus their written training plan.
18. An expired member must retain access to their own balance and payment history and to the payment flow, but must lose access to shared content cards until the membership is renewed.
19. Every question asked, whether answered or routed to staff, must be logged with: member ID, raw query text, matched record ID (if any), confidence score (if applicable), matched staff-routed category (if any), and routed-to-staff flag.
20. Every answer screen must include a "this doesn't look right" control that sends the question, the answer given, and the member ID to the owner's flagged-answer queue.
21. Shared record cards must have a status of `DRAFT`, `APPROVED`, or `SUPERSEDED`. Only `APPROVED` cards are eligible for semantic search results shown to members.
22. A staff edit to an already-approved card must create a new `DRAFT` version rather than overwriting the live `APPROVED` card. When the new version is approved, the previously approved version of the same card lineage must be set to `SUPERSEDED` in the same transaction, so only one version is ever eligible for search at a time.
23. A private-record lookup must return a result, or a clear refusal, within 3 seconds under normal network conditions. A shared-record semantic search must return a result, or a clear refusal, within 5 seconds under normal network conditions.

## 7. AI and AI-Related Tools and Solutions
The AI's job is retrieval, not generation of facts. Before any retrieval happens, a classification step checks whether the question matches a fixed staff-routed category (Functional Requirement 6). Only questions that do not match proceed to either shared-record semantic search or private-record lookup.

The AI turns a member's plain-language question into a search over shared record cards (semantic search, meaning it matches by meaning rather than exact keywords), and turns a private-record question into a lookup by fixed category (attendance count, balance, expiry, tier) rather than a free-text search.

**What the AI is allowed to do:**
- Embed (convert text into a vector, a list of numbers that represents meaning, for comparison) approved shared record cards for semantic search.
- Classify an incoming question first against the fixed staff-routed category list, then, if no match, classify it into one of a fixed set of private lookup types.
- Generate the wording of an answer using only the fields returned by the record fetch. It must not add information not present in that record.

**What the AI is not allowed to do:**
- It must never search across member IDs. Private lookups are parameterized by the authenticated member's ID only, enforced at the database query layer, not by prompt instruction alone.
  ASSUMPTION: this constraint is enforced in application code, through a fixed set of parameterized Prisma queries per lookup type whose function signatures do not accept a member ID parameter from outside the authenticated session. A model instruction is not a security boundary.
- It must never answer a question matched to a staff-routed category, even if a record exists that seems relevant.
- It must never state a financial fact (balance, expiry, payment status) without attaching the record's confirmation timestamp.
- It must never guess or interpolate when a shared-record match falls below the confidence threshold. Silence and staff handoff are the required behavior.

**Failure and refusal handling:** every refusal (low confidence match, staff-routed category match, compound question, or private lookup with no data) returns a consistent response shape: a short reason and the name of the staff member on duty. This is a fixed template, not model-generated language, so refusal behavior cannot drift.

## 8. Technical Architecture
Frontend and backend both live in a single Next.js app using the App Router, written in TypeScript. Prisma is the ORM (object-relational mapper, a tool that lets application code query the database using generated TypeScript functions instead of raw SQL). PostgreSQL is the database, with the pgvector extension enabled for semantic search.

Note on Prisma and pgvector: Prisma Client does not support pgvector similarity operators (such as cosine distance) through its normal type-safe query API. Any similarity search must use `$queryRaw` with the pgvector operator directly. This is called out explicitly so it is not discovered mid-build.

**High level flow:**
- Member authenticates via SMS OTP tied to their registered phone number. Session stored server-side, checked on every request that touches private data.
- An incoming question first hits a classification step that checks it against the fixed staff-routed category list. If matched, the app refuses immediately with the named staff member on duty.
- If not matched, the app classifies the question as either a shared-record question or a private-record question.
- A shared-record question runs a `$queryRaw` pgvector cosine similarity search against the `CardEmbedding` table, filtered to `status = APPROVED` and the member's tier, and returns the top match if above threshold.
- A private-record question runs one of a fixed set of Prisma queries scoped to `where: { memberId: session.memberId }`, using functions whose signatures do not accept an externally supplied member ID.
- Check-in hits an API route that validates the scanned QR payload against a known location code, then writes an `AttendanceRecord` with `source = QR`. A failed scan routes to a staff screen that writes `source = STAFF_MANUAL`.
- Payment initiation hits an API route that creates a `Transaction` row with `status = INITIATED` and redirects to the gateway's hosted checkout. A separate webhook route receives gateway confirmation and updates `status` to `CONFIRMED` or `FAILED`, and only on `CONFIRMED` does it update `Membership.expiresAt` and `Membership.balanceKobo`. Staff-recorded cash payments write directly to `Transaction` with `source = MANUAL_STAFF` and `status = CONFIRMED`, bypassing the webhook step entirely.

**Prisma schema:**

```prisma
generator client {
  provider = "prisma-client-js"
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
}

model FlaggedAnswer {
  id                String   @id @default(cuid())
  memberId          String
  member            Member   @relation(fields: [memberId], references: [id], onDelete: Restrict)
  queryLogId        String
  reviewedByOwnerId String?
  reviewedAt        DateTime?
  flaggedAt         DateTime @default(now())
}
```

ASSUMPTION: money is stored as an integer in kobo (the smallest unit of the naira, 1 naira equals 100 kobo) rather than a decimal, to avoid floating point rounding errors on financial fields.

ASSUMPTION: the embedding column uses `vector(1536)`, matching a common embedding model output size. The exact model and dimension count is a Pre-Build Blocker candidate once an embedding provider is chosen; see Business Model.

ASSUMPTION: `Member` rows are never hard-deleted in v1. A `deactivatedAt` field marks a member inactive while preserving financial and attendance history for record-keeping.

## 9. Vector Database Architecture and Design
Only shared record cards are embedded, stored in the `CardEmbedding` table, never as a column on `SharedRecordCard` itself. Private records (attendance, balance, expiry, tier) are never embedded and never enter the vector search path, because private records are answered by exact ID lookup, not by meaning search.

This boundary is enforced structurally, not just by convention: the function that runs the semantic search does not accept a `memberId` parameter in its signature at all, so passing one is a compile-time impossibility, not a discipline problem a future developer could accidentally break.

**What gets embedded:** the `bodyText` of every `SharedRecordCard` at the moment it moves to `status = APPROVED`, written as a new row in `CardEmbedding`.

**What never gets embedded:** attendance rows, transaction rows, balances, expiry dates, member names, phone numbers, or any field on the `Member` model.

**Retrieval flow for a shared-record question:**
1. The question first passes the staff-routed category classifier (Functional Requirement 5). If matched, retrieval stops here.
2. If not matched, the member's raw query text is sent to an embedding model.
3. The resulting vector is compared, via `$queryRaw`, against `CardEmbedding.embedding` for all rows where `status = APPROVED` and `tierGate <= member.tier`, using pgvector's cosine distance operator.
4. The top result is returned only if its similarity score clears the confidence threshold. Below threshold, the app refuses and routes to staff.
5. The query, the matched card ID (or null), the confidence score, and the classifier result are written to `QueryLog` regardless of outcome.

## 10. Vector Database Model

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | primary key of the embedding row, distinct from `sourceCardId` |
| sourceCardId | String | foreign key to `SharedRecordCard.id` |
| embedding | vector(1536) | pgvector column, one row per approved card version |
| tierGate | Tier enum | copied from the card at embedding time, used to pre-filter before the similarity search |
| status | CardStatus enum | must be APPROVED to be eligible for search; set to SUPERSEDED when a newer version is approved |
| embeddedAt | DateTime | when this vector was generated, used to detect stale embeddings after a card edit |

Indexing approach: a pgvector IVFFlat index (a type of approximate nearest neighbor index) on the `embedding` column, filtered first by `status` and `tierGate` before the vector comparison runs.

ASSUMPTION: at roughly 400 members and a small number of shared record cards (likely under 200), an IVFFlat index is more than sufficient and HNSW's extra build cost is not needed. This should be revisited only if the card count grows by an order of magnitude.

## 11. Business Model
The gym pays for and owns the app. Members do not pay Spotter directly. Membership fees paid by members go straight into the gym's own account at the payment gateway, never held by the app.

**Infrastructure cost at this scale (400 members):**
- Hosting: a free-tier Next.js deployment (for example Vercel's free tier) is sufficient at this traffic volume. Ceiling: this tier is expected to hold up to roughly 100,000 requests a month; if the gym's member count or query volume grows well beyond 400 members, this must be re-evaluated and likely moved to a paid tier.
- Database: a free-tier managed PostgreSQL instance with pgvector support (for example Supabase's free tier) covers this scale, with a similar storage ceiling to watch.
- SMS OTP: each login requires one SMS message. At an estimated cost of a few naira per message and a few logins per member per month, this is a real recurring cost and must be budgeted, not treated as free infrastructure.
- Embedding model calls: only shared record cards are embedded, at creation or edit time, plus one embedding call per live member question for the search comparison. At an estimated under 200 cards and under 5,000 member queries a month, embedding API cost is expected to stay within most providers' free or low-cost tier, but this depends on the provider chosen.
  ASSUMPTION: exact embedding provider and its free tier limits remain unresolved; this should be finalized before the cost estimate above is treated as final.
- Payment gateway: free to integrate and test in sandbox mode. Live transaction fee is approximately 1.5 percent per transaction on Nigerian gateways such as Paystack or Flutterwave, capped around 2,000 naira per transaction on local cards.

**Ongoing maintenance:** this PRD assumes the gym owner or a contracted developer is responsible for monitoring the flagged-answer queue, tuning the confidence threshold after launch, and responding to gateway or OTP provider changes. This is not a one-time build; it requires an ongoing, named owner.

**Pricing to the member:** unchanged from today. Basic and Premium tiers reflect the gym's existing membership pricing; Spotter does not introduce a new fee layer.

## 12. Success Metrics
1. Volume of the five recurring desk questions, measured at the front desk for two weeks before launch (the baseline from Section 2) and two weeks after. A firm percentage target must be set once that baseline number exists; it cannot be finalized until then.
2. Check-in adoption: percentage of active members who check in via QR (source = QR, not STAFF_MANUAL) at least once in a 30-day window. Provisional target: above 80 percent, to be revisited after the first 30 days of real data.
3. Payment confirmation latency: percentage of gateway transactions that reach `CONFIRMED` status within the 10-minute webhook window. Target: above 95 percent.
4. Flagged answer rate: number of "this doesn't look right" flags per 100 answered questions. Provisional target: below 2 per 100, to be revisited after the first 30 days, since there is no prior data to base this number on yet.
5. Staff correction volume: number of manual check-in or manual payment entries staff make per week, tracked as a proxy for how often the automated paths are actually used versus bypassed.

## 13. Risks
1. **Most severe:** the app states a wrong financial fact (balance or expiry) that a member acts on, either being turned away despite having paid or being let in while owing money, in front of other members at the desk. Mitigated by Functional Requirements 4, 13, and 15, but the mitigation depends entirely on correct webhook handling and an up to date `lastConfirmedAt` timestamp; if either is buggy, this risk is fully live.
2. **Second:** a payment reports success on the member's phone but the gateway webhook never arrives, leaving the transaction stuck in `PENDING_VERIFICATION` with no automated resolution in v1, since automated follow up is explicitly out of scope. This requires a staff member to notice and manually resolve it.
3. **Third**, lower severity but corrosive over time: if the QR code at the front desk is photographed and shared, or if a member checks in for someone else, attendance data becomes untrustworthy without anyone noticing immediately. This is a known, accepted tradeoff in v1 and is the direct reason Goal 2 is worded to state its own limits rather than claim full proof. Device-level verification is deferred to v2.

## 14. Open Questions
1. Which embedding model and provider will generate the vectors for shared record cards, and what is that provider's free tier limit at the expected query volume?
2. Which payment gateway, Paystack or Flutterwave, will the gym actually use? (Also listed as a Pre-Build Blocker, since payment cannot be built without this decision.)
3. Who technically owns the merchant account: the gym as a registered business, or the owner personally? This affects settlement report access and liability.
4. What is the actual firm target percentage for the drop in desk questions after launch, once the two-week baseline is measured?
5. What is the exact SMS OTP provider and its per-message cost in naira?
6. Does the gym have any existing member ID or membership numbering system to map onto the `Member.id` field, or does this launch generate IDs fresh?

---

## Assumption Count
6 assumptions made.

## Open Question Count
6 open questions left, plus 3 items elevated to Pre-Build Blockers that must be resolved before build starts, not during it.
