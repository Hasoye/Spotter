# Spotter

A member-facing app for a gym with 400 members. Members ask questions in plain language and get answers from the gym's own records only — shared records (timetable, prices, rules, guest policy, training plans) and private records (attendance, tier, expiry, balance). Members also check in by QR code and pay or renew inside the app.

The app never states a private or financial fact it cannot back with a record and a confirmation date. When a match is uncertain, or the question falls in a staff-routed category, it refuses and names the staff member on duty instead of guessing.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router), TypeScript |
| Database | PostgreSQL with pgvector, via Prisma |
| Payments | Flutterwave |
| Embeddings | Gemini free tier |
| Tests | Vitest |

## Prerequisites

- Node.js 18.17 or newer
- PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension installed and creatable in your database
- A Flutterwave account, a Gemini API key, and an SMS OTP provider account (any of these can be left blank while the matching feature is still being built)

## Setup

```bash
git clone <repo-url>
cd SPOTTER
npm install            # also runs `prisma generate` via postinstall
cp .env.example .env   # use `copy .env.example .env` on Windows
```

Fill in `.env.example`'s values in `.env`. Every variable is listed there with a pointer to the rule file that explains it. `DATABASE_URL` is required for anything that touches the database; the rest are required only by the feature that uses them.

Create the database, apply the schema, and start the dev server:

```bash
npx prisma migrate dev   # first run: create the initial migration from prisma/schema.prisma
npm run dev              # http://localhost:3000
```

> No migrations are committed to this repository yet. The first `prisma migrate dev` will generate the initial migration file; commit it alongside any later schema change, never mixed with feature code.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint via `next lint` |
| `npm run test` | Run the Vitest suite once (`vitest run`) |
| `npx prisma generate` | Regenerate the Prisma client (runs automatically on `npm install`) |
| `npx prisma studio` | Browse the database locally |

Run `npm run lint` and `npm run test` before every commit. CI runs both, plus `npm run build`, on every push and pull request.

> ESLint is not configured in this repository yet, so the first local `npm run lint` stops and asks how you want to configure it. Pick a preset (or add a config file) once; until then CI will not get past the lint step either.

## Project layout

```
app/                Next.js App Router pages and layouts
app/api/            API route handlers
components/         UI components (never touch the database directly)
lib/                Shared server-side logic, Prisma client, tuned constants
prisma/             schema.prisma and migrations
Docs/               Product requirements document
.agent/rules/       Detailed engineering rules (auth, payments, retrieval, security, ...)
.github/workflows/  CI
```

`lib/` holds server code only. `components/` calls into `lib/`, never into the database. A new top-level folder is never added without updating `.agent/rules/structure.md` in the same change.

## Where the rules live

This repo keeps detail out of any single summary file. Before changing something, read the file that owns it:

- Product scope and requirements: [`Docs/spotter-prd-revised.md`](Docs/spotter-prd-revised.md)
- How to work in this codebase: [`AGENTS.md`](AGENTS.md)
- Engineering rules — schema, auth, retrieval, vector search, payments, security, staff routing, testing, git workflow: [`.agent/rules/`](.agent/rules)
- Database schema: [`prisma/schema.prisma`](prisma/schema.prisma)
- Environment variables: [`.env.example`](.env.example)

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and to any `feature/*`, `fix/*`, or `chore/*` branch, and on pull requests to `main`:

```
npm ci → npm run lint → npm run test → npm run build
```

This repository's default branch is `master`, which the workflow does not list. Pushes to `master` do not trigger CI today.

## Contributing

Branch from `master` using `feature/short-name`, `fix/short-name`, or `chore/short-name`. Never commit directly to the default branch. One commit covers one function, one file, or one endpoint, and starts with an imperative verb. A schema change and a feature change never share a commit.
