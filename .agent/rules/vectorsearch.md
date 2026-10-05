---
trigger: glob
globs: lib/vector-search.ts
---

# Vector Search

## Job of this file
State exactly how the shared-record similarity search runs, and name the one place raw SQL is allowed.

## The raw SQL exception
`SECURITY.md` and `AGENTS.md` forbid raw SQL everywhere else in the codebase. This file names the one exception.
- Prisma Client does not support pgvector similarity operators, such as cosine distance, through its normal type-safe query API.
- The similarity search must use `$queryRaw` with the pgvector cosine distance operator.
- This function must live in exactly one file, `lib/vector-search.ts`, and nowhere else. No other file in the codebase may contain a `$queryRaw` call.
- Reason: naming one file makes it possible to check the whole codebase for raw SQL by checking one place, instead of searching everywhere for exceptions to the rule.

## Query order
1. Filter `CardEmbedding` rows to `status = APPROVED`.
2. Filter further to `tierGate` at or below the member's tier.
3. Only then run the cosine similarity comparison against the filtered rows.
- Reason: filtering first keeps the similarity search from scanning rows it can never legally return, which is both faster and safer.

## Index
IVFFlat index on the `embedding` column, applied through a raw SQL migration, per the note in `prisma/schema.prisma`.
- Reason: at Spotter's expected scale, under 200 cards, IVFFlat is sufficient and cheaper to build than the alternative, HNSW.

## Confidence threshold
The similarity score is compared against the value in `docs/THRESHOLDS.md`. This file does not restate that value.