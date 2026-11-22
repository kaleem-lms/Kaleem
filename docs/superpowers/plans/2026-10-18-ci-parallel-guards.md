---
spec: docs/superpowers/specs/2026-10-18-ci-parallel-guards-design.md
status: draft
---

# Plan: ci-parallel-guards

Branches: `feat/ci-parallel-guards` in `backend` (worktree
`kaleem-worktrees/backend-ci-parallel-guards`, made as runbook §1 says) and in meta (this
worktree). Backend lands first. The meta PR then carries the ci.yml change, the docs line
and the backend pin. It merges after `inf-ci-actions-v7` (`merge_after`).

There are no migrations. The dependencies, the floors and `CLAUDE.md` stay unchanged.

## Steps

1. [ ] **The manifest runner. Tests first.** Create
   `kaleem/platform/tests/test_seed_e2e_all.py` with these tests, all `django_db`,
   using `settings.DEBUG = True` unless stated:
   - `test_runs_entries_in_manifest_order`: write a temp manifest with two entries
     separated by a comment and a blank line, and pass it as `--manifest <tmp>`. Patch
     the module's `call_command` and assert the calls in order.
   - `test_refuses_an_empty_manifest`: the file holds only comments and blank lines.
     Expect `CommandError`.
   - `test_refuses_a_duplicate_entry`: expect `CommandError`, with nothing run.
   - `test_refuses_an_unknown_command_before_running_any`: use a valid entry first and
     a bogus one second. Expect `CommandError`, with the valid entry not run. Validate
     against `django.core.management.get_commands()`.
   - `test_refuses_outside_debug`: `DEBUG=False`. Expect `CommandError`, with nothing run.
   - `test_shipped_manifest_is_todays_ci_order`: the default manifest parses to exactly
     `["seed_e2e", "seed_e2e_matching"]`.

   See all six fail, then write `kaleem/platform/management/commands/seed_e2e_all.py`.
   It reads `--manifest`, which defaults to `settings.BASE_DIR / "config" /
   "e2e_seeds.txt"`, validates every entry, then runs `call_command(name)` for each.
   Also write `config/e2e_seeds.txt`, whose header comment explains the format, the
   append rule and the sweep rule (spec, Goal). Use no import of any business module.

2. [ ] **Narrow the fixture's sweep. Test first.** In
   `kaleem/scheduling/tests/test_seed_e2e_matching.py`, add
   `test_it_does_not_generate_sessions_for_other_students`. Create a bystander teacher
   and student, then `TeacherAssignment(ACTIVE)` + `RecurringSlot(ACTIVE)` +
   `billing_services.grant_dev_subscription(bystander)` with no sessions. Run `seed_e2e`
   and `seed_e2e_matching`. Assert the bystander has 0 `Session` rows. See it fail, then
   change `seed_e2e_matching.py`'s `booking.generate_sessions()` to
   `booking.generate_sessions(student_id=booked_student.id)`. Mutation-check: revert the
   one-line change and see red.

3. [ ] **Backend gate and commit.** Run `backend-gate.sh <wt>
   kaleem/platform/tests/test_seed_e2e_all.py
   kaleem/scheduling/tests/test_seed_e2e_matching.py`, then the full `backend-gate.sh
   <wt>`, which includes `makemigrations --check --dry-run`. Commit with two
   Conventional Commits: `feat(platform): seed_e2e_all runs an ordered e2e seed
   manifest` and `fix(scheduling): seed_e2e_matching sweeps only its booked student`.

4. [ ] **Migration-check mutation, local only.** In the backend worktree, add a throwaway
   field to any model. Run `backend-gate.sh <wt>` and see it fail at `makemigrations
   --check`. Discard the change (`git checkout -- <file>`) and confirm the tree is clean.
   The mutation is never committed.

