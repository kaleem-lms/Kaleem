---
name: pay-earnings-ledger
phase: v1 (wave 3, billing stream)
modules: [billing, scheduling]
status: draft
created: 2026-10-26
closed: null
---

## Goal

Record what kaleem owes each teacher, lesson by lesson. The product spec says kaleem pays
teachers monthly, "sessions delivered × rate per session" (Teacher pay; Flow 8), with rates set
by kaleem and never by the teacher (BR-07) and no pay for a teacher no-show (BR-05, BR-13).
Nothing records pay today: there is no rate anywhere, and a closed-out lesson leaves no money
trace.

This unit adds two billing tables. `TeacherRate` holds a teacher's rate per lesson, effective
from an instant. `TeacherEarning` is an append-only ledger with one line per lesson that earns,
written **in the same transaction** as the fact that earns it. Payout runs, the teacher's
earnings page and the statement build on it later (`pay-payout-runs`, `pay-earnings-dashboard`,
`pay-statement-pdf`).

It implements `dec-lesson-outcomes` (answered: pay excludes `teacher_absent`) and
`dec-retention-new-domains` (earnings: the statutory period). **`dec-pay-rate-currency` is still
open.** This spec is written on its recommended option (a per-teacher rate over time, in one
currency); see Open questions. No real rate, currency choice or amount appears in this spec,
the plan, the code or the tests (fake amounts only).

