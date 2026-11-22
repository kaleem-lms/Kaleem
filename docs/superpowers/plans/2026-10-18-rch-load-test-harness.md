---
spec: docs/superpowers/specs/2026-10-18-rch-load-test-harness-design.md
status: draft
---

Repos: `backend` and `infra`, each on `feat/rch-load-test-harness` in
`/home/abdulkhalek/Projects/kaleem-worktrees/<repo>-rch-load-test-harness` (runbook §1), plus
docs in the meta worktree. No migration, no dependency change, no floor edit, no ADR.

## Steps

### Backend (worktree `backend-rch-load-test-harness`)

1. [x] **Account seed: guards first (red).** New
   `kaleem/identity/tests/test_seed_load_accounts.py`. Write these first:
   - `test_refuses_without_debug`: `override_settings(DEBUG=False)` raises `CommandError`
     and leaves `User.objects.filter(email__endswith="@load.kaleem.test")` at 0.
   - `test_refuses_non_loadtest_database`: the test DB name has no `loadtest`, so the
     command raises with nothing written.
   - `test_refuses_missing_or_short_password`: `LOADTEST_PASSWORD` is unset, or is 15
     characters.

   For the happy paths, a fixture patches `connection.settings_dict` with `patch.dict` to
   `NAME="kaleem_loadtest"` and sets a 20-character `LOADTEST_PASSWORD` through
   `monkeypatch`. Then add
   `kaleem/identity/management/commands/seed_load_accounts.py`, guards only.
2. [x] **Account seed: population (red, then green).** Tests:
   - `test_creates_declared_accounts`: `--students 6 --teachers 2 --parents 2` gives
     verified primary emails, one profile each, and `check_password` true.
   - `test_parent_links`: parent 0 is linked to students 0 and 1, and parent 1 to students
     2 and 3.
   - `test_idempotent_and_adopts_new_password`: a second run with a different password
     leaves the counts the same and makes the new password authenticate.
   - `test_hashes_once`: patch `make_password`, and it is called exactly once for six
     accounts.

   Implement with a `load_email(role, i)` helper on the format
   `load.<role>.<i:05d>@load.kaleem.test`, in one `transaction.atomic()`.
3. [x] **Scheduling seed: guards (red, then green).** New
   `kaleem/scheduling/tests/test_seed_load_scheduling.py`. It gets the same three refusal
   tests, plus `test_refuses_over_capacity`: 113 matched students for one teacher raises
   with no `TeacherAssignment` written. The capacity check runs **before** any write.
4. [x] **Scheduling seed: state (red, then green).** Each test first runs
   `call_command("seed_load_accounts", …)`. That doubles as the email-agreement test: if
   the two formats drift, `get_user_by_email` raises. Tests:
   - `test_matched_students_booked`: with `--students 12 --teachers 3 --unmatched-every 4`,
     9 students have an ACTIVE assignment, an ACTIVE `RecurringSlot` and at least one
     `Session`.
   - `test_no_teacher_double_booked`: `(teacher, weekday, start_time)` is unique among
     ACTIVE slots.
   - `test_unmatched_students_open`: students 0, 4 and 8 have exactly one OPEN
     `MatchRequest`, and each appears in `matching.list_offers_for(teacher, today)` for a
     seeded teacher.
   - `test_idempotent`: a second run gives the same counts of assignments, slots, sessions
     and open requests.

   Implement `kaleem/scheduling/management/commands/seed_load_scheduling.py` with
   `seed_e2e_matching`'s service calls and reset order, scoped to load-domain students.
   It must import no `identity.models`, `curriculum.models` or `billing.models`;
   `lint-imports` must pass.
5. [x] **Mutation checks.** For each guard, delete the guard, see its test go red, then
   restore it. Do the same for the capacity pre-check. Record the failure lines for the
   hand-back.
6. [x] **Full backend gate.** `"${R}/_tools/backend-gate.sh" "${WT}"`. It covers migrate,
   `makemigrations --check` (expected: no changes), pytest with coverage at or above the
   current floor (never edited), ruff, `ruff format --check` and `lint-imports`. Commit as
   `feat(loadtest): seed commands for identity and scheduling`, staging the four
   new files by explicit path.

