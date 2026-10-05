---
trigger: model_decision
description: "Rules for calling the embedding provider and writing CardEmbedding rows"
---

# Embedding

## Job of this file
State which embedding provider and model Spotter uses, and when embedding happens.

## Provider
Gemini free tier.

## Model and dimensions
Not yet finalized. This document and `prisma/schema.prisma` currently both assume `vector(1536)`. This is a placeholder, not a confirmed value.
- Rule: if the actual Gemini embedding model's output size differs from 1536, both this file and the `embedding` column type in `prisma/schema.prisma` must be updated together, in the same commit. They must never disagree.
- Reason: a mismatch between the stated dimension and the schema's actual column size causes the similarity search to fail or error, not just underperform.

## When embedding happens
- Only when a `SharedRecordCard` moves to `status = APPROVED`.
- Never on every edit. A `DRAFT` card is not embedded.
- Reason: embedding a draft would let unapproved content leak into search results.

## What gets embedded
- Only the `bodyText` field of the card.
- Reason: title and metadata do not need to be searched by meaning, and including them adds noise to the match.

## What never gets embedded
- Any field on `Member`, `AttendanceRecord`, `Transaction`, or `QueryLog`.
- Reason: private data must never enter the same search space as shared records. See `docs/PRIVATE_RECORD_ACCESS.md`.