Read for this spec: backend `origin/main` ef9984e (`sched-reschedule` merged, #97), and the
`eng-event-bus-publish` branch (7aae610), which is still landing.

## User flow

No user-facing surface ships here. What changes is what a close-out or a cancellation leaves
behind.

1. **A teacher closes a lesson out** as `held` or `student_absent` (`complete_session`,
   `mark_student_absent`). In the same transaction, one earning line is written for that lesson
   at the teacher's rate in effect when the lesson **started**.
2. **A family cancels late.** The student or a parent cancels less than 24 hours before the
   start, so the unit is spent (`consumes_quota=True`). One earning line is written with basis
   `late_cancellation`. This includes ending the weekly time inside 24 hours of a lesson,
   because `end_slot` cancels through the same `_apply_cancellation`.
3. **Nothing is earned** for a teacher's cancellation, a cancellation 24 hours or more ahead,
   or `teacher_absent`. A rebooked lesson (`rescheduled_from` set) is an ordinary session. It
   earns once, when it is closed out. Its source was refunded, so the source earned nothing.
4. **No rate in effect.** The line is still written, but **unpriced**: rate, amount and
   currency are all null. A `billing.earning_unpriced` warning is logged. The close-out is
   never refused for a missing rate, because the teacher did their part. Pricing an unpriced
   line is `pay-payout-runs`' job. A payout must not be approved while a line in its period is
   unpriced.
5. **Setting a rate.** The owner or conductor runs `manage.py set_teacher_rate --teacher <id>
   --amount-minor <n> --currency <iso> --effective-from <ISO-8601>` on the server. It refuses
   a non-teacher (shown as not found), an amount below 1, a currency that is not three
   lowercase letters, a currency that differs from the existing rates, and a second rate for
   the same teacher at the same instant. Rates are append-only too: a correction is a new rate
   from a later instant. ADR-0057 rules out Django admin for this, and the staff screen
   belongs to `pay-payout-runs` (Open question 6).

Errors: a failure while writing the earning line rolls back the whole close-out or
cancellation. The teacher sees the request fail and can retry. The lesson is never left closed
with no line.

## Data model delta

Migration `billing/0008` (the number is allocated by the conductor) is additive: two new tables,
no change to an existing one. That makes it safe in the blue-green window, because the old
release neither reads nor writes these tables. There is no backfill: the ledger starts with this
deploy, and production is not live yet (`launch-go-no-go`), so no real lesson predates it.

```
User 1──* TeacherRate                       User 1──* TeacherEarning *──0..1 TeacherRate
  teacher       FK User, PROTECT              teacher        FK User, PROTECT
  amount_minor  PositiveInteger (>= 1)        session_id     PositiveBigInteger, UNIQUE (no FK)
  currency      char(3), lowercase ISO-4217   basis          held | student_absent | late_cancellation
  effective_from datetime (UTC instant)       lesson_starts_at datetime
  created_at                                  recorded_at    datetime (the close-out / cancel instant)
  UNIQUE (teacher, effective_from)            rate           FK TeacherRate, PROTECT, null
                                              amount_minor   PositiveInteger, null
                                              currency       char(3), null
                                              created_at
                                              CHECK rate, amount_minor, currency all null or all set
```

- **`session_id` is a plain integer, not a FK.** billing may not import scheduling (import
  contract), and the ledger must outlive the session row: the e2e and staging seeds delete
  sessions. Postgres never reuses a session id, so the unique key stays sound.
- **Amount and currency are copied onto the line.** A later rate never rewrites history.
- **`PROTECT` on `teacher`** keeps a financial record from vanishing with a hard user delete.
  Erasure is anonymize-in-place (`lb-dec-erasure-semantics`), so no production path
  hard-deletes a teacher.
- **No row ever names the student.** The line holds the lesson's id and nothing else about it.

**Personal data (ADR-0023).**

- *What:* a teacher's rate history and per-lesson earnings. This is financial personal data
  about the teacher.
- *Why:* to pay them (BR-07, Flow 8).
- *How long:* the statutory accounting period (`dec-retention-new-domains`). An accountant
  confirms the figure, and `lb-gdpr-retention-jobs` purges on it.
- *Who sees it:* the teacher, through their export now and their earnings page later, and
  staff in payout runs later. Students and parents never see it.

The registry entry is `billing.earnings`, covering both models:

- **Export:** the teacher's own rates and lines.
- **Erase:** a deliberate no-op. The rows carry no name, email or free text, the user row is
  anonymized by identity, and the rows are kept for the statutory period. Refusing erasure
  while a line is unpaid needs a "paid" state, so `pay-payout-runs` adds that refusal.

## API delta

No HTTP endpoint. Public service names in `kaleem.billing.services`, implemented in a new
`kaleem/billing/earnings.py`:

- `record_lesson_earning(*, teacher_id, session_id, lesson_starts_at, basis, recorded_at) ->
  None`. `basis` is a lesson outcome or `late_cancellation`. `held`, `student_absent` and
  `late_cancellation` write a line. `teacher_absent` writes nothing. Anything else raises
  `ValueError`, which is a programming error. **Billing owns the pay rule**: scheduling passes
  facts, and billing decides what they earn. A second line for the same session raises
  `IntegrityError`, which rolls the caller back.
- `set_teacher_rate(teacher, *, amount_minor, currency, effective_from) -> TeacherRate`. It
  raises `ValidationError` (`error_code` `validation_error`, with `field`). Messages go through
  gettext and have Arabic catalogue entries.

## Frontend

None. The teacher's earnings page is `pay-earnings-dashboard`. The close-out controls
(`pay-lesson-completion`) do not change.

## Module boundaries

**billing owns the ledger.** scheduling calls `billing.services` from two places, and both are
already allowed by the ADR-0033 contract, so no import contract changes:

- `booking._close_out` **step 6**, the slot that `ana-session-outcomes` reserved for this
  unit. It runs after the outcome is written and before rooms end (step 7) and the bus publish
  (step 8).
- `booking._apply_cancellation`, after the row is saved and only when `consumes_quota` is
  true.

**Why a synchronous call and not the event bus (ADR, number from the conductor).** The bus
(ADR-0063) writes its outbox row in the producer's transaction, but delivers after commit, and
a failure is retried by a sweep every 10 minutes. A ledger fed from it would have three costs:

- Lag: a lesson would be closed with no line until delivery.
- Hidden failures: a handler failure for money would be retried or dead-lettered where nobody
  sees it.
- Ordering: `sched-teacher-no-show`'s reversal would be ordered against an asynchronous write.

A call inside the transaction makes the outcome and its money one fact. It either commits or
the teacher sees the failure. **billing reading sessions directly is not possible:** billing may
not import scheduling. A nightly pull would also add lag and a reconciler. The programme plan
already recorded this choice ("Earnings are money and must be written in the same transaction
as the outcome"). This unit does not consume `session_completed` or `session_cancelled`.

## Out of scope

- Payout runs, adjustments, pricing unpriced lines, the "paid" state, and the erase refusal
  for unpaid lines: `pay-payout-runs`.
- A teacher's earnings page or API (`pay-earnings-dashboard`), and the statement PDF
  (`pay-statement-pdf`).
- The `teacher_absent` reversal line, and the conditional unique key it needs:
  `sched-teacher-no-show`. Corrections are always new lines, never updates or deletes.
- A staff screen for rates, and the purge job (`lb-gdpr-retention-jobs`).
- Trial-lesson pay: trials are dropped (`D-trl-exists`).

## Test plan

**Earning rules** (`billing/tests/test_earnings.py`):

- Each basis that earns writes exactly one line.
- `teacher_absent` writes none. An unknown basis raises.
- **Rate selection:**
  - a rate effective exactly at `lesson_starts_at` applies;
  - a rate effective one second after does not;
  - with two earlier rates, the later one wins;
  - another teacher's rate is never used.
- **Unpriced lines:** with no rate, the line has all three money fields null and the warning
  is logged.
- **Duplicates:** a second line for the same session raises, and the database `CHECK` and
  `UNIQUE` constraints hold without the service.

**Rates** (`billing/tests/test_teacher_rate.py`):

- Each refusal reports its field.
- A currency mismatch against existing rates is refused.
- Same teacher, same instant is refused.
- The management command prints the created row and maps each refusal to a non-zero exit.

**Close-out matrix** (`scheduling/tests/test_close_out_matrix.py`, extended, never a second
matrix): a new `earning` column holds `(basis, amount_minor)` or `None`. It shows:

- `held` and `student_absent` for an accepted close-out;
- `late_cancellation` only for a student or parent cancelling inside 24 hours;
- `None` for every refusal, every teacher cancellation and every cancellation 24 hours or
  more ahead.

**Rollback:** if `record_lesson_earning` raises inside `_close_out`, the outcome, the status and
the room are all unchanged. This test is mutation-checked: with the call moved outside the
atomic block, it goes red.

**Personal data** (`billing/tests/test_personal_data.py`):

- The registry contract helpers pass for `billing.earnings`.
- The export is exactly the user's own rows.
- Erasure keeps the rows and is idempotent.

## Open questions

These are for the owner (the spec touches money, `dec-spec-approval`). A recommended answer is
given for each, and the build follows the answers.

1. **`dec-pay-rate-currency`:** how is a rate shaped, and in what currency is a teacher paid?
   *Recommended:* one rate per teacher that changes over time (effective-from), all in one
   currency (option 1). The currency and figures go on the server, never in this repo.
2. **What is the rate a rate for?** *Recommended:* a fixed amount per lesson, since every
   lesson is 60 minutes (BR-01), not an hourly rate.
3. **Which rate applies?** *Recommended:* the rate in effect when the lesson starts, not when
   it is closed out. Which month's payout a line falls in is `dec-pay-schedule`, decided in
   `pay-payout-runs`. The ledger stores both instants.
4. **What earns, and how much?** *Recommended:*
   - `held`: the full rate.
   - `student_absent`: the full rate.
   - A late family cancellation (under 24 hours, unit spent): the full rate.
   - A teacher's cancellation, a cancellation 24 hours or more ahead, and `teacher_absent`:
     nothing.

   This follows the recommended text of `dec-lesson-outcomes`, which the owner accepted. Its
   public record states only the `teacher_absent` exclusion, so please confirm the full rate
   for the absent and late-cancellation cases, or name a fraction.
5. **No rate is set when a lesson earns.** *Recommended:* write an unpriced line and log a
   warning, and do not refuse the close-out. `pay-payout-runs` blocks approval until the line
   is priced. *Alternative:* refuse the close-out (409) until staff set a rate.
6. **Who enters rates before a staff screen exists?** *Recommended:* the owner or conductor,
   through the `set_teacher_rate` management command, with the screen added in
   `pay-payout-runs`. *Alternative:* add a staff API now (new endpoint and scope).
7. **Retention figure.** "Statutory period" is decided. The number of years waits for the
   accountant. Nothing in this unit purges data, so this does not block the build.
