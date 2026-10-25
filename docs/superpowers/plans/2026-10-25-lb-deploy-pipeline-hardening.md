---
spec: docs/superpowers/specs/2026-10-25-lb-deploy-pipeline-hardening-design.md
status: draft
---

Bases: infra `origin/main` ab91adc, meta `origin/master` 4472576. Worktrees
`kaleem-worktrees/{infra,meta}-lb-deploy-pipeline-hardening`, branch
`feat/lb-deploy-pipeline-hardening` (runbook section 1). No backend or dashboard change, so no
`_tools` gate script applies; the gates are the shell tests below plus `_tools/gitleaks-range.sh`.
Floors are not touched (`dec-floor-ownership`). No migration. No e2e (no user-facing behaviour).

Each code step: write the test, run it red, write the code, run it green, mutation-check (revert
the code, see red, restore) and record the check in the hand-back. Shell scripts follow
`check-published-ports.sh`: `#!/usr/bin/env bash`, `set -euo pipefail`, every variable braced.

## Infra PR (`feat/lb-deploy-pipeline-hardening` → `main`)

1. [ ] **Retention selection.** Test first, `scripts/test-deploy-lib.sh` (table-driven, the
   `test-check-published-ports.sh` `expect` shape, exits non-zero on any failure). Cases:
   `keeps_last_n` (7 history SHAs, N=5: the oldest two selected), `keeps_deploying_sha` (not in
   history), `keeps_in_use` (an old SHA a stopped container uses), `ignores_other_repos`
   (`traefik:v3`, `postgres:18-alpine`), `ignores_latest_and_buildcache`, `ignores_untagged`
   (`<none>`). Code: `scripts/deploy-lib.sh`, `select_prunable KEEP HISTORY_FILE DEPLOY_SHA`
   reading two newline lists on fds or args: present images (`repo:tag`) and in-use images; prints
   the `repo:tag` refs to remove. Pure: no `docker` call.
2. [ ] **History.** Tests: `history_add_appends`, `history_add_dedupes_moves_to_end`,
   `history_trims_to_50`, `history_ignores_non_hex_lines` (7-40 hex), `history_write_is_atomic`
   (target directory read-only → old file intact, non-zero return), `history_seed_when_empty`
   (missing and empty file both seeded with the given SHA; a non-empty file untouched). Code:
   `history_add FILE SHA`, `history_seed FILE SHA`, `history_tail FILE N` in `deploy-lib.sh`, tmp +
   `mv -f` like `write_state`.
3. [ ] **Service set.** Tests: `services_equal_pass`, `services_extra_fails_names_it`,
   `services_missing_fails_names_it`. Code: `services_diff "<compose services>" "<listed>"`,
   prints `unlisted: x` / `not in compose: y`, returns 1 on any difference.
4. [ ] **Non-fatal removal wrapper.** Test with a stub `docker` first on `PATH` (writes its argv to
   a file; `rmi` of one ref exits 1): `remove_images_nonfatal` returns 0, logs
   `WARNING: could not remove <ref>`, still attempts the rest, then runs `docker image prune -f`
   (dangling only, never `-a`). Code: `remove_images_nonfatal` and `prune_superseded KEEP
   HISTORY_FILE DEPLOY_SHA`, which gathers the two lists with
   `docker image ls --format '{{.Repository}}:{{.Tag}}'` and `docker ps -a --format '{{.Image}}'`
   and calls `select_prunable` then `remove_images_nonfatal`. Logs `Keeping: <shas>` and
   `Removed <n> superseded images`.
5. [ ] **Wire `ship.sh`.** Test first in `test-deploy-lib.sh`: `ship_list_services` (`bash
   scripts/ship.sh --list-services` prints exactly the eight names, runs no `docker` — stub on
   `PATH` records zero calls) and `ship_parses` (`bash -n`). Code, in order:
   - `SHARED_SERVICES=(traefik postgres redis flower coturn signaling)` and
     `STATIC_SERVICES=(dashboard marketing)` at the top; `--list-services` handled before the
     `DEPLOY_SHA` usage line; `source "$(dirname "${BASH_SOURCE[0]}")/deploy-lib.sh"`.
   - New step 0a: `services_diff "$(docker compose ... config --services)"` against the union;
     on difference print it and exit 1 before step 3 touches anything.
   - Step 1 unchanged, then: `history_seed` with the SHA of `kaleem-django-${CURRENT}-1`'s image
     (skipped when `CURRENT=none` or the container is absent), then `prune_superseded` (non-fatal),
     then the existing free-space check (its hint now names `.deploy-history` retention, not
     `until=24h`).
   - Steps 4 and 10 use the arrays. Step 7b also calls `history_add "$DEPLOY_SHA"` after
     `write_state`. Step 11 replaces `docker image prune -a -f --filter until=24h` with
     `prune_superseded`; the `Disk now:` line is kept byte-for-byte.
   - `KEEP_DEPLOYS="${KEEP_DEPLOYS:-5}"`, `HISTORY_FILE=/opt/kaleem/.deploy-history`.
   Locally, also `shellcheck scripts/*.sh` if installed (not a CI gate).
