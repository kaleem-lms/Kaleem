---
spec: docs/superpowers/specs/2026-11-22-eng-points-levels-design.md
status: approved
---

Backend only (`backend-eng-points-levels`, branch `feat/eng-points-levels`, off `origin/main`
e543505). Meta is docs only. The owner answered the spec's open questions on 2026-11-22, all as
recommended. If a later answer changes a value (points, thresholds, audience), change the constant or
the seed and its test. The structure does not change.

The TDD loop is `_tools/backend-gate.sh "${WT}" kaleem/engagement/tests/<file>.py`. Write each
step's tests first and see them red, then write the code.

## Steps

1. [ ] **Models and migrations.**
   - Tests first, in `engagement/tests/test_models.py`:
     - `test_unique_reason_and_source` (IntegrityError on a second line);
     - `test_amount_must_be_positive` (0 and −1 refused by the CHECK, bypassing the service);
     - `test_level_number_and_min_points_unique`;
     - `test_seeded_levels_start_at_zero_and_rise` (ten rows, `min_points` 0, strictly
       increasing with `number`).
   - Code:
     - `engagement/models.py`: `PointsEntry`, with `Reason.LESSON_DELIVERED`, and
       `LevelDefinition`, both as in the spec.
     - `makemigrations engagement` gives `0001_initial`.
     - Hand-write `0002_seed_levels.py`, modelled on `curriculum/0002_seed_subjects.py`:
       `update_or_create` by `number`, with an `unseed`.
   - Also:
     - Add `"engagement.LevelDefinition"` to `NOT_PERSONAL` in
       `tests/test_personal_data_hooks_cover_every_model.py`. The guard goes red until step 5
       registers `PointsEntry`. That is expected and keeps step 5 honest.
     - Update the docstring of `tests/test_module_scaffolds.py`: engagement now has models.

2. [ ] **Points service.**
   - Tests first, in `engagement/tests/test_points.py`:
     - `test_award_writes_one_line`;
     - `test_award_twice_same_source_is_noop` (returns `False`, one row);
     - `test_state_zero_points_is_level_one`;
     - `test_state_one_below_threshold`;
     - `test_state_at_threshold`;
     - `test_state_top_level_has_no_next`;
     - `test_state_beyond_top`;
     - `test_state_empty_level_table_is_null`;
     - `test_state_ignores_other_students`.
   - Code:
     - `engagement/points.py`:
       - `POINTS_PER_DELIVERED_LESSON = 10`.
       - `award_points(*, student_id, reason, source_id, amount, occurred_at) -> bool`:
         `get_or_create` on `(reason, source_id)`.
       - `PointsState` and `Level`, frozen dataclasses.
       - `state_for(user_id)`: one `SUM` and one level query.
     - `services.get_user_state(user_id)` delegates to `state_for`.

3. [ ] **Handler and subscription.**
   - Tests first, in `engagement/tests/test_handlers.py`. Publish with
     `events.registry.type_named("scheduling.session_completed").cls(...)` inside `atomic()`,
     then call `events.deliver(pk)`. No scheduling import (contract).
     - `test_held_awards_points`;
     - `test_student_absent_awards_nothing`;
     - `test_unknown_version_awards_nothing` (call the handler with an `Event` of version 2);
     - `test_redelivery_awards_once`;
     - `test_second_event_same_lesson_awards_once`;
     - `test_missing_user_is_skipped_and_logged` (`caplog`, no raise, one `HandledEvent`);
     - `test_subscription_registered` (exact type and handler name).
   - Code:
     - `engagement/handlers.py` holds `HANDLER_NAME`, `on_session_completed(event)` and
       `register()`.
     - The handler does three things:
       - It returns when `event.version != 1` or `outcome != "held"`.
       - It checks the student exists through `identity.services.get_users([id])`.
       - It then calls `award_points`.
     - `engagement/apps.py` gets `ready()` importing and calling `handlers.register()` and
       `personal_data.register()` (the latter lands in step 5).

4. [ ] **`me/` endpoint.**
   - Tests first, in `engagement/tests/test_api.py`:
     - `test_student_gets_state` (exact JSON shape);
     - `test_student_zero_state`;
     - `test_teacher_only_forbidden` (403, `error_code == "permission_denied"`);
     - `test_parent_only_forbidden`;
     - `test_anonymous_refused`;
     - `test_only_own_points`.
   - Code:
     - `engagement/api/views.py` has `MyPointsView(APIView)` with a `_require_student`
       guard, copying `scheduling/api/views.py`.
     - `engagement/api/serializers.py` holds the response serializer.
     - `engagement/api/urls.py` adds `path("me/", ..., name="me")`.
     - Create `engagement/locale/ar/LC_MESSAGES/django.po` for the one `pgettext_lazy`
       message (`makemessages -l ar`, then fill the entry). `tests/test_translation_catalogs.py`
       checks it.
     - `test_api_versioning_is_enforced.py` covers the route automatically.

