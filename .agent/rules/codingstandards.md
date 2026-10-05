---
trigger: always_on
---

# Coding Standards

## Job of this file
Set how code is written so every session produces code that reads like one person wrote it.

## TypeScript
- Strict mode is on. Never turn it off in `tsconfig.json`.
- Reason: strict mode catches null and undefined bugs before they reach a user, which matters most on the payment and private record code paths.
- Never use `any`. If a type is genuinely unknown, use `unknown` and narrow it before use.
- Reason: `any` silently disables the type checker exactly where it is needed most.

## Naming
- Files: kebab-case. Example: `member-balance.ts`.
- Functions and variables: camelCase.
- Types and interfaces: PascalCase.
- Reason: one convention means the agent never has to guess which style a given file follows.

## Structure
- Each file exports one function, or a small set of functions that only make sense together, serving one clearly named purpose. If a file needs a sentence to explain what it does, it is doing one job. If it needs two sentences joined by "and," split it.
- Shared logic goes in a `lib/` file, never copied between routes.
- Reason: copied logic drifts. A rule like "never trust client payment status" must exist in one place, not three.

## Next.js
- Components are Server Components by default. Add `"use client"` only when a component needs interactivity, such as a form or a button handler.
- Reason: this is the stack's own default. Marking everything as a Client Component without reason adds unnecessary client-side JavaScript on a user base with small data bundles.

## Formatting and linting
- Use Prettier defaults. Do not customize print width, quote style, or semicolons.
- Run the linter before treating any change as finished.
- Reason: formatting arguments waste review time that should go to logic review.

## Logging
Logging rules live in `ERROR_HANDLING.md`, not here. Do not restate them.