6. [ ] **Mutation pass and commit.** Revert each function body in turn and see its tests red.
   Commit: `feat(deploy): keep the last N deploys and assert ship.sh's service lists`.

## Meta PR (`feat/lb-deploy-pipeline-hardening` → `master`)

Conductor prerequisite for step 9: the staging host's ed25519 public key line (VPS step V1).

7. [ ] **`check-shipsh-services.sh`.** Test first, `.github/scripts/test-check-shipsh-services.sh`:
   generated compose fixtures with a stub ship script — `profiled_ignored`, `extra_shared_fails`,
   `missing_fails`, `required_vars_get_dummies` (a `${X:?}` variable does not break resolution),
   then the real pair (`infra/docker-compose.production.yml`, `infra/scripts/ship.sh`) passes.
   Code: `check-shipsh-services.sh <compose> <ship.sh>`, resolution copied from
   `check-published-ports.sh` (dummy `:?` vars, empty `.env.production` in a temp dir), compares
   `config --services` with `bash <ship.sh> --list-services`. Exit 0 match, 1 mismatch, 2 cannot
   resolve.
8. [ ] **`deploy-outcome.sh`.** Test first, `.github/scripts/test-deploy-outcome.sh`, with
   `toJSON(needs)`-shaped fixtures: `deploy_success_passes`, `docs_only_passes_with_notice`
   (`code=false`), `gate_failed_deploy_skipped_fails_names_gate`, `deploy_failed_fails`,
   `dependabot_skip_fails`. Code: reads `NEEDS_JSON`, `CODE`, `ACTOR` from env; uses `jq`; writes
   `::notice::`/`::error::` and a table of each need's result to `$GITHUB_STEP_SUMMARY` when set.
9. [ ] **`ci.yml`.** One commit, three parts:
   - `security` job: after "Only the documented ports are published", a step running
     `infra/scripts/test-deploy-lib.sh`, `.github/scripts/test-check-shipsh-services.sh`,
     `.github/scripts/check-shipsh-services.sh infra/docker-compose.production.yml
     infra/scripts/ship.sh` and `.github/scripts/test-deploy-outcome.sh`.
   - `deploy-staging`: `docker buildx create --use --driver docker-container` once; each image
     built with `docker buildx build --push --provenance=false`, the same `-f`, `--target`,
     `--secret`, `--build-arg` and both tags as today, plus
     `--cache-from type=registry,ref=ghcr.io/kaleem-lms/<image>:buildcache` and
     `--cache-to type=registry,ref=ghcr.io/kaleem-lms/<image>:buildcache,mode=max`; the separate
     push steps go. The two `appleboy` steps are replaced by one step: key to
     `$RUNNER_TEMP/staging_key` under `umask 077`; `ssh` options `-i`, `IdentitiesOnly=yes`,
     `BatchMode=yes`, `StrictHostKeyChecking=yes`,
     `UserKnownHostsFile=.github/deploy/staging_known_hosts`, `HostKeyAlias=kaleem-staging`,
     `ConnectTimeout=20`; `tar -C infra -cf - docker-compose.production.yml scripts/ship.sh
     scripts/deploy-lib.sh traefik/traefik.yml coturn/turnserver.conf | ssh … 'tar -C /opt/kaleem
     -xf -'`; then `printf '%s' "$GHCR_PAT" | ssh … "docker login ghcr.io -u <actor>
     --password-stdin"`; then `ssh … "cd /opt/kaleem && bash scripts/ship.sh ${SHORT_SHA}"`.
     Secrets reach the step through `env:`, never interpolated into `run:`. Keep the existing
     comments' facts (coturn conf is mandatory; `.env.production` is not synced).
   - New `deploy-outcome` job: `needs` = every gate plus `deploy-staging`; `if: always() &&
     github.event_name == 'push' && github.ref == 'refs/heads/master'`; `timeout-minutes: 5`;
     checkout without submodules; runs `.github/scripts/deploy-outcome.sh` with
     `NEEDS_JSON: ${{ toJSON(needs) }}`.
   Commit `.github/deploy/staging_known_hosts` (one line, `kaleem-staging ssh-ed25519 AAAA…`) in
   the same commit. Validate: YAML parses; `actionlint` via its pinned Docker image if reachable.
