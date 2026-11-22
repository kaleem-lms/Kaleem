---
spec: docs/superpowers/specs/2026-10-25-asm-e2e-fixtures-design.md
status: built
---

# Plan: asm-e2e-fixtures

Two code repos on branch `feat/asm-e2e-fixtures`, each in its own worktree (runbook
section 1): `backend-asm-e2e-fixtures` and `dashboard-asm-e2e-fixtures`, both from
`origin/main`. Meta holds only this plan and the spec. No migration, no dependency change,
no `ci.yml` edit, no floor edit.

Base read for this plan: backend `origin/main` 60de1b7 (assessment app, session outcomes
and the seed manifest are all on it), dashboard `origin/main` a776875.

## Steps

### Backend

1. [x] **Accounts (identity).** Test first in `kaleem/identity/tests/test_seed_e2e.py`:
   - `test_seeds_the_assessment_accounts_with_their_profiles`: four emails, profiles
     Teacher / Student / Parent / Parent.
   - `test_the_assessment_accounts_are_verified_and_can_authenticate`.
   - `test_the_assessment_parent_has_only_the_assessment_student_after_a_reseed`: add a
     stray link to `e2e.student`, reseed, exactly one link remains.
   - `test_the_unrelated_parent_has_no_children_after_a_reseed`: add a stray link to
     `asmStudent`, reseed, none remain.
   - Change `test_reports_how_many_accounts_it_seeded` to 21.

   Then `kaleem/identity/management/commands/seed_e2e.py`: four constants
   (`ASM_TEACHER_EMAIL`, `ASM_STUDENT_EMAIL`, `ASM_PARENT_EMAIL`, `ASM_OTHER_PARENT_EMAIL`)
   with a comment saying which spec owns them; four `_account` calls; `_link_guardian(asm_parent,
   asm_student)`; `ParentStudent.objects.filter(parent=other_parent.parent_profile).delete()`;
   the count line. Mutation-check M6 (spec).

