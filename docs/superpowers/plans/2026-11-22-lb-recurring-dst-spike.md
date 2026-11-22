---
spec: docs/superpowers/specs/2026-11-22-lb-recurring-dst-spike-design.md
status: draft
---

# Plan: lb-recurring-dst-spike

Size S, under a day. This is a spike. Its output is one backend test file, one corrected
comment and a written recommendation. No production code changes.

- Backend worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/backend-lb-recurring-dst-spike`
  on `feat/lb-recurring-dst-spike`, created per runbook §1 from `origin/main` (e543505 at
  writing). In the steps below, `WT` is that path and `R` is `/home/abdulkhalek/Projects/kaleem-worktrees`.
- Meta worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/meta-lb-recurring-dst-spike`.
- No migration, dependency, env var, ship.sh change, ADR, route or locale string. No floor
  edit (dec-floor-ownership). `models.py` is listed as a shared file, but this unit does not
  touch it.
- Nothing security-sensitive is expected, so there is no private file.

## Files

| File | Change |
| --- | --- |
| `backend/kaleem/scheduling/tests/test_dst_characterization.py` | new |
| `backend/kaleem/scheduling/tests/test_to_utc.py` | the line 23 comment only |
| this spec | Findings and recommendation, status `shipped` |
| `docs/architecture/scheduling.md` | "Two clocks": one sentence on `fold=0`, one on claims being checked against the current week |
| `ISSUES.md` | Dashboard: the `ClaimSlotCard.formatSlot` winter-offset label, for `lb-recurring-dst-anchoring` |

## Steps

Each test is written first and run alone with
`"${R}/_tools/backend-gate.sh" "${WT}" kaleem/scheduling/tests/test_dst_characterization.py`.
These are characterization tests, so they are expected to pass on today's code. In TDD terms,
"red first" means the **mutation check** listed with each step: break the code under test by
hand, watch the test fail, then revert the break with `git -C "${WT}" checkout -- <file>`.
Record the failing line for the hand-back. A test that stays green under its mutation does
not count as evidence.

Shared setup in the file:

- Pin the clock with `mock.patch.object(timezone, "now", return_value=NOW)`, where `NOW` is
  2026-10-20 10:00Z. This follows `test_options_follow_a_clock_change_in_one_partys_zone`
  (`get_quota` and `claim_slot` both read `timezone.now()`).
- Reuse conftest's `entitled` (four sessions per cycle) and `_slot`. Set
  `current_period_end` to 2026-11-16 00:00Z.
- Pair builders take a teacher zone and a student zone. Each person's availability is one
  hour on Saturday, starting at their 24 Oct local lesson time (a P1 teacher in London has
  18:00–19:00, for example). Each person gets their own `TeacherProfile` or
  `StudentProfile`, an assignment and an active `RecurringSlot` at the stored UTC time
  (P1/P2 17:00, P3 15:00). Every name, docstring and comment says "today's behaviour",
  never "correct".
- File docstring: this file pins UTC anchoring as it stands on purpose, so
  `lb-recurring-dst-anchoring` changes these assertions deliberately.

1. [ ] **tz database guard.** `test_the_tz_database_has_the_switches_these_tests_assume`
   checks, using `ZoneInfo`, that the UTC offset changes at London 2026-10-25 01:00Z,
   Cairo 2026-10-29 21:00Z, New York 2026-11-01 06:00Z and Cairo 2026-04-23 22:00Z. It
   compares the offset one minute before and at each instant.
   *Mutation:* move one instant by an hour in the test's own table. Red.
2. [ ] **UTC instant kept.**
   `test_generated_lessons_keep_their_utc_instant_across_every_switch`, parametrised over
   P1–P3: `generate_sessions(now=NOW)` writes exactly four sessions, on 24 Oct, 31 Oct,
   7 Nov and 14 Nov, each at the slot's UTC time.
   *Mutation:* in `booking._occurrences`, combine with `ZoneInfo("Europe/London")` in place
   of `dt.UTC`. Red.
3. [ ] **Local time moves at one's own switch.**
   `test_each_persons_local_lesson_time_moves_at_their_own_switch`, parametrised over the
   six people. Each session's `starts_at`, converted into that person's zone, matches the
   spec's prediction table:

   | Person | 24 Oct | 31 Oct | 7 and 14 Nov |
   | --- | --- | --- | --- |
   | P1 London teacher | 18:00 | 17:00 | 17:00 |
   | P1 New York student | 13:00 | 13:00 | 12:00 |
   | P2 Cairo teacher | 20:00 | 19:00 | 19:00 |
   | P2 London student | 18:00 | 17:00 | 17:00 |
   | P3 New York teacher | 11:00 | 11:00 | 10:00 |
   | P3 Cairo student | 18:00 | 17:00 | 17:00 |

   *Mutation:* the same as step 2. Red.
4. [ ] **Availability drifts away from the lesson.**
   `test_the_shared_window_leaves_the_booked_instant_after_a_switch` (P1).
   `matching.overlap_intervals` should return `[(17:00Z, 18:00Z)]` on 24 Oct, `[]` on
   31 Oct and `[(18:00Z, 19:00Z)]` on 7 Nov. The booked 17:00Z lesson is inside the window
   only on 24 Oct.
   *Mutation:* in `services._to_utc`, use `tz = dt.UTC`. Red.
