---
name: plat-mypy-gate
phase: v1 (wave 2, platform stream)
modules: [ci]
status: draft
created: 2026-10-18
closed: null
---

## Goal

The roadmap names mypy as a gate ("lint → type → test", Phase 0 exit criteria) and
CLAUDE.md says `just lint` runs it. Neither is true: `backend/pyproject.toml` configures
mypy (`[tool.mypy]`, django-stubs and DRF plugins, `check_untyped_defs`,
`warn_unused_ignores`), but no CI job, pre-commit hook or `just` target runs it, and it is
red. The owner chose to fix and gate it (`dec-mypy-gate`, ADR-0045). This unit makes
`mypy .` clean on backend and adds a type-check step to ci.yml's `backend-lint`, so the
next type error fails the PR instead of accumulating.

**Measured size.** On backend `origin/main` 18888b2, in gate image
`kaleem-gate:2c8d4dc5e9bb` (mypy 2.4.0, django-stubs 6.1.2, djangorestframework-stubs
3.18.1), `mypy .` reports **36 errors in 14 files** (271 files checked, about 5 s cold). The
programme's "14" is ISSUES.md's 2026-09-13 count (14 errors in 5 files). It has grown with
new code and with unpinned stub upgrades. The 36 split as follows:

| Where | Errors | Root cause |
|---|---|---|
| `kaleem/scheduling/services.py` | 8 | `ends_at` is an `.annotate()` field, but `_sessions()` / `_session_scope()` return a plain `QuerySet[Session]`, so django-stubs cannot see it |
| `kaleem/scheduling/rooms.py` | 1 | the `VideoProvider` Protocol omits `name`, which both concrete providers define |
| `kaleem/scheduling/matching.py` | 1 | `rows` is rebound from a QuerySet to a list |
| `config/settings/{test,local}.py`, `test_diagnostics_api.py` | 4 | `REST_FRAMEWORK` / `LOGGING` in `base.py` are inferred as `dict[str, object]` |
| `tests/stripe_clock/*` | 11 | `datetime | None` arithmetic, `Subscription | None`, `IO | None` |
| other tests (7 files) | 11 | `None` passed as a request, untyped empty lists, a reused loop variable, a deliberate write to a frozen dataclass, `SimpleNamespace` standing in for a WebSocket, a union-typed `urlconf_module` |

Production code fixes are typing-only. They change no runtime behaviour. One trial in a
scratch copy confirmed the approach: `WithAnnotations[Session, ...]` clears all 8
`services.py` errors, `name: str` on the Protocol clears `rooms.py`, and annotating
`base.py`'s dicts clears the `test.py`/`local.py` ones. `lint-imports` stayed green with
23 kept and ruff stayed clean.

## User flow

None. A developer whose PR adds a type error sees `backend-lint` fail at a step named
"Type check (mypy)", with mypy's error lines in the log.

## Data model delta

None. No migration.

## API delta

None.

## Frontend

None. This is a backend CI gate.

## Module boundaries

The unit touches typing only, inside `scheduling`, `config` and tests. The only new import
is `from django_stubs_ext import WithAnnotations` in `kaleem/scheduling/services.py`, under
`if TYPE_CHECKING:`, so production never loads it. `django-stubs-ext` is already installed,
because `django-stubs` requires it. No contract changes.

**Pins.** The type checker and its stubs are unpinned today (`mypy>=1.10`,
`django-stubs>=5.0`, `djangorestframework-stubs>=3.15`). CI resolves them fresh on every
run, so a stub release could turn an unchanged tree red. That is the reason ruff is already
pinned in the same file. This unit pins `mypy`, `django-stubs`, `django-stubs-ext` and
`djangorestframework-stubs` with `==` in `requirements/local.txt`, at the versions measured
clean. That is a requirements change, so the gate image key changes (see the plan).

## Personal data (ADR-0023)

None is collected, stored or shown.

## Expand/contract

Not applicable. The change has no schema, API or cookie surface, and the CI step has no
deploy-time effect.

## Out of scope

- A pre-commit mypy hook. It needs the full Django dependency set inside pre-commit's
  isolated environment. CI plus `just lint` is the gate.
- Making mypy stricter (`disallow_untyped_defs` and similar), and annotating untyped code.
  This unit is about clean and gated, not stricter.
- Excluding tests from mypy. `mypy .` checks tests today, and the gate keeps that.
- Adding mypy to `_tools/backend-gate.sh`. It is conductor-owned and outside every repo;
  the plan lists it as a conductor follow-up.

## Test plan

- `mypy .` in backend exits 0 with "Success: no issues found".
- Mutation check: add a deliberate type error to a kaleem module. `mypy .` then exits 1
  naming that line, and the same error placed in a tests file is caught too. Revert, and it
  exits 0.
- The full backend gate stays green: tests, coverage floor, ruff and lint-imports. No floor
  is touched.
- The proof PR's CI run shows the new step running and passing in `backend-lint`, with the
  "Success" line in its log.

## Open questions

None. `dec-mypy-gate` is resolved ("Fix and gate"). Decisions made here, not by the owner:
pin exact versions, and annotate typed hooks such as `WithAnnotations` and the Protocol
attribute instead of adding `# type: ignore`. A targeted ignore is acceptable only where a
test deliberately does something ill-typed, such as asserting a frozen dataclass refuses
writes. `warn_unused_ignores` keeps every such ignore honest.
