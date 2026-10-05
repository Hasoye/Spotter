---
trigger: always_on
---

# Private Record Access

## Job of this file
List every field that counts as a private record, and list the fixed lookup types allowed against them.

## What counts as a private record
- Attendance (`AttendanceRecord`)
- Balance (`Member.balanceKobo`)
- Expiry (`Member.expiresAt`)
- Tier (`Member.tier`)
- Payment and transaction history (`Transaction`)

## Enforcement
The rule for how these fields must be accessed, no external member ID parameter, session ID only, is stated once in `AGENTS.md`. It is not restated here. It applies to every field listed above without exception.

## Fixed lookup types
Private-record questions are answered through exactly these lookups, nothing else:
1. Attendance count for a given period.
2. Current balance.
3. Expiry date.
4. Current tier.
- Reason: a fixed, closed list of lookups means there is no free-text query path into private data. Anything outside this list is a staff-routed question, not a lookup.

## What never happens
- No private record field is ever embedded. See `docs/EMBEDDING.md`.
- No private record is ever returned as part of a shared-record search result.