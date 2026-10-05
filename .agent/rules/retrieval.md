---
trigger: always_on
---

---
trigger: always_on
---

# Retrieval

## Job of this file
State the order a question moves through the system. This file defines sequence and ownership only. It does not restate any logic already owned by another file. If you need the actual mechanism behind a step, follow the link, do not copy the rule here.

## The order
1. **Classify.** Check the question against the fixed staff-routed categories.
   Owner: `staffrouting.md`.
2. **Route on match.** If matched, stop here and return the matching refusal template.
   Owner: `responsecontract.md`.
3. **Branch.** If no match, classify the question as shared-record or private-record.
   Owner: `privaterecordaccess.md`.
4. **Shared-record path.** Run the shared-record search.
   Owner: `vectorsearch.md` for the mechanism, `threshold.md` for the confidence value.
5. **Private-record path.** Run the private-record lookup.
   Owner: `AGENTS.md` and `privaterecordaccess.md`.
6. **Answer or refuse.** Return the answer with its confirmation timestamp, or the appropriate refusal template.
   Owner: `responsecontract.md`.
7. **Log.** Write the outcome to `QueryLog`.
   Owner: `metrics.md`.

## Compound questions
A question with more than one detected intent is handled per `staffrouting.md`. This file does not restate that behavior.

## Rule
This file is the map. If a change to the retrieval flow's order is needed, change it here first, then update the owning file for the step that changed. Never let the order described here and the order actually implemented in code disagree.
Reason: several files each own a piece of this flow. Without one file stating the order, an agent building any single step has to infer the sequence, which is exactly how a staff-routed question could end up reaching search before being checked.