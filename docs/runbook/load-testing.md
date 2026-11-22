# Load-testing runbook

The k6 harness lives in `infra/loadtest/`. It builds a production-shaped stack on your own
machine, fills it with synthetic accounts, drives the dashboard's real requests against it
and records what happened. Spec:
`docs/superpowers/specs/2026-10-18-rch-load-test-harness-design.md`.

**What it is for:** a regression reference. Run it before and after a change that should
(or should not) move latency, and compare. `rch-redis-caching` may only cache what this
shows is hot; `rch-capacity-measurement` points the same journeys at throwaway servers.

**What it is not:** a capacity figure. One development machine, no network between the
client and the server, no Celery workers, and think times that make 100 users only about
25 requests a second. Do not read "the API handles N users" off any number here.

## Run it

Needs Docker, `jq` and `openssl`. Nothing else is installed on the host.

```bash
# from the infra repo (or its worktree)
loadtest/run.sh smoke    <path to a backend checkout>   # about 1 minute; must end 100% green
loadtest/run.sh baseline <path to a backend checkout>   # about 10 minutes
loadtest/selftest.sh     <path to a backend checkout>   # the harness's own proof (below)
```

`run.sh` builds the backend's `--target production` image from that checkout, so the
numbers belong to that commit. Stage by stage, in a private Docker network with **no
published ports**:

1. Postgres 18 (with `pg_stat_statements`) and Redis 8, from an empty volume; migrate.
2. A one-off container with `DJANGO_DEBUG=True` runs the two seed commands (below).
3. The serving containers start with `DEBUG` off: gunicorn (production's command: 3
   workers) behind Traefik v3 terminating TLS on its self-signed default certificate.
   `run.sh` checks `DEBUG` is False in the serving container and refuses to measure it
   otherwise.
4. `pg_stat_statements` is reset, so the SQL ranking is the load and not the seeding.
5. k6 runs while a sampler records `docker stats` every 5 s.
6. Results are collected and the whole stack, volume included, is removed on every exit
   path.

Overrides, as environment variables: `VUS` (baseline peak, default 100), `RAMP` (2m),
`HOLD` (5m), `STUDENTS` / `TEACHERS` / `PARENTS` (smoke 20/2/5, baseline 600/30/150).
`K6_HTTP_DEBUG=headers` prints every request and response; it is verbose, and it shows
cookies, which are throwaway.

Results land in `infra/loadtest/results/<time>-<scenario>/` (gitignored):

| File | What it holds |
| --- | --- |
| `summary.json` | per-endpoint p50/p95/p99/max, requests per second, error rate, check pass rate |
| `stats.jsonl` | CPU and memory of each container, every 5 s |
| `pg_top.csv` | the 20 statements with the most total time (normalised: no literals, no row data) |
| `meta.json` | backend and infra SHAs (and whether the backend tree was dirty), k6 version, host CPU/RAM, scenario parameters |

Take a heavy slot first (`flock` on a free `_locks/heavy-N.lock`) if other builds share the
machine, and record `uptime`: a noisy host moves the numbers more than most code changes.

## The three controls

**The target guard** (`k6/lib/target.js`). k6 refuses, at init and having sent nothing, any
base URL whose host is not `localhost`, `127.0.0.1`, `[::1]` or a `*.localhost` name. To
aim at another host on purpose, set `K6_ALLOW_TARGET` to exactly that host; one host per
run, no wildcards. TLS verification is skipped only for the local names. The host is
parsed out of the authority, so `https://api.kaleem.localhost@elsewhere.example/` and
`localhost.elsewhere.example` are judged by where the request would really go.

**The seed controls.** `seed_load_accounts` (identity) and `seed_load_scheduling`
(scheduling) each raise `CommandError` before writing anything unless all three hold:

1. `DEBUG` is true, as the e2e seeds require;
2. the connected database's name contains `loadtest` (production and staging never do);
3. `LOADTEST_PASSWORD` is set and at least 16 characters (`run.sh` generates one per run;
   no password is in the repo).

Accounts are on the reserved `.test` TLD, so they can never receive mail, and the seed only
ever touches addresses ending `@load.kaleem.test`.

**The selftest.** `loadtest/selftest.sh [backend-dir]` proves the guard refuses a
non-local target (and that an opt-in naming a different host does not open it), checks the
guard's host rules as a table, and, given a backend checkout, runs the smoke scenario.

