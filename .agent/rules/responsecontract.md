---
trigger: model_decision
description: "Rules for refusal, error, and fallback text shown to a member"
---

# Response Contracts

## Job of this file
Hold the exact, fixed wording for every kind of refusal the app can give. No refusal wording is generated freely.

## Rule
- Every refusal uses one of the templates below, filled in with the specific detail (staff name, category) but never rewritten.
- Reason: the PRD requires refusal behavior that cannot drift session to session. A model generating fresh wording each time cannot guarantee that.

## Template: staff-routed category match
"I can't help with that here. [Staff name] can help you with this, they're on duty now."

## Template: low confidence shared-record match
"I couldn't find a confident answer to that. [Staff name] can help you with this, they're on duty now."

## Template: empty private-record lookup
"I don't have that on record yet. [Staff name] can help you check, they're on duty now."

## Template: compound question, partial answer
"[Answer to the resolvable part.] For the rest of your question, please ask [Staff name], they're on duty now."

## Template: no staff currently on duty
"I can't help with that right now, and no one is on duty at the moment. Please try again when the gym is staffed."
- Reason: the PRD's own opening scenario is a member arriving before any staff member is on shift. Every other template assumes someone is on duty. This is the required fallback for when that assumption is false.

## What fills in the brackets
- `[Staff name]` comes from whichever `Staff` record currently has `onDuty = true`. Never hardcoded, never guessed. If no `Staff` record has `onDuty = true`, use the no-staff-on-duty template instead.
- `[Answer to the resolvable part]` comes only from the matched record's own fields, never invented text.