---
name: lb-deploy-pipeline-hardening
phase: v1 programme (wave 1, ops stream)
modules: [deploy (infra `scripts/`), meta CI (`.github/`)]
status: draft
created: 2026-10-25
closed: null
---

## Goal

Make the staging deploy survive the programme's merge rate (4-7 merges an hour) and stop it
failing silently. Today `ship.sh` step 11 runs `docker image prune -a --filter until=24h`, which
at that rate keeps up to a day of ~1 GB backend images (74 deploys once filled the 75 GB disk);
it runs only after a successful deploy, so failed deploys accumulate images; and the conductor
throttles merges by reading the deploy log's `Disk now:` line. A red gate on a master push makes
`deploy-staging` skip with no signal (ISSUES.md, #88). The deploy builds every image from
scratch, and its file-sync and remote-run steps download helper binaries at deploy time with no
checksum (ISSUES.md). Nothing checks that every shared compose service is in `ship.sh`'s
explicit start list, the gap that once left coturn unstarted with every health check green.

Six changes, one infra PR plus one meta PR:

1. **Keep the last N deploys, not the last 24 hours.** `ship.sh` records each successful deploy's
   SHA in `/opt/kaleem/.deploy-history` and removes every `ghcr.io/kaleem-lms/*` image whose tag
   is neither in the last `KEEP_DEPLOYS` (default 5) entries, nor the SHA being deployed, nor used
   by any container (running or stopped). Other repositories' images lose only dangling layers.
   It prunes at the start of every deploy as well as the end, so a run of failed deploys cannot
   fill the disk.
2. **Previous image tags stay available for rollback.** The last 5 deploys stay on the host, so
   `bash scripts/ship.sh <sha>` with a SHA from `.deploy-history` rolls back without a re-pull;
   GHCR keeps every SHA tag (this unit removes nothing from GHCR). On a host with no history, the
   image the live colour runs is recorded first, so the first deploy after this lands still keeps
   a rollback target.
3. **Registry build cache.** `deploy-staging` builds the three images with `docker buildx`
   (builder created in the job, no new action) using a GHCR cache,
   `ghcr.io/kaleem-lms/<image>:buildcache`, `mode=max`, read and written only by this master-only
   job. Tags and image contents are unchanged (`--provenance=false` keeps the pushed manifest the
   same shape as today).
4. **A skipped deploy is visible.** A new `deploy-outcome` job runs on every master push after
   `deploy-staging`, whatever happened. A docs-only push (`code != 'true'`) passes with a notice.
   Otherwise, if `deploy-staging` did not succeed, it fails with "master is not on staging" and
   names each gate's result in the log and the step summary. A deliberate Dependabot skip is red
   too: staging lagging master is exactly what should be seen.
5. **No downloaded deploy binaries.** The file sync and the remote run use the runner's own
   OpenSSH (`tar | ssh` and `ssh`) in place of the two `appleboy` actions. The deploy pins the
   staging host key: a public-key line committed under a host alias
   (`.github/deploy/staging_known_hosts`, alias `kaleem-staging`, no address), used with
   `StrictHostKeyChecking=yes`. The SSH key is written to a mode-600 file in `$RUNNER_TEMP`; the
   GHCR token reaches `docker login` on stdin, never on a command line. The synced file set gains
   `scripts/deploy-lib.sh`.
6. **Every shared compose service is in `ship.sh`'s lists.** `ship.sh` names its shared services
   (step 4) and static frontends (step 10) once, as arrays, and `ship.sh --list-services` prints
   them without touching Docker. The set of compose services outside a colour profile must equal
   their union. Checked twice: in CI on every PR (`check-shipsh-services.sh`, resolving the
   compose file exactly as `check-published-ports.sh` does), and by `ship.sh` itself before it
   pulls anything (`docker compose config --services` on the host).

When this lands, the conductor's disk-based deploy cap (`serialization_points`) can be lifted:
a deploy's disk use becomes bounded by `KEEP_DEPLOYS`, not by merge rate. The `Disk now:` line
stays, in the same format.

## User flow

No user-facing change. The operator's flow:

1. A merge to master deploys as today. The log shows the retention step (`Keeping <shas>`,
   `Removed <n> superseded images`) and the unchanged `Disk now:` line.
2. A gate fails on master: the run shows `deploy-outcome` red with "master is not on staging"
   and the gate that failed, instead of a grey skipped `deploy-staging` among green jobs.
3. Rollback: `tail -5 /opt/kaleem/.deploy-history`, then `bash scripts/ship.sh <sha>`; the image
   is already local.
4. A compose change adds a non-profile service without adding it to `ship.sh`: the PR's
   `security` job fails naming the service. If it somehow reaches the host, `ship.sh` refuses
   before pulling.
5. Errors: a failed `docker rmi` (image in use, race) is logged and skipped, never fatal; a
   history file that cannot be written fails nothing already done (atomic tmp + `mv`, like
   `write_state`); a host-key mismatch fails the deploy at its first SSH call, before anything is
   synced.

## Personal data (ADR-0023)

None. `.deploy-history` holds commit SHAs only. No log line gains user data.

## Data model delta

None. No migration. One new host file, `/opt/kaleem/.deploy-history` (SHA per line, newest last,
deduplicated, at most 50 lines).

## API delta

None.

## Frontend

None. No dashboard or marketing change.

## Module boundaries

Infra (`scripts/ship.sh`, new `scripts/deploy-lib.sh`, new `scripts/test-deploy-lib.sh`) and meta
CI (`.github/workflows/ci.yml`, new `.github/scripts/check-shipsh-services.sh`,
`.github/scripts/deploy-outcome.sh` and their `test-*.sh`, new `.github/deploy/staging_known_hosts`).
No backend module, no import-linter change. `deploy-lib.sh` holds the pure parts (which images to
remove, history update, service-set comparison) so they are testable without a Docker daemon;
`ship.sh` sources it and stays the only entry point. The new tests run in the meta `security` job,
next to the existing checker self-tests (infra has no CI of its own).

Blue-green: nothing here changes the colour flip or what either colour runs. Expand/contract does
not apply (no schema, no contract between releases). The pointer bump and the sync-list change
land in the same meta PR, because `ship.sh` sources a file that only the new sync list delivers.

Owner gate `hg-shipsh-review`: pre-approved by the owner on 2026-10-25; the meta PR body
summarises each `ship.sh` and deploy-step change.

## Out of scope

- A disk alarm or host monitoring (`lb-uptime-host-alerts`).
- GHCR-side retention (deleting old package versions).
- Caching for the PR-time `image-scan` builds.
- Signaling continuity across deploys (`lb-signaling-deploy-continuity`).
- The infra `CLAUDE.md`'s stale `deploy.sh` name (ISSUES.md one-liner, D10).
- Production (`lb-prod-*` units). The scripts are environment-agnostic, but only staging is wired.

## Test plan

Infra, `scripts/test-deploy-lib.sh` (bash, table-driven, no Docker daemon; failing first):

- Retention selection: keeps the last 5 history SHAs, the deploying SHA and every image any
  container uses; removes the other `ghcr.io/kaleem-lms/{backend,dashboard,marketing}` tags;
  never selects another repository's image, an untagged image or a `buildcache`/`latest` tag.
- History: append dedupes (a rollback's SHA moves to the end), trims to 50, ignores lines that
  are not 7-40 hex characters, and writes atomically (a failed write leaves the old file). An
  empty or missing history is seeded with the live colour's SHA before anything is selected.
- Service set: equal sets pass; an unlisted non-profile service fails naming it; a listed service
  missing from compose fails naming it.
- Non-fatal removal: a `docker rmi` that fails (stub) leaves the step's exit status 0 and logs a
  warning.

Meta, `.github/scripts/test-check-shipsh-services.sh`: generated compose fixtures (a profiled
service is ignored; an extra shared service fails; a missing one fails; the real
`infra/docker-compose.production.yml` with the real `ship.sh --list-services` passes). Verified
locally on 2026-10-25 that `docker compose config --services` without `--profile` lists exactly
the eight non-profile services (traefik, postgres, redis, flower, coturn, signaling, dashboard,
marketing).

Meta, `.github/scripts/test-deploy-outcome.sh`: needs-JSON fixtures: deploy success passes;
docs-only passes with a notice; deploy skipped after a failed gate fails and names the gate;
deploy failed fails; Dependabot skip fails.

Every regression test is mutation-checked (revert the code, see red).

Not testable before merge, verified on the first staging deploy after it (conductor, watching
the run): the SSH transport and host-key pin, the buildx cache (the second deploy's log shows
`CACHED` layers and a shorter build), the retention step's real removals and the `Disk now:` line.

e2e: none. No user-facing behaviour (D3 table, "None" in the unit's entry).

## Open questions

None. Decisions cited: `rch-d-security-disclosure`, `dec-spec-approval`, `dec-floor-ownership`.
Owner gate `hg-shipsh-review` pre-approved 2026-10-25. One conductor step before build: supply
the staging host's public key line (plan step 6).
