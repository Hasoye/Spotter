name: scaffold-api-route
description: Use when creating a new API route for Spotter, so every route gets input validation, session handling, error handling, and a test in the same pass instead of missing one.
---
Job

Build one new API route with input validation, session handling, error handling, and a test, in that order, every time.

Procedure
Confirm the route's file location matches structure.md. Do not create it elsewhere.
Write a zod schema for the route's input, per security.md. Confirm the schema rejects a request missing any required field.
If the route touches a private record, confirm the member ID comes only from the session, never from the request body or query string, per privaterecordaccess.md. Confirm this by checking the function signature accepts no external member ID parameter.
Wrap the route's logic in error handling per errorhandling.md. Confirm every catch block either logs with context or re-throws, never both empty and silent.
Check whether this route's failure mode has a domain-specific rule (for example payments.md or embedding.md). If it does, confirm the route follows that rule instead of a generic catch-and-log.
Write at least one test covering the normal case and one covering a real failure case, per testing.md. Confirm both tests exist before marking the route done.
Run npm run lint and npm run test, per command.md. Confirm both pass before committing.