---
spec: docs/superpowers/specs/2026-10-18-cur-course-structure-design.md
status: approved
---

# Plan: cur-course-structure

dec-cur-ownership is resolved (option 1, 2026-10-18); the spec is approved.

Branch `feat/cur-course-structure` in three worktrees under
`/home/abdulkhalek/Projects/kaleem-worktrees/`: `backend-cur-course-structure`,
`dashboard-cur-course-structure` (runbook section 1, from `origin/main`) and
`meta-cur-course-structure`. Backend base must contain fe415f1 or later (registry, seed
manifest); dashboard base c70a0f4 or later (terminology test).

One migration (`curriculum/0004_course_unit_lesson`). No dependency change. No floor edit
(dec-floor-ownership). No contract change.

## Steps

### Backend

1. [x] **Red: models.** `kaleem/curriculum/tests/test_models.py` (extend):
   `test_unit_position_unique_per_course_at_commit` and the lesson twin (insert a
   duplicate, run `SET CONSTRAINTS ALL IMMEDIATE`, expect `IntegrityError`);
   `test_swapping_two_positions_in_one_transaction_succeeds`;
   `test_deleting_a_course_deletes_its_units_and_lessons`;
   `test_a_subject_with_courses_cannot_be_deleted` (PROTECT).
2. [x] **Green: models and migration.** Add `Course`, `Unit`, `Lesson` to
   `kaleem/curriculum/models.py` as the spec says. Generate `0004_course_unit_lesson` with
   `python manage.py makemigrations curriculum -n course_unit_lesson`, run through the gate
   compose file (`GATE_PROJECT=gate-backend-cur-course-structure WT=<wt>
   GATE_IMAGE=<image> docker compose -f <R>/_tools/backend-gate.compose.yml run --rm gate
   ...`). Read the generated file and check both constraints say `deferrable`.
   `test_migrations.py` gains a check that 0004 applies after 0003.
3. [x] **Red: services.** `kaleem/curriculum/tests/test_course_services.py`:
   - `test_create_course_returns_the_tree`, `test_blank_title_refused` (`""`, `"   "`),
     `test_title_over_200_refused`, `test_inactive_subject_refused`,
     `test_course_limit_refused_at_51`, and the unit and lesson limits.
   - `test_add_unit_appends`, `test_delete_unit_renumbers_densely`, and the lesson twins.
   - `test_reorder_units_rewrites_positions`, and
     `test_reorder_refuses_missing_extra_duplicate_or_foreign_ids` (parametrized; each
     raises `ConflictError` and leaves positions unchanged). Lesson twins.
   - `test_every_service_hides_another_teachers_course` (parametrized over all thirteen
     services; `NotFoundError`).
   - `test_changing_to_a_retired_subject_refused_but_keeping_one_allowed`.
4. [x] **Green: services.** Add the thirteen services to `kaleem/curriculum/services.py`.
   Every write runs in `transaction.atomic()` and takes `select_for_update()` on the
   course row first. Reorder compares the submitted ids to the current set, raising
   `ConflictError` on any difference, then writes positions 0..n-1. Reads prefetch units
   and lessons in position order. Reuse `_resolve` for the subject.
5. [x] **Red then green: API.** `kaleem/curriculum/tests/test_course_api.py`:
   - 403 for a student-only user on each route; 404 for another teacher's course with a
     body equal to a missing id's; 400 field errors; 409 on a stale order; 201 on creates,
     204 on course delete.
   - `test_writes_require_csrf` (`APIClient(enforce_csrf_checks=True)`).
   - The tree's exact keys.

   Then add serializers to `api/serializers.py`, views to `api/views.py` (reusing
   `_require_teacher`) and the routes to `api/urls.py`.
   `tests/test_api_versioning_is_enforced.py` must stay green untouched.
