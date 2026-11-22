---
name: rch-redis-caching
phase: v1 programme (wave 2, ops stream)
modules: [platform (backend `kaleem/platform`), settings (backend `config/settings`), infra (compose, ship.sh, loadtest)]
status: approved
created: 2026-11-22
closed: null
---

## Goal

Give Django's cache its own Redis instance, make a cache outage degrade to "uncached" for
everything that can safely do so while the rate limits that guard the most abusable actions
refuse instead (split by risk, see "Outage semantics"), and cache new reads only where the
load-test baseline shows they are hot.
It shows none are, so this unit caches nothing new and writes down the rule a future cached read
must follow (ADR: cache topology, number allocated by the conductor).

Grounded in backend `e543505`, infra `aa3dc7d`, meta `414752c`.

**Today.** `config/settings/base.py` sets `CACHES["default"]` to `RedisCache` at
`DJANGO_CACHE_URL`, defaulting to the broker's host on DB 1. Staging sets no `DJANGO_CACHE_URL`
(`infra/.env.production.example` has none), so the cache is DB 1 of the one `redis` service
that is also Celery's broker and result backend. The cache holds only short-lived security
state: DRF scoped throttles (`kaleem/platform/throttling.py` and five `throttle_scope`s),
allauth's rate-limit histories and their `add` locks, and allauth's TOTP used-code markers.
Nothing in kaleem caches a response or a query.

**Why a separate instance, not just a separate DB index.** Memory limits and eviction policy are
per instance, not per DB. A broker must never evict (a lost key is a lost task); a cache should
be bounded and evict. One instance cannot be both. A separate instance also means a cache
problem cannot take the broker with it, or the reverse.

**Why nothing new is cached.** The baseline (`docs/runbook/load-testing.md`, 100 virtual users)
puts `GET billing/plans/` at p95 36 ms and the two subject reads at p95 39 ms, among the fastest
endpoints. Neither table appears in the top statements by total time; those are the per-request
session and user lookups, sub-millisecond each, which a view-level cache would not remove
(authentication runs before the view). A plan cache would also add a stale-price risk for no
measured gain. So: measured, not cached.

## User flow

No user-visible change while the cache is up. During a cache outage, requests are still served
and reads that would use the cache behave as misses, with one deliberate exception: an action
guarded by a high-risk rate limit (a password re-ask, an outbound email) is refused with a
typed 503, `rate_limit_unavailable`, until the cache is back (see "Outage semantics"). The
outage is reported once per process at ERROR (`cache_unavailable`) and its end at INFO
(`cache_recovered`).

## Data model delta

None. No migration.

## API delta

None.

## Frontend

None. No route, component or API call changes.

## The change

**A. A cache instance (infra).** `docker-compose.production.yml` gains a shared (not colour)
service `redis-cache`: `redis:8-alpine`, the same `redis-cli ping` healthcheck as `redis`, no
published port, no volume, started with `--maxmemory 64mb --maxmemory-policy allkeys-lru
--save "" --appendonly no`. The broker `redis` is unchanged. `ship.sh` adds `redis-cache` to
`SHARED_SERVICES` (step 4 starts it before the new colour), and `test-deploy-lib.sh`'s expected
service list follows. The Django colours do not `depends_on` it: the API serves without a cache,
so a cache that is down must not stop a colour starting. `/health/ready/` does not check the
cache, for the same reason (an outage must not roll a deploy back). Each environment's compose
project has its own `redis-cache` on its own network, so staging and production never share
cache keys on the shared server.

