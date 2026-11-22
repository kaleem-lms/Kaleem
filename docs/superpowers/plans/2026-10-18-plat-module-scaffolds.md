---
spec: docs/superpowers/specs/2026-10-18-plat-module-scaffolds-design.md
status: draft
---

# Plan: plat-module-scaffolds

Repos: `backend` (code) only. Meta doc edits are close-out items for the conductor
(step 7). Branch `feat/plat-module-scaffolds`. The backend worktree is
`/home/abdulkhalek/Projects/kaleem-worktrees/backend-plat-module-scaffolds`. Create it from
backend `origin/main` as conductor-runbook section 1 describes.

Agents never run `just`, so every file is written by hand. Below, `M` means each of
`assessment content messaging notifications engagement analytics`, in that order, which is
also the `LOCAL_APPS` order. No migrations. No dependency change. No floor edit.

## Steps

1. [ ] **Red: scaffold test.** Write `backend/tests/test_module_scaffolds.py`, with
   `MODULES` holding the six names and `pytest.mark.parametrize` over them:
   - `test_app_is_installed(m)`: `apps.get_app_config(m).name == f"kaleem.{m}"`.
   - `test_public_api_module_exists(m)`: `importlib.import_module(f"kaleem.{m}.services")`.
   - `test_has_migrations_package(m)`: `importlib.import_module(f"kaleem.{m}.migrations")`.
     Without the package, label-less `makemigrations --check` skips the app's models.
   - `test_api_is_mounted(m)`: in `config.api_router.urlpatterns`, exactly one
     `URLResolver` has `str(p.pattern) == f"{m}/"`. Its `namespace` is `m`, and its
     `urlconf_module.__name__` is `f"kaleem.{m}.api.urls"`.

   Run it with `backend-gate.sh <wt> tests/test_module_scaffolds.py`. All 24 cases fail.

2. [ ] **Red: contract-coverage test.** Write
   `backend/tests/test_import_contracts_cover_every_module.py`. It loads
   `settings.BASE_DIR / "pyproject.toml"` with `tomllib`, and takes
   `business = {a for a in settings.LOCAL_APPS if a != "kaleem.platform"}`.
   - `test_platform_contract_is_forbidden_over_every_business_module`. Find the contract
     named "platform imports no business modules". Assert `type == "forbidden"`,
     `source_modules == ["kaleem.platform"]` and `set(forbidden_modules) == business`.
   - `test_every_business_module_has_a_forbidden_contract`. For each module in `business`,
     some contract has `type == "forbidden"` with that module in `source_modules`.

   This test fails on the platform contract (it is `independence` today). Once step 3
   lands, it also fails for the six new modules until step 4 writes their contracts.

3. [ ] **Green: scaffold the six apps.** For each `M`:
   - `kaleem/M/__init__.py`, empty.
   - `kaleem/M/apps.py`: `class <M>Config(AppConfig)` with
     `default_auto_field = "django.db.models.BigAutoField"` and `name = "kaleem.M"`, the
     same as curriculum. No `ready()`.
   - `kaleem/M/services.py`: a docstring only, "Public API of the M module. Other modules
     import this, never M's models."
   - `kaleem/M/api/__init__.py`, empty.
   - `kaleem/M/api/urls.py`: `app_name = "M"` and `urlpatterns = []`.
   - `kaleem/M/migrations/__init__.py`, empty. No migration file.
   - `kaleem/M/tests/__init__.py`, empty.

   Also:
   - Append the six to `LOCAL_APPS` in `config/settings/base.py`.
   - Add six `path("M/", include("kaleem.M.api.urls"))` lines to `config/api_router.py`,
     after `curriculum/` and before `schema/`.

   Step 1 goes green. Then run `tests/test_api_versioning_is_enforced.py`; it must still
   be green.

4. [ ] **Green: contracts.** Edit `pyproject.toml`:
   - Change the platform contract to `type = "forbidden"` and
     `source_modules = ["kaleem.platform"]`. `forbidden_modules` lists all ten business
     modules, with a comment saying why the independence form was vacuous.
   - For each `M`, add two contracts:
     - "M imports no business modules except identity". It forbids the other eight
       business modules.
     - "M does not reach past identity's public API": `forbidden_modules =
       ["kaleem.identity.models"]` and `allow_indirect_imports = true`. **No
       `ignore_imports`.** import-linter 2.15 fails with "No matches for ignored import"
       on an ignore that matches nothing (probed on 2401dc7).

   Step 2 goes green. Running `lint-imports` must report 23 kept and 0 broken.