5. [ ] **A fresh claim follows the switch, the slot does not.** These run on a fresh pair
   shaped like P1 (a different London teacher and New York student, with no slot yet). A
   second assignment under P1's own teacher would not work: that teacher's booked 17:00
   would hide the option. `reference_date` is 2026-11-07 unless stated otherwise.
   - `test_a_fresh_claim_at_the_pre_switch_time_is_refused_after_it`: `claim_slot` at
     weekday 0, 17:00 raises `ValidationError` with `code == "validation_error"` and
     `field == "start_time"`.
   - `test_a_fresh_claim_an_hour_later_succeeds_after_it`: at 18:00 the claim returns a
     slot.
   - `test_slot_options_move_with_the_switch`: start times are `[17:00]` for reference
     2026-10-24 and `[18:00]` for 2026-11-07.

   *Mutation:* the same as step 4. Red.
6. [ ] **Cairo's skipped and repeated hours** (`services.to_utc_intervals`).
   - `test_cairo_availability_in_the_skipped_hour_starts_at_the_first_real_instant`:
     Friday (weekday 6) 00:00–02:00, reference 2026-04-18. Expect
     `[(2026-04-23 22:00Z, 23:00Z)]`.
   - `test_cairo_availability_ending_in_the_repeated_hour_ends_at_its_first_occurrence`:
     Thursday (weekday 5) 22:00–23:30, reference 2026-10-24. Expect
     `[(2026-10-29 19:00Z, 20:30Z)]`.

   *Mutation:* in `_to_utc`, add `.replace(fold=1)` to both `combine` results. Both tests
   go red.
7. [ ] **Comment fix.** `test_to_utc.py:23` becomes
   `# Cairo is UTC+3 in June (EEST): Egypt observes DST, back to UTC+2 from 29 Oct 2026`.
   No assertion changes.
8. [ ] **Optional staging read (conductor, read-only).** This is the only way to show what
   happened to the planned staging seed (`base-06`). The read script writes nothing and
   rolls back. It prints no credentials, but it does name fixture accounts, so its output
   stays in `_ops/dst-seed/` and is never committed:

   ```sh
   ssh kaleem 'c=kaleem-django-$(cat /opt/kaleem/.active-color)-1; date -u; docker inspect --format "image {{.Config.Image}}" $c; docker exec -i $c python manage.py shell -v 0 -c "import sys; exec(sys.stdin.read())"' < /home/abdulkhalek/Projects/kaleem-worktrees/_ops/dst-seed/read_dst_spike.py > "/home/abdulkhalek/Projects/kaleem-worktrees/_ops/dst-seed/dst-read-$(date -u +%Y%m%dT%H%MZ).txt"
   ```

   - If it prints `MISSING pool accounts`, the seed was never applied, and the spec says so.
   - If the pairs are present, their stored instants are supporting evidence: they show
     that nothing on staging rewrote a lesson across the real switches. The teardown
     stays the owner's `base-06` step.
   - If the conductor skips this step, the spec says "not read".
9. [ ] **Full gate and hand-back.** Run `"${R}/_tools/backend-gate.sh" "${WT}"`. It runs
   migrate, the `makemigrations --check`, pytest with coverage, ruff, format,
   lint-imports and mypy; the new file must type-check. Commit with explicit paths:
   `test(scheduling): characterize recurring lessons across DST`. Then
   `git -C "${WT}" merge --no-edit origin/main` (a merge, never a rebase), re-run the
   full gate, and run the five checks in runbook §3, including `gitleaks-range.sh` and
   the floor grep.
10. [ ] **Write-up (meta).** Fill in the spec's "Findings and recommendation" from the test
    results and the step 8 outcome. Make the three doc edits from the Files table, and set
    spec `status: shipped` and plan `status: done`. Commit with
    `docs: lb-recurring-dst-spike findings and recommendation`. The journal and `STATE.md`
    entries are written at the conductor's close-out (runbook §6).

## e2e

None. There is no user-facing change, and the programme entry says "None.". The
frozen-clock e2e flow belongs to `lb-recurring-dst-anchoring`. D9's staging click-through
does not apply, because nothing visible changes.

## Risks

- **A future tzdata change**, for example Egypt changing its rules again. All dates are in
  2026, which tzdata now records as history. The step 1 guard fails first and names the
  zone.
- **Missing the clock pin.** `get_quota` reads `timezone.now()`, so an unpinned run would
  generate against the real date and produce nothing. Step 2's exact-count assertion
  catches that.
- **Characterization tests read as an endorsement.** The names and the file docstring say
  "today's behaviour", and the anchoring unit's spec must list each assertion it flips.
- **Scope creep.** A fix for the `ClaimSlotCard` label or for anchoring is out of scope:
  record it in `ISSUES.md` and stop (D10). If any prediction is refuted, record it as a
  finding. Change no production code.

## Verification

- Each of the nine tests was red under its stated mutation and green once the mutation was
  reverted. The failing lines are quoted in the hand-back.
- Full backend gate rc=0, with the TOTAL line quoted. gitleaks reports CLEAN. The floor is
  untouched.
- The spec's Findings section answers each point listed under "Findings and
  recommendation", and cites the test names as its evidence.