5. [ ] **ci.yml (meta).**
   - In `backend-test`, after "Run migrations", add a step named "Check for missing
     migrations" that runs `python manage.py makemigrations --check --dry-run`, with a
     one-line comment saying why `migrate` alone is not enough.
   - In `e2e`, replace the two seed lines with `python manage.py seed_e2e_all`, and add a
     comment that points units at `backend/config/e2e_seeds.txt`.
   - After "Start signaling", add "Start the Celery worker". It runs
     `nohup celery -A config.celery_app worker -l info --concurrency=2 > /tmp/celery.log
     2>&1 &` in `backend`, with no `-B`. Then add "Prove the worker executes a task",
     which runs `python manage.py shell -c` and does three things:
     - dispatches `kaleem.platform.tasks.send_email_message.delay(...)` to an
       `@kaleem.test` address;
     - calls `.get(timeout=60)` on the result (the result backend is the broker Redis);
     - on failure, prints `/tmp/celery.log` and exits 1.

     The locmem backend means nothing leaves the runner.
   - Add `/tmp/celery.log` to the failure artifact's `path`.
   - Self-check: `actionlint` if available, and `python -c 'import yaml;
     yaml.safe_load(open(".github/workflows/ci.yml"))'`.

6. [ ] **Worker mutation, local, in an e2e slot (runbook §2).** Start the slot with no
   worker. The probe snippet must time out, which is red. Start the worker and the probe
   must pass. Record both outputs for the hand-back.

7. [ ] **Docs.** Add a short "e2e fixtures" paragraph to
   `docs/developer-guide/testing.md`. It covers what to add: a DEBUG-guarded
   `seed_e2e_<x>` and one manifest line. It covers order: run order is file order, and a
   seed that changes shared state must scope its sweeps. It also says the e2e job runs a
   worker but no beat. Commit with `ci: migration check, seed manifest and a Celery
   worker in e2e`, plus `docs: e2e seed manifest`.

8. [ ] **Hand back** with runbook §3's five checks and its block. The conductor pushes,
   opens the backend PR and the draft meta PR with the pin, and updates the `_ops` e2e
   slot recipe to `seed_e2e_all`.

## Risks

- **The worker changes e2e behaviour.** Today queued emails are never sent. With a
  worker, they are sent through locmem inside the worker process. No current flow
  observes mail, and `send_email_message` writes no rows. Fallback: if an existing spec
  turns red, that is a real finding. Report it and do not drop the worker.
- **The probe hangs.** `.get(timeout=60)` bounds it, and the job keeps its 15-minute
  timeout.
- **Cross-seed matching.** `sync_match_requests()` is global and runs on every matching
  read, so a later seed's entitled, unassigned student with an interest gets a request,
  which can become a second offer for `e2e.teacher` and break the "exactly one offer"
  flows. The manifest header and the testing guide say so; reviewers of seed-adding
  units check it.
- **Manifest merge conflicts.** Units appending at the same end of the file conflict at
  freshness. The rule, stated in the file's header: keep both lines, in dependency
  order.
- **ci.yml overlap with `inf-ci-actions-v7`.** That unit bumps `upload-artifact` in the
  same block this unit extends. `merge_after` orders it first, and the conductor
  resolves the hunk at freshness.
- **Local coverage differs from CI's.** Never touch the floor. The conductor sets it
  (`dec-floor-ownership`).

## Verification

- Backend: the six runner tests and the bystander test are red first and green after.
  The bystander test goes red again when its fix is reverted. The full `backend-gate.sh`
  exits 0, and ruff, format and lint-imports are clean.
- Migration check: step 4's local red, then the PR run log shows "Check for missing
  migrations" ran with "No changes detected".
- Seed manifest: the PR run's e2e log shows both seeds' success lines, printed by
  `seed_e2e_all`.
- Worker: step 6's local red and green. The PR run shows the probe green and every
  existing e2e test passing, with no new flow (D3 table unchanged). Read the e2e log for
  the probe line.
- `gitleaks-range.sh` reports clean over `origin/main..HEAD` in backend, and the meta
  `security` job is green.
