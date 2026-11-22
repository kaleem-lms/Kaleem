---
name: lb-server-log-retention
phase: v1 programme (launch-blocker stream)
modules: [infra (compose, host), platform (no code change)]
status: approved
created: 2026-11-22
closed: null
---

## Goal

Every log kept on the staging/production host holds at most 30 days of entries (`lb-dec-retention`,
"logs 30 days", approved by the owner 2026-11-22; GDPR Art 5(1)(e), storage limitation).
Production shares this host (owner decision), so one host configuration covers both.

The bound comes from one place: **container output goes to the host's systemd journal, and the
journal keeps 30 days at most.** The journald driver is used instead of json-file size caps
because a size cap does not bound age: a quiet, long-lived container such as `traefik` or
`coturn` would keep months of access lines inside its cap. The host's text logs (rsyslog files,
`wtmp`/`btmp` and the rest of `/var/log`) are capped by their logrotate stanzas. A committed,
tested script sets and checks all of the host side. The decision is recorded in an ADR (number
from the conductor).

## What is logged, and where it ends up (grounded at infra `aa3dc7d`, backend `e543505`)

| Source | Writes to | After this unit |
| --- | --- | --- |
| Traefik access log (JSON, `RequestPath` dropped, ADR-0053) and its own log | stdout (no `--accesslog.filepath`) | journal, tag `kaleem-traefik-1` |
| gunicorn access/error (`gunicorn.conf.py`: `accesslog = "-"`) and Django `LOGGING` (`StreamHandler` only) | stdout/stderr | journal |
| uvicorn signaling (`signaling/logconf.json`, `StreamHandler`s) | stdout/stderr | journal |
| celery worker/beat, flower | stdout/stderr | journal |
| coturn (`log-file=stdout` in `turnserver.conf`) | stdout | journal |
| postgres, redis, dashboard/marketing nginx | stdout/stderr (postgres's `logging_collector` is off in the stock image; the check confirms it) | journal |
| Host: sshd, kernel, systemd units | journal, plus rsyslog's text files if rsyslog is installed | journal ≤30 days; text files capped by logrotate |
| Host: `wtmp`/`btmp`, apt/dpkg, ufw, fail2ban, and any other logrotate-managed file | `/var/log` | every stanza capped to ≤29 days worst case |
| Files under `/opt/kaleem` | ship.sh writes state files only (`.active-color`, `.deploy-history`, `.coturn-conf-sha`), no logs | the check fails on any log file there older than 30 days |

The monitoring skeleton (`infra/monitoring/`, Loki and promtail) is not started by `ship.sh` and
is not in the deploy sync list. Its retention belongs to `lb-uptime-host-alerts`, which already
carries "event and metric retention per lb-dec-retention". The check reports any running container
that does not log to the journal, which would catch it if it were running.

## Personal data (ADR-0023)

- **What:** client IP addresses and user agents (Traefik access log, uvicorn `client_addr`, sshd),
  ephemeral TURN usernames that encode a kaleem user id (coturn), request paths that can hold
  numeric object ids (gunicorn), login records (`wtmp`/`btmp`). No credentials: ADR-0053 and
  `lb-access-log-redaction` keep them out.
- **Why:** operations and incident response.
- **How long:** at most 30 days, for every store above. Containers that are removed (each deploy
  removes the old colour) keep their lines in the journal until they age out. Today those lines go
  when the container goes, so a deploy no longer erases the evidence of an incident.
- **Who sees it:** operators with root or Docker access on the host. Nothing leaves the host.

This unit reduces retained personal data and adds no new data. Nothing is stored in the database.

## Design

1. **Compose.** One extension field, `x-logging: &kaleem-logging` (`driver: journald`,
   `options.tag: "{{.Name}}"`), referenced as `logging: *kaleem-logging` by all 14 services: the
   eight shared and static ones, and the six colour ones. `docker logs` keeps working, because the
   journald driver can be read back (verified locally 2026-11-22 with Docker Compose 5.7.1: a
   container on `--log-driver journald` returned its line from `docker logs` and from
   `journalctl -t <name>`). The runbooks' `docker logs kaleem-…` commands stay valid.
2. **Host script `infra/scripts/host-log-retention.sh`**, idempotent, run by the conductor over ssh
   (piped on stdin, so nothing is copied to the host). `ROOT=` (default `/`) lets the tests run it
   against a fixture tree.
   - `check` (read-only): prints each store and its worst-case age, then exits 1 if any exceeds
     the bound, if a running container does not log to the journal, or if `/opt/kaleem` holds a
     log file older than 30 days.
   - `apply`: writes `/etc/systemd/journald.conf.d/90-kaleem-retention.conf` (`Storage=persistent`,
     `MaxRetentionSec=28d`, `MaxFileSec=1d`, `SystemMaxUse=2G`). Retention plus one file span plus
     a day of vacuum lag stays under 30 days, and the size cap keeps the journal off the 5 GiB
     ship.sh needs free. It then caps each logrotate stanza (below), and if rsyslog is installed
     writes an `/etc/rsyslog.d/` filter that stops container lines (`programname` starting
     `kaleem`) being copied into `/var/log/syslog`, so the journal is their only copy. It restarts
     journald and rsyslog, runs `journalctl --vacuum-time=28d`, and finishes by running `check`.
     Originals go to `/var/backups/kaleem-log-retention/<timestamp>/`, outside `logrotate.d`.
   - **logrotate rule.** The worst case is period × (rotate + 1), with daily = 1, weekly = 7,
     monthly = 31 and yearly = 366 days. It must be ≤ 29 days, which leaves a day for the daily
     timer. `apply` sets `weekly`/`monthly`/`yearly` stanzas to `weekly` with `rotate` ≤ 3, and
     `daily` stanzas to `rotate` ≤ 28. It removes `minsize`, which postpones rotation forever on a
     small file such as `wtmp`, and turns a size-only `size X` into `maxsize X` plus `weekly`.
     Globals in `logrotate.conf` follow the same rule. Lowering a stanza's `rotate` does not make
     logrotate delete the copies above the new count (it removes only the one that falls off the
     end), and copies inside the count can hold content from the old, longer regime. So `apply`
     also deletes every rotated copy under `/var/log` that is 30 days old or more by mtime
     (`name.N`, `name.N.gz|xz|bz2|zst|lz4|Z`, `name-YYYYMMDD…`; the journal's own directory is
     left to journald), lists each file it removes, and takes no backup of them. `check` fails on
     the same set, so a host that was never swept cannot report ok. Lines inside
     `prerotate|postrotate|firstaction|lastaction … endscript` are never touched. A file the
     parser does not understand (an `include` of another directory, an unbalanced brace) makes
     `apply` refuse with exit 2 and change nothing.
3. **Order.** The host is configured first (`apply` from the reviewed feature branch), and the
   compose change merges second. The other order would briefly point containers at a journal that
   has no age limit.

**Blue-green and deploy window.** No schema or code contract changes. A logging change is part of
a container's configuration, so the first deploy after the merge recreates every shared service at
`ship.sh` step 4 and the frontends at step 10. That is the same recreation an upstream `traefik:v3`
or `redis:8-alpine` image bump already causes: seconds of gateway restart, live calls reconnect,
and Postgres restarts on its volume. The conductor deploys it at a quiet hour. `ship.sh` itself is
unchanged (`hg-shipsh-review` is pre-approved; the PR body summarises the compose change).

## Data model delta

None. No migration.

## API delta

None.

## Frontend

None. Nothing user-facing changes.

## Module boundaries

Infra only: `infra/docker-compose.production.yml`, `infra/scripts/host-log-retention.sh` and
`infra/scripts/test-deploy-lib.sh`. Meta: the ADR, `docs/runbook/log-retention.md`, this spec and
the plan. No backend module, `ship.sh` or `ci.yml` change: the new cases run in the existing
`security`-job step that already runs `infra/scripts/test-deploy-lib.sh`.

## Out of scope

- Loki/promtail and any future monitoring or error-tracking store (`lb-uptime-host-alerts`,
  `lb-error-tracking`).
- Database-held logs (call diagnostics 90 days, notification log 90 days):
  `lb-gdpr-retention-jobs`.
- Purging staging's existing logs that hold credentials: an owner step of
  `lb-access-log-redaction`. Recreating the containers does discard their json-file logs as a side
  effect.
- GitHub Actions run logs (a GitHub setting; the deploy output carries no personal data).
- The local load-test and dev compose files (developer machines, not the server).

## Test plan

All cases are in `infra/scripts/test-deploy-lib.sh` style (table-driven, `run_case`, stubs on
PATH). Each is mutation-checked: it goes red with its fix reverted.

- **Compose:** every service resolved with `--profile blue --profile green` has `logging.driver ==
  "journald"` and a non-empty `tag`, and the resolved set is exactly the 14 services. Two controls:
  a copy with one service's `logging:` removed names that service, and an unresolvable file fails
  rather than passing with zero offenders.
- **Journald:** `apply` writes a drop-in whose `MaxRetentionSec` + `MaxFileSec` ≤ 29 days, with
  `Storage=persistent` and `SystemMaxUse` set. `check` fails on a root with no drop-in, and on one
  whose values sum to more than 29 days.
- **logrotate:** fixtures copied from stock Ubuntu stanzas: `rsyslog` (weekly, rotate 4, with a
  postrotate script), `wtmp` (monthly, minsize, rotate 1), `apt` (monthly, rotate 12), a size-only
  stanza and an inheriting stanza under `weekly`/`rotate 4` globals. `check` reports each with its
  worst-case days. `apply` caps every one. A second `apply` changes nothing. Script bodies come
  through byte-identical. Backups land outside `logrotate.d`. An `include` of another directory is
  refused with no change.
- **Rotated copies:** a fixture tree with `apt/history.log.12.gz`, `term.log.4.gz`,
  `dpkg.log.3.xz`, `dpkg.log-20240101.gz`, an unattended-upgrades `.5` and an installer
  `.log.2345`, all dated 300 days ago. `check` exits 1 and names each; `apply` deletes and lists
  each and a following `check` exits 0. Survivors, asserted: a fresh `history.log.1.gz`, a
  future-dated dateext copy, an old non-rotated `lastlog` and `Xorg.0.log` (reported as `info`
  only), and an old `journal/…/system.journal.1`.
- **rsyslog:** the filter is written when `etc/rsyslog.conf` exists and not otherwise.
- **`/opt/kaleem` and Docker:** `check` fails on a fixture `*.log` dated 40 days ago and passes
  without it. With the Docker stub, it fails on a running container whose driver is `json-file`
  and names it.
- **Existing gates:** `check-published-ports.sh`, `check-shipsh-services.sh` and
  `check-traefik-static-config.sh` stay green on the changed compose file.
- **Staging (conductor, after deploy):** `check` exits 0, every `kaleem-*` container reports
  `journald`, `docker logs kaleem-traefik-1 --tail 1` and `journalctl -t kaleem-traefik-1 -n 1`
  return a line, no `*-json.log` or `container-cached.log` remains for a kaleem container, and
  there are no `Suppressed` messages from journald.

**e2e:** none, by design. Nothing user-facing changes and CI has no host journal to assert
against. The proof is the compose check in CI plus the staging check above, as for C3b/C3c in the
D3 table.

## Open questions

None. The retention value and the scope are owner decisions (2026-11-22). Whether `ssh kaleem` has
`sudo` is found out at the plan's first host step; without it, that step escalates.
