---
trigger: model_decision
description: "Rules for member login, OTP, and session handling"
globs: src/server/auth/** , src/middleware.ts
---

# Auth

## Job of this file
State how a member logs in. This file replaces the earlier `docs/AUTH.md`, which should be deleted to avoid two files governing the same behavior.

## Method
SMS one-time password (OTP), tied to the member's registered phone number. No other login method is permitted in the MVP.

## OTP provider
Not yet decided. Once chosen, record here:
- Provider name.
- Per-message cost in naira, also added to `docs/PAYMENTS.md`'s cost section if one exists, or to the business model document.
- Any rate limit the provider itself imposes.
Reason: the per-message cost is a real recurring cost that must be tracked, not assumed to be free.

## Login flow
1. Member enters their registered phone number.
2. A one-time code is sent by SMS.
3. Member enters the code. On match, a server-side session is created.
4. Session is checked on every request that touches a private record.

## Session rules
- Session data is stored server-side, not in a client-readable cookie beyond a session identifier.
- A session expires after a period of inactivity. Exact duration is not yet decided and must be recorded here once set.
- Reason: an undecided session length is not a blocker to starting the login flow, but it must not be silently defaulted to something long without a record of the decision.

## Rate limiting
See `SECURITY.md`. This file does not restate the rate limit rule, only confirms it applies to the OTP send step.

## Where credentials live
Provider credentials are named in `.env.example` and explained in `docs/env.md`. This file does not restate them.

## Open item: staff and owner login
This file covers member login only. The PRD requires a staff screen and an owner screen, but nothing anywhere defines how staff or the owner log into them. This is not answered here, since answering it would mean inventing a mechanism. It must be resolved before either screen is built.