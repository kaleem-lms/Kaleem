---
spec: docs/superpowers/specs/2026-11-22-rch-redis-caching-design.md
status: done
---

Three repos, one branch name, `feat/rch-redis-caching`: backend and infra (worktrees per runbook
section 1, `R=/home/abdulkhalek/Projects/kaleem-worktrees`) and meta
(`meta-rch-redis-caching`). No migration, no dependency change (`redis` is already in
`requirements/base.txt`), no floor edit. Mutation-check every regression test: revert the fix,
see red, restore it, and record the failure line for the hand-back block.

## Amendment: split by risk (owner decision, 2026-11-22)

The owner approved the spec with one change, so steps 2, 4 and 7 grew by one mechanism and
step 7's test now runs both ways. What was built beyond the steps below:

- `kaleem/platform/cache.py` also holds `StrictRedisCache` (same class, `fail_closed = True`,
  raises `CacheUnavailable`) and `CACHES` has a second alias, `throttle-strict`, with the same
  `LOCATION` and `OPTIONS` (base, test and production settings).
- `kaleem/platform/throttling.py`: `FailClosedThrottleMixin`, `FailClosedScopedRateThrottle`;
  `EmailScopedThrottle` takes the mixin. The data-export and account-delete views use the
  strict class. `RateLimitUnavailable` (503, `rate_limit_unavailable`, Arabic entry) joins the
  platform exceptions and the DRF map.
- Tests, real views over a real refused port (the root `cache_outage` fixture):
  `identity/tests/test_cache_outage.py` (each strict view answers 503 and does nothing),
  `scheduling/tests/test_cache_outage.py` and `messaging/tests/test_cache_outage.py` (each
  everyday view keeps serving). The `StrictRedisCache` behaviour sits in `test_cache.py`.
- Infra: `test-deploy-lib.sh` also asserts the shape of the `redis-cache` service and the
  load-test harness's copy of it.
- The Dockerfile's build-only `DJANGO_CACHE_URL` (step 6) changes the file the gate image is
  keyed on, so the final full gate ran on the tree before that one line and the line itself
  was verified by running the Dockerfile's own `collectstatic` command in the gate image.

## Steps

### Backend (`backend-rch-redis-caching`)

1. [ ] **Tests first**, new file `kaleem/platform/tests/test_cache.py`. Build the backend
   directly, `ResilientRedisCache("redis://cache.invalid:6379/0", {})`, and put a stub in its
   `_cache` cached property (`backend.__dict__["_cache"] = stub`), whose methods return values or raise.
   - `test_outage_returns_the_documented_value`, parametrized over every row of the spec's
     outage table (`get`, `get_many`, `has_key`, `set`, `touch`, `delete`, `delete_many`,
     `clear`, `set_many`, `add`, `incr`, `decr`) and over both `redis.exceptions.ConnectionError`
     and `redis.exceptions.TimeoutError`.
   - `test_success_passes_through`: the same operations return the stub's value unchanged.
   - `test_other_redis_errors_propagate`: `redis.exceptions.ResponseError` raises.
   - `test_outage_is_logged_once_then_recovery`: with `caplog`, two failures then a success give
     exactly one ERROR containing `cache_unavailable` and one INFO containing `cache_recovered`;
     no record's message or args contains the key used (use a key like
     `throttle_email_someone@example.test`). An autouse fixture resets the module's state.
   - Red: `kaleem.platform.cache` does not exist.
