---
trigger: glob
globs: .github/workflows/**
---

# CI

## Job of this file
State what runs automatically on every push or pull request, before a merge is allowed.

## Where this lives
The workflow configuration is `.github/workflows/ci.yml`, per `docs/structure.md`. Do not create a second workflow file for the same checks.

## Required checks
Every pull request must pass all of the following before it can be merged:
1. `npm run lint`
2. `npm run test`
3. `npm run build`
Reason: `git.md` asks a developer to run these locally before committing, but a local run can be skipped. CI is the check that cannot be skipped.

## What CI does not do
- CI does not run `prisma migrate dev` or apply any migration to a real database.
- CI does not send a real SMS OTP or a real Flutterwave transaction. Any test touching those paths uses a mock, not the live provider.
Reason: CI must never cost real money or touch a real member's data.

## On failure
A failing check blocks the merge. No merge happens with a red check, even for a small change.
Reason: this is the enforcement mechanism behind `TESTING.md`'s definition of done. A definition of done that is not enforced automatically becomes optional.