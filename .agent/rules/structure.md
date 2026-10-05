---
trigger: always_on
---

# Structure

## Job of this file
Define the folder structure. This resolves an open question left in `AGENTS.md`, which previously said no structure was defined.

## Layout
```
app/                Next.js App Router routes and pages
app/api/            API route handlers
lib/                Shared server-side logic
lib/constants.ts    Single source for the confidence threshold and other tuned values
lib/vector-search.ts  Where the pgvector similarity search lives (see docs/VECTOR_SEARCH.md)
components/         Shared UI components
prisma/             schema.prisma and its migrations
docs/               Rules files, including this one
.github/workflows/  CI configuration, see ci.md
```

## Rules
- A new top-level folder is never added without updating this file in the same change.
- `lib/` holds server-side logic only. It never imports from `app/` in a way that would pull client code into a server module.
- `components/` holds UI only. It never talks to the database directly. It calls functions in `lib/`.
- Reason: without a fixed layout, each build session can place logic differently, and shared functions stop being found or reused, which directly breaks the "no copied logic" rule in `CODING_STANDARDS.md`.

## What this file does not cover
- Naming conventions for files within a folder are covered in `CODING_STANDARDS.md`, not here.
- What is and is not allowed inside `lib/vector-search.ts` is covered in `docs/VECTOR_SEARCH.md`, not here.