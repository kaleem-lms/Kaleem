---
spec: docs/superpowers/specs/2026-10-25-asm-report-api-design.md
status: draft
---

# Plan: asm-report-api

This unit changes two repos, both on branch `feat/asm-report-api`:
- `backend`, for the code;
- meta, for `docs/architecture/assessment.md`.

Worktrees:
- Backend: `/home/abdulkhalek/Projects/kaleem-worktrees/backend-asm-report-api`, created
  from backend `origin/main` as conductor-runbook section 1 says. Its base must contain
  asm-module-foundation and ana-session-outcomes. Both are on main at 6b596c8.
- Meta: `/home/abdulkhalek/Projects/kaleem-worktrees/meta-asm-report-api`.

Constraints:
- **No migration, no dependency change, no new ADR.**
- **Floors:** never edit `fail_under` (dec-floor-ownership).
- **Start condition:** the spec's open question 1 (`asm-d-report-mandatory`) is answered
  and the owner approves the spec. If the answer is option 3, drop step 4 and its tests.

## Steps

Each step follows the same loop:
1. Write the named tests.
2. Run them red with `backend-gate.sh <wt> <file>`.
3. Write the code.
4. Run them green.

Files are under `kaleem/assessment/`.

1. [ ] **Fixture.** In `tests/conftest.py`, add an `outcome` argument to `make_session`.
   It defaults to `"held"` when `status` is completed and to `None` otherwise. The
   existing suite must stay green unchanged. This step has no new test; that green run
   is the proof.

2. [ ] **The write rule.** In `tests/test_services_write.py`:
   - Replace `test_a_lesson_still_running_may_be_reported` with
     `test_a_lesson_not_yet_closed_out_cannot_be_reported`.
   - Add these tests:
     - `test_only_a_held_lesson_can_be_reported` (parametrized over `student_absent`,
       `teacher_absent` and `None`);
     - `test_the_window_opens_at_the_start_and_closes_seven_days_later` (the start,
       start plus 7 days minus 1 second, and start plus 7 days);
     - `test_an_edit_after_the_window_is_refused_and_changes_nothing`;
     - `test_the_window_is_refused_before_the_missing_outcome` (a stale `scheduled`
       lesson gets the "passed" message).
   - Code:
     - add `now=None` to `save_report`;
     - add a `_require_reportable(info, now)` helper that uses
       `scheduling_services.close_out_window` and the `_HELD = "held"` string constant
       (the `_CANCELLED` precedent);
     - write new `gettext` sentences.
   - Mutation checks: revert the outcome check and the window check in turn, and each test
     must go red.

3. [ ] **Read view and flags.** In `tests/test_report_view.py`, add these tests:
   - `test_teacher_may_write_then_may_edit`;
   - `test_flags_are_false_after_the_window_and_for_a_lesson_not_held`;
   - `test_student_parent_and_staff_read_with_flags_false` (with and without a report);
   - `test_current_same_subject_teacher_reads_a_recent_report_only` (at 90 days, at
     91 days, and with no report);
   - `test_stranger_and_former_teacher_are_refused`;
   - `test_unknown_lesson_is_not_found`.

   Code: a frozen `ReportView` DTO and `report_view(viewer, session_id, *, now)`. It reuses
   `can_read_report` and `_sees_every_report_of`, and raises `PermissionDeniedError` or
   `NotFoundError`.

4. [ ] **Reports due.** In `tests/test_reports_due.py`, add these tests:
   - `test_lists_held_unreported_lessons_in_the_window_oldest_first`;
   - `test_excludes_reported_absent_scheduled_cancelled_and_expired` (parametrized);
   - `test_excludes_other_teachers_and_own_childs_lessons`;
   - `test_query_count_is_constant` (`django_assert_num_queries` with 1 row and with
     5 rows).

   Code: a frozen `ReportDue` DTO and `reports_due(teacher, *, now)`. It reads
   `sessions_between(teacher, now - CLOSE_OUT_WINDOW, now + 1s, role="teacher")`, keeps
   lessons with `outcome == "held"` and an open window, and drops those in
   `reported_session_ids`.

5. [ ] **HTTP.** Add `api/serializers.py`, `api/views.py` and the routes
   `session-report` and `reports-due` in `api/urls.py`. In `tests/test_api.py`, using the
   `APIClient.force_authenticate` pattern from `scheduling/tests/test_booking_api.py`:
   - GET shape for each reader;
   - PUT creates and then replaces;
   - PUT error cases:
     - invalid content gets 400 with `error_code: validation_error` and the field;
     - a student gets 403 `permission_denied`;
     - after the window gets 409 `conflict`;
     - an unknown lesson gets 404 `not_found`;
     - anonymous is refused;
   - `reports-due` gets 403 without a teacher profile and 200 with a list;
   - with `Accept-Language: ar`, a 409 message and `subject_name` (Quran) are Arabic;
   - a CSRF-enforcing client (`APIClient(enforce_csrf_checks=True)` with a logged-in
     session) is refused on a PUT without a token.

   `subject_name` goes through `pgettext("subject name", ...)` in the serializer. The PUT
   passes `request.data` straight to `save_report`, because Pydantic is the validator.
   `content` is a `JSONField` in the output serializer.

6. [ ] **Catalog.** Add the new msgids to `locale/ar/LC_MESSAGES/django.po` (draft Arabic,
   marked for `hg-arabic-review` in the PR body). The completeness test must pass
   (`msgfmt --check`, re-extraction).

7. [ ] **Docs (meta).** In `docs/architecture/assessment.md`:
   - drop "no HTTP route yet";
   - add a Routes section (the three routes, the flags, the refusal order);
   - replace the "added by asm-report-api" sentence with the rule as built.

## Gates

- Run `backend-gate.sh <wt> kaleem/assessment` during the loop.
- Before hand-back, run the full `backend-gate.sh <wt>`. It covers migrate,
  `makemigrations --check`, pytest with coverage, ruff, format, `lint-imports` and mypy.
- Then run `gitleaks-range.sh <wt> origin/main..HEAD`, and the floor grep and freshness
  merge from runbook section 3. Merge `origin/main` into the branch; never rebase.
- The mutation checks to report are those in steps 2 and 4. For step 4, re-adding a
  reported lesson to the list must turn the exclusion test red.

**e2e:** none in this unit. The programme assigns the contract flow to
asm-teacher-report-ui, which adds the D3 row. The time budget is therefore 0.

## Risks

- **The fixture default changes what `lesson` means** for the existing assessment tests.
  Step 1 lands alone and green so that any surprise is isolated.
- **The subject-name lookup is repeated outside curriculum.** If curriculum renames the
  `subject name` context, the Arabic `subject_name` test in step 5 goes red. That is
  intended. Moving the lookup into `scheduling.services` would be scope growth; the
  repetition is listed in `ISSUES.md` instead.
- **`sessions_between` overlaps on end time.** A lesson that started just before
  `now - 7d` can overlap the range, so `reports_due` filters on `close_out_window`, not on
  the overlap. The exact-boundary test pins this.
- **Shared files.** asm-ratings edits `services.py` and `api/`. The conductor serializes
  the two merges (`shared_files`). On a conflict, merge and never rebase.
- **The owner's answer to `asm-d-report-mandatory`.** If it is option 3, step 4 and its
  route are dropped. If it is option 1, nothing changes here.

## Verification

- Each step is proven by its named tests going red and then green.
- The whole unit is proven by the full backend gate (rc 0) and a clean gitleaks range.
- The reviewer repeats the mutation checks.
- Staging verification belongs to asm-teacher-report-ui, the first unit with a screen.
