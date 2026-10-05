---
trigger: model_decision
description: Apply when considering, building, or discussing a background job, scheduled task, cron, or queue.
---

---
trigger: model_decision
description: Apply when considering, building, or discussing a background job, scheduled task, cron, or queue.
---

# Jobs

## Job of this file
State what background or scheduled jobs exist in this codebase.

## The answer for v1: none
- No cron job, queue, or scheduler exists in this project.
- No reminder, notification, or follow up runs automatically.
- No job runner package (queue library, cron library, task scheduler) is added in v1.
Reason: the PRD explicitly excludes agents, automated messages, and follow ups from v1. This file exists so an agent does not add a scheduler "to be helpful," since a helpful-looking addition here is directly out of scope.

## What silently looks like a job but is not
- The webhook handler in `payments.md` is not a job. It runs in response to a real request from Flutterwave, not on a timer.
- The confidence threshold tuning in `threshold.md` is a manual, one-time exercise before launch, not a recurring job.

## What v2 will likely need
Reminders before membership expiry and follow ups on flagged answers are named in the PRD as v2 candidates. `metrics.md` already states what gets logged now to support that later decision. This file does not repeat that list.

## Rule
If a future task seems to require a background job, stop and ask before adding one. This file must be updated with the job's purpose, trigger, and failure handling before any job scheduler is introduced.