---
trigger: glob
globs: .env.example, .env
---

---
trigger: glob
glob: .env.example, .env
---

# Env Example

## Job of this file
Hold the exact, current content of the project's `.env.example`. No real value ever goes in this file or in the real `.env.example`. Real values go only in a local, never-committed `.env`.

Where to obtain each real value is explained in `env.md`, not here. This file holds the variable names only.

```
# Database. See prisma-schema.md.
DATABASE_URL=

# Session handling. See auth.md.
SESSION_SECRET=

# Payment gateway. See payments.md.
FLUTTERWAVE_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_WEBHOOK_SECRET=

# Embedding provider. See embedding.md.
GEMINI_API_KEY=

# SMS OTP provider. See auth.md.
OTP_PROVIDER_API_KEY=
OTP_PROVIDER_SENDER_ID=
```