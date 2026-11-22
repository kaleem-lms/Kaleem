---
spec: docs/superpowers/specs/2026-10-18-plat-mypy-gate-design.md
status: draft
---

# Plan: plat-mypy-gate

The unit touches two repos.

- **backend:** the type fixes and the version pins. Worktree
  `/home/abdulkhalek/Projects/kaleem-worktrees/backend-plat-mypy-gate`, branch
  `feat/plat-mypy-gate`, created from `origin/main` as conductor-runbook section 1 describes.
- **meta:** the ci.yml step and the `just lint-backend` line. Worktree
  `/home/abdulkhalek/Projects/kaleem-worktrees/meta-plat-mypy-gate`.

Other facts about the change:

- No migrations, and no floor edit.
- It is a **dependency change**: four `==` pins in `requirements/local.txt`. The pinned
  versions equal what `kaleem-gate:2c8d4dc5e9bb` already has. The image key still changes,
  so `backend-gate.sh` exits 3 until the conductor builds the new key (runbook section 7).
- e2e: none. There is no user-facing behaviour. The proof is the mutation check (step 6).

**How to run mypy here.** `backend-gate.sh` has no mypy stage. Run it with the compose
file's documented form, against the same image the gate uses. Brace every variable:

```bash
R=/home/abdulkhalek/Projects/kaleem-worktrees; WT="${R}/backend-plat-mypy-gate"
GATE_PROJECT=gate-backend-plat-mypy-gate WT="${WT}" GATE_IMAGE=kaleem-gate:<key> \
  docker compose -f "${R}/_tools/backend-gate.compose.yml" run --rm gate mypy .
```

Before the new image exists, use `kaleem-gate:2c8d4dc5e9bb`; the versions are identical.
The settings import that django-stubs performs needs `DATABASE_URL` to be set. The compose
service sets it, and it connects to nothing.

## Steps

1. [ ] **Red baseline.** Run mypy on the fresh worktree and record the count for the
   hand-back. Expect 36 errors in 14 files. If the count differs, another unit has merged
   since; fix the new ones too if they are mechanical (see Risks).
2. [ ] **Pins.** In `requirements/local.txt`, set `mypy==2.4.0`, `django-stubs==6.1.2`,
   `django-stubs-ext==6.1.2` and `djangorestframework-stubs==3.18.1`, each with a
   one-line reason in the style of the ruff pin. Hand the conductor the new key printed by
   `backend-gate.sh` so it can build the image.
3. [ ] **Production typing (4 files).** Re-run mypy after each file; that file's errors go
   and no new ones appear.
   - `kaleem/scheduling/services.py`: add a `_SessionAnnotations(TypedDict)` with
     `ends_at: dt.datetime`. Type `_sessions()` and `_session_scope()` as
     `QuerySet[WithAnnotations[Session, _SessionAnnotations]]`. Import `WithAnnotations`
     from `django_stubs_ext` under `if TYPE_CHECKING:`; the module already has
     `from __future__ import annotations`. This clears 8 errors (trial-verified).
   - `kaleem/scheduling/providers/__init__.py`: add `name: str` to `VideoProvider`. This
     clears `rooms.py:124` (trial-verified).
   - `kaleem/scheduling/matching.py:208`: bind `list(rows)` to a new name rather than
     rebinding the QuerySet variable.
   - `config/settings/base.py`: annotate `REST_FRAMEWORK: dict[str, Any]` and
     `LOGGING: dict[str, Any]`, with `from typing import Any` after the module docstring.
     This clears `test.py:22`, `local.py:71` and `local.py:85`. Do **not** re-annotate in
     `test.py`: that raises `no-redef`.
