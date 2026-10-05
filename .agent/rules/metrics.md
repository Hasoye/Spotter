---
trigger: model_decision
description: description: "Rules for what gets logged to QueryLog, AttendanceRecord, Transaction, and FlaggedAnswer"
---

# Metrics

## Job of this file
Define what each success metric measures and what must be logged to support it. Targets are provisional where the PRD marks them provisional. This file does not invent final numbers.

## 1. Desk question volume
What it measures: how often the five recurring desk questions (class time, guest policy, card failure, attendance count, balance owed) are asked at the front desk, before and after launch.
Target: not set. Requires a two-week baseline measured before launch, per the PRD. Do not build against a guessed number.

## 2. Check-in adoption
What it measures: percentage of active members who check in via `source = QR` at least once in a 30-day window. Manual staff check-ins do not count toward this metric.
Provisional target: above 80 percent. Revisit after 30 days of real data.

## 3. Payment confirmation latency
What it measures: percentage of `GATEWAY` transactions that reach `CONFIRMED` within the 10-minute webhook window defined in `docs/PAYMENTS.md`.
Target: above 95 percent.
Reason: a transaction that misses this window signals a real technical problem with the webhook path, not normal variance, and needs staff attention promptly.

## 4. Flagged answer rate
What it measures: number of "this doesn't look right" flags per 100 answered questions, from `FlaggedAnswer`.
Provisional target: below 2 per 100. Revisit after 30 days.

## 5. Staff correction volume
What it measures: number of `STAFF_MANUAL` check-ins plus `MANUAL_STAFF` transactions per week. Tracked as a signal of how often automated paths are actually bypassed.
Target: none set. Tracked as a trend, not a pass or fail number.

## Logging requirement
Every metric above depends on `QueryLog`, `AttendanceRecord.source`, `Transaction.source`, and `FlaggedAnswer` being written correctly on every relevant action. Missing logging here means the metric cannot be measured at all.