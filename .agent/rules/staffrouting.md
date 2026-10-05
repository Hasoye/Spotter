---
trigger: always_on
---

# Staff Routing

## Job of this file
State how a question is detected as belonging to one of the five staff-routed categories, before it reaches search or lookup.

## The five categories
Already named in AGENTS.md: refunds, billing disputes, medical or injury questions, policy exceptions, hardware faults. This file does not restate them, only how detection works.

## Detection method
Not yet decided. This must be resolved and recorded here before this logic is built. The two real options are:
1. A fixed keyword and phrase list per category, checked before any other processing.
2. A lightweight classification call using the same Gemini free tier used for embeddings.
Reason: leaving this undecided in code, rather than here, means each build session could pick a different method and produce inconsistent routing behavior.

## Where this code lives
`lib/staff-routing.ts`, per `structure.md`. Whichever detection method is chosen, it lives in this one file, not scattered across routes.

## Where this runs
- Before shared-record search.
- Before any private-record lookup.
Reason: a staff-routed question must never reach search or lookup, even to fail there. It must stop at this step.

## What happens if classification fails
If the detection method is a live call (option 2 above) and that call fails, times out, or errors, treat the question as if it matched a staff-routed category and return the staff-routed refusal template from `docs/RESPONSE_CONTRACTS.md`. Never let a classification failure fall through to shared-record search or private lookup.
Reason: this step exists specifically to keep risky questions away from search and lookup. On failure, the safe direction is to over-route to staff, not to guess that the question was probably fine and let it through.

## Compound questions
If a question contains more than one detected intent, for example a private lookup and a staff-routed topic together, answer only the resolvable part. Tell the member to ask the staff-routed part separately, using the exact wording in `docs/RESPONSE_CONTRACTS.md`.
Reason: partially answering a compound question is safer than either refusing the whole thing or guessing at the risky part.

## Logging
Every classification result, matched category, no match, or classification failure, is written to `QueryLog.matchedStaffCategory`.
Reason: this is the only record showing whether routing behaved correctly over time, and it is what a review of flagged answers or a future tuning pass would need to check.