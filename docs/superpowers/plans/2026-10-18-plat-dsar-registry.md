---
spec: docs/superpowers/specs/2026-10-18-plat-dsar-registry-design.md
status: draft
---

# Plan: plat-dsar-registry

Repos: `backend` (code) and meta (ADR and `docs/architecture/platform.md`). The branch is
`feat/plat-dsar-registry` in both.

- Backend worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/backend-plat-dsar-registry`,
  created from backend `origin/main` as conductor-runbook section 1 describes. Its base
  must contain plat-module-scaffolds (f2b86d2 or later).
- Meta worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/meta-plat-dsar-registry`.

No migrations. No dependency change. No floor edit. No module joins in this unit.

## Steps

1. [ ] **Red: registry tests.** Write `kaleem/platform/tests/test_personal_data.py`. Each
   test builds its own `Registry()`, uses fake hooks over in-memory dicts, and gets users
   from `get_user_model()`. Use `@pytest.mark.django_db`; the rollback test needs
   `transaction=True`.
   - `test_register_then_export_keys_by_name_in_name_order`
   - `test_reregistering_same_function_is_a_noop`
   - `test_second_function_under_taken_name_raises` (`ImproperlyConfigured`)
   - `test_erase_runs_in_order_then_name`. Register `order=900 "a.x"`, `order=100 "b.y"`
     and `order=100 "a.z"`. The call order must be `a.z`, `b.y`, `a.x`.
   - `test_erase_rolls_back_every_hook_when_one_raises`. The first hook sets the user's
     `is_active=False` through `get_user_model().objects.filter(pk=...).update(...)`. The
     second hook raises. After `pytest.raises`, the row must still read `True`.
   - `test_on_commit_work_is_dropped_on_rollback`

   Run it with `backend-gate.sh <wt> kaleem/platform/tests/test_personal_data.py`. It
   fails at import, because the module does not exist yet.

2. [ ] **Green: registry.** Write `kaleem/platform/personal_data.py`:
   - an `ExportHook`/`EraseHook` dataclass (name, fn, models, order);
   - a `Registry` class with `register_export`, `register_erase`, `export_hooks()`,
     `erase_hooks()`, `export_user` and `erase_user` (the latter wrapped in
     `transaction.atomic()`);
   - a module-level default instance, with the four functions re-exported from it.

   The user type is `AbstractBaseUser`. The module docstring states the hook contract in
   five lines. Step 1 goes green.

3. [ ] **Red: contract-helper tests.** Write
   `kaleem/platform/tests/test_personal_data_contract.py`.
   - One correct fake pair over an in-memory store passes
     `assert_hooks_honour_contract(..., registry=r)`.
   - Then one test per broken fake, each asserting `AssertionError` with the rule named in
     its message:
     - `export_not_json` (returns a `date`);
     - `export_not_deterministic` (a counter);
     - `export_writes` (updates the user row);
     - `erase_not_idempotent` (appends on every call);
     - `erase_touches_other_user`;
     - `erase_raises_on_unseeded_user`;
     - `assert_erased_failed`.

   It fails at import.

4. [ ] **Green: contract helper.** Write `kaleem/platform/personal_data_contract.py`. It
   implements the spec's six checks in that order:
   - JSON with no `default=`, by `json.dumps`;
   - determinism;
   - no writes: `CaptureQueriesContext(connection)`, rejecting any SQL that starts with
     INSERT, UPDATE or DELETE;
   - an unseeded user;
   - idempotent erase;
   - B unchanged;
   - an optional `assert_erased`.

   Each failure is an `AssertionError` whose message starts with the rule name. `registry`
   defaults to the module instance. Step 3 goes green.

5. [ ] **Red then green: coverage guard.** Write
   `tests/test_personal_data_hooks_cover_every_model.py`, with `NOT_PERSONAL = {}` and
   both pending maps empty. Put the checks in a function `problems(registry)` that returns a
   list of messages, so step 6 can feed it a test registry. It walks `apps.get_app_configs()` for names starting with
   `kaleem.`, reads `get_models()`, and checks the default registry. Run it, and see red
   for every model in identity, billing, scheduling and curriculum.

   Then fill `PENDING_EXPORT = {"identity" | "billing" | "scheduling" | "curriculum":
   "lb-gdpr-data-export"}` and `PENDING_ERASE` with the same four apps, each mapped to
   `"lb-gdpr-erasure"`. Add a comment saying the maps may only shrink. Add the other
   checks: hook name prefix and declared models in the same installed `kaleem.*` app, no
   stale pending entry, and every `NOT_PERSONAL` label resolves. Green.