**B. The cache URL is required in production (backend).** `production.py` reads
`DJANGO_CACHE_URL` through `_required`, so a production process without it refuses to start
instead of silently falling back to the broker. `base.py` keeps its broker-DB-1 default for
local development, CI and e2e, which have one Redis. The Dockerfile's collectstatic step gets a
build-only value like its other required variables. The value is `redis://redis-cache:6379/0`,
the same in every environment and not a secret, so it is set in `docker-compose.production.yml`
(the `environment:` of every service that loads production settings: both Django colours, both
Celery workers, both beats and flower), not in the host's `.env.production`. That way it ships
in the same deploy as the `redis-cache` service it names. A host env-file entry would have to
exist before the service does, and any deploy in between would point the running code, which
already reads this variable, at a host that is not there: every throttled endpoint would then
answer 500, with nothing to roll the deploy back (`/health/ready/` and `check --deploy` never
touch the cache). A test in `scripts/test-deploy-lib.sh` fails if a service that loads
production settings lacks it.

**C. Outage semantics (backend).** `CACHES["default"]["BACKEND"]` becomes
`kaleem.platform.cache.ResilientRedisCache`, a subclass of Django's `RedisCache`. On
`redis.exceptions.ConnectionError` or `redis.exceptions.TimeoutError` only (never a bare
`Exception`; any other Redis error still raises):

| Operation | Returns during an outage |
| --- | --- |
| `get`, `get_many`, `has_key` | a miss: `default`, `{}`, `False` |
| `set`, `touch`, `delete`, `delete_many`, `clear` | nothing is written; the "did nothing" value Django defines |
| `set_many` | every key, as "failed to set" |
| `add` | `False` ("not added"), the conservative answer for every caller using `add` as a guard |
| `incr` / `decr` | `ValueError`, as for a missing key |

**Split by risk (owner decision, 2026-11-22).** The table above is the `default` alias, used by
everything that can safely behave as uncached. A second alias, `throttle-strict`, points at the
same instance with the same options but its backend (`StrictRedisCache`, a subclass) raises
`CacheUnavailable` instead of degrading. The throttles that guard a password re-ask or an
outbound email use it through one mixin (`FailClosedThrottleMixin`), which turns
`CacheUnavailable` into `RateLimitUnavailable` (a `KaleemError`, 503, `error_code`
`rate_limit_unavailable`, gettext message with an Arabic entry). Every other throttle keeps the
default alias and so passes through during an outage, as do any throttle added later unless it
opts in with the mixin. The TOTP replay guard and allauth's own limits are unchanged (they
already refuse during an outage). Both aliases share the one "down" flag, so the ERROR is
still once per process. Which scope sits on which side, and why, is recorded privately
(rch-d-security-disclosure). `OPTIONS` sets `socket_connect_timeout` and `socket_timeout` to
0.25 s; both default to none, so today a cache that accepts a connection and never answers holds
a request until the OS gives up. The pool Django builds already retries nothing (redis-py 8.1.0
gives a connection with no `retry` argument `Retry(NoBackoff(), 0)`, read in the gate image);
the slow-cache test below fails if that ever changes. Log lines carry the operation and the exception class, never the
key: throttle keys contain an email address or a user id.

**D. Load-test topology (infra).** `loadtest/docker-compose.loadtest.yml` gains the same
`redis-cache` service and `DJANGO_CACHE_URL`, so the harness keeps measuring production's shape
(production settings now require the variable, so the harness would not start without it).

## What is in the cache, and how each thing leaves it

ADR-0023's four points. Nothing here is a response or a query result.

| Entry | Personal data | Why | Leaves by | Who sees it |
| --- | --- | --- | --- | --- |
| DRF throttle history | email address (`EmailScopedThrottle`), user id or client address (`ScopedRateThrottle`), timestamps | rate limiting | TTL = the throttle window (at most an hour) | no person: internal instance, no port, no disk |
| allauth rate-limit history and lock | user id, email or client address, timestamps | allauth's rate limits | TTL = the rate's window; the lock 10 s | same |
| allauth TOTP used-code marker | user id, a used code | replay guard | TTL = the code's validity window | same |

Persistence is off and the cap evicts least-recently-used keys, so nothing outlives its TTL by
more than a restart, well inside dec-retention-new-domains' "caches <= 24h". No entry is
invalidated by a write elsewhere, because no entry mirrors stored data.

