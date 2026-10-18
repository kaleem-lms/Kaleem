---
name: rch-load-test-harness
phase: v1 (wave 1, ops stream; roadmap E4 "load test with k6")
modules: [loadtest harness (infra), identity + scheduling seed commands (backend)]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Nothing in kaleem measures how the API behaves under concurrent use. `rch-redis-caching`
may only cache reads that are *measured* as hot, and `rch-capacity-measurement` needs a
harness it can point at throwaway VPSes. This unit builds that harness:

1. **Real user journeys** in k6, using the same requests the dashboard sends, with a real
   session cookie and real CSRF on writes.
2. **A load-seed command pair** that creates a matched, booked population of synthetic
   accounts.
3. **Metrics capture**: per-endpoint latency, resource use per container, and the top SQL
   statements.
4. **A baseline**: one recorded run on a local, production-shaped stack. It is a regression
   reference, **not** a capacity figure. Capacity per VPS size is `rch-capacity-measurement`.

Where the capacity runs happen is the open decision `rch-d-loadtest-env`. That decision
blocks only `rch-capacity-measurement`, not this unit, because nothing here leaves the
developer's machine.

## What exists today (origin/main: backend 18888b2, infra 962c8b5)

- No load tooling anywhere. The roadmap (E4) names k6 or locust; the programme picked k6.
- `infra/monitoring/` is a dead Prometheus/Grafana/Loki skeleton. It scrapes a `/metrics`
  endpoint Django does not serve. `lb-uptime-host-alerts` owns fixing or retiring it.
  **This unit does not touch `infra/monitoring/`.** That removes the overlap the programme
  lists as a shared file. Metrics come from k6, `docker stats` and `pg_stat_statements`,
  which need nothing from that stack.
- The fixture seeds (`seed_e2e`, `seed_e2e_matching`) build five accounts. They refuse to
  run with `DEBUG=False`, and so does `billing.services.grant_dev_subscription`. The load
  seed follows the same split (identity makes accounts; scheduling makes the state) and the
  same guard.
- Production serves the API through gunicorn (`--workers 3 --timeout 120`) behind Traefik
  v3 with `config.settings.production`. That means `Secure` cookies, `SECURE_PROXY_SSL_HEADER`
  and `ATOMIC_REQUESTS`. A plain-HTTP target would not carry a `Secure` session cookie, so
  the harness puts TLS in front, as production does.

## The harness (`infra/loadtest/`)

| Piece | What it is |
| --- | --- |
| `docker-compose.loadtest.yml` | Project `kaleem-loadtest`, one private network, **no published ports**. `postgres:18-alpine` (with `pg_stat_statements` preloaded) and `redis:8-alpine`, matching production. `django` is the backend's `--target production` image, running production's gunicorn command with `config.settings.production`. `traefik` uses the same `v3` line as production, with a file-provider router `api.kaleem.localhost` → `django:8000`, TLS on its default self-signed certificate. `k6` is `grafana/k6`, pinned by digest. |
| `run.sh <smoke\|baseline> <backend-dir>` | Builds the production image from the given backend checkout. Generates a per-run secret key, DB password and account password (`openssl rand`), held only in the process environment. Brings the stack up from an empty volume and migrates. Seeds through a one-off container (below). Runs k6 while a sampler records `docker stats`. Then collects results and runs `down -v` on every exit path (`trap`). |
| `k6/lib/target.js` | The **target guard**: the base URL's host must be `localhost`, `127.0.0.1` or a `*.localhost` name. Any other host is refused at init, with no request sent, unless `K6_ALLOW_TARGET` names that exact host. TLS verification is skipped only for `*.localhost` targets. |
| `k6/lib/session.js` | Login the way the dashboard does it: `GET identity/csrf/`, then `POST identity/login/` with `X-CSRFToken`, `Origin` and `Referer` set to the app origin. Writes send the same three. Each VU logs in once, and `noCookiesReset` keeps the session across iterations, as a real session lasts. |
| `k6/journeys/{student,teacher,parent}.js` | One iteration is one dashboard visit (below). Every request has a `name` tag (the URL template) and a declared expected status. Anything else fails a check. |
| `k6/main.js` | Scenarios. **smoke**: one VU per role, one iteration each; thresholds `checks == 100%` and `http_req_failed == 0`. **baseline**: ramping VUs (default up to 100) with a role mix of 60% students, 25% parents and 15% teachers. Thresholds are recorded but not enforced, except `checks > 99%`. |
| `results/` (gitignored) | One directory per run: `summary.json` (k6 `handleSummary`, per-`name` p50/p95/p99, RPS, errors), `stats.jsonl` (CPU and memory every 5 s per container), `pg_top.csv` (the top 20 statements by total time), `meta.json` (backend and infra SHAs, k6 version, host CPU and RAM, scenario parameters). |

