---
number: 0067
title: The Django cache is its own bounded Redis instance, and an outage splits by risk
status: proposed
date: 2026-11-22
---

## Context

Django's cache and Celery's broker shared one Redis service (the cache on DB 1). The cache
holds only short-lived security state: DRF scoped throttles, allauth's rate-limit histories
and locks, and allauth's one-time-code replay marker. Nothing in kaleem caches a response or
a query.

Memory limits and eviction policy are per instance, not per DB. A broker must never evict (a
lost key is a lost task); a cache should be bounded and evict. One instance cannot be both,
and a cache problem could take the broker down with it, or the reverse.

Two further facts. With Django's own `RedisCache`, an unreachable instance raises out of every
call, so a cache outage is a 500 on every request that touches it. And redis-py gives a
connection no socket timeout, so a cache that accepts a connection and never answers holds a
request until the operating system gives up.

## Decision

1. **A separate instance.** `redis-cache` is a shared compose service (`redis:8-alpine`,
   64 MB, `allkeys-lru`, no snapshot, no append-only file, no volume, no published port),
   one per environment's compose project, listed in `ship.sh`'s `SHARED_SERVICES`. The broker
   `redis` is unchanged. Anything that must not be evicted (task results, pub/sub) stays on
   the broker.
2. **Production names it and refuses to start without it.** `DJANGO_CACHE_URL` is required by
   `production.py`; the value is `redis://redis-cache:6379/0` in every environment and is set by
   `docker-compose.production.yml` on every service that loads production settings, not by the
   host's env file, so it deploys atomically with the service it names.
   `base.py` keeps its broker-DB-1 default, for development, CI and e2e, which have one Redis.
   The colours do not `depends_on` the cache and `/health/ready/` does not check it: the API
   serves without one, and a cache outage must not roll a deploy back.
3. **An outage is bounded and reported.** The backend sets 0.25 s connect and read timeouts.
   `kaleem.platform.cache` turns `ConnectionError` and `TimeoutError` (only those) into the
   outcome below, logs one ERROR (`cache_unavailable`) per process and one INFO
   (`cache_recovered`), and never logs a key (throttle keys contain an email address or a user
   id).
4. **Outage semantics split by risk (owner decision, 2026-11-22).** Two aliases, one instance:
   - `default` (`ResilientRedisCache`) degrades to "uncached": a read is a miss, a write is
     skipped, `add` reports "not added", `incr` reads as a missing key. It serves every
     request-path use that can safely behave as uncached, including the everyday throttles.
   - `throttle-strict` (`StrictRedisCache`) raises `CacheUnavailable`. The throttles that
     guard a password re-ask or an outbound email use it through
     `FailClosedThrottleMixin`, and during an outage answer **503 `rate_limit_unavailable`**
     (a typed `KaleemError`, Arabic message) instead of going uncounted. A throttle is open
     unless it opts in, so a future one (`rch-ratelimit-drf`) decides deliberately.
   - The one-time-code replay guard and allauth's own limits already refuse during an
     outage and are unchanged.
5. **The rule for a future cached read.** Cache a read only when a load-test run shows it is
   hot, with the run cited. Cache only data that is identical for every viewer, or key it by
   user id; never a whole authenticated response. The owning module's `services.py` deletes
   the key in the same function that writes the data (on commit), and a TTL of at most 24 hours
   backs that up (`dec-retention-new-domains`). A miss or an outage computes the value from the
   database. Every entry's four ADR-0023 answers (personal data, why, how it leaves, who sees
   it) are written where it is added.
6. **Measured, not cached.** The 2026-10-18 baseline (`docs/runbook/load-testing.md`, 100
   virtual users) has `GET billing/plans/` at p95 36 ms and the two subject reads at p95 39 ms,
   among the fastest endpoints. Neither table is among the top statements by total time; those
   are the per-request session and user lookups, sub-millisecond each, which a view-level
   cache would not remove because authentication runs before the view. A plan cache would add
   a stale-price risk for no measured gain. This unit caches nothing new.

## Alternatives considered

- **Keep one instance and a separate DB index.** Free, and what we had. Cannot bound or evict
  one DB without the other, so it cannot protect the broker.
- **Cache plans and subjects now.** Nothing measured justifies it, and a price served stale is
  a worse failure than a 36 ms read.
- **Every throttle degrades on an outage.** Simplest, and the original proposal. Rejected by
  the owner for the throttles that guard a password re-ask or an outbound email: during the
  outage they would stop counting for as long as it lasted.
- **Every throttle refuses on an outage.** Rejected because everyday limits would turn a cache
  outage into a lesson that cannot be joined and a chat that cannot send, and because the
  login throttles `rch-ratelimit-drf` will add must not turn it into "nobody can sign in".
- **Give the new colour a `depends_on` on the cache.** A cache that is down would stop a colour
  starting and roll back a deploy for a dependency the API does not need to serve.

## Consequences

- A cache outage is a log line and a degraded rate limit, not an outage of the API, with one
  deliberate exception: the actions behind the strict throttles return a retryable 503 until
  the cache is back.
- At the cutover the old colour counts in the broker's DB 1 and the new one in `redis-cache`,
  so throttle counts start from zero once. The old keys expire on their own TTLs.
- 64 MB with LRU eviction means a burst of distinct throttle keys evicts the oldest counts
  first. `rch-capacity-measurement` revisits the size.
- Production's compose project must not reuse staging's network or container names on the
  shared server (`lb-prod-env-parametrization`); one cache instance per environment is part
  of this decision.
- `DJANGO_CACHE_URL` lives in the compose file, not the hand-managed `.env.production`. The
  alternative (a host env line added before the deploy) was rejected: code already on the
  server reads that variable, so a deploy between the edit and this one would aim it at a
  cache host that does not exist, and every throttled endpoint would answer 500 with no
  rollback, because the health checks never touch the cache. A host-level override cannot be
  set by accident for the same reason: the compose value wins.

Spec: `docs/superpowers/specs/2026-11-22-rch-redis-caching-design.md`.
