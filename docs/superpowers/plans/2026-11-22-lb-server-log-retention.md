---
spec: docs/superpowers/specs/2026-11-22-lb-server-log-retention-design.md
status: in-progress
---

Size M. Repos: `infra` (worktree `kaleem-worktrees/infra-lb-server-log-retention`, branch
`feat/lb-server-log-retention`, created per runbook section 1) and meta (this worktree). There is
no migration, no env var, no new dependency and no coverage floor. Infra has no gate tool; its
gate is `bash scripts/test-deploy-lib.sh` plus `shellcheck`, the same as the CI `security` step.

## Steps

1. [ ] **Compose tests first (red).** In `infra/scripts/test-deploy-lib.sh`, new section
   `# ---- 8. compose: log retention`:
   - helper `compose_log_offenders <file>`: copy the file to a scratch directory beside an empty
     `.env.production`, give every `${VAR:?` a dummy value (the `check-published-ports.sh`
     pattern), run `docker compose --profile blue --profile green config --format json`, and
     print `<count>` followed by each service whose `.logging.driver != "journald"` or whose
     `.logging.options.tag` is empty. Exit non-zero if compose cannot resolve the file.
   - `compose_every_service_logs_to_the_journal`: count 14, no offenders.
   - `compose_log_check_names_a_service_without_logging`: an awk copy without coturn's `logging:`
     line prints exactly `coturn`.
   - `compose_log_check_fails_when_compose_cannot_resolve`: a garbage file gives a non-zero exit.
   - Add all three to the `for c in …` table. Run it: the first two are red on `aa3dc7d` (every
     service is an offender), and the third is green already, because it tests the helper.
2. [ ] **Compose change (green).** Add `x-logging: &kaleem-logging` (driver `journald`,
   `options.tag: "{{.Name}}"`) at the top of `docker-compose.production.yml` and add
   `logging: *kaleem-logging` to all 14 services. Put a comment block on the anchor (why the
   journal and not size caps, and that `docker logs` still works). Section 8 goes green. Then run
   the meta checkers against the worktree file:
   `check-published-ports.sh`, `check-shipsh-services.sh <compose> <ship.sh>` and
   `check-traefik-static-config.sh`. Commit `feat(compose): send every container's log to the host journal`.
3. [ ] **Host-script tests first (red).** Section `# ---- 9. host log retention` in the same
   file. Add `systemctl` and `journalctl` stubs to `${stubdir}` that record argv. The fixture root
   `${work}/root` gets `etc/logrotate.conf` (globals `weekly` / `rotate 4` /
   `include /etc/logrotate.d`), `etc/logrotate.d/{rsyslog,wtmp,apt,sizeonly,inherit}` taken from
   stock Ubuntu 24.04 (rsyslog with its `postrotate … endscript`), and optionally
   `etc/rsyslog.conf` and `opt/kaleem/`. Cases (each `ROOT="${work}/root" bash host-log-retention.sh …`):
   - `host_check_fails_without_a_journald_dropin`
   - `host_check_fails_when_retention_plus_file_span_exceeds_29_days` (`29d` + `1d`)
   - `host_apply_writes_a_bounded_journald_dropin` (parse `<n>d` values, sum ≤ 29,
     `Storage=persistent`, `SystemMaxUse=` set)
   - `host_check_reports_each_logrotate_offender_with_its_worst_case` (rsyslog 35, wtmp
     "unbounded (minsize)", apt 403, sizeonly "unbounded (size)", inherit 35)
   - `host_apply_caps_every_stanza` (then `check` exits 0)
   - `host_apply_is_idempotent` (a second run leaves every file byte-identical)
   - `host_apply_leaves_rotate_scripts_byte_identical`
   - `host_apply_backs_up_outside_logrotate_d`
   - `host_apply_refuses_an_unknown_include` (exit 2, tree unchanged)
   - `host_apply_writes_the_rsyslog_filter_only_when_rsyslog_exists`
   - `host_apply_restarts_and_vacuums` (stub argv: `systemctl restart systemd-journald`,
     `journalctl --vacuum-time=28d`)
   - `host_check_fails_on_an_old_log_under_opt_kaleem` (`touch -d '40 days ago'`)
   - `host_check_names_a_container_not_on_the_journal` (the docker stub answers `inspect`)
4. [ ] **Host script (green).** Write `infra/scripts/host-log-retention.sh` (bash,
   `set -euo pipefail`, braced variables, `ROOT="${ROOT:-/}"`) with `check` and `apply`. The
   logrotate logic is one awk program that tracks globals and stanzas, skips script blocks, and
   prints `file:line:period:rotate:flags` for `check` and the rewritten text for `apply`. The
   journald drop-in and the rsyslog filter are heredocs inside the script, so one file is piped to
   the host. `shellcheck` clean. Commit `feat(scripts): host-log-retention check and apply`.
5. [ ] **Mutation checks.** For each of the steps 2 and 4 fixes, revert the line that a case
   guards and record the red line: the anchor on one service, `MaxFileSec`, the `minsize` removal,
   the script-block skip, the idempotency guard and the `/opt/kaleem` age test. Then restore them.
   The hand-back block lists them.
