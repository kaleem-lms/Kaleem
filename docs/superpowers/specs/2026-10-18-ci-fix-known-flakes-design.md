---
name: ci-fix-known-flakes
phase: D
modules: [dashboard (e2e, vitest)]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Remove the two known sources of spurious red in the dashboard's merge gates, so that from
here on a pass-on-rerun is always reported as a finding with its run URL (ADR-0027 §5)
rather than explained away as "the known flake":

1. **`call.spec.ts` "the lobby has a way back to the schedule"** asserts
   `Math.round(boundingBox().height) >= 44` on the lobby exit. It failed at 43 on meta#221
   (first run and retry) and passed on a fresh runner at the same commit. It also fails
   locally at 43 (runbook §2). `boundingBox()` returns the painted box. It does not show the
   area that accepts a pointer, and a single sub-pixel difference makes a correct `h-11`
   control fail.
2. **The vitest suite drops a test file when the host is loaded.** jsdom throws
   `SyntaxError: Invalid or unexpected token` inside `installInterfaces` → `createWindow`.
   One file goes missing, every test that ran passes, and the process exits non-zero. This
   happens in about 1 run in 4 on a loaded machine (ISSUES.md, "Known-good gotchas").

Grounded at dashboard `origin/main` 9d21e01. Versions: `vitest` 3.2.6, `jsdom` 29.1.1.
`pool` is unset, so it is forks, the vitest 3 default. CI runs `pnpm test:coverage` with the
default worker count, and the local gate passes `--maxWorkers=6`. Playwright `retries` is 1
in CI and 0 locally.

No personal data is touched (ADR-0023: none collected, none retained, nobody new sees
anything). No decision ids apply.

## User flow

There is no user-facing change. The person affected is the developer or agent reading a
CI result: a red result means a real failure.

## Data model delta

None. No migrations.

## API delta

None.

## Frontend

There is no route, component or behaviour change. `ExitToSchedule` stays `h-11` and is not
edited. Only one comment in `ExitToSchedule.test.tsx` changes: it currently says the e2e
"measures a bounding box", and after this unit it does not.

### Fix 1: the lobby exit is checked by hit-testing

Replace the `boundingBox()` height assertion in `call.spec.ts` with a hit-test that works
the way `touch-targets.spec.ts` does. Scroll the exit into view, take its centre, and
require `document.elementFromPoint` at the four corners `(±REACH, ±REACH)` to resolve to the
exit or to one of its descendants.

- **`REACH = 21`.** The probe points span 42px, so a target that accepts 43px or more
  passes and a 40px target fails. The 44px goal stays (it is the iOS escape hatch this test
  exists for, and the project prefers 44px). The 1px of tolerance is stated in a comment
  with its reason (sub-pixel layout on different runners), so it is not hidden inside
  `Math.round`.
- The check is a few lines written inline in `call.spec.ts`. `touch-targets.spec.ts` is not
  refactored into a shared helper (D10).
- As a side effect, the check also fails if something is painted over the exit, because
  `boundingBox()` cannot see an overlap and a hit-test can.

### Fix 2: stop the jsdom crash under load

The fix is chosen by measurement, not guessed. Remedies are tried in this order, and the
first one that passes the acceptance bar below is shipped:

- **A. Cap the pool in `vitest.config.ts`.** Use `test.maxWorkers` or
  `poolOptions.forks.maxForks`, with the value taken from the measurement, together with a
  comment that cites this spec. This is a config-only change, and a CLI `--maxWorkers`
  still overrides it.
- **B. Pin the jsdom/vitest pair** to versions under which the crash does not reproduce.
  This changes the lockfile, so the conductor must first allocate dashboard's dependency
  slot (execution protocol step 4). The lockfile is written with `npx -y pnpm@10.28.0
  install`. This counts as "pinning an existing dev dependency", not adding a new one.

**Acceptance bar.** The repro harness in the plan is run before and after the change, under
the same load both times: pinned to 4 cores like CI's runner, with CPU burners on those
same cores.

- Before, on `origin/main`: at least 2 crashes in 12 runs.
- After: 0 crashes in 24 runs.

At the observed rate of 1 in 4, 24 clean runs happen by chance less than 0.1% of the time.
A crash is counted when either of these holds:

- the reported file count is below the number of test files;
- the output contains `installInterfaces`.

The coverage thresholds are never touched (dec-floor-ownership). The wall-clock time of
`pnpm test:coverage` must not rise by more than 25% against the before figure on the same
host.

## Module boundaries

Only test infrastructure in `dashboard` changes. No backend change, no import-linter
contract change, no new events.

## Out of scope

- Loosening the lobby check to the 24px of SC 2.5.8, or changing `ExitToSchedule`.
- Refactoring `touch-targets.spec.ts`, or its `/login` flake that runbook §2 mentions. That
  is a separate entry if it recurs in CI.
- Raising Playwright `retries` or adding vitest `retry`. Both would hide flakes instead of
  removing them.
- Other flakes in ISSUES.md: `availability.spec.ts`, and the C3a seed-age time bomb.
- Coverage floors.

## Test plan

- **Fix 1, red before green.** Locally (e2e slot), the current assertion fails at 43px on
  `origin/main`, and the hit-test version passes on the same build.
- **Fix 1, mutation check.** With `ExitToSchedule`'s `h-11` changed to `h-10`, the new check
  goes red. With it reverted, the check goes green. A second mutation, an overlay `div`
  placed on top of the exit, also goes red.
- **Fix 2.** The acceptance bar above, with before/after counts and wall-clock times
  recorded in the PR body.
- **Unchanged:** the full dashboard gate stays green (tsc, biome, coverage floors, build),
  the e2e suite in CI stays green with no retry used, and the new test name appears in the
  e2e log.
- **e2e time budget:** under +0.5s on the lobby flow, which takes about 1.6s today.

## Open questions

None. If the before-run cannot reproduce the crash, the plan stops and escalates. It does
not ship a fix that has not been proven.