### Infra (worktree `infra-rch-load-test-harness`)

7. [x] **Target guard first (red).** Write `loadtest/k6/lib/target.js` and
   `loadtest/selftest.sh`. Its first case runs the pinned k6 image against
   `BASE_URL=https://example.invalid/api/v1/`. It must exit non-zero and show no
   `http_reqs` in the summary. The case is red until the guard throws at init. Its second
   case runs with `K6_ALLOW_TARGET` set to a different host and must still refuse. Pin
   `grafana/k6` by digest: `docker pull` the current stable 1.x and record the tag and
   digest in a comment.
8. [x] **Stack.**
   - `loadtest/docker-compose.loadtest.yml`, as the spec's table describes. Postgres runs
     with `-c shared_preload_libraries=pg_stat_statements`, and the DB name is
     `kaleem_loadtest`. Django gets dummy Stripe values (the Dockerfile's build-only
     strings), `DJANGO_ALLOWED_HOSTS=api.kaleem.localhost`,
     `DJANGO_COOKIE_DOMAIN=.kaleem.localhost`, and
     `CSRF_TRUSTED_ORIGINS`/`CORS_ALLOWED_ORIGINS=https://app.kaleem.localhost`; secrets
     come from `run.sh`'s environment.
   - `loadtest/traefik/dynamic.yml`.
   - The network alias `api.kaleem.localhost` on Traefik.
   - Nothing published to the host.
   - Check: `docker compose config` is clean, and
     `curl -k https://api.kaleem.localhost/health/ready/` from a container on the network
     returns 200.
9. [x] **Seed through `run.sh`.** Write `loadtest/run.sh` with `set -euo pipefail`,
   `trap 'docker compose … down -v' EXIT`, and every variable braced. It runs the build,
   `up -d`, `migrate`, then a one-off
   `run --rm -e DJANGO_DEBUG=True django python manage.py seed_load_accounts … && seed_load_scheduling …`.
   Defaults: 600 students, 30 teachers and 150 parents; 20 students per teacher stays
   well under 112. Check: the seed exits 0, and the serving container's `DEBUG` is False
   (`manage.py shell -c`).
10. [x] **Session and journeys.** Write `k6/lib/session.js`, `k6/journeys/*.js` and
    `k6/main.js` (the smoke and baseline scenarios, `noCookiesReset: true`,
    `insecureSkipTLSVerify` only for `*.localhost`). Each request carries its `name` tag
    and expected-status list. VU-to-account mapping: `(__VU - 1) % count` per role.
    `selftest.sh`'s third case is `run.sh smoke`, which must end with 100% of checks and
    0 failed requests.
11. [x] **Metrics capture.** The `docker stats --no-stream --format json` sampler, every
    5 s, runs in the background with its PID killed in the trap. After k6 finishes,
    `pg_top.csv` is written from `pg_stat_statements` (top 20 by `total_exec_time`), and
    `meta.json` too. `handleSummary` writes `summary.json` and the text summary.
    `loadtest/.gitignore` ignores `results/`.
12. [x] **Harness mutation checks.**
    - Remove `X-CSRFToken` from writes: smoke goes red with 403 on the two `PUT`s.
    - Weaken the guard to accept any host: selftest case 1 goes red.
    - Restore both. Record the lines.
13. [x] **Commit infra:** `feat(loadtest): k6 journeys, production-shaped stack and metrics capture`,
    with explicit paths. Add one line to `infra/CLAUDE.md`'s Structure list for
    `loadtest/`.

### Baseline and docs (meta worktree)

14. [x] **Baseline run.** Take a heavy slot first, so dashboard gates do not share the
    CPU: `flock` on a free `${R}/_locks/heavy-N.lock`. Then run
    `infra/loadtest/run.sh baseline <backend worktree>`. Record the following:
    - the per-endpoint p50/p95/p99 and error rate;
    - peak CPU and memory per container;
    - the top 5 SQL statements;
    - the host conditions (cores, RAM, other load);
    - the SHAs.

    If the role-mixed p95 of any single endpoint is wildly off, re-run once. Report both
    runs rather than picking one.