2. [ ] `kaleem/platform/cache.py`: `ResilientRedisCache(RedisCache)` overriding the eleven public
   methods Django 6.0's `RedisCache` defines (`add get set touch delete get_many has_key incr
   set_many delete_many clear`; `decr` goes through `incr`). One private helper runs the call,
   catches only `(ConnectionError, TimeoutError)` from `redis.exceptions`, logs the transition
   and returns the row's fallback. A module-level flag holds "down", so the ERROR is once per
   process, not per thread-local cache instance. Signatures match django-stubs so mypy passes.
   Green. Mutations: (a) catch nothing, (b) make `add` return `True` on outage, (c) drop the
   flag: each turns its case red.
3. [ ] **Tests first**, same file, real sockets, no mocks:
   - `test_refused_address_returns_the_default_fast`: `redis://127.0.0.1:1/0` with the
     production `OPTIONS`; `get("k", "d") == "d"` in under 1 s.
   - `test_silent_listener_returns_the_default_fast`: a `socket` bound to `127.0.0.1:0` that
     listens and never reads or writes, closed by the test after 3 s (so a mutated build fails
     on time rather than hanging); `get` returns the default in under 1 s.
   - Red: no `OPTIONS` yet, so the second waits for the listener to close (about 3 s).
4. [ ] `config/settings/base.py`: `BACKEND` becomes `kaleem.platform.cache.ResilientRedisCache`;
   `OPTIONS = {"socket_connect_timeout": 0.25, "socket_timeout": 0.25}`. Update the comment
   above `CACHES` (the cache is its own instance in staging and production; DB 1 of the broker
   only where there is one Redis). Green. Mutation: drop `socket_timeout`, see the listener test
   red.
5. [ ] **Tests first**, `tests/settings/`:
   - Add `"DJANGO_CACHE_URL": "redis://redis-cache:6379/0"` to `PRODUCTION_HOST_ENV` in
     `conftest.py`, so `test_production_refuses_to_start_without` in
     `test_cookie_names_and_hosts.py` gains a case for it and `test_check_deploy.py`'s env has it.
   - New `test_cache_settings.py`: production's `CACHES["default"]` has `LOCATION` from the env
     and the resilient `BACKEND`; `config.settings.base` with no `DJANGO_CACHE_URL` keeps the
     broker-host DB-1 default.
   - Red: production does not require it.
6. [ ] `config/settings/production.py`: `CACHES = {"default": {**CACHES["default"], "LOCATION":
   _required("DJANGO_CACHE_URL")}}` (import `CACHES` from `.base` the way `STORAGES` is).
   `Dockerfile`: add `DJANGO_CACHE_URL=redis://build-only.invalid:6379/0` to the collectstatic
   line. `.env.example`: a commented `DJANGO_CACHE_URL` line saying local uses the default.
   Green. Mutation: give `_required` a default path back, see the new case red.
7. [ ] **Test first**, `kaleem/platform/tests/test_cache.py`:
   `test_scoped_throttle_view_survives_an_outage`, using `override_settings(CACHES=...)` pointing
   the resilient backend at `redis://127.0.0.1:1/0`, then a real request to a view with a
   `throttle_scope` that the suite already has fixtures for (the `call-diagnostics` POST) returns
   its normal status, not 500. Mutation: step 2's (a) turns it into a 500.
8. [ ] Full gate: `"${R}/_tools/backend-gate.sh" "${WT}"` (pytest with coverage, ruff, format,
   lint-imports, migrations check) and mypy as CI runs it. Commit
   `feat(platform): a cache backend that degrades to uncached on an outage`.

### Infra (`infra-rch-redis-caching`)

9. [ ] **Test first**, `scripts/test-deploy-lib.sh`: the `ship_list_services` expectation becomes
   `coturn dashboard flower marketing postgres redis redis-cache signaling traefik`. Red.
