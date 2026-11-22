# Runbook: log retention (30 days)

Server, application and container logs on the staging/production host are kept **at most 30 days**
(`lb-dec-retention`, ADR-0068). Production shares the host, so one configuration covers both.

The bound has one source: container output goes to the host's systemd journal (the compose file's
`x-logging` anchor) and the journal keeps 28 days; the host's own text logs are capped by their
logrotate stanzas. `infra/scripts/host-log-retention.sh` sets and checks the host side.

## Where each log lives

| Source | Where it ends up | Bound |
| --- | --- | --- |
| Traefik access log (JSON, `RequestPath` dropped, ADR-0053) and its own log | journal, tag `kaleem-traefik-1` | journal, 28d + 1d file span |
| gunicorn access/error, Django `LOGGING` | journal, tag `kaleem-django-<colour>-1` | same |
| uvicorn signaling | journal, tag `kaleem-signaling-1` | same |
| celery worker/beat, flower | journal | same |
| coturn (`log-file=stdout`) | journal, tag `kaleem-coturn-1` | same |
| postgres, redis, dashboard/marketing nginx | journal | same |
| Host: sshd, kernel, systemd units | journal; plus rsyslog's text files if rsyslog is installed | journal; text files by logrotate |
| Host: `wtmp`/`btmp`, apt/dpkg, ufw, fail2ban, any other logrotate-managed file | `/var/log` | every stanza at 29 days worst case or less |
| Files under `/opt/kaleem` | `ship.sh` writes state files only (`.active-color`, `.deploy-history`, `.coturn-conf-sha`) | `check` fails on a log file 30 days old or more |

The monitoring skeleton (`infra/monitoring/`) is not started by `ship.sh`. If it is ever run, its
retention is `lb-uptime-host-alerts`'s job, and it must read the journal, not
`/var/lib/docker/containers`.

## Reading logs

`docker logs kaleem-<service>-1` still works. The journal adds age-based queries and survives the
container: a colour removed by a deploy keeps its lines.

```bash
journalctl -t kaleem-traefik-1 --since '2 hours ago' -o cat
journalctl -t kaleem-django-green-1 --since yesterday -p warning
journalctl -u ssh --since today              # sshd
journalctl --disk-usage
```

## Checking the host

`check` is read-only and exits 1 on any violation. It lists each store with its worst case. Pipe the
script to the host over ssh as root (`sudo bash -s -- check`, with `infra/scripts/host-log-retention.sh`
on stdin), so nothing is copied there.

It fails on: a journald configuration that is not persistent, unset, or over 29 days
(`MaxRetentionSec` + `MaxFileSec`); any logrotate stanza over 29 days or unbounded (`minsize`,
size-only, no period); a running container whose log driver is not `journald`; a log file under
`/opt/kaleem` 30 days old or more; a rotated copy under `/var/log` (`name.N`, `name.N.gz`,
`name-YYYYMMDD`) 30 days old or more (logrotate never removes the copies above a lowered `rotate`,
so a long-lived host carries them until `apply` sweeps them). It also prints (without failing)
other, non-rotated files under `/var/log` older than 30 days, such as `lastlog`.

Run it after every deploy that touches compose, and in the Friday review.

## Setting it up (once per host, before the compose change merges)

The host is configured **first**. If the compose change landed first, containers would log to a
journal that has no age limit. All of these run on the host as root, the script on stdin:

- **H1, inventory, read-only.** `sudo -n true` first: if sudo is refused, stop, this needs owner
  access. Then `sudo bash -s -- check`, and read `docker info --format '{{.LoggingDriver}}'`,
  `/etc/os-release`, `systemctl is-active systemd-journald rsyslog`, and (in the postgres
  container) `show logging_collector`, which should be `off`. Anything unexpected (a non-kaleem
  container, a log file under `/opt/kaleem`, a running Loki, a host without systemd, the collector
  on) goes to the private notes, not into the repo.
- **H2, apply.** `sudo bash -s -- apply`. It ends with a host-side check and exits 0 even while
  containers are still on `json-file` (it says which). Confirm with
  `systemd-analyze cat-config systemd/journald.conf` (the four keys below) and `journalctl --disk-usage`.
  Expect a list of `removed /var/log/...` lines on a host that has been up for months (apt, dpkg,
  unattended-upgrades copies); an empty sweep prints `removed 0 rotated log(s)`. Keep that list
  for the journal entry. A second `apply` removes nothing.

`apply` writes `/etc/systemd/journald.conf.d/90-kaleem-retention.conf` (`Storage=persistent`,
`MaxRetentionSec=28d`, `MaxFileSec=1d`, `SystemMaxUse=2G`), caps each logrotate stanza (period to
weekly, rotate to 3 under weekly or 28 under daily, drops `minsize`, turns a size-only `size X` into
`maxsize X` plus `weekly`), writes `/etc/rsyslog.d/05-kaleem-container-logs.conf` if rsyslog is
installed, deletes every rotated log copy under `/var/log` that is 30 days old or more (it lists
each as `removed /var/log/...`, ends with a count, and takes no backup of them; the journal's own
directory is left to journald), restarts journald (and rsyslog), and vacuums to 28 days. Originals go to
`/var/backups/kaleem-log-retention/<timestamp>/`. It is idempotent: a second run changes nothing and
takes no backup. If it does not understand a logrotate file (an `include` of another directory, an
unbalanced brace) it exits 2 and changes nothing; send the file to the private notes and escalate.

Then merge the compose change and deploy at a quiet hour: the first deploy recreates every shared
service and the frontends (seconds of gateway restart, live calls reconnect, Postgres restarts on
its volume).

## After the deploy (H3)

- Every running container reports `journald`:
  `docker ps --format '{{.Names}}' | xargs docker inspect --format '{{.Name}} {{.HostConfig.LogConfig.Type}}'`.
- Both readers work: `docker logs kaleem-traefik-1 --tail 1` and
  `journalctl -t kaleem-traefik-1 -n 1 -o cat` each return a line.
- No `*-json.log` or `container-cached.log` is left under `/var/lib/docker/containers` for a kaleem
  container.
- `journalctl -u systemd-journald --since -1h | grep -c Suppressed` prints 0.
- `sudo bash -s -- check` exits 0.

`Suppressed` messages mean journald's rate limit dropped lines under a flood. The fallback is a
raised `RateLimitBurst` in the same drop-in, by an amendment to ADR-0068.

## Rolling back

Revert the compose change and deploy: containers are recreated on `json-file`. The journald drop-in
can stay (it only shortens retention). The swept rotated copies are not restorable, by design: they were logs past the bound. To restore the logrotate files, copy them back from
`/var/backups/kaleem-log-retention/<timestamp>/` (the backup tree mirrors `/etc`).

## What this does not cover

- Database-held logs (call diagnostics 90 days, notification log 90 days): `lb-gdpr-retention-jobs`.
- Loki/promtail and any future monitoring or error-tracking store: `lb-uptime-host-alerts`,
  `lb-error-tracking`.
- GitHub Actions run logs (a GitHub setting; the deploy output carries no personal data).
- The local load-test and dev compose files (developer machines, not the server).
