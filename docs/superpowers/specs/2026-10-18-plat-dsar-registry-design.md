---
name: plat-dsar-registry
phase: v1 (wave 1, platform stream)
modules: [platform]
status: draft
created: 2026-10-18
closed: null
---

## Goal

ADR-0023 promised a data-subject-request flow "when approaching public launch". Two v1
units deliver it: lb-gdpr-data-export and lb-gdpr-erasure. Eight more units add personal
data to new modules, including children's data. If each unit invented its own export and
erase code, the export would silently miss modules and erasure would leave data behind.

This unit builds the one interface every personal-data module joins, in that module's own
PR. It is a registry in `kaleem.platform` for **export** and **erase** hooks, which each
module fills from its own `AppConfig.ready()`. The registry runs the hooks in a defined
order. It comes with a **contract helper** that any module's tests call to prove its hooks
behave, and a **coverage guard** that turns CI red when a model holding data is not
covered by any hook. It also writes `docs/architecture/platform.md` and an ADR for the
contract.

Retention periods are not part of the interface. Purges belong to each module's own
retention unit.

## User flow

None. No endpoint, no UI and no caller yet. lb-gdpr-data-export and lb-gdpr-erasure are
the first callers.

## Data model delta

None. No model and no migration. The registry is in-process state built at startup.

ADR-0023's four points:

- **What:** the registry stores no personal data. It holds hook functions and model labels.
- **Why:** it is the interface for export and erasure.
- **How long:** export output is built in memory and returned to the caller, which decides
  what happens to it.
- **Who sees it:** only the code that calls the runners, which is the later units. This
  unit adds no caller.

Expand/contract: no schema, API or cookie change. Both colours register the same hooks
at startup, and nothing runs them. The previous release is unaffected.

## API delta

No HTTP API. The Python interface is in `kaleem/platform/personal_data.py`:

- `register_export(name, fn, *, models)` and `register_erase(name, fn, *, models, order=500)`.
  - `name` is `"<app_label>.<topic>"`, for example `"curriculum.subjects"`. A module may
    register several hooks.
  - `models` lists the model labels the hook covers, as strings (`"curriculum.TeacherSubject"`).
    Strings keep platform free of model imports.
  - Registering the same function under the same name again is a no-op, because Django may
    call `ready()` more than once. A different function under a taken name raises
    `ImproperlyConfigured`.
- **Export hook:** `fn(user) -> JSON value`. It must be read-only, deterministic, and
  serializable by `json.dumps` with no `default=`, so dates go out as ISO strings. A user
  with no data in the module gets an empty value, never an error.
- **Erase hook:** `fn(user) -> None`. It removes or anonymizes the user's data in its
  module. The method follows lb-dec-erasure-semantics ("anonymize in place"); the per-model
  choice is the joining unit's. It must be **idempotent**: a second call changes nothing,
  so a failed erasure can simply be retried. It acts on exactly one user. Whether erasing
  a parent touches a child account is caller policy (lb-gdpr-erasure), not hook policy.
- `export_user(user) -> dict[str, JSON]` runs every export hook in name order and keys the
  result by hook name. The file format, including any schema version, belongs to
  lb-gdpr-data-export.
- `erase_user(user)` runs every erase hook in ascending `order`, ties broken by name, in a
  single `transaction.atomic()`. If any hook raises, every database change is rolled back.
  Hooks that touch outside systems (storage, Stripe) defer that work with
  `transaction.on_commit`. Ordering convention, recorded in the ADR: identity's hook runs
  last (`order=900`), so other modules can still resolve relationships through identity's
  services while they erase.
- The hooks are typed against `django.contrib.auth.base_user.AbstractBaseUser`, so platform
  imports no business module.

## Frontend

None.

## Module boundaries

Owned by `platform`. The platform contract (forbidden, over all ten business modules)
already ensures the registry never imports a module to collect hooks.

Joining convention, to be documented in `platform.md`:

- A module's hooks live in `kaleem/<m>/personal_data.py`, which reads its own models.
- `kaleem/<m>/apps.py` gains `ready()`, which imports that file and registers its hooks.
- Business modules already allow `kaleem.platform` imports, so no contract changes.

**Coverage guard** (`backend/tests/test_personal_data_hooks_cover_every_model.py`). For
every concrete model in every installed `kaleem.*` app, the model must be one of:

1. Named in the `models` of at least one export hook **and** one erase hook.
2. Listed in `NOT_PERSONAL` (model label to a one-line reason), for reference data such as
   a catalogue row.