6. [ ] **Mutation checks.** Record each red line, revert, and confirm green.
   - Remove `"billing"` from `PENDING_EXPORT`. The guard goes red, naming billing's models.
   - Add `"analytics": "x"` to `PENDING_ERASE`. Analytics has no models, so it is a stale
     entry and the guard goes red.
   - In a test-only registry, register a hook named `"billing.x"` that declares
     `"curriculum.Subject"`, and pass that registry to `problems()`. Red, because the
     declared model is in a different app.
   - Swap the sort key in `erase_user` to name only. The order test goes red.
   - Remove `transaction.atomic()` from `erase_user`. The rollback test goes red.
   - In the helper, delete the no-writes check. `export_writes` goes red. Repeat for the
     idempotency check and the B-unchanged check.
   - Make re-registration of the same function raise.
     `test_reregistering_same_function_is_a_noop` goes red.

7. [ ] **Full gate and commit (backend).** Run `backend-gate.sh <wt>` and require rc 0.
   `lint-imports` must still report every contract kept, which proves platform imports no
   business module. Commit these paths: `kaleem/platform/personal_data.py`,
   `kaleem/platform/personal_data_contract.py`, the two platform tests and the root guard.
   Message: `feat(platform): export/erase hook registry with a contract helper and coverage guard`.
   Use `PIP_CONFIG_FILE=/dev/null`.

8. [ ] **Meta docs (meta worktree).**
   - `docs/adr/NNNN-export-erase-hook-contract.md`. The number is allocated by the
     conductor. It records:
     - why a registry filled at `ready()` and not a hard-coded list;
     - why two hook kinds and model-level coverage, and not app-level;
     - why one transaction plus `on_commit`;
     - the `order` convention, with identity at 900;
     - that retention is outside the interface;
     - alternatives: one hook per app, `pre_delete` signals, and a cascade on User delete,
       which is rejected by lb-dec-erasure-semantics.
   - `docs/architecture/platform.md`. A short doc of what platform owns:
     - the existing items: exceptions, DRF handler, pagination, permissions, throttling,
       middleware, logging, health, email task, seed command;
     - the registry pattern;
     - the personal-data registry, joining a module in four steps (`personal_data.py`,
       `ready()`, a contract-helper test, removing the pending entry or adding a
       `NOT_PERSONAL` reason);
     - that identity's hooks own allauth's `EmailAddress` rows.

   Commit: `docs: ADR and platform architecture doc for the export/erase registry`.

9. [ ] **Hand-back.** Run runbook section 3's five checks in the backend worktree: not
   stale, clean tree, gitleaks range CLEAN, and the floor grep empty. Send the step-6 red
   lines with the hand-back.

## Gates

- TDD loop: `/home/abdulkhalek/Projects/kaleem-worktrees/_tools/backend-gate.sh <wt> <test path>`.
- Full: `/home/abdulkhalek/Projects/kaleem-worktrees/_tools/backend-gate.sh <wt>`. This runs
  migrate, `makemigrations --check`, `pytest --cov=kaleem --cov=signaling`, ruff check and
  format, and `lint-imports`.
- `/home/abdulkhalek/Projects/kaleem-worktrees/_tools/gitleaks-range.sh <wt> origin/main..HEAD`.
- No dashboard, marketing or e2e gate. Nothing user-facing changes, so the D3 table gains
  no row. The contract tests are the proof.

## Risks

- **Too strict for real modules.** The B-unchanged check assumes `seed` can create data
  for one user with no links to anyone else. A module whose rows always involve two people
  (a session, a chat) seeds its own counterpart C inside `seed`. Only A's export and B's
  are compared, and B is seeded independently. If a joining unit still cannot meet a rule,
  it escalates; it never loosens the helper in its own PR.
- **Model-level guard blocks a foundation unit.** That is the intent. The fix is to join or
  to add a `NOT_PERSONAL` reason, which the reviewer checks.
- **Shared-file conflicts** in `kaleem/platform`. lb-gdpr-data-export lists
  `backend/kaleem/platform` as a shared file and merges after this unit. This unit touches
  no file that plat-module-scaffolds changed.
- **`ready()` runs twice.** This is covered by the idempotent re-registration in step 1.
- **Coverage.** Both new modules are fully exercised by the platform tests. The helper is
  production code on purpose, so module tests can import it. The floor is the conductor's.
- **Blue-green.** Nothing is registered and nothing runs, so the old colour is unaffected.

## Verification

- Steps 1, 3 and 5 are each seen red before green.
- Every step-6 mutation is seen red, then reverted to green.
- The full backend gate passes with rc 0, with all import contracts kept.
- CI on the meta proof PR is green.
- After deploy, the staging health probes stay green. That proves the module imports under
  production settings.
