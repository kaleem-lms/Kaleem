---
spec: docs/superpowers/specs/2026-10-25-cur-lesson-assignment-design.md
status: draft
---

# Plan: cur-lesson-assignment

Blocked until dec-cur-parent-visibility is answered and the owner approves the spec. If the
answer is "nothing", drop dashboard step 4's parent half, the nav change and e2e flow 2.

Branch `feat/cur-lesson-assignment` in `backend-cur-lesson-assignment` and
`dashboard-cur-lesson-assignment` (runbook section 1, from `origin/main`), plus the meta
worktree. Bases: backend 3cf6e75 or later, dashboard a776875 or later (both contain
cur-course-structure and the teaching port).

One migration (`curriculum/0005_lessonassignment`). No dependency change, no floor edit
(dec-floor-ownership), no import-linter change. `kaleem/curriculum/services.py` is a shared
file: append a new section at the end, edit nothing above it.

## Steps

### Backend

1. [ ] **Red: model.** `kaleem/curriculum/tests/test_models.py`:
   `test_lesson_assignment_pair_is_unique` (`IntegrityError`) and
   `test_deleting_a_lesson_unit_or_course_removes_its_assignments` (parametrized).
2. [ ] **Green: model and migration.** `LessonAssignment` as the spec says. Generate with
   `makemigrations curriculum -n lessonassignment` through the gate compose file (runbook
   section 2). `test_migrations.py`: 0005 applies after 0004.
3. [ ] **Red: services.** New `kaleem/curriculum/tests/test_assignment_services.py`. Register
   a fake teaching provider per test via a fixture that saves and restores the port's
   provider:
   - `test_assign_creates_every_pair`, `test_assign_twice_is_idempotent`,
     `test_withdraw_removes_only_named_pairs`, `test_withdraw_absent_pair_is_a_no_op`.
   - `test_assign_to_untaught_student_is_not_found_and_writes_nothing`, and the withdraw twin.
   - `test_lesson_from_another_course_conflicts_and_writes_nothing` (assign and withdraw).
   - `test_another_teachers_course_is_not_found` (all three teacher services).
   - `test_roster_lists_only_current_students_and_their_pairs`.
   - `test_student_keeps_lessons_after_teacher_change`: end the link in the fake provider;
     `get_student_curriculum` still returns the lesson; list, assign and withdraw no longer
     see the student.
   - `test_student_curriculum_order_and_filter` (two courses, unassigned unit absent) and
     `test_student_curriculum_query_count` (`django_assert_num_queries`).
4. [ ] **Green: services.** Append `list_course_assignments`, `assign_lessons`,
   `withdraw_lessons` and `get_student_curriculum` to `services.py`. Writes: `_lock_course`,
   check lesson ids against the course (`ConflictError`), check student ids against
   `teaching.student_ids_taught_by` (`NotFoundError` "Student"), then `bulk_create(...,
   ignore_conflicts=True)` or one filtered delete. `get_student_curriculum`: one query with
   `select_related("lesson__unit__course__subject")`, grouped in Python. Messages through
   gettext.
5. [ ] **Red then green: API.** New `kaleem/curriculum/tests/test_assignment_api.py`: 403
   student-only on the three course routes; 404 bodies equal for a foreign and a missing
   course, and for an untaught and a missing student; 409 for a foreign lesson; 400 for
   empty lists, 101 lessons and 51 students; `test_writes_require_csrf`
   (`APIClient(enforce_csrf_checks=True)`); lessons view 200 for self and for a parent, 404
   for an unrelated user and an unknown id with equal bodies; exact keys of the roster and
   the lessons view. Then `AssignmentWriteSerializer` (shape only), views and routes in
   `api/urls.py`.
6. [ ] **Registry.** `test_personal_data.py`: contract test for
   `curriculum.lesson_assignments`; erasing one student leaves another's rows; export
   contains titles and dates, no bodies. Then `export_lesson_assignments`,
   `erase_lesson_assignments` and their registration in `personal_data.py`; replace the
   "revisit" note on `erase_courses` with the spec's answer. The coverage guard
   (`tests/test_personal_data_hooks_cover_every_model.py`) must stay green unchanged.
7. [ ] **Seed.** `test_seed_e2e_curriculum.py`:
   `test_rerun_clears_assignments_for_booked_student`. No seed code change is expected
   (the rebuild cascades); if the test is red, fix the seed.
8. [ ] **Arabic catalog.** `makemessages -l ar` through the gate compose file, add the
   entries in `kaleem/curriculum/locale/ar/LC_MESSAGES/django.po`;
   `tests/test_translation_catalogs.py` must pass.