10. [ ] `scripts/ship.sh`: `SHARED_SERVICES=(traefik postgres redis redis-cache flower coturn
    signaling)`. `docker-compose.production.yml`: the `redis-cache` service exactly as spec
    section A (no `depends_on` from the colours, no port, no volume). `.env.production.example`:
    `DJANGO_CACHE_URL=redis://redis-cache:6379/0` under `CELERY_BROKER_URL`, with a two-line
    comment (own instance, bounded and evicting; required in production). `CLAUDE.md`'s
    shared-services line gains `redis-cache`. Green: `bash scripts/test-deploy-lib.sh`, and meta's
    `.github/scripts/check-shipsh-services.sh docker-compose.production.yml scripts/ship.sh`
    exits 0 (run from the meta worktree against the infra worktree's files). Mutation: drop the
    `SHARED_SERVICES` entry, see both red.
11. [ ] `loadtest/docker-compose.loadtest.yml`: the same `redis-cache` service and
    `DJANGO_CACHE_URL: redis://redis-cache:6379/0`; `run.sh` brings it up with `postgres redis`
    and includes it in the stats sampler's container list. Commit
    `feat(deploy): a separate, bounded Redis instance for the Django cache`.
12. [ ] Load test, holding a heavy slot: `loadtest/run.sh smoke <backend worktree>` must end 100%
    green; then `loadtest/run.sh baseline <backend worktree>`, with `uptime` before and after.
    Pass: no endpoint's p95 more than 20% above the recorded baseline on a comparable load
    average; otherwise re-run once and report both.

### Meta (`meta-rch-redis-caching`)

13. [ ] `docs/adr/NNNN-cache-topology.md` (number from the conductor): the cache is its own
    bounded, evicting, non-persistent instance per environment; the broker and anything that
    must not be evicted (results, pub/sub) stay on `redis`; outage semantics as the spec's table;
    the rule for a future cached read; "measured, not cached" for plans and subjects with the
    baseline cited.
14. [ ] `docs/architecture/platform.md`: a "Cache" row next to "Throttling". `docs/runbook/
    deploy.md`: the shared-services command gains `redis-cache`, and the env list names
    `DJANGO_CACHE_URL`. `docs/runbook/load-testing.md`: one line with the step-12 run (SHAs, p95
    deltas). D3 table: unchanged (no user-facing area; existing flows exercise the backend).
15. [ ] Hand-back per runbook section 3 for backend and infra: merge `origin/main` (never rebase)
    right before hand-back, re-run the full gates, `gitleaks-range.sh`, the floor-touch grep.
    The block says `needs: env var DJANGO_CACHE_URL (hg-vps-env) | infra/ship.sh and compose
    (hg-shipsh-review)`. The PR body summary for hg-shipsh-review: one new shared compose service
    `redis-cache` (no port, no volume, 64 MB LRU, no persistence), one new `SHARED_SERVICES`
    entry, no step reordered, no other ship.sh change.

## Risks

- **The env var reaches staging late.** The new colour refuses to start, the health check fails
  and ship.sh rolls back: loud and safe. Fallback: add the line, redeploy the same SHA.
- **Throttle counts reset once at the cutover** (old colour on DB 1, new on `redis-cache`).
  Accepted in the spec; it happens on this deploy only.
- **django-stubs signatures differ from Django 6.0's runtime ones** and mypy rejects an override.
  Use the stubs' signatures; `*args/**kwargs` only if a stub forces it, with the reason.
- **redis-py changes its retry default** on a future upgrade: the silent-listener and refused
  tests catch the slowdown, which is why they use real sockets.
- **64 MB is too small** under a burst of distinct throttle keys: LRU evicts the oldest counts
  first. The step-12 run's `redis-cache` memory line says how far below the cap a 100-user load
  sits; `rch-capacity-measurement` revisits it.
- **The shared server.** Production's compose project must not reuse staging's network or
  container names; that is the setup step's concern (lb-prod-env-parametrization), and the ADR
  states one cache instance per environment.

## Verification

- Each step's named tests red then green, with each mutation check's failure line recorded.
- Backend full gate rc 0; mypy clean; infra `test-deploy-lib.sh` and `check-shipsh-services.sh`
  rc 0; `docker compose -f docker-compose.production.yml config` resolves with dummy values.
- CI green on the meta PR, including the e2e job (existing flows, now on the new backend). Read
  the backend job log for the new test names.
- After deploy (conductor, ssh): `docker compose exec redis-cache redis-cli CONFIG GET
  maxmemory-policy` gives `allkeys-lru`; after one throttled request, `redis-cache` has a
  `throttle_` key and the broker's DB 1 gains none (`redis-cli -n 1 --scan --pattern
  '*throttle_*'` count unchanged; Django prefixes keys with `:1:`). The deploy log's `Disk now:` line read as usual.