### Journeys (the dashboard's own request sets, read from `dashboard/src/features/*/api.ts`)

- **Student**:
  - reads: `identity/me/`, `scheduling/sessions/`, `scheduling/quota/`,
    `scheduling/slots/`, `scheduling/assignments/`, `scheduling/match-requests/mine/`,
    `billing/me/subscription/` and `curriculum/me/student-subjects/`;
  - in one iteration in five: `PUT curriculum/me/student-subjects/` with the subject set
    just read, unchanged.
- **Teacher**:
  - reads: `identity/me/`, `scheduling/match-offers/`, `scheduling/sessions/`,
    `scheduling/assignments/`, `scheduling/me/availability/` and
    `curriculum/me/teacher-subjects/`;
  - in one iteration in five: `PUT scheduling/me/availability/` with the body just read,
    unchanged.
- **Parent**: reads only. `identity/me/` (the payload includes the children),
  `scheduling/assignments/` (the children's), `billing/plans/` and
  `billing/me/subscription/`.
- Think time of 1–3 s between requests and 5–15 s between iterations.

Expected statuses follow today's behaviour. For example, `slots/` answers 404 for a
student with no weekly time (`ISSUES.md`). Every write is idempotent, so a run's data
state does not drift.

**Left out on purpose:**
- `sessions/<id>/join/` and the signaling WebSocket. Join makes a video-provider call and
  is throttled per user. Media and signaling load belong to `rch-capacity-measurement`.
- Checkout and portal, which redirect to Stripe.
- Registration, verification and password reset, which need an inbox.
- Cancel and complete, which consume the seeded state.

## Load seed (backend)

| Command | Module | Does |
| --- | --- | --- |
| `seed_load_accounts --students S --teachers T --parents P` | identity | Upserts `load.student.NNNNN@`, `load.teacher.NNNNN@` and `load.parent.NNNNN@load.kaleem.test`. Each gets a verified primary `EmailAddress`, its profile, and the password from `LOADTEST_PASSWORD`. That password is hashed **once** and the hash is assigned to every account, so seeding 1,000 users does not cost 1,000 Argon2 rounds. Parent `j` is linked (`ParentStudent`) to students `2j` and `2j+1`. Upsert only, with no prune: a fresh volume is the reset. |
| `seed_load_scheduling --students S --teachers T [--unmatched-every N]` | scheduling | Calls only the services `seed_e2e_matching` already uses. It does four things. (1) Gives every account the `quran` subject, and every teacher gender `male` plus availability on all seven days, 06:00–22:00 UTC. (2) Gives every student a dev subscription. (3) Leaves every Nth student (default 10) **open**, with all-week availability, so teachers' offer lists are non-empty. (4) Assigns each other student to teacher `i mod T` through `matching.accept_offer`, then has it claim a unique weekly hour through `booking.claim_slot`; that call generates the sessions. The hour is `(k mod 7, 06:00 + k div 7)` for the student's index `k` within its teacher, which gives a capacity of 112 students per teacher. Over that, it refuses before writing anything. Resets only load-domain students' scheduling rows (Session → RecurringSlot → TeacherAssignment → MatchRequest, the order `seed_e2e_matching` uses), so it converges on a second run. |

**Controls on both commands.** Each must hold, or the command raises `CommandError`
before it writes anything:

1. `settings.DEBUG` is true. This is the convention its sibling seeds follow, and the
   condition `grant_dev_subscription` itself enforces.
2. The connected database's name contains `loadtest`. Staging and production databases
   never do, so an accidental run there fails closed with no new setting or env var.
3. `LOADTEST_PASSWORD` is set and at least 16 characters long. No password is written in
   the repo. `run.sh` generates a fresh one each run.

`run.sh` seeds through a one-off `django` container with `DJANGO_DEBUG=True`. The serving
containers run with `DEBUG=False`, so the measured stack is production-shaped while the
fixture guards stay as they are. Both commands use the same email format. A test that runs
one command after the other catches the two drifting apart. That test replaces the shared
constant that the import contracts would forbid.

## Personal data (ADR-0023)

None. Every account is synthetic, on the reserved `.test` TLD, which cannot receive mail.
It exists only in a throwaway Postgres volume that `run.sh` destroys on exit. Nothing
reaches staging or production, and `results/` holds timings, container stats and SQL
*shapes* (`pg_stat_statements` normalises literals), not row data.

## Data model / API / Frontend delta

None: no migration, no endpoint, no route, no new setting, no backend dependency. k6 runs
from its container image. `infra/loadtest/` is not in `ship.sh` or in `ci.yml`'s deploy
file list, so no deploy changes (no `hg-shipsh-review` or `hg-vps-env`).
Expand/contract: not applicable.

## Module boundaries

`seed_load_accounts` lives in identity and uses identity's own models, as `seed_e2e` does.
`seed_load_scheduling` lives in scheduling and calls only `identity.services`,
`curriculum.services` and `billing.services`, plus scheduling's own `matching` and
`booking`. That set is inside ADR-0033's contract. No contract changes.

## Out of scope

- Capacity per VPS size, throwaway VPSes and the runbook figures: all
  `rch-capacity-measurement`, gated on `rch-d-loadtest-env` and `hg-loadtest-vps`.
- Acting on what the baseline shows (`rch-redis-caching`, `rch-ratelimit-drf`).
- Prometheus, Grafana or any monitoring wiring (`lb-uptime-host-alerts`).
- A CI job that runs the smoke scenario. This unit leaves `ci.yml` alone; one `ISSUES.md`
  line records it as a follow-up.

## Test plan

- **Backend (pytest, TDD).**
  - Each command refuses each of the three controls with nothing written.
  - The happy path creates the declared counts, with verified primary emails, profiles,
    a password that authenticates and the parent links.
  - It is idempotent: a second run gives the same counts and adopts a changed password.
  - Teachers never have overlapping weekly slots.
  - Every matched student has an active slot and generated sessions.
  - Every Nth student has exactly one open request, and that request appears in a seeded
    teacher's `list_offers_for`.
  - Over-capacity is refused with nothing written.
  - The two commands agree on emails.
- **Harness.**
  - `run.sh smoke` passes: 100% of checks, including one CSRF-protected write per
    writing role.
  - Mutation checks, each seen red:
    - drop `X-CSRFToken` from writes, and smoke fails with 403;
    - point the base URL at a non-local host, and k6 exits non-zero having sent no
      request;
    - remove the database-name guard, and its pytest goes red.
- **Baseline.** One `run.sh baseline` run on the developer machine. The numbers go in
  `docs/runbook/load-testing.md` together with the host conditions.
- **e2e: none, by design.** Nothing changes for a user. Add a D3-table row:
  "`loadtest` harness ❌ by design: no user-facing behaviour; proven by its smoke scenario".

## Open questions

None for this unit. `rch-d-loadtest-env` is open but blocks only `rch-capacity-measurement`.
