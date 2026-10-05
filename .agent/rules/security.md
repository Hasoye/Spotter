---
trigger: always_on
---

# Security

## Job of this file
State what to check before adding a dependency, and the minimum input validation every route needs.

## Secrets
- No secret, key, or password is ever written directly in code.
- All secrets come from environment variables named in `.env.example`.
- Reason: a secret committed to git history stays exposed even after it is deleted from the latest version.

## Adding a dependency
AGENTS.md requires asking before adding a package. Before asking, check:
- The package has had a release in the last 12 months.
- The package has no open critical vulnerability listed on its registry page.
- The package is actually needed, not a convenience for one function that could be written directly.
- Reason: an unmaintained or vulnerable dependency becomes the agent's problem to fix later, usually under worse conditions.

## Input validation
- Use zod to define a schema for every API route's input, and validate against it before using any value.
- Reject the request if validation fails. Never proceed with partial or assumed data.
- Reason: this is the first line of defense against a request that tries to pass a member ID, a card status, or an amount that does not belong to it.

## Rate limiting
- Rate limit the OTP send route by phone number.
- Rate limit the payment initiation route by member ID.
- Reason: both actions cost real money per call. An unthrottled route is a direct financial risk. Each route needs its own key because a phone number exists before login, and a member ID does not.