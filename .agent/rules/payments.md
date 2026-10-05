---
trigger: glob
globs: src/server/payment/** , **/payments/**, **/webhook*, **/transaction*
---

# Payments

## Job of this file
State how Spotter handles money, using Flutterwave, and how manual cash payments are entered.

## Gateway
Flutterwave. Checkout is hosted by Flutterwave, not built custom.

## Transaction states
- `INITIATED`: payment started, checkout redirect sent.
- `PENDING_VERIFICATION`: checkout finished, no webhook received yet.
- `CONFIRMED`: webhook received and verified.
- `FAILED`: webhook reports failure, or verification times out with no success.

## The core rule
- A member's `balanceKobo` or `expiresAt` is updated only when a `Transaction` reaches `CONFIRMED` through a verified webhook.
- The app never trusts what the client's browser or phone reports about payment success.
- Reason: this is the PRD's most severe named risk. A client-reported success can be wrong, delayed, or spoofed. A server-to-server webhook cannot be faked by the member's phone.

## Webhook signature verification
- Every incoming webhook request must be verified against `FLUTTERWAVE_WEBHOOK_SECRET` before any part of it is trusted.
- If the signature does not match, reject the request and log it. Do not process the payload.
- Reason: without this check, a POST request to the webhook route from anywhere, not just Flutterwave, could mark a transaction confirmed. The secret is what proves the request actually came from the gateway.

## Timeout
- If no webhook arrives within 10 minutes of checkout redirect, set status to `PENDING_VERIFICATION` and show the member a message that the payment is being confirmed, not a success or failure state.
- Reason: an undefined in-between state leaves both the app and the member unsure what happened.

## Cash payments
- Staff can create a `Transaction` directly with `source = MANUAL_STAFF` and `status = CONFIRMED`.
- This path bypasses the webhook entirely and is entered by a logged-in staff user only.
- Reason: cash paid at the desk has no webhook to wait for. This is a separate, explicit path, not a workaround of the gateway path.

## Fees
Flutterwave charges approximately 1.5 percent per transaction, capped around 2,000 naira on local cards. This fee is paid to Flutterwave, not held or processed by Spotter.

## Idempotency
- The webhook handler must check whether a `gatewayRef` has already been processed before applying any update.
- Reason: gateways can send the same webhook more than once. Processing it twice must not double-apply a balance update.