## What the journeys do, and leave out

One iteration is one dashboard visit, using the request sets in
`dashboard/src/features/*/api.ts`: log in once per virtual user (real CSRF, a `Secure`
session cookie shared across `.kaleem.localhost`), then read the pages a student, a teacher
or a parent opens, with 1-3 s between requests and 5-15 s between visits. In one visit in
five a student re-saves their subjects and a teacher re-saves their availability, both
unchanged, so writes carry real CSRF without changing the data.

Left out on purpose:

- **Anything that sends email or leaves the stack:** registration, password reset, adding a
  child, checkout, the billing portal. There is no mail catcher or Stripe here, and a
  stand-in would measure the stand-in.
- **Video:** joining a lesson, signaling and TURN. WebSocket load is
  `rch-capacity-measurement`'s question.
- **Celery:** no worker or beat runs, so nothing here measures background jobs.
- **A mixed-version deploy:** one colour only.

## Baseline

*A regression reference on one development machine, not a capacity figure.*

Recorded 2026-10-18 at backend `3a8aefe1c11b` (the seed commands on `18888b2`), infra
`f5339dbc080b`, k6 v2.3.0 (image pinned by digest in `loadtest/lib.sh`). Host: Intel
i7-14700F, 28 logical cores, 31 GiB RAM, load average about 4 before and after (other
agents' builds were running). Population: 600 students (540 matched and booked, 60 open),
30 teachers, 150 parents. Load: 100 virtual users at peak (60 students, 25 parents, 15
teachers), 2 min ramp, 5 min hold, 30 s down. 12,036 requests at 25.4 per second, **0
failed requests, 100% of checks passed**. One run; no endpoint was far enough off to
justify a second.

| Endpoint | p50 ms | p95 ms | p99 ms |
| --- | ---: | ---: | ---: |
| `POST identity/login/` | 69 | 129 | 172 |
| `GET scheduling/match-offers/` | 38 | 75 | 84 |
| `PUT scheduling/me/availability/` | 41 | 63 | 125 |
| `GET scheduling/sessions/` | 29 | 57 | 66 |
| `GET scheduling/match-requests/mine/` | 23 | 52 | 57 |
| `GET scheduling/assignments/` | 23 | 51 | 58 |
| `PUT curriculum/me/student-subjects/` | 27 | 48 | 56 |
| `GET scheduling/quota/` | 21 | 46 | 53 |
| `GET scheduling/slots/` | 21 | 45 | 51 |
| `GET billing/me/subscription/` | 20 | 45 | 49 |
| `GET scheduling/me/availability/` | 21 | 42 | 47 |
| `GET identity/me/` | 17 | 42 | 47 |
| `GET curriculum/me/student-subjects/` | 18 | 39 | 45 |
| `GET curriculum/me/teacher-subjects/` | 19 | 39 | 42 |
| `GET billing/plans/` | 17 | 36 | 40 |
| `GET identity/csrf/` | 10 | 23 | 72 |

| Container | Peak CPU (100 = one core) | Peak memory |
| --- | ---: | ---: |
| django (gunicorn, 3 workers) | 111 | 263 MiB |
| postgres | 68 | 53 MiB |
| redis | 5 | 15 MiB |
| traefik | 9 | 72 MiB |

Top statements by total time, over the run:

| Calls | Total ms | Statement |
| ---: | ---: | --- |
| 11,836 | 693 | `SELECT ... FROM identity_user WHERE id = ...` |
| 1,217 | 528 | `SELECT ... FROM scheduling_session ...` |
| 7,331 | 421 | `SELECT ... FROM identity_studentprofile ...` |
| 11,836 | 377 | `SELECT ... FROM django_session WHERE session_key = ...` |
| 1,217 | 313 | `SELECT ... FROM scheduling_teacherassignment ...` |

Read this the way the numbers allow. Every authenticated request costs one session lookup
and one user lookup (11,836 each, one per request after login), which is why those two
lead a ranking with sub-millisecond means. The slowest reads are the scheduling lists.
Nothing was near saturation: gunicorn used a bit over one of its three cores' worth.
That is the arithmetic of 100 virtual users who spend most of their time reading: it says
the stack is not slow at this load, and nothing about where it stops being fast.