4. [ ] **Test typing (10 files).** Use real types first, and a narrow, coded
   `# type: ignore[<code>]` only where the test is ill-typed on purpose.
   - `test_admin.py`: pass a `RequestFactory` request rather than `None`, and a real `Room`
     or `None` rather than `object()`.
   - `test_read_api.py:171,203`: these write to a frozen dataclass on purpose, so use
     `# type: ignore[misc]`.
   - `signaling/tests/test_app.py:623`: `cast("WebSocket", fake)`.
   - `tests/stripe_clock/*`:
     - assert or narrow `current_period_end` and the `Subscription | None` before using
       them;
     - type `now` as `dt.datetime`;
     - guard `process.stdout`;
     - assert or narrow the price's `unit_amount`.
   - `test_personal_data_*`: annotate the empty lists and rename the reused `hook` loop
     variable.
   - `test_module_scaffolds.py:63`: narrow `urlconf_module` with `isinstance(..., ModuleType)`.
   - `test_diagnostics_api.py:127`: type the rates at the test site
     (`rates: dict[str, str] = ...`). The settings annotation does not reach it through
     `django.conf.settings`.
5. [ ] **Green locally.**
   - mypy exits 0: "Success: no issues found in 271 source files" (or the current count).
   - `backend-gate.sh "${WT}" kaleem/scheduling tests/test_module_scaffolds.py
     kaleem/platform/tests` passes.
   - The full gate passes: `backend-gate.sh "${WT}"`.
   - Commit in two commits, each with explicit paths:
     - `build(deps): pin mypy and stubs for the type gate`
     - `fix(types): make mypy clean`
6. [ ] **Mutation check.** Append `_x: int = "not an int"` to
   `kaleem/platform/pagination.py`. mypy must exit 1 and name that line. Repeat with the
   same line in `kaleem/scheduling/tests/test_admin.py`. Revert both; mypy exits 0. Quote
   the failure lines in the hand-back.
7. [ ] **Meta: CI step.** In `.github/workflows/ci.yml` `backend-lint`, after "Import
   linter", add:

   ```yaml
   - name: Type check (mypy)
     # django-stubs imports config.settings.test, which reads DATABASE_URL.
     # Nothing connects to it; the URL only has to parse.
     env:
       DATABASE_URL: postgres://kaleem:kaleem@localhost:5432/kaleem_test
     run: mypy .
   ```

   No `needs:` edge changes, because the step sits in an existing job that is already in
   `deploy-staging` and `record-verified-tree`. In `justfile` `lint-backend`, append
   `&& mypy .` inside the `sh -euc`, which makes CLAUDE.md's `just lint` line true. Commit:
   `ci: gate backend on mypy`.
8. [ ] **Hand-back** (runbook section 3): freshness, a clean tree, gitleaks range, the
   floor grep, and `needs: dependency change (pins only)`.

**Conductor close-out:**

- strike the ISSUES.md mypy entry as FIXED;
- add `mypy .` to `_tools/backend-gate.sh`'s full gate and to the runbook's gate
  description;
- after merge, tell in-flight backend units that `backend-lint` now type-checks.

## Risks

- **Parallel units add errors before this merges.** At freshness, after merging
  `origin/main`, re-run mypy. Fix any new mechanical errors in this unit. If an error needs
  a design change in another unit's code, escalate rather than reshape it.
- **In-flight units go red at their own freshness merge** once the gate lands. This is
  intended. The conductor announces it (close-out), and the fix belongs to each unit.
- **Pins drift from CI's fresh resolve.** They are exact, so they cannot drift. Bumping
  them is a deliberate requirements change, like ruff.
- **`WithAnnotations` is not accepted by the version actually installed.** The trial on
  2.4.0 / 6.1.2 cleared all 8 errors. If a later pin bump breaks it, fall back to a coded
  ignore with a reason, never a blanket one.
- **Settings import in CI fails** (a missing env var turns into a mypy INTERNAL ERROR, as
  measured with no `DATABASE_URL`). The step sets `DATABASE_URL`, and the proof run's log
  must show "Success".

## Verification

- Steps 3 and 4: mypy's error count falls to 0, with no new errors along the way.
- Step 5: the full backend gate is green, and the coverage floor is untouched.
- Step 6: the mutation check is red with the error, green without it, and the failure lines
  are quoted.
- Step 7: the meta proof PR's `backend-lint` log contains "Type check (mypy)" and "Success:
  no issues found". The PR run has 0 non-success jobs except `deploy-staging`.
