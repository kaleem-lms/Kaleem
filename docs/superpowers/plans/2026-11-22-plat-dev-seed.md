---
spec: docs/superpowers/specs/2026-11-22-plat-dev-seed-design.md
status: draft
---

Backend worktree `kaleem-worktrees/backend-plat-dev-seed` and meta worktree
`kaleem-worktrees/meta-plat-dev-seed`, both on branch `feat/plat-dev-seed`. No migration, no
dependency change, no env var, no floor edit.

## Steps

1. [ ] **Guard tests first (red).** Create `kaleem/platform/tests/test_seed.py` with the
   spec's unit tests. Patch `kaleem.platform.management.commands.seed.call_command` and
   set `settings.DEBUG` / `settings.FRONTEND_URL` per test. Parametrize the hosts:
   - accepted: `http://localhost:5173`, `http://app.kaleem.localhost`,
     `http://127.0.0.1:8000`, `http://[::1]:5173`
   - refused: `https://app-staging.kaleem.academy`, `https://app.kaleem.academy`,
     `http://localhost.example.com`, `http://app.kaleem.localhost.example`, and `""`

   Also add `test_refuses_outside_debug`, `test_basic_is_the_default`,
   `test_basic_runs_the_e2e_manifest` (asserts `call_command("seed_e2e_all",
   stdout=...)`, called once) and `test_rich_is_not_a_dataset`. Run with
   `backend-gate.sh <wt> kaleem/platform/tests/test_seed.py` and see every test red.

2. [ ] **Rewrite `seed.py` (green).** Keep the positional `dataset`, but make it
   `nargs="?"`, `choices=["basic"]` and `default="basic"`. Add a module-level
   `_is_local_host(url) -> bool` using `urlparse(...).hostname`. A host is local when it is
   `localhost`, `127.0.0.1` or `::1`, or when its last dot-label is `localhost`.
   `handle` must:
   - raise `CommandError` on `not settings.DEBUG`;
   - raise `CommandError` on a non-local `FRONTEND_URL`, with a message that names
     `DJANGO_FRONTEND_URL`;
   - call `call_command("seed_e2e_all", stdout=self.stdout, stderr=self.stderr)`;
   - write one success line that points to `docs/developer-guide/local-setup.md`, with no
     password.

   Type-annotate it for mypy, and import no business module. Rewrite the module
   docstring to cite the spec. **Mutation-check:** delete the host check and see the
   four refused-host cases go red; restore it. Then delete the DEBUG check and see
   `test_refuses_outside_debug` go red; restore it.

3. [ ] **Dataset test (red, then green).** Create `backend/tests/test_dev_seed_dataset.py`
   (`django_db`, `settings.DEBUG=True`, a local `FRONTEND_URL`). Call the real
   `call_command("seed", "basic")` with nothing patched, then assert the spec's list
   using `identity`, `scheduling` and `assessment` models: the three role profiles, a
   staff user, a `ParentStudent` link, an ACTIVE `TeacherAssignment`, a future SCHEDULED
   session, outcomes `held` and `student_absent`, a past SCHEDULED session with a null
   outcome, and a `SessionReport`. A second test runs the seed twice and asserts that the
   `User`, `Session` and `SessionReport` counts are equal.

   Before step 2 this test fails, because the no-op seeds nothing. **Mutation-check:**
   temporarily change the call to `call_command("seed_e2e")`, which seeds the accounts
   only. The session and report asserts should go red. Then restore the call.

4. [ ] **Full backend gate.** `backend-gate.sh <wt>`: migrate,
   `makemigrations --check`, pytest with coverage (the floor is untouched; seed.py goes
   from 0% to covered), ruff, ruff format, lint-imports and mypy. Commit:
   `feat(platform): seed basic runs the e2e manifest, local hosts only`.

5. [ ] **Meta docs**, committed in the meta worktree:
   - `docs/developer-guide/local-setup.md`, "Test users": replace the fictional list with a
     short role table. One account per role is enough: teacher `e2e.asm.teacher`, student
     `e2e.asm.student`, parent `e2e.asm.parent`, staff `e2e.staff`, plus `e2e.booked`
     for a student with upcoming lessons and a lesson joinable now. Add one line saying
     the password is `E2E_PASSWORD` in `seed_e2e.py`, and rerun `just seed` to refresh
     the time-relative lessons.
   - `docs/architecture/platform.md`: change the seed row from `seed basic|rich` to
     `seed [basic]`, and say it runs the e2e manifest.
   - `ISSUES.md`: add one line saying `just seed` is described as "reset DB" in the
     justfile, the roadmap and CLAUDE.md, but it converges and does not reset.

   Commit: `docs: dev seed account table and platform seed row`.

6. [ ] **Hand-back.** `git merge --no-edit origin/main` (never a rebase), re-run the full
   gate, `gitleaks-range.sh <wt> origin/main..HEAD`, run the floor-touch grep, and check
   that the tree is clean.

## Gates

- `backend-gate.sh` full run, green.
- `gitleaks-range.sh` CLEAN over `origin/main..HEAD`.
- e2e: none by design (spec, D3). CI's e2e job is unaffected: it calls `seed_e2e_all`
  directly, not `seed`.
- D9 click-through: run `just seed` locally (or reproduce the e2e topology from runbook
  section 2) and sign in as each table account. Staging verification does not apply,
  because the command refuses staging.

## Risks

- **The dataset test calls every manifest seed under test settings** (eager Celery, the
  event bus, the earnings ledger written at close-out). CI's e2e job proves the manifest
  only under local settings. If a seed misbehaves under test settings, that is a real
  finding: record it in `ISSUES.md` and assert around it. Do not patch the seed (D10).
  If that cannot be done within scope, escalate.
- **Runtime.** A full manifest run per test, run twice for the convergence test, might
  add several seconds. Keep it to two tests. If it is slow, mark it the way the other
  slow tests are marked, and do not drop it.
- **Append-only rows.** The earnings ledger, for one, may grow on every reseed because
  lessons are closed out again. The convergence test therefore checks only users,
  sessions and reports. Note any growth found in `ISSUES.md`.
- **A developer's `.env` sets a non-local `DJANGO_FRONTEND_URL`.** The command refuses
  and names the variable. That is the intended behaviour, not a bug.
- **Local e2e after manual clicking.** Using the e2e accounts by hand can leave state that
  a local e2e run trips on. Every local e2e recipe seeds first, and the seeds converge,
  so this is documented and not engineered around.

## Verification

Steps 1 to 3 are each red before and green after, with the stated mutation checks. Step 4
is the full gate. Step 6 is the runbook section 3 hand-back block.
