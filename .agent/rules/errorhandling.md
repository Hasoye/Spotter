---
trigger: always_on
---

# Error Handling

## Job of this file
State what an agent must never do silently, and how errors are surfaced.

## Never swallow an error
Every `catch` block either logs the error with enough context to reproduce it, or re-throws it. Never both empty and silent.
Reason: a swallowed error on a payment or record-fetch path is exactly how a wrong balance goes unnoticed.

## Domain-specific failure behavior wins
If a domain file defines a specific fallback for a specific failure, for example `docs/EMBEDDING.md`'s rule for a failed embedding call, or `docs/staffrouting.md`'s rule for a failed classification call, follow that rule exactly. This file's generic log-or-rethrow rule is the default for everything not covered by a more specific rule, not a replacement for one.
Reason: a generic catch-and-log is not the same as the specific fail-safe those files require. Applying the generic rule where a specific one exists would under-protect exactly the paths that need the most care.

## Logging
- Use a single logger module, not `console.log` directly.
- Every logged error includes: what operation was running, the member ID if one is involved, and the original error message.
- Never log a full card number, OTP code, or password, even in an error.
Reason: logs are the only record of what happened when something breaks in production. They must be useful and must not leak sensitive data.

## User-facing errors
A member never sees a stack trace or a raw error message. Every user-facing error is plain language, and for private-record or payment failures, follows the exact template in `docs/RESPONSE_CONTRACTS.md`.
Reason: this matches AGENTS.md's rule that the app must never guess or improvise wording on a sensitive path.

## Payment and webhook errors
If a webhook fails to process, the transaction stays in `PENDING_VERIFICATION`. It is never marked `CONFIRMED` as a fallback.
Reason: defaulting to success on an error is the single most dangerous shortcut available in this codebase.