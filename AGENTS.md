# Spotter

## Description
Spotter is a member-facing app for a gym with 400 members. It is a retrieval-only app over the gym's own records. Nothing it answers comes from outside those records. It answers questions from two kinds of record: shared records that are the same for every member, and private records that belong to one member only. Members also check in by QR code and pay or renew membership inside the app.

## Who uses it
- Member: the primary user. Asks questions, checks in, pays or renews.
- Staff: not a user of the app. Drafts shared record cards and corrects check-ins or payments behind the scenes. Appears to members only as a named person the app hands off to.
- Owner: not a user of the app in the retrieval flow. Approves every staff-drafted card before it goes live. Reviews flagged wrong answers.

## One thing the agent must do well
The app must never state a private or financial fact it cannot back with a record and a confirmation date. If a match is uncertain, or the question falls in a staff-routed category, the app must refuse and name the staff member on duty instead of guessing. The staff member on duty is whichever staff record is currently marked on duty in the staff data. This value must never be guessed or hardcoded. Every answer screen must include a control the member can tap to flag a wrong answer. This flag must reach the owner, not disappear.

## Defined scope for the MVP
- Ask a shared-record question, answered by meaning search over rule cards, filtered by tier.
- Ask a private-record question, answered by exact fetch on the member's own ID.
- Check in by scanning a QR code at the gym. A member can never self-check-in by tapping a button. If the scan fails, only staff can log the check-in, from the staff screen.
- Pay or renew inside the app through the payment gateway. Never update a member's balance or expiry from the app's own success screen. Update it only after the payment gateway confirms the transaction on the server. Staff can record a cash payment separately.
- View a written training plan, Premium tier only.
- An expired member keeps access to their own balance and payment history and can still pay. They lose access to shared content until they renew.
- A private-record lookup must answer, or refuse, within 3 seconds. A shared-record search must answer, or refuse, within 5 seconds.
- Member login must use SMS OTP. No other authentication method is permitted in the MVP.

## Not in scope for the MVP
- Class booking or reservation.
- Push notifications, reminders, or any automated follow up.
- Any agent action that is not confirmed by a human first.
- Social features or leaderboards.
- Refund processing, billing dispute resolution, or medical guidance. These always route to staff.
- Device-level check-in verification. Do not build this. It is not part of this project yet.

## Stack
- Next.js
- TypeScript
- Prisma
- PostgreSQL
- Flutterwave for payments
- pgvector for vector data
- Gemini free tier for embeddings

## Folder map
Not defined in the PRD or in this file. Do not invent a folder structure. See Open Questions below.

## How to work in this codebase
- Make one change at a time: one function, one file, or one endpoint per response. Do not combine unrelated changes in the same response.
- Ask before adding a new package or dependency.
- Never modify `prisma/schema.prisma` or run a migration without asking first. All database access goes through Prisma's generated client, never raw SQL.
- Any function that reads a private record must not accept a member ID as an external parameter. It must always use the ID from the current logged-in session, nothing else.
- List assumptions at the end of every response.
- Stop and ask when the PRD is silent about something. Do not guess or fill the gap.

## Where the detailed rules live
This file does not hold schema, SQL, model names, vector dimensions, prices, thresholds, or environment variable names. Those belong in dedicated files. Create the file first if it does not exist yet, then keep it current.
- Database schema and SQL: `prisma/schema.prisma`
- Confidence thresholds and tuning notes: `docs/THRESHOLDS.md`
- Embedding model name and dimensions: `docs/EMBEDDING.md`
- Prices, fees, and gateway settings: `docs/PAYMENTS.md`
- Environment variable names: `.env.example`

## Definitions
- Tier: Basic or Premium. Basic sees the timetable, prices, rules, access hours, and the member's own attendance and balance. Premium sees all of that plus the training plan.
- Shared record: a record that is the same for every member, such as the timetable, prices, rules, guest policy, or training plans. Gated by tier.
- Private record: a record that belongs to one member only, such as attendance, balance, expiry, or tier status. Fetched by exact member ID only. Never searched across members.
- Embedding: a vector, meaning a list of numbers, that represents the meaning of a piece of text, used for search.
- Semantic search: search that matches by meaning rather than exact keywords.
- OTP: one-time password, a short numeric code sent by text message, required for every member login.
- Confidence threshold: the score that decides whether a shared-record match is certain enough to show as an answer. It is a placeholder value that must be tuned before launch and must never ship untested. The exact value lives in `docs/THRESHOLDS.md`, not in this file.
- Staff-routed category: one of exactly five question types that always go to staff regardless of what any record says: refunds, billing disputes, medical or injury questions, policy exceptions, and hardware faults. No other category may be added without updating this file.
- Chunk: not defined in the PRD. Do not use this term until it is defined.