5. [ ] **Mutation checks.** Use the focused gate, or `lint-imports` inside the gate image.
   Record each red line, revert the mutation, and confirm green again.
   - Append `import kaleem.billing.services  # noqa: F401` to
     `kaleem/platform/pagination.py`. "platform imports no business modules" must be
     `BROKEN`, and the report must show `kaleem.platform.pagination ->
     kaleem.billing.services`.
   - In `kaleem/assessment/services.py`, add `import kaleem.billing.services`. "assessment
     imports no business modules except identity" must be `BROKEN`.
   - In `kaleem/assessment/services.py`, add `from kaleem.identity.models import User`.
     "assessment does not reach past identity's public API" must be `BROKEN`.
   - Revert step 4's platform hunk. Step 2's platform test must go red.
   - Delete `kaleem.analytics` from `LOCAL_APPS`. Step 1's `analytics` cases must go red.
   - Delete `kaleem/content/migrations/__init__.py`. `test_has_migrations_package[content]`
     must go red.

6. [ ] **Full gate and commit (backend).** Run `backend-gate.sh <wt>`. It must pass with
   rc 0. Commit with explicit paths: the 42 new files, `config/settings/base.py`,
   `config/api_router.py`, `pyproject.toml` and the two tests. Message:
   `feat(platform): scaffold six business modules and make the platform contract real`.
   Commit with `PIP_CONFIG_FILE=/dev/null`.

7. [ ] **Close-out text for the conductor** (execution protocol step 12; not committed
   by this unit):
   - For `docs/architecture/overview.md`: replace the stale "Current state: Phase 0, only
     platform exists" with the real state. Built: identity, billing, scheduling and
     curriculum. Scaffolded, empty and identity-only: the six. Note that the map's other
     edges open under each unit's ADR.
   - For `ISSUES.md`, one line: `just new-module` writes no `api/urls.py` and no
     `migrations/__init__.py`, and is out of date with the scaffold shape.

8. [ ] **Hand-back.** Run runbook section 3's five checks: contained, clean tree, gitleaks
   range CLEAN, floor grep empty. Then send the hand-back block, which includes the step-5
   red lines.

## Gates

- TDD loop: `/home/abdulkhalek/Projects/kaleem-worktrees/_tools/backend-gate.sh <wt> <test path>`.
- Full: `/home/abdulkhalek/Projects/kaleem-worktrees/_tools/backend-gate.sh <wt>`. This runs
  migrate, `makemigrations --check`, `pytest --cov=kaleem --cov=signaling`, ruff check and
  format, and `lint-imports`.
- `/home/abdulkhalek/Projects/kaleem-worktrees/_tools/gitleaks-range.sh <wt> origin/main..HEAD`.
- No dashboard or marketing gate, because neither is touched. No e2e: the spec has no
  user-facing behaviour, and the D3 table gains no row.

## Risks

- **Label clash.** The default labels are the module names. None clashes with an installed
  app (`contenttypes` and `messages` are different labels). Step 1's `get_app_config(m)`
  would catch a clash.
- **A transitive platform path appears before merge.** The forbidden contract is
  transitive. If another unit merges first and gives platform an import chain into a
  business module, step 6 goes red. Fix the chain, never the contract. If the chain is
  legitimate, escalate.
- **Contract-name drift.** Step 2 finds the platform contract by name. Renaming it breaks
  the test loudly, which is the intended behaviour.
- **Shared-file conflicts** with plat-dsar-registry and the module foundation units in
  `base.py`, `api_router.py` and `pyproject.toml`. This unit merges first (programme merge
  order), so later units rebase onto these lines rather than racing to add them.
- **Coverage.** Every new file is imported at startup or by step 1, so nothing appears
  as an unimported 0% file. The floor is the conductor's to set (dec-floor-ownership).
- **Blue-green.** No migration files, models or tasks, and no change to any existing route. The
  old colour is unaffected.

## Verification

- Steps 1 and 2 are each seen red before their green step.
- Every step-5 mutation is seen red, then reverted to green.
- The full backend gate passes with rc 0, with `Contracts: 23 kept, 0 broken.`
- CI on the meta proof PR is green, including `backend-lint` (`lint-imports`).
- After deploy: staging `GET /api/v1/assessment/` returns 404, and the health probes stay
  green. This proves the apps load in the production settings, with no route exposed.
