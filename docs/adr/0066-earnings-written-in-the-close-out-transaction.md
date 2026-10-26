---
number: 0066
title: Lesson earnings are written in the close-out transaction through billing.services
status: proposed
date: 2026-10-26
---

## Context

kaleem pays teachers monthly, "sessions delivered x rate per session" (Flow 8), with rates
set by kaleem (BR-07) and nothing paid for a teacher no-show (BR-05, BR-13). Something has
to record, lesson by lesson, what is owed. The record must agree with the lesson's outcome
at all times: a lesson closed as `held` with no line is money silently missing, and a line
for a lesson that was never closed out is money paid for nothing.

Two things were available. The domain event bus (ADR-0063) already tells subscribers that a
lesson was completed or cancelled. And billing may call scheduling's public API, but may not
import it: ADR-0033 allows only the arrow `scheduling -> billing.services`.

## Decision

1. **Scheduling calls billing, inside the transaction.** `booking._close_out` (step 6, the
   slot `ana-session-outcomes` reserved) and `booking._apply_cancellation` (when the unit is
   spent) call `billing.services.record_lesson_earning`. The line is written in the same
   `atomic()` block as the outcome, so the two commit together or not at all. A failure
   rolls the whole close-out back and the teacher retries.
2. **Scheduling passes facts; billing decides the pay rule.** The call carries the teacher,
   the session id, the lesson's start, a basis (an outcome, or `late_cancellation`) and the
   instant. Billing decides which bases earn (`held`, `student_absent`,
   `late_cancellation`; `teacher_absent` earns nothing) and which rate applies (the one in
   effect when the lesson started).
3. **The ledger is two billing tables, append-only.** `TeacherRate` (effective-from, one
   currency) and `TeacherEarning` (one line per session, unique on `session_id`). The
   session id is a plain integer, not a foreign key: billing may not import scheduling, and
   a financial record must outlive the session row. Amount and currency are copied onto the
   line, so a later rate never rewrites history. A correction is a new line, never an
   update.
4. **A missing rate never refuses a close-out.** The line is written unpriced and a warning
   is logged; the payout run (`pay-payout-runs`) refuses to approve while one remains.
5. **No import-linter change.** The edge `scheduling -> billing.services` already exists.
6. **Expand only.** Migration `billing/0008` adds two tables and touches nothing existing,
   so the previous release, which neither reads nor writes them, runs unharmed through the
   blue-green window.

## Alternatives considered

- **Consume `session_completed` / `session_cancelled` from the event bus.** Delivery is
  after commit, retried by a sweep every 10 minutes. That gives a window in which a lesson
  is closed with no line, makes a failure for money a retried or logged event nobody is
  looking at, and orders a later reversal (`sched-teacher-no-show`) against an asynchronous
  write. The bus is right for subscribers that merely react; the ledger is part of the
  fact.
- **Billing reads scheduling and derives earnings nightly.** Forbidden by the import
  contract, and a pull adds lag plus a reconciler to detect what it missed.
- **A foreign key from the earning to the session.** Needs billing to import scheduling's
  models, and ties a financial record's life to a row that the seeds delete.
- **Refuse the close-out when no rate exists.** Punishes the teacher for a staff omission.
  The unpriced line keeps the fact and moves the check to the one place where money leaves.

## Consequences

- The close-out and cancellation sequence now holds a billing write, so a billing outage is
  a close-out failure. That is the intended trade: it is visible and retryable.
- The close-out matrix gains an `earning` column; the next unit that adds a step extends it.
- `sched-teacher-no-show` will need a reversal line for a lesson already paid as `held`,
  which the one-line-per-session unique key forbids. It must replace that key with a
  conditional one (for example, unique per session where the line is not a reversal). That
  is recorded in the billing architecture doc so the next author does not discover it late.
- Rows are kept for the statutory period (`dec-retention-new-domains`) and survive erasure.
  The registry entry `billing.earnings` exports a teacher's own rows and erases nothing.
