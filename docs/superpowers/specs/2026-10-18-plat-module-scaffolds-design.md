---
name: plat-module-scaffolds
phase: v1 (wave 1, platform stream)
modules: [platform, assessment, content, messaging, notifications, engagement, analytics]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Six of the roadmap's ten business modules do not exist yet: `assessment`, `content`,
`messaging`, `notifications`, `engagement` and `analytics`. Eight v1 units build inside
them, and each would otherwise race to append itself to the same three shared files
(`LOCAL_APPS`, `config/api_router.py`, the import-linter contracts in `pyproject.toml`).
This unit writes all six into those files **once**, as empty apps with the narrowest
boundary, so later units only ever widen a contract through their own ADR.

It also replaces the platform contract, which today checks nothing. In
`backend/pyproject.toml` it is `type = "independence"` over `["kaleem.platform"]` alone. An
independence contract only forbids imports *between* the modules it lists. With one module
in the list there is no pair to check, so it can never fail. This was measured on
backend `origin/main` 2401dc7 with import-linter 2.15 (gate image `kaleem-gate:2c8d4dc5e9bb`,
re-run 2026-10-18). A one-line
`import kaleem.billing.services` added to `kaleem/platform/pagination.py` left it `KEPT`.
A `forbidden` contract over the same source turned `BROKEN` on that same line, and stayed
`KEPT` without it. So platform has no path into a business module today, and the new
contract can land green.

## User flow

None. Nothing here is user-facing. Each empty mount has no routes, so every path under
`/api/v1/<module>/` answers 404, exactly as it does today.

## Data model delta

None. The new apps have no models and no migration files. Each module's foundation unit
writes its own `0001`.

Each app does get an empty `migrations/__init__.py`, on purpose. Django 6.0's
`MigrationQuestioner.ask_initial` (read from source in the gate image) returns `False` for
an app with no migrations package unless that app is named on the command line. So the
gate's label-less `makemigrations --check` would skip a foundation unit's first models
entirely. The test database would still build those tables for an unmigrated app, so the
tests would pass while `migrate` on staging created nothing. The empty package closes that
gap before any model exists. No personal data is stored, so ADR-0023's four data points do
not apply. Expand/contract: no schema change, and no API or cookie change. The previous
release runs unchanged beside this one during the blue-green window.

## API delta

Six empty includes in `config/api_router.py`, each under the existing `/api/v1/` base:
`assessment/`, `content/`, `messaging/`, `notifications/`, `engagement/` and `analytics/`.
Each points at `kaleem.<module>.api.urls`, which sets `app_name = "<module>"` and
`urlpatterns = []`. No endpoint is added. ADR-0029's allowlist is untouched.

## Frontend

None. No route, component or API call.

## Module boundaries

Owned by `platform`, the stream that owns the backend registries (programme plan,
"Backend registries"). Per new module `M`:

- `backend/kaleem/M/`: `__init__.py`, `apps.py` (an `AppConfig` with `name = "kaleem.M"`,
  shaped like `kaleem/curriculum/apps.py`), `services.py` (a docstring naming it the
  module's public API), `api/__init__.py`, `api/urls.py`, `migrations/__init__.py` and
  `tests/__init__.py`.
- A `LOCAL_APPS` entry, appended after `kaleem.curriculum`.
- **Two** forbidden contracts, the shape curriculum has used since its first day:
  - "M imports no business modules except identity". It forbids the other eight
    business modules, transitively (the default).
  - "M does not reach past identity's public API". It forbids `kaleem.identity.models`
    with `allow_indirect_imports = true`. It has no `ignore_imports`: no test imports
    identity's models yet, and import-linter 2.x fails on an ignore that matches nothing.

  Identity-only is deliberately the narrowest boundary. Each edge the roadmap's module map
  draws beyond it (for example analytics to scheduling, or the producers into
  notifications) opens in the unit that needs it, under that unit's ADR. ntf-core opens
  every producer edge into notifications in one PR.
- **Platform contract:** "platform imports no business modules" becomes
  `type = "forbidden"`, with `source_modules = ["kaleem.platform"]`. Its
  `forbidden_modules` lists all ten business modules, transitive. This is boundary rule 4
  in `docs/architecture/overview.md`.
- **Registries:** this is the rule every later registry follows, starting with
  plat-dsar-registry. A registry lives in `platform` and is filled by each module calling
  it from its own `AppConfig.ready()`. The registry never imports a module to collect
  entries. The platform contract above is what makes this enforceable: an import-based
  registry would break it. This unit builds no registry, and the new `AppConfig`s have
  no `ready()`.

Existing contracts need no edit. Identity, billing, curriculum and scheduling already list
all six names as forbidden. Those entries name modules that do not exist yet, so today
they are inert. After this unit they apply to real modules.

## Out of scope

- Models, services, endpoints, migrations and per-module architecture docs. Each module's
  foundation unit writes those.
- Any contract wider than identity-only.
- The export/erase registry (plat-dsar-registry) and `docs/architecture/platform.md`.
- Editing meta docs in this unit. The `docs/architecture/overview.md` "Current state"
  update and the `ISSUES.md` line below are close-out items for the conductor's batched
  docs PR (execution protocol step 12).
- The stale `just new-module` recipe (it writes no `api/urls.py` or `migrations/`, and agents never run
  `just`). This gets one line in `ISSUES.md` (D10).
- Coverage floors. The conductor sets them from CI (dec-floor-ownership).

## Test plan

- `backend/tests/test_module_scaffolds.py`, parametrized over the six modules:
  - the app is installed under its default label, with `name == "kaleem.M"`;
  - `kaleem.M.services` imports;
  - `kaleem.M.migrations` imports (the package exists, so `makemigrations --check` sees
    the app);
  - `config.api_router` holds an include at `M/` whose namespace is `M` and whose module
    is `kaleem.M.api.urls`.

  The versioning test (`tests/test_api_versioning_is_enforced.py`) still covers placement
  under `/api/v1/`. But an empty include yields no route for it to walk, so on its own it
  cannot tell a missing mount from a present one.
- `backend/tests/test_import_contracts_cover_every_module.py` reads `pyproject.toml` and
  `settings.LOCAL_APPS`:
  - the platform contract is `forbidden` and is sourced from `kaleem.platform` alone;
  - its `forbidden_modules` equals the set of business modules in `LOCAL_APPS`;
  - every business module is the source of at least one `forbidden` contract.

  This is the guard for "a list that has to be edited to stay correct". The vacuous
  contract went unnoticed because nothing checked it.
- `lint-imports` mutation checks, each reverted afterwards:
  - a platform-to-billing import must turn the platform contract `BROKEN`;
  - in `kaleem/assessment/services.py`, a billing import must break assessment's sibling
    contract, and a direct `kaleem.identity.models` import must break its mirror.
- Full backend gate green: migrate, `makemigrations --check`, pytest with coverage, ruff,
  and `lint-imports` with 23 contracts kept. That is 11 today, minus the independence
  contract, plus its forbidden replacement, plus 12 new.
- e2e: none. There is no user-facing behaviour, so the D3 table gains no row.

## Open questions

None. The unit cites no decision ids (`decision_ids: []`) and has no human gates.