3. In an app listed in `PENDING_EXPORT` or `PENDING_ERASE` (app label to the id of the unit
   that removes the entry).

The guard also checks:

- A hook's name prefix and every model it declares belong to one installed `kaleem.*`
  app, so a module declares only its own models.
- No pending entry is stale. A pending app whose models are all covered fails until its
  entry is removed, so the pending maps can only shrink.
- Every `NOT_PERSONAL` label names a real model.

The guard runs from the root `tests/` directory, as `test_import_contracts_cover_every_module.py`
does today.

The pending maps start with the four modules that hold data today: identity, billing,
scheduling and curriculum.

| Map | Entries | Unit that removes them |
| --- | --- | --- |
| `PENDING_EXPORT` | the four modules | lb-gdpr-data-export ("modules joined so far are exported") |
| `PENDING_ERASE` | the four modules | lb-gdpr-erasure |

The six scaffolded modules have no models yet. Their foundation units (asm-module-foundation,
cur-content-storage, msg-core-backend, ntf-core, eng-points-levels, ana-foundation)
therefore cannot add a model without joining or justifying it. cur-course-structure adds
models to curriculum, which is already pending, so a hook for its new models does not clear
curriculum's entry. The stale check only fires once every curriculum model is covered.

Identity's hooks, registered by the two lb-gdpr units, also own allauth's `EmailAddress`
rows. That is noted in `platform.md`. Third-party apps sit outside the guard because it
only walks `kaleem.*` apps.

**Contract helper** (`kaleem/platform/personal_data_contract.py`):
`assert_hooks_honour_contract(name, *, seed, make_user, assert_erased=None)`. The module
supplies `seed(user)`, which creates its data for one user with no links to anyone else.
The helper raises `AssertionError` naming the broken rule. Using two users, A and B, both
seeded, it checks:

- Export of A is JSON-serializable with no `default=`, and two exports are equal.
- Export issues no INSERT, UPDATE or DELETE, checked with `CaptureQueriesContext`.
- Export and erase of an unseeded user do not raise.
- Erase of A, run twice, leaves A's export the same after the second call as after the
  first.
- B's export is identical before and after A is erased.
- `assert_erased(A)`, if supplied, passes. This is where each module asserts its own
  anonymization.

The helper reads hooks from the global registry by name. Tests that build their own
`Registry()` can pass it in.

## Out of scope

- Any module joining. That includes the four existing modules, which join in lb-gdpr-data-export
  and lb-gdpr-erasure.
- Endpoints, the export file format, re-authentication and the dashboard. All of these
  belong to the lb-gdpr units.
- Retention periods and purge jobs.
- Erasure of linked accounts (parent and child), Django admin `LogEntry` rows, sessions,
  logs and backups. Each belongs to lb-gdpr-erasure or the retention units.
- Coverage floors (dec-floor-ownership).

## Test plan

- `kaleem/platform/tests/test_personal_data.py` uses a fresh `Registry()` and in-memory
  fake hooks. It imports no business module. Its users come from `get_user_model()`.
  - Registration: a valid hook registers. Re-registering the same function is a no-op. A
    second function under the same name raises.
  - `export_user` keys results by hook name and returns them in name order.
  - `erase_user` runs hooks in `order`, ties broken by name.
  - Rollback: a hook that updates the user row and is followed by a hook that raises
    leaves the row unchanged.
  - Commit deferral: work registered with `on_commit` does not run when the transaction
    rolls back.
- `kaleem/platform/tests/test_personal_data_contract.py`: the helper passes a correct fake
  pair. It fails, naming the rule, for each broken fake:
  - an export that returns a `date`;
  - an export that changes between calls;
  - an export that writes, by updating the user row;
  - an erase that is not idempotent;
  - an erase that touches B;
  - an erase that raises for an unseeded user;
  - a failing `assert_erased`.
- `tests/test_personal_data_hooks_cover_every_model.py`: the coverage guard, green with
  the four pending modules.
- Mutation checks are in the plan.
- e2e: none. The unit has no user-facing behaviour, so the D3 table gains no row.
  Contract tests take its place.

## Open questions

None. The unit cites no open decision. It relies on two resolved ones:
lb-dec-erasure-semantics ("anonymize in place") shapes the erase-hook wording, and
dec-spec-approval classifies this spec. The ADR number is allocated by the conductor.