10. [ ] **Docs.** `docs/runbook/deploy.md`: rollback from `.deploy-history`, `KEEP_DEPLOYS`, the
    `deploy-outcome` job, the host-key file and how to rotate it. `docs/runbook/ci.md`: the new
    job and checks. `ISSUES.md`: strike the #88 silent-skip entry and the downloaded-binary entry
    as fixed; amend the 2026-09-12 disk entry's (b) and (c) as fixed, (a) left to
    `lb-uptime-host-alerts`; add the infra `CLAUDE.md` `deploy.sh` naming one-liner.
11. [ ] **Pointer bump** to the merged infra commit, in the same meta PR (the sync list and the
    sourced file must arrive together). Merge `origin/master` (never rebase) before hand-back.

## Gates

- `bash infra/scripts/test-deploy-lib.sh`, and the three meta `test-*.sh` plus the real-file
  check, run locally from the meta worktree with the infra worktree in place of the submodule
  dir (or after the pointer bump).
- `_tools/gitleaks-range.sh` over `origin/main..feat/…` (infra) and
  `origin/master..feat/…` (meta).
- CI `security` job green on the meta PR; the `deploy-staging` and `deploy-outcome` proof is the
  first master run.

## VPS steps (conductor, over the owner-delegated shell)

- V1, before step 9: `cat /etc/ssh/ssh_host_ed25519_key.pub` on the staging host; confirm its
  fingerprint (`ssh-keygen -lf`) matches the conductor's known_hosts entry for the address
  STAGING_HOST holds. Hand the line to the builder.
- V2, before the meta merge: `docker compose version` (expect v2 or later; the
  `config --services` profile behaviour was verified on 5.6.1) and `tar --version` (GNU).
- V3, after the first deploy: `tail -5 /opt/kaleem/.deploy-history`;
  `docker image ls 'ghcr.io/kaleem-lms/*' --format '{{.Repository}}:{{.Tag}} {{.Size}}'` (at most 5
  SHAs per repository plus the live one); `df -h /var/lib/docker`.
- V4, after a second deploy: the build log shows `CACHED` layers. Then lift the `Disk now:`
  deploy cap in the programme's serialization points.

## Risks

- **Transport and cache are proven only on master.** `deploy-staging` runs only on a master
  push. A failure in the build or SSH steps happens before `ship.sh` runs, so staging keeps
  serving the previous deploy; `deploy-outcome` goes red. Fallback: revert the meta PR (the
  previous pointer still has the old `ship.sh`, and the old sync list). Merge outside a release
  train, and watch the run.
- **Retention removes a rollback target.** Guarded by in-use protection, the seed, and tests;
  `docker rmi` without `-f` cannot remove an image a container uses. Worst case is a re-pull from
  GHCR, which keeps every tag.
- **Host compose differs.** If the host's `config --services` lists profiled services, step 0a
  refuses every deploy with the difference printed; V2 checks this before merge.
- **Host key rotates** (VPS rebuild): every deploy fails at the first SSH call until
  `staging_known_hosts` is updated; the runbook says how.
- **Cache poisoning.** Only the master-push job, after every gate, reads or writes `buildcache`;
  PR jobs never touch it.
- **Shared files.** `infra/scripts/ship.sh` and `ci.yml` are shared with other infra/ops units
  (`lb-signaling-deploy-continuity`, `lb-uptime-host-alerts`): this unit heads the queue, later
  units build on these arrays and the new lib.

## Verification

Steps 1-8 by their tests (red first, mutation-checked). Step 9 by the meta PR's `security` job and
then the first master run: `deploy-staging` green, `deploy-outcome` green, VPS steps V3-V4. The
skip path is proven by step 8's fixtures; it is not provoked on master.