2. [x] **Lessons (scheduling).** Tests first in new
   `kaleem/scheduling/tests/test_seed_e2e_assessment_lessons.py`, seeding with
   `seed_e2e`, `seed_e2e_matching`, `seed_e2e_family_booking` then the new command (the
   manifest's order, so the shared-database interactions are real):
   - `test_it_refuses_to_run_outside_debug`.
   - `test_it_assigns_the_student_quran_with_the_assessment_teacher_and_leaves_no_open_request`.
   - `test_it_leaves_four_lessons_in_the_declared_states`: ordered by start, statuses and
     outcomes `completed/held`, `completed/held`, `completed/student_absent`,
     `scheduled/None`; starts at −3 d, −2 d, −1 d, −3 h from the run, to the minute (pin
     `timezone.now` around the call with `unittest.mock.patch` on the command module, as
     the project has no time library).
   - `test_every_lesson_has_ended_inside_the_close_out_window`
     (`close_out_window(...) == "open"`, `starts_at + 60 min <= now`).
   - `test_only_the_to_close_lesson_is_owed_an_outcome` (`sessions_to_close`).
   - `test_the_assessment_teacher_is_offered_nobody` (`matching.list_offers_for`).
   - `test_it_leaves_the_booked_students_lessons_alone`: (id, starts_at, status) of
     `e2e.booked`'s lessons equal before and after.
   - `test_a_reseed_reopens_a_lesson_a_spec_closed`: `complete_session` on `toClose`,
     reseed, it is `scheduled` with no outcome.

   Then new `kaleem/scheduling/management/commands/seed_e2e_assessment_lessons.py`,
   modelled on `seed_e2e_family_booking.py`: DEBUG guard; one `transaction.atomic`;
   subjects, gender, availability (weekday 5 = Thursday, 15:00–18:00 UTC), dev
   subscription; scoped `MatchDecline` delete and `_reset_student_state(asm_student)`;
   `sync_match_requests`; `accept_offer`; `claim_slot(... weekday=5, start_time=15:00)`;
   `generate_sessions(student_id=...)`; assert four lessons came back (raise
   `CommandError` otherwise, so a quota change fails loudly); reposition them to the
   offsets; `complete_session` x2 and `mark_student_absent` with the seed's `now`.
   Mutation-check M1, M3, M4.

3. [x] **Report (assessment).** Tests first in new
   `kaleem/assessment/tests/test_seed_e2e_assessment.py` (full manifest order, plus the
   lessons command):
   - `test_it_refuses_to_run_outside_debug`.
   - `test_the_earliest_held_lesson_has_the_fixture_report` (content equals the declared
     dict, author is `asmTeacher`).
   - `test_no_other_lesson_has_a_report_and_nobody_has_rated`.
   - `test_reports_due_is_exactly_the_unreported_held_lesson`.
   - `test_the_report_audience` (teacher, student, `asmParent` admitted;
     `asmOtherParent` refused).
   - `test_a_reseed_removes_what_a_spec_left` (a report on `heldUnreported`, a rating on
     `heldReported`, then rerun the command alone).
   - `test_the_fixture_texts_are_the_published_ones`: pins the three strings the TS module
     exports.

   Then new `kaleem/assessment/management/commands/seed_e2e_assessment.py`: DEBUG guard;
   look the teacher up through `identity.services.get_user_by_email`; lessons through
   `scheduling.services.sessions_between(teacher, now - CLOSE_OUT_WINDOW, now + 1 s,
   role="teacher")`; delete `SessionReport` and `Rating` rows on those ids; `save_report`
   on the earliest `outcome == "held"` one; `CommandError` if there is none (the lessons
   seed did not run). Needs `kaleem/assessment/management/__init__.py` and
   `commands/__init__.py`. Mutation-check M2.

4. [x] **Manifest.** Append `seed_e2e_assessment_lessons` then `seed_e2e_assessment` to
   `config/e2e_seeds.txt`; extend `test_shipped_manifest_is_todays_ci_order` first.

5. [x] **Backend gate.** `backend-gate.sh <wt>` full (migrate, `makemigrations --check`,
   pytest with coverage, ruff, ruff format, lint-imports, mypy). Expect no migration and
   all contracts kept. Commit with explicit paths, e.g.
   `test(seeds): assessment fixture accounts and lesson states` /
   `feat(seeds): ...`.

### Dashboard

6. [x] **Accounts module.** New `e2e/accounts/assessment.ts` (`ASSESSMENT_ACCOUNTS`,
   `ASSESSMENT_REPORT`, a header naming the three backend commands as the contract and the
   ownership table from the spec); import and spread in `e2e/fixtures.ts`.

7. [x] **Sign-in flow.** New `e2e/assessment-fixtures.spec.ts`: for each key of
   `ASSESSMENT_ACCOUNTS`, a fresh context runs `login(page, key)` (which asserts it landed
   on Home). Mutation-check M5 locally if an e2e slot is free; otherwise CI is the proof
   and the reviewer repeats it.

8. [x] **Dashboard gate.** `dashboard-gate.sh <wt>` full (tsc, lint, coverage, build).
   Nothing in `src/` changes, so coverage must be unchanged.

### Hand-back

9. [ ] Merge `origin/main` into each branch (never rebase), re-run both full gates, then
   the runbook section 3 checks (contained, clean tree, `gitleaks-range.sh`, no floor
   touched) and the hand-back block, listing M1–M6 with their red lines.

## e2e (D3)

One flow, about 8 s: the four accounts sign in. What it does not cover, stated for the D3
row at close-out: the lesson and report states are proven by backend tests only; no
screen reads them until asm-teacher-report-ui and asm-report-views.

## Risks

- **`seed_e2e` and the manifest are shared files.** Other units may add accounts (the
  count line) or manifest lines at the same time. Conflicts are resolved at the freshness
  merge: keep both, recount, manifest in dependency order.
- **Quota.** The four lessons spend the whole dev cycle. If `grant_dev_subscription`'s
  defaults change, `generate_sessions` returns fewer and the command raises rather than
  seeding a partial state.
- **Global reconciler.** If a later seed or flow gives another entitled student a Thursday
  afternoon window, it could be offered to `asmTeacher`. The no-offer test catches it in
  the seed tests; the manifest's rule 2 comment already warns.
- **Clock.** Offsets are relative to seeding; a local database seeded more than four days
  ago has `heldReported` past its window. CI seeds every run; locally, reseed (as for every
  other seed).
- **Retries.** CI retries a failed flow once against the same database. Consumers that
  write to their lesson must tolerate finding their own earlier write; noted in the TS
  header, not solved here.

## Verification

Each step's tests go red first, then green; each mutation check goes red with its change
and green when reverted. The whole: both full gates green, the manifest test green, CI's
e2e job lists `assessment-fixtures.spec.ts` as passed, and `seed_e2e_all` in CI's log
names the two new commands.
