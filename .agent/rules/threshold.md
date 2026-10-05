---
trigger: model_decision
description: "Rules for the shared-record confidence threshold and lib/constants.ts"
---

# Thresholds

## Job of this file
Hold the exact confidence threshold used to decide whether a shared-record match is certain enough to show as an answer, and its tuning history.

## Current value
0.75 cosine similarity. This is a placeholder, not a tuned value.

## Where code reads this value
This markdown file is not readable by application code at runtime. The real value lives in `lib/constants.ts`, in a single named export, for example `CONFIDENCE_THRESHOLD`. This document is the human-readable log of what that value is and why it changed. The two must always match. If they do not, `lib/constants.ts` is wrong and must be corrected to match this file, since this file is the record of the decision.

## Rule
- This value must not ship to production untested.
- Before launch, it must be tuned against a labeled set of real gym questions with known-correct answers.
- Reason: this is the single number that decides whether the app answers or refuses. A wrong value either refuses too often, making the app useless, or answers too often, stating facts it should not.

## How to change this value
1. Run the tuning set against the current value and record the false-answer rate and false-refusal rate.
2. Adjust the value and re-run.
3. Log every change below with the date, old value, new value, and reason.
4. Update `lib/constants.ts` in the same commit as this file. Never let the two disagree.

## Change log
- Placeholder set at 0.75. Not yet tuned.