5. [ ] **Personal-data hooks.**
   - Tests first, in `engagement/tests/test_personal_data.py`:
     - `test_hooks_honour_contract` (`assert_hooks_honour_contract("engagement.points", seed=...,
       make_user=...)`);
     - `test_export_is_own_lines` (`{points, level, entries:[{reason, amount, occurred_at}]}`,
       no ids);
     - `test_erase_removes_only_own_lines`.
   - Code: `engagement/personal_data.py` uses `NAME = "engagement.points"` and
     `MODELS = ["engagement.PointsEntry"]`, with `export_points`, `erase_points` and
     `register()`. The coverage guard from step 1 turns green.

6. [ ] **Cross-module wiring test.**
   - `tests/test_engagement_points_wiring.py`:
     - Build a student, a teacher, an assignment and a lesson started in the past, following
       `tests/test_curriculum_assignment_wiring.py`'s fixtures.
     - Call `booking.complete_session(teacher, session.id, now=...)` inside
       `django_capture_on_commit_callbacks(execute=True)`. Celery is eager in test settings.
     - Assert `get_user_state(student.id).points == 10`.
     - Then `mark_student_absent` on a second lesson leaves the total at 10.
   - **Mutation check:** comment out the `subscribe` call in `handlers.register()`. The test
     must go red. Restore it. Record both lines for the hand-back.
   - **Second mutation check:** drop the `outcome != "held"` guard. The absent case must go
     red.

7. [ ] **Full gate and hand-back.**
   - Run `_tools/backend-gate.sh "${WT}"`. It covers:
     - migrate;
     - `makemigrations --check`;
     - pytest with coverage against the existing floor (never edit it);
     - ruff;
     - format;
     - `lint-imports`, with no contract change;
     - mypy.
   - Then `git fetch origin main && git merge --no-edit origin/main` (a merge, never a
     rebase), re-run the full gate, and run `gitleaks-range.sh "${WT}" origin/main..HEAD`.
   - Commit with explicit paths, for example `feat(engagement): points ledger, levels and me/
     endpoint`.

8. [ ] **Meta docs, in this worktree, at close-out.**
   - `docs/architecture/engagement.md` (new): the models, the handler, the endpoint, the
     hooks, and "levels are reference data in a migration".
   - In `CLAUDE.md` D3, add a row: "`engagement` — points | ❌ by design | API only; the card
     and its flow are `eng-dashboard-ui`".
   - Update `STATE.md` and the journal line.

## Tests written first, in order

`test_models.py`, then `test_points.py`, `test_handlers.py`, `test_api.py`,
`test_personal_data.py`, and finally `tests/test_engagement_points_wiring.py`. Every
regression-style test is mutation-checked: revert the fix and see red.

## Gates

| Gate | How |
| --- | --- |
| Focused TDD | `_tools/backend-gate.sh "${WT}" kaleem/engagement/tests/...` |
| Full backend (CI parity) | `_tools/backend-gate.sh "${WT}"` |
| Secrets | `_tools/gitleaks-range.sh "${WT}" origin/main..HEAD` |
| Floor untouched | the runbook section 3 grep on `pyproject.toml` |
| e2e | none (spec, Test plan). The existing `event_bus_probe` CI step must stay green |

## Migrations

- `engagement/0001_initial` creates `PointsEntry` and `LevelDefinition`.
- `engagement/0002_seed_levels` is a `RunPython` seed with a reverse.

Both are additive and expand-only. There are no NOT NULL changes, renames or drops on an
existing table. The conductor confirms the numbers. If main gains an engagement migration
first, renumber at freshness.

## Risks

- **Seeded levels vanish in `transaction=True` tests.** The flush empties the table. The
  service returns `level: null` rather than crashing, which is tested. Level-boundary tests
  create their own rows rather than relying on the seed, except the one seed test.
- **The handler raises in production.** For example, the identity lookup fails. The bus
  retries it and logs at ERROR with the event id, and the close-out is unaffected. Fallback:
  `replay_events --handler engagement.points_lesson_delivered` once fixed.
- **Missed points after deploy.** The sweep only looks back 24 hours. The conductor's one-off
  replay on staging (spec Q7) covers the 90-day log, and it is idempotent.
- **An owner answer changes a rule after the build starts.** Values live in one constant and
  one seed migration, so a change is a small edit plus its test. A changed audience (teachers
  too) is a bigger change, and it re-opens the spec.
- **Scope creep.** A parent endpoint, a history list or a staff screen would each be a new
  endpoint. Escalate, do not add them.

## Verification

- Each step is green in the focused loop, and the full gate is green before hand-back.
- The mutation checks in step 6 are recorded in the hand-back block.
- Staging, after the conductor deploys:
  - Close a pool student's lesson out as delivered.
  - `GET /api/v1/engagement/me/` as that student shows +10 and the right level.
  - As a teacher, it gives 403.
  - Then run the one-off `replay_events` for Q7.
