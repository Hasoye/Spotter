name: apply-schema-change
description: Use when adding, removing, or changing a model or field in the Prisma schema, so the vector index and documentation stay in sync with the code.
---
Job

Change the database schema and keep prismaschema.md, the vector index, and schema.md all in sync with the result.

Procedure
Confirm the intended change matches what prismaschema.md already states, or update prismaschema.md first if the change is new. Do not edit the real schema before this file agrees with it.
Apply the change to the real prisma/schema.prisma and run npx prisma migrate dev, per command.md.
Check whether the change touches the CardEmbedding model or its embedding column. If it does, confirm the separate raw SQL migration for the pgvector IVFFlat index, per vectorsearch.md, still matches the current column definition.
If the change alters a design decision explained in schema.md (for example, why a field is an integer, why a relation restricts delete), update schema.md in the same change.
Run npx prisma generate and confirm the generated client reflects the change.
Run npm run test, per command.md. Confirm every test touching the changed model still passes.