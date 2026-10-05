---
trigger: model_decision
description: "Rules for migrating existing gym balance and payment data into the app"
---

# Data Migration

## Job of this file
Hold the plan for moving the gym's existing balance and payment history into `Member.balanceKobo`, and state the blocker until that plan exists.

## Current status: blocked
The PRD names this as a Pre-Build Blocker, not an open question to answer later.
Where the gym's existing balance data currently lives is not yet known: spreadsheet, notebook, or memory.
- Reason: without knowing the source, there is no way to migrate it, and every balance the app shows on day one would be unverified.

## Rule
Do not build or ship the balance-reading feature against live member data until:
1. The current data source is identified.
2. A migration plan is written below.
3. That plan has been run at least once against a small test set of real members, and checked by hand against the existing record.

## If the source is a spreadsheet or notebook
Check the migrated values by hand against that written record before trusting them in the app.

## If the source is memory only
There is no written record to check against. This means:
- The migration cannot be automated.
- The gym must first write down current balances manually, in a spreadsheet, before any migration into the app can happen.
- This manual write-down step becomes part of the migration plan, not a shortcut around it.
Reason: a memory-only source is not a data source, it is a missing record. Treating it as one risks migrating guesses as if they were facts.

## Migration plan
Not yet written. Add it here once the data source above is confirmed.

## Day-one behavior
Until migration is complete, a member with no balance record shows "not recorded yet," never a zero balance.
- Reason: a false zero balance is worse than an honest gap, since it looks like a fact instead of a missing one.