9. [ ] **Gate.** `backend-gate.sh <wt>` full (migrate, `makemigrations --check`, pytest
   with coverage, ruff, format, lint-imports, mypy).

### Dashboard

1. [ ] **API layer.** `schemas.ts` (`Roster`, `StudentLessons`), `api.ts` (four calls),
   `queries.ts` (four hooks). Tests first in `api.test.ts` and `queries.test.tsx`: paths,
   bodies, the roster replacing its cache after a write, a 409 or 404 refetching.
2. [ ] **AssignDialog.** `AssignDialog.test.tsx` first: checked when every target lesson is
   held, unchecked with "Has some of these lessons" when some are; save sends assign for
   newly checked and withdraw for newly unchecked only, and nothing for untouched rows;
   empty-students state; error keeps the dialog open; the live region announces success.
3. [ ] **Builder wiring.** Assign buttons in `UnitSection` and `LessonRow` with names that
   carry the item; the three delete bodies gain the sentence. Extend
   `CourseBuilder.test.tsx`.
4. [ ] **Lessons view.** `StudentLessons.test.tsx` and `LessonsForPicker.test.tsx` first:
   loading, empty, error with retry, order; picker hidden with one option; a parent's view
   has no button that writes. Then `CurriculumPage` composes teacher, then student or
   parent; `CourseBuilderPage` shows the not-found state for non-teachers. Update
   `nav.ts` (+ `nav.test.ts`) and Home's `SOON` set (+ its test).
5. [ ] **Copy.** Keys in `src/locales/en/curriculum.json` and `ar/curriculum.json`;
   `parity.test.ts` and the namespace guards stay green. Arabic marked for hg-arabic-review.
6. [ ] **e2e.** `e2e/curriculum-assignment.spec.ts` (three serial flows, as the spec lists,
   40 s budget) and `{ path: "/curriculum", as: "guardian" }` in `e2e/routes/curriculum.ts`.
   Grep `e2e/shell.spec.ts` for parent nav assertions before assuming none change.
7. [ ] **Gate.** `dashboard-gate.sh <wt>` full (tsc, lint, coverage, build with the
   580,000-byte initial-JS budget, built-CSS check). e2e locally in a port slot is optional;
   CI is the authority.

### Meta

1. [ ] `docs/architecture/curriculum.md`: model, services, endpoints, visibility rule.
2. [ ] At ship: the CLAUDE.md D3 row `curriculum — assignment` (3 flows), journal, `STATE.md`.

Before hand-back: `git merge --no-edit origin/main` (never rebase), re-run both full gates,
`gitleaks-range.sh <wt> origin/main..HEAD` in each repo, and the floor grep from runbook
section 3.

## Mutation checks

Each reverted, seen red, restored:

- Drop the teaching-link check in `assign_lessons`: the untaught-student test goes red.
- Add a teaching-link filter to `get_student_curriculum`: the teacher-change test goes red.
- Drop the course filter on lesson ids: the foreign-lesson conflict test goes red.
- Drop `is_parent_of` from the lessons view: the parent 200 test goes red; let anyone
  through: the unrelated-user 404 test goes red.
- Make the dialog send every checked row: the "sends only the diff" test goes red.
- e2e: skip the withdraw call in the dialog; flow 3 goes red.

## Risks

- **Open decision.** dec-cur-parent-visibility parks the build. Fallback: none; wait.
- **Shared `services.py` and migration numbering** with cur-lesson-resources or
  cur-content-storage. Append-only edits; the conductor renumbers 0005 at freshness.
- **e2e seed interplay.** `curriculum.spec.ts` reorders the seeded course in the same run.
  The new flows find units and lessons by name, never by position. `e2e.booked` is shared
  with booking and call specs; this unit adds rows only in `curriculum`, which those specs
  never read.
- **Bundle budget** (577 KB of 580 KB). Everything new sits in the lazily loaded route
  chunk and the `curriculum` catalogue; the build step fails if it does not.
- **The teaching port's first consumer.** A missing provider raises
  `ImproperlyConfigured` (by design); the API tests run with the real scheduling provider,
  so wiring faults show there, not only with the fake.

## Verification

Each step's tests red first, then green. Whole unit: both full gates, the mutation checks
above, CI e2e green with the three new flow names in the log, then staging per
dec-d9-substitute (both themes, Arabic RTL, 320 px) as teacher, `booked` and `guardian`.
