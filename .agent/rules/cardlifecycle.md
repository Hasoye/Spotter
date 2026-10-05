---
trigger: model_decision
description: "Rules for shared record card draft, approval, and status transitions"
---

# Card Lifecycle

## Job of this file
State how a `SharedRecordCard` moves between `DRAFT`, `APPROVED`, and `SUPERSEDED`, and who can trigger each move.

## States
- `DRAFT`: staff-written, not visible to members, not searchable.
- `APPROVED`: owner-approved, visible to members at or above the card's `minTier`, searchable.
- `SUPERSEDED`: was approved, now replaced by a newer approved version. Not searchable, kept for history.

## Rules
1. Staff can create a new `DRAFT` card, or a new `DRAFT` version of an existing card.
   Reason: staff write the content, but nothing they write reaches a member until it is checked.
2. Editing an already-`APPROVED` card never overwrites it. It always creates a new `DRAFT` version instead.
   Reason: overwriting a live card would let unapproved content go straight to members with no review step.
3. Only the owner can move a card from `DRAFT` to `APPROVED`.
   Reason: this is the single approval gate the PRD requires. Splitting it across more than one role removes the point of having a gate.
4. When a new version is approved, the previous `APPROVED` version of the same card lineage is set to `SUPERSEDED` in the same database transaction.
   Reason: without this, two approved versions of the same card can exist at once, and both become eligible for search, which was a confirmed bug in an earlier review of this product.

## Embedding trigger
Moving to `APPROVED` is also the trigger for embedding. See `docs/EMBEDDING.md`. This file does not restate that logic.