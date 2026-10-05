---
trigger: model_decision
description: Apply when writing or editing frontend UI, client-side state, or code handling network requests from the browser.
---

---
trigger: model_decision
description: Apply when writing or editing frontend UI, client-side state, or code handling network requests from the browser.
---

# Client

## Job of this file
State the frontend constraints that come from the actual device Spotter runs on: an inexpensive Android phone, small mobile data bundles, and unreliable power.

## Bundle size
- Keep client-side JavaScript to what a page actually needs. This follows from the Server Component default in `codingstandards.md`; this file does not restate that rule, only the reason it matters here specifically.
- Reason: a member buying data in small bundles pays, in real money, for every unnecessary kilobyte shipped to their phone.

## Network failure handling
- Every network request that can fail (check-in scan, payment initiation, asking a question) must show a clear loading state and a clear failure state. Neither can be silent.
- A failed request must be safely retryable. Tapping "try again" must never risk creating a duplicate check-in or a duplicate payment attempt.
- Reason: connections drop mid-request on this user base regularly, not as an edge case. The idempotency rule in `payments.md` protects the server side of this; this rule protects the client side.

## Power and session loss
- Do not rely on long-lived client-side state that would be lost if the app closes or the phone loses power mid-action. A check-in or payment in progress must be resumable from its actual server-side status on reopen, not from memory the client held.
- Reason: unreliable power means the app can close mid-action at any time. State that only exists on the client disappears with it.

## Loading feedback
- Any action expected to take more than one second shows a loading indicator immediately, not after a delay.
- Reason: without immediate feedback, a slow network makes the app look broken rather than working.

## What this file does not cover
Response time targets themselves are set in `AGENTS.md`'s functional requirements, not here. This file covers how the client behaves while waiting, not how long the wait is allowed to be.