name: add-refusal-path
description: Use when adding a new reason the app must refuse to answer, so the template, trigger, logging, and test are wired together every time.
---
Job

Add one new refusal path with a fixed template, a clear trigger, a log entry, and a test.

Procedure
Write the new refusal's fixed wording in responsecontract.md. Confirm the wording matches the plain-language pattern of the existing templates. Do not generate wording elsewhere.
Confirm where this trigger fits in the existing sequence in retrieval.md. If it changes the order of any step, update retrieval.md first.
Confirm the trigger condition is checked in code before any answer is returned, not after.
Add the new outcome to what gets written to QueryLog, per metrics.md. Confirm the field exists to record this specific outcome.
Write a test confirming the exact template from responsecontract.md is returned for this trigger, per testing.md. Confirm the test checks the literal string, not just that a refusal occurred.
Run npm run test, per command.md. Confirm it passes before committing.