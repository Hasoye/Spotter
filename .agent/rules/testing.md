---
trigger: always_on
---

# Testing

## Job of this file
State what must be tested before a change counts as done, and what tool tests use.

## Tool
- Use Vitest for unit and integration tests.
- Reason: one tool, chosen once, so the agent never asks or guesses per session.

## What must always be tested
- Any function that reads or writes a private record. Test that it cannot be called with a member ID from outside the session.
- Any function that changes a `Transaction` status. Test that a client-reported success never changes a balance without a verified webhook.
- Any function that changes a `SharedRecordCard` status. Test that approving a new version supersedes the old one.
- Any refusal path. Test that the exact response template from `docs/RESPONSE_CONTRACTS.md` is returned, not a generated string.
- Any function that classifies a question into a staff-routed category. Test that a matched category never reaches shared-record search or private lookup.
- Reason: these five are the exact places past reviews of this product found real bugs. They are load-bearing, not optional.

## Definition of done
A change is done only when:
1. It has at least one test covering the normal case.
2. It has at least one test covering that function's specific, real failure mode: the actual bad input, missing record, or failed dependency it could realistically encounter, not a placeholder test.
3. All existing tests still pass.
- Reason: "done" without a testable definition becomes whatever the agent felt like finishing.

## What does not need a test
- Static content, copy text, and styling changes.
- Reason: testing these wastes effort without reducing real risk.