6. [x] **Red then green: registry.** `kaleem/curriculum/tests/test_personal_data.py` calls
   `assert_hooks_honour_contract("curriculum.courses", seed=..., make_user=...,
   assert_erased=...)`. `seed` makes a teacher's course with a unit and a lesson.
   `assert_erased` checks that no course remains. Then write
   `kaleem/curriculum/personal_data.py` (export: course trees with ISO dates, ordered by
   id; erase: delete the teacher's courses) and `CurriculumConfig.ready()`, which
   registers both. `tests/test_personal_data_hooks_cover_every_model.py` stays green
   unedited (curriculum is still pending).
7. [x] **Red then green: seed.**
   `kaleem/curriculum/tests/test_seed_e2e_curriculum.py`: it refuses `DEBUG=False`; after
   running twice, `e2e.teacher@kaleem.test` has exactly one course, "E2E Course"
   (subject `quran`), with units "Unit 1" and "Unit 2", and lessons "Lesson A", "Lesson
   B" and "Lesson C" in Unit 1, in that order. Write
   `kaleem/curriculum/management/commands/seed_e2e_curriculum.py` (user via
   `identity.services.get_user_by_email`; delete that user's courses, then create through
   the services). Append `seed_e2e_curriculum` to `config/e2e_seeds.txt` after
   `seed_e2e_matching`. `kaleem/platform/tests/test_seed_e2e_all.py::test_shipped_manifest_is_todays_ci_order`
   pins the shipped list; add the new entry to it in the same commit.
8. [x] **Mutation checks (backend).** Each is red with the change, then reverted:
   - Drop `deferrable` (and regenerate): the swap test fails with `IntegrityError`.
   - Remove the set comparison in `reorder_units`: the 409 test goes red.
   - Remove the `owner_id=teacher_id` filter in `get_course`: the hide test goes red.
   - Remove `.strip()` from title validation: the whitespace case goes red.
   - Make erase delete every course: the contract helper's "B unchanged" rule fails.
9. [x] **Full gate and commit.** `backend-gate.sh <wt>` rc 0. Commits (explicit paths,
   `PIP_CONFIG_FILE=/dev/null`): `feat(curriculum): course, unit and lesson models`,
   `feat(curriculum): course builder services and API`,
   `feat(curriculum): export and erase hooks for courses`,
   `test(curriculum): seed_e2e_curriculum in the e2e manifest`.

### Dashboard

10. [x] **Red then green: data layer.** `src/features/curriculum/schemas.ts` (course tree
    and summary), `api.ts` (the thirteen calls), `queries.ts` (`useCourses`, `useCourse`
    and a mutation per call that writes the returned tree with `setQueryData`; on 409 it
    invalidates the course instead). Tests in `api.test.ts` and `queries.test.tsx`:
    each call's path and verb, the cache write, and the 409 refetch.
11. [x] **Red then green: `MoveButtons`.** `MoveButtons.test.tsx`: names carry the item
    title; Up is disabled on the first item and Down on the last; a click calls `onMove`
    with the direction; each button is at least 44 px (class check, as `button.test.tsx`
    does). Then `components/MoveButtons.tsx` from `Button` and lucide `ChevronUp` and
    `ChevronDown`.
12. [x] **Red then green: builder.** `CourseBuilder.test.tsx`, `UnitSection.test.tsx`,
    `LessonRow.test.tsx` and `LessonFormDialog.test.tsx` (`vi.spyOn(curriculumApi, ...)`, as
    `SubjectsCard.test.tsx` does):
    - renders units and lessons in order, with the lesson body as text (an HTML string
      shows literally);
    - a move PUTs the swapped id list, announces "X moved to position n of m" in the live
      region and leaves focus on the moved item's button (or its other button at an end);
    - 404 shows not-found with a link back; a 409 shows the reload message;
    - add, rename, edit and delete, with delete confirmed in a `Dialog`;
    - loading and error-with-retry states.
13. [x] **Red then green: list and routes.** `CourseList.test.tsx` and
    `CourseFormDialog.test.tsx`: empty state, the list with counts, a whitespace title
    refused before any request, a server 400 shown on the field, and navigation to the
    builder on success. Routes: `src/routes/_authed/curriculum.tsx` becomes
    `component: Outlet`; new `curriculum.index.tsx` (`CurriculumPage`: the list for a
    teacher, the placeholder otherwise) and `curriculum.$courseId.tsx`
    (`-pages/CourseBuilderPage.tsx`). Regenerate `routeTree.gen.ts` with the build. Remove
    Curriculum from `module-scaffolds.test.tsx` and add `curriculum.index.test.tsx` for
    both branches.
14. [x] **Home and nav.** `Home.tsx`: the Curriculum tile keeps "Coming soon" only for a
    user without a teacher profile (test in `index.test.tsx`). Update the scaffold note in
    `nav.ts`.
15. [x] **Copy.** The course builder's text is a feature catalogue,
    `src/locales/{en,ar}/curriculum.json` (namespace `curriculum`), not part of
    `common.json`: in the entry chunk it took the initial JS to 585,694 bytes against the
    580,000 budget, and the owner declined to raise the budget (2026-10-19, option c:
    per-feature lazily loaded catalogues). Arabic: دورة (course), وحدة (unit), درس
    (lesson), queued for hg-arabic-review. `modules.curriculum.description` stays in
    `common.json`, where `terminology.test.ts` reads it as its positive control.
15a. [x] **Lazy catalogue.** `src/lib/i18n-namespaces.ts`: `FEATURE_CATALOGUES` (dynamic
    imports, both locales) and `loadNamespace(ns)` (idempotent, deduplicated, retryable).
    `curriculum.tsx`'s `loader` calls it, so both child routes have their text before they
    render. The components use `useTranslation("curriculum")`. Tests: `parity.test.ts` and
    `terminology.test.ts` now walk every catalogue by listing the directory;
    `i18n-namespaces.test.ts` covers the loader, the route and a static-import guard;
    component tests import `@/test/feature-i18n`. Documented in
    `docs/developer-guide/i18n.md`.
15b. [x] **Second catalogue: `call`.** With curriculum moved out, the initial JS was still
    581,064 bytes against 580,000 (main alone: 579,286), and the budget stays. The same
    pattern is applied to the video room: the `call` block leaves `common.json` for
    `src/locales/{en,ar}/call.json`, `FEATURE_CATALOGUES` gains `call`, and the `_call`
    layout route's `loader` loads it after the auth guard. The call components use
    `useTranslation("call")`; the three shared `booking.*` strings they show are read with
    `{ ns: "common" }`. Tests first: `i18n-namespaces.test.ts` (route loader, both locales,
    registry, `common.json` carries neither block), `parity.test.ts` (discovered),
    `terminology.test.ts` (call stays under the lesson-wording guard). Mutation-checked: a
    static import of `call.json` in `main.tsx`, no `_call` loader, `call` put back in
    `common.json`, and `call` dropped from the registry each turn a test red.
16. [x] **e2e.** `e2e/curriculum.spec.ts` with the spec's three flows, as `teacher`. Flow 2
    reads the current order before moving, so it holds under a retry. It switches to
    Arabic, sets 320 px and checks `dir`, `widestOverflow` (`e2e/support/measure.ts`) and
    axe after `settle`. `e2e/routes/curriculum.ts` gains `{ path: "/curriculum", as:
    "teacher" }`. `e2e/routes/index.ts` `NOT_SWEPT` gains `/curriculum/$courseId` with its
    reason.
17. [x] **Mutation checks (dashboard).** For the lazy catalogue: a static import of the
    catalogue in `lib/i18n.ts` turns the guard red; a dropped `ar` key turns parity red; no
    route `loader` turns the route test red; un-exempting curriculum turns the wording
    guard red; an unregistered catalogue turns discovery red. Remove the live-region write: the builder test
    goes red. Remove the client blank check: the dialog test goes red. Make the move
    send the unswapped list: the move test goes red. In e2e (local slot or CI), have
    `reorder_lessons` skip the save: flow 2 goes red after the reload.
18. [x] **Full gate and commit.** `dashboard-gate.sh <wt>` rc 0. Commits:
    `feat(curriculum): course builder data layer`, `feat(curriculum): course builder with
    button reordering`, `test(e2e): course builder flows`.

### Meta

19. [x] **Docs.** `docs/architecture/curriculum.md`: models, services, endpoints, the
    ordering and locking rule, the registry hook. Proposed D3 row (`curriculum` - course
    builder, 3 flows), given in the hand-back for close-out. Commit
    `docs: curriculum architecture for the course builder`.
20. [ ] **Hand-back.** Runbook section 3's checks in both submodule worktrees, with the
    step 8 and 17 red lines.

## Gates

- TDD: `_tools/backend-gate.sh <wt> <test path>` and `_tools/dashboard-gate.sh <wt> <test
  path>`.
- Full: `_tools/backend-gate.sh <wt>` (migrate, `makemigrations --check`, pytest with
  coverage, ruff, lint-imports, mypy) and `_tools/dashboard-gate.sh <wt>` (tsc, lint,
  coverage, build, built-CSS check).
- `_tools/gitleaks-range.sh <wt> origin/main..HEAD` in each submodule worktree.
- e2e: optional in a local port slot; CI is the authority, and its log must name all three
  new flows plus the new sweep entries.

## Risks

- **Deferred constraints hide in tests.** pytest-django never commits, so a deferred
  violation passes silently. Step 1 forces the check, and step 8 proves it bites.
- **Route restructure.** Turning `curriculum.tsx` into a layout moves the page. The sweep's
  completeness test catches a missing list entry; `nav.test.ts` and the `aria-current`
  e2e must stay green for `/curriculum/<id>`.
- **Shared files.** `curriculum/models.py` and `curriculum.tsx` are shared with later
  curriculum units, and `config/e2e_seeds.txt` with every seeding unit (append-only, keep
  both lines). Migration 0004 may need renumbering at freshness.
- **The `teacher` e2e account** is shared with the subjects, matching and booking specs.
  This unit only touches its courses, which nothing else reads. The seed creates no
  `TeacherSubject` row, so matching state is unaffected.
- **Arabic copy** may change in review. That holds spec closure, not the merge.
- **Size.** L. If the dashboard half runs past the estimate, split it into its own PR
  after the backend lands. That is a sequencing change, not a scope change.

## Verification

- Every red step is seen red before green, and every step 8 and 17 mutation is seen red,
  then reverted to green.
- Both full gates pass with rc 0; gitleaks is CLEAN; the floor grep is empty.
- CI green on the meta PR, with the three flows in the e2e log.
- Staging (dec-d9-substitute): build a course, reorder, reload; both themes, Arabic RTL,
  320 px.