6. [ ] **Meta docs.** The ADR (number from the conductor), titled "Container and host logs live
   in the journal for at most 30 days": the decision, journald over json-file caps (age versus
   size), the rate-limit trade-off, and what `lb-uptime-host-alerts` must read from (the journal,
   not `/var/lib/docker/containers`). Add `docs/runbook/log-retention.md`: the store table from the
   spec, how to read logs (`docker logs` unchanged; `journalctl -t kaleem-<service>-1 --since …`),
   and the conductor commands below. Set the spec to `approved` and the plan to `in-progress` per
   the conductor. Commit `docs: ADR and runbook for server log retention`.
7. [ ] **Hand-back** (runbook section 3). Merge `origin/main` into the infra branch (never rebase)
   and re-run step 2's and step 4's gates. Run `gitleaks-range.sh` on both worktrees and make sure
   the tree is clean. `needs: hg-shipsh-review (compose change; summary below), host step H1–H3 before merge`.
   The PR-body summary: "compose: every service gets `logging: *kaleem-logging` (journald,
   tag = container name). First deploy recreates all shared services and frontends; ship.sh
   unchanged."

### Conductor host steps (sub-agents cannot ssh). Run them in the merge slot, from the infra worktree

```bash
I=/home/abdulkhalek/Projects/kaleem-worktrees/infra-lb-server-log-retention
# H1 inventory, read-only. If `sudo` is refused, stop and escalate.
ssh kaleem 'sudo -n true' && ssh kaleem 'sudo bash -s -- check' < "${I}/scripts/host-log-retention.sh"
ssh kaleem 'docker info --format "{{.LoggingDriver}}"; . /etc/os-release; echo "${PRETTY_NAME}"; systemctl is-active systemd-journald rsyslog || true'
ssh kaleem 'docker exec kaleem-postgres-1 sh -c "psql -U \"\$POSTGRES_USER\" -Atc \"show logging_collector\""'   # expect off
# H2 apply, then confirm (check runs again at the end of apply, and must exit 0)
ssh kaleem 'sudo bash -s -- apply' < "${I}/scripts/host-log-retention.sh"
ssh kaleem 'systemd-analyze cat-config systemd/journald.conf | grep -E "^(Storage|MaxRetentionSec|MaxFileSec|SystemMaxUse)="; journalctl --disk-usage'
# --- merge + deploy-staging, at a quiet hour ---
# H3 after the deploy
ssh kaleem 'docker ps --format "{{.Names}}" | xargs docker inspect --format "{{.Name}} {{.HostConfig.LogConfig.Type}}"'   # all journald
ssh kaleem 'docker logs kaleem-traefik-1 --tail 1 >/dev/null && journalctl -t kaleem-traefik-1 -n 1 -o cat >/dev/null && echo READ-OK'
ssh kaleem 'sudo find /var/lib/docker/containers \( -name "*-json.log" -o -name "container-cached.log" \) | wc -l'   # 0 for kaleem containers
ssh kaleem 'journalctl -u systemd-journald --since -1h | grep -c Suppressed || true'                          # 0
ssh kaleem 'sudo bash -s -- check' < "${I}/scripts/host-log-retention.sh"                                       # exit 0
```

H1 output goes in the hand-back. Anything it finds outside the spec goes to
`_ops/private/lb-server-log-retention.md` and is escalated, never published. That covers a
non-kaleem container, a log file under `/opt/kaleem`, a running Loki, a non-systemd host and
`logging_collector` on.

## Risks

- **No `sudo` for `ssh kaleem`, or a host without systemd-journald.** H1 finds this before
  anything changes. Escalate (owner access).
- **The journald rate limit drops lines under a flood.** All containers share
  `docker.service`'s budget. H3 checks for `Suppressed`. The fallback is a raised
  `RateLimitBurst` in the same drop-in, by ADR amendment.
- **The first deploy recreates Postgres, Redis, Traefik, coturn and signaling.** It is the same as
  an upstream image bump. Deploy at a quiet hour. Rollback means reverting the compose change and
  deploying again, which recreates the containers on json-file. The journal drop-in can stay: it
  only shortens retention.
- **The logrotate rewrite meets a stanza shape the fixtures lack.** `apply` refuses (exit 2), and
  the conductor sends the file to the private notes and escalates. A partial rewrite cannot happen:
  every file is validated before any is written.
- **Edited distro conffiles.** apt keeps local edits by default (`--force-confold` under
  unattended-upgrades), and `check` reports drift if an upgrade replaces one. H3's `check` is
  repeated in the weekly review.
- **`lb-uptime-host-alerts` assumes promtail on `/var/lib/docker/containers`.** The ADR says it
  must read the journal. Both specs cite it.

## Verification

- Per step: the named cases are red before and green after, and the step 5 mutation lines are
  recorded.
- Whole unit: `bash scripts/test-deploy-lib.sh` exits 0, `shellcheck scripts/*.sh` is clean, the
  three meta compose checkers are green, CI's `security` job is green on the meta proof PR, and
  H3 passes on staging after the deploy.
- **e2e:** none (spec, "Test plan"). D9 click-through: not applicable, because nothing is
  user-facing. H3 is the live check, with a D9 line in the journal.
