---
number: 0068
title: Container and host logs live in the journal for at most 30 days
status: proposed
date: 2026-11-22
---

<!-- The number is provisional: the conductor allocates ADR numbers. Renumber on land. -->

## Context

`lb-dec-retention` (owner, 2026-11-22): server, application and container logs on the
staging/production host are kept at most 30 days. It is a storage-limitation rule (GDPR Art 5(1)(e)):
those logs hold client IP addresses and user agents (Traefik, uvicorn, sshd), ephemeral TURN
usernames that encode a user id (coturn), request paths that can carry numeric object ids
(gunicorn), and login records (`wtmp`/`btmp`).

Before this ADR nothing bounded their age. Every service used Docker's default `json-file` driver
with no `max-size` and no `max-file`, so a container's output grew until the container was
removed. Each deploy removes the old colour, which erased those lines as a side effect, but the
shared containers (`traefik`, `coturn`, `postgres`, `redis`, `signaling`, `flower` and the
frontends) are recreated only on an image bump. Host text logs follow whatever each package's
logrotate stanza says, and several stock stanzas keep a year or more (`apt` keeps twelve months,
`wtmp` never rotates a small file).

Production shares this host (owner decision), so one host configuration covers both
environments.

## Decision

1. **Containers log to the systemd journal, and the journal keeps 28 days.** One compose
   extension field, `x-logging: &kaleem-logging` (`driver: journald`, `tag: "{{.Name}}"`), is
   referenced by all 14 services. The host's journald drop-in sets `MaxRetentionSec=28d`,
   `MaxFileSec=1d`, `SystemMaxUse=2G` and `Storage=persistent`. Retention plus one file span plus
   a day of vacuum lag stays under 30 days, and the size cap keeps the journal off the free disk
   the deploy needs.
2. **Host text logs are capped by their logrotate stanzas to 29 days at worst.** The worst case of
   a stanza is `period x (rotate + 1)` with daily = 1, weekly = 7, monthly = 31, yearly = 366.
   `minsize` and a size-only criterion have no worst case at all and are removed. If rsyslog is
   installed, a filter stops container lines being copied into `/var/log/syslog`, so the journal
   is their only copy.
   Lowering `rotate` does not make logrotate delete the copies above the new count, so a host that
   has been up for months keeps rotated files far older than 30 days, and the copies inside the
   count can hold content from the old regime. `apply` therefore also deletes every rotated copy
   under `/var/log` (`name.N`, `name.N.<compression>`, `name-YYYYMMDD…`) that is 30 days old or more
   by mtime, listing each one and taking no backup; `check` fails on the same set. The journal's
   own directory is left to journald.
3. **A committed, tested script sets and checks the host side.** `infra/scripts/host-log-retention.sh`
   has `check` (read-only; exits 1 on a violation) and `apply` (idempotent; refuses without changing
   anything if it does not understand a logrotate file; backs originals up outside `logrotate.d`).
   The conductor pipes it over ssh, so nothing is copied to the host. CI proves the compose half
   (every resolved service has the journald driver and a tag) and runs the script against a fixture
   tree; the staging check is `check` after the deploy.
4. **Order.** The host is configured first and the compose change merges second. The other order
   would briefly point containers at a journal with no age limit. `apply` therefore does not fail
   on containers that are still on `json-file`; `check` does.

Anything that stores logs on this host later (the monitoring stack, an error tracker) reads from
the journal, or sets its own retention of at most 30 days. In particular `lb-uptime-host-alerts`
must not assume promtail tailing `/var/lib/docker/containers`: with this driver those files no
longer exist.

## Alternatives considered

**`json-file` with `max-size` and `max-file`.** The obvious Docker-native cap. It bounds bytes,
not age: a quiet, long-lived container such as `traefik` or `coturn` would keep months of access
lines inside its cap, and a busy one would lose lines within hours. The requirement is an age, so
the mechanism has to be one that expires by age. Rejected.

**A cron job that deletes old `*-json.log` files.** Docker holds those files open and tracks their
offsets; truncating or removing them under a running container is unsupported and loses lines
unpredictably. Rejected.

**Ship everything to Loki with a 30-day retention.** The monitoring skeleton in `infra/monitoring/`
is not started by `ship.sh`, and adding a store to bound a store is the wrong way round. That
stack's retention belongs to `lb-uptime-host-alerts`. Out of scope.

**A Docker daemon default (`log-driver` in `/etc/docker/daemon.json`).** One host setting would
cover every container, including ones outside compose. It restarts the Docker daemon, and the
setting is invisible to a reader of the repo and to CI. The compose anchor is reviewable and
tested. A host default can be added later for non-compose containers if one ever appears.
Rejected for now.

**A scheduled `journalctl --vacuum-time` instead of `MaxRetentionSec`.** Bounds age only while the
schedule runs; the journald limit holds on its own. Rejected.

## Consequences

- Every container's output is bounded by one number in one file on the host, and a removed
  container keeps its lines in the journal until they age out, so a deploy no longer erases the
  evidence of an incident.
- `docker logs <name>` keeps working (the journald driver can be read back), and so does
  `journalctl -t <name>` (the tag is the container name, for example `kaleem-traefik-1`). The
  runbooks' `docker logs` commands stay valid.
- **Rate limit.** journald drops lines from a service that logs faster than `RateLimitBurst` in
  `RateLimitIntervalSec` (defaults 10000 per 30 s), and all containers share `docker.service`'s
  budget. A flood is logged as "Suppressed N messages". The post-deploy check looks for it. If it
  appears, the fallback is a raised `RateLimitBurst` in the same drop-in, by amendment to this ADR.
- The first deploy after the compose change recreates every shared service and the frontends,
  because a logging change is part of a container's configuration. It is the same recreation an
  upstream image bump causes: seconds of gateway restart, live calls reconnect, Postgres restarts
  on its volume. It deploys at a quiet hour. `ship.sh` is unchanged.
- Rollback is reverting the compose change and deploying again, which recreates the containers on
  `json-file`. The journal drop-in can stay: it only shortens retention.
- The logrotate rewrite changes distro conffiles. A package upgrade that ships a new version of one
  keeps the local edit by default (`--force-confold` under unattended-upgrades); if one is replaced,
  `check` reports the drift, and it is part of the weekly review.
- The database-held logs (call diagnostics 90 days, notification log 90 days) are not covered here;
  `lb-gdpr-retention-jobs` owns them.