**Rule for a future cached read (goes in the ADR).** Cache a read only when a load-test run
shows it is hot, with the run cited. Cache only data that is identical for every viewer, or key
it by the user id when it is not; never a whole authenticated response. The owning module's
`services.py` deletes the key in the same function that writes the data (on commit), and a TTL
of at most 24 hours backs that up. A miss or an outage computes the value from the database.

## Deploy and the blue-green window

- No schema change, so nothing to expand or contract.
- hg-vps-env: none. `DJANGO_CACHE_URL` is carried by the compose file (section B), so staging's
  and production's `.env.production` need no new line, and no ordering between an env edit and a
  deploy exists. An existing `DJANGO_CACHE_URL` line in a host env file is overridden by the
  compose value.
- hg-shipsh-review (pre-approved): the PR body summarises the compose service and the one
  `SHARED_SERVICES` entry.
- During the window the old colour still counts in the broker's DB 1 and the new colour in
  `redis-cache`, so throttle counts start from zero on the new instance once, at this deploy.
  The old DB-1 keys expire on their own TTLs; no cleanup step.
- A rollback recreates the old colour from the new compose file; the old code reads
  `DJANGO_CACHE_URL` too and finds `redis-cache` already running from step 4.

## Module boundaries

`kaleem.platform` owns the backend (it already owns throttling). No module imports it: settings
name it by dotted path. No new import-linter contract. `billing` and `curriculum`, named in the
programme entry, are not touched, for the reason in the Goal.

## Out of scope

- Caching plans, subjects or any other read (measured, not justified; see Goal).
- Session storage in the cache (`cached_db`): the session lookup is sub-millisecond.
- Changing any throttle rate, or adding a scope (`rch-ratelimit-drf`). Which existing throttles
  use the strict alias is decided here (recorded privately).
- The broker's own memory settings, and where `msg-realtime`'s pub/sub runs. The ADR says only
  that anything that must not be evicted stays off the cache instance.
- A JSON-formatter change to emit `extra` fields (`error_code` goes in the message text).

## Test plan

Backend, test-first (the plan names each test):

- Every operation in the outage table returns its listed value when the client raises
  `ConnectionError` and when it raises `TimeoutError`, and passes through unchanged when the
  client succeeds. Another `RedisError` propagates.
- No mocks, real sockets: against a refused address `get` returns the default within 1 s, and
  against a local listener that accepts and never answers it returns the default within 1 s.
  The second is what proves the socket timeout takes effect.
- One ERROR on the first failure, none on the second, one INFO on recovery; no record contains
  the key.
- Through real DRF views, over a refused address, end to end: an everyday scoped throttle
  serves its normal status (no 500); each high-risk throttled view answers 503 with
  `error_code` `rate_limit_unavailable` and, with the cache up, behaves as before (the limit
  still counts and 429s). The message is Arabic under `ar`.
- `StrictRedisCache` raises `CacheUnavailable` on both exception types and passes success
  through; `throttle-strict` shares `LOCATION` and `OPTIONS` with `default` in base and
  production settings.
- `production.py` refuses to start without `DJANGO_CACHE_URL`; `base.py` keeps its default;
  `CACHES` names the new backend outside test settings.
- e2e: existing flows only. The e2e job runs with a real Redis and the new backend on every
  flow, which proves the normal path. A cache outage cannot be staged inside the Playwright job,
  and the unit tests above cover it. e2e time budget: 0 s added.

Infra: `test-deploy-lib.sh` and meta's `check-shipsh-services.sh` agree on the new service list;
`docker compose config` resolves. Load test: `run.sh smoke` 100% green, then a `baseline` run
compared with the recorded one (no endpoint's p95 more than 20% worse on a quiet host).

After the staging deploy (conductor, over ssh): `redis-cache` answers `CONFIG GET maxmemory-policy`
with `allkeys-lru`; a throttled request creates a key there and none in the broker's DB 1.

## Open questions

None open. The owner approved the spec on 2026-11-22 and chose the split by risk above.
