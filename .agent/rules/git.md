---
trigger: always_on
---

---
trigger: always_on
---

# Git

## Job of this file
Define what "one change at a time," a rule already stated in `AGENTS.md`, means in git terms. This file replaces the earlier `GIT_WORKFLOW.md`, which should be deleted to avoid two files governing the same behavior.

## Branches
- Never commit directly to `main`.
- Branch names: `feature/short-name`, `fix/short-name`, or `chore/short-name`.
- Reason: a named branch per change makes it possible to review, revert, or discard one change without touching another.

## Commits
- One commit covers one function, one file, or one endpoint. This is the exact unit `AGENTS.md` refers to when it says "one change at a time."
- Commit message starts with an imperative verb: "Add", "Fix", "Remove". Example: "Add webhook handler for Flutterwave confirmation."
- Never combine a schema change and a feature change in the same commit.
- Reason: a mixed commit cannot be reviewed or reverted cleanly, and schema changes carry more risk than feature code.

## Before committing
Run `npm run lint` and `npm run test`, both named in `command.md`. Do not commit if either fails.
Reason: this is the local check. `ci.md` is the check that runs regardless of whether this step was followed.

## Pull requests
Every pull request states what changed and why, in plain sentences, not just a file list.
Reason: a reviewer without full context needs the reasoning, not just the diff.