15. [x] **Docs.**
    - New `docs/runbook/load-testing.md`:
      - how to run smoke and baseline;
      - the target guard and the `K6_ALLOW_TARGET` opt-in;
      - what the seed's three controls are;
      - what the journeys deliberately leave out;
      - the baseline table, labelled *"a regression reference on one development
        machine, not a capacity figure"*.
    - `CLAUDE.md` D3 e2e table: one row, "`loadtest` harness ❌ by design".
    - `ISSUES.md`: one line, "smoke scenario not yet a CI job".

    Commit as `docs: load-testing runbook and baseline` with explicit paths.

## Gates

- Backend: `backend-gate.sh` focused per test file during TDD; the full gate before
  hand-back.
- Infra has no CI and no hooks. The proof is `selftest.sh`: guard refusal ×2 and smoke
  green, with its output pasted into the hand-back.
- Every repo: `gitleaks-range.sh "${WT}" origin/main..HEAD` → `CLEAN`. The compose file
  carries only the Dockerfile's existing build-only dummy values; no secret is committed.
- Meta: the docs-only change goes through CI's normal docs path.
- **e2e: none.** No user-facing behaviour. Time budget for the harness: smoke at most
  3 min after the image is built; baseline about 10 min.

## Risks

- **TLS and cookies.** If Traefik's default certificate or the `Secure` cookie does not
  reach k6 as expected, smoke shows it at once (login 200, then `me/` 403). The fallback
  is to keep TLS and fix the alias or cookie domain. Never drop to plain HTTP with relaxed
  cookie flags: that would measure a stack production does not run.
- **Seed speed.** `accept_offer` plus `claim_slot` per student is several queries plus
  session generation, so 600 students should take under 2 min. If it is slower, lower the
  defaults rather than bypass the services. Bypassing would seed a state the code never
  produces.
- **Expected statuses** may differ from what the spec assumes (for example, a parent's
  `me/subscription/` answering 404). Smoke tells you. Record the observed status as
  expected only after you have confirmed it is today's intended behaviour. If it looks
  like a bug, it goes to `ISSUES.md` (D10).
- **Noisy baseline.** It shares a 28-core host with other agents' gates. The heavy slot
  and the recorded host conditions are the mitigation. The numbers are a reference, and
  the runbook says so.
- **Scope creep toward capacity work.** Remote targets, VPS sizing and WebSocket load stay
  out (`rch-capacity-measurement`). If any of them seems needed, escalate.

## Verification

Hand-back (runbook §3), per repo:
- the backend full-gate TOTAL line, with every new test listed;
- the six mutation checks (three backend guards plus capacity; CSRF and guard on the
  harness), each red, then green again;
- `selftest.sh` output;
- the baseline `meta.json` and summary table;
- `gitleaks` CLEAN;
- `needs: none`.

## Built as planned, with these differences (2026-10-18)

- **k6 is v2.3.0, not 1.x.** The current stable image at build time reports v2.3.0; it is
  pinned by digest in `infra/loadtest/lib.sh` (step 7).
- **The target guard has its own parser.** k6 has no global `URL`, so `target.js` parses the
  authority by hand and refuses anything it does not understand. `selftest.sh` gained a
  third case, a no-network table of host rules, so the plan's "case 3" smoke run is case 4.
- **A throw inside a k6 iteration exits 0.** The selftest table therefore asserts through
  `check` plus a `checks == 100%` threshold.
- **`K6_HTTP_DEBUG` passes through to the k6 container** for diagnosing a failing journey.
- **Statuses.** Every request in smoke answered 200, so smoke expects only 200. The load
  population keeps `[200, 404]` for a student's `slots/`, because one student in ten is
  unmatched on purpose.
- **Close-out items left to the conductor** (shared files, protocol step 12): the CLAUDE.md
  D3 row for `loadtest`, and the `ISSUES.md` line "smoke scenario not yet a CI job".
- **No architecture-doc change:** the unit adds two management commands and a harness; no
  module's public behaviour changed.
