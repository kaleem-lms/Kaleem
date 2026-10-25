---
spec: docs/superpowers/specs/2026-10-25-lb-signaling-deploy-continuity-design.md
status: draft
---

Worktrees: `R=/home/abdulkhalek/Projects/kaleem-worktrees`, `U=lb-signaling-deploy-continuity`.
Create `${R}/backend-${U}`, `${R}/dashboard-${U}` and `${R}/infra-${U}` per runbook §1. Meta work
(the ADR and runbooks) goes in `${R}/meta-${U}`. No migrations. No dependency change. Floors are
not touched (dec-floor-ownership).

## Steps

0. [ ] **M1 baseline on staging (conductor, inside the staging lock, before anything lands).**
   1. Put two staging pool accounts in a live call: Playwright with fake media, as in
      dec-d9-substitute. Run a probe that logs, every 250 ms, for each page: the remote tile's
      `getVideoPlaybackQuality().totalVideoFrames`, whether a heading matching `/connection.*lost/i`
      is visible, and whether the local `<video>` still has a live track.
   2. Then run:

      ```bash
      ssh kaleem 'docker version --format "{{.Server.Version}}"; docker compose version --short'
      ssh kaleem 'cd /opt/kaleem && SHA=$(docker inspect --format "{{.Config.Image}}" kaleem-signaling-1); SHA=${SHA##*:}; \
        T0=$(date +%s%N); DEPLOY_SHA=$SHA docker compose -f docker-compose.production.yml --env-file .env.production \
        up -d --no-deps --force-recreate signaling; \
        until [ "$(docker inspect --format "{{.State.Health.Status}}" kaleem-signaling-1)" = healthy ]; do sleep 0.2; done; \
        echo "recreate->healthy $(( ($(date +%s%N)-T0)/1000000 )) ms"'
      ```

   3. Record in the ADR draft (none of these values is sensitive):
      - the Engine and compose versions;
      - the time from recreate to healthy;
      - the time from the first page close to "lost";
      - whether frames stopped.

      Expected from the code: `lost` within about 1 s, the camera stopped, and about 15 s to
      healthy.

   This step does not block steps 1-5, which follow from the code. It must be done before step 6
   finalises the ADR.

1. [ ] **backend: `signaling/fingerprint.py` (TDD).**
   1. First write `signaling/tests/test_fingerprint.py`, so these fail before the module exists:
      - `test_same_tree_same_value`;
      - `test_signaling_file_change_changes_value`;
      - `test_tests_pycache_and_outside_files_are_ignored`;
      - `test_distribution_version_change_changes_value` (inject the distribution list);
      - `test_python_version_change_changes_value`;
      - `test_dpkg_status_change_changes_value` and `test_missing_dpkg_status_is_allowed`;
      - `test_value_is_64_lowercase_hex`;
      - `test_main_prints_one_line` (capsys).
   2. Then implement `fingerprint(root, distributions, python, dpkg_status) -> str`, with defaults
      read from the live interpreter, and `main()`. Use only the standard library; the import
      contract must stay green.
   3. Mutation check: drop the distributions input and see the version test fail; drop the
      exclusion and see the ignore test fail.

2. [ ] **infra: `choose_signaling_sha` in `scripts/deploy-lib.sh` (TDD).**
   1. Extend the docker stub in `scripts/test-deploy-lib.sh` so it answers `inspect`,
      `exec kaleem-signaling-1 python -m signaling.fingerprint` and
      `run --rm ... python -m signaling.fingerprint` from `STUB_*` files and exit codes.
   2. Add these cases first:
      - equal fingerprints give the running SHA;
      - different fingerprints give the deploy SHA;
      - each of these gives the deploy SHA and logs a reason:
        - no container;
        - `exec` fails;
        - `run` fails;
        - non-hex output;
        - a running image that is not `ghcr.io/kaleem-lms/backend:<hex>`.
   3. Then implement the function: print the chosen SHA on stdout and the reason on stderr. It
      never fails, because it returns 0 on every path.
   4. Mutation check: make it always return the deploy SHA and see the "equal" case fail; make it
      keep the running SHA when `run` fails and see that case fail.

3. [ ] **infra: wire it into `ship.sh` and the compose file.**
   1. In `ship.sh`, after step 3b:

      ```bash
      SIGNALING_SHA=$(choose_signaling_sha "$DEPLOY_SHA")
      export SIGNALING_SHA
      ```

      This must be an export, not a prefix: step 5's profile `up -d` re-applies signaling.
      - Log `signaling unchanged (<fp12>); keeping <sha>` or `signaling changed; recreating on
        <sha>`.
      - `restore_signaling` compares against `ghcr.io/kaleem-lms/backend:${SIGNALING_SHA}` and
        restores with `SIGNALING_SHA="$PREV_SHA"`.
      - Rewrite the step-4 comment: signaling is now recreated only when its fingerprint changes.
   2. In the compose file:
      - change the signaling image to `${SIGNALING_SHA:-${DEPLOY_SHA:-latest}}`;
      - in the healthcheck, add `start_period: 30s` and `start_interval: 1s`.
   3. Verify locally:
      - `docker compose -f docker-compose.production.yml --env-file .env.production.example
        config --images` prints the right signaling image in three cases: both variables set, only
        `DEPLOY_SHA` set, neither set (nested interpolation).
      - In a scratch directory, give a two-line alpine service an `env_file`, run `up -d`, edit the
        file, and run `up -d` again. Confirm the container is recreated. **If it is not**,
        `choose_signaling_sha` also compares a SHA-256 of `.env.production`, kept in
        `/opt/kaleem/.signaling-env-sha` and written after a healthy signaling (the coturn
        pattern), and step 2 gains the two matching test cases.
   4. Also run `.github/scripts/check-shipsh-services.sh` and `bash -n scripts/ship.sh`.
   5. **If M1 showed an Engine older than 25:** drop `start_interval` and set `interval: 2s`.

4. [ ] **dashboard: `useSignaling` (TDD).**
   1. First, in `useSignaling.test.ts`, rewrite "reports a retryable close after an open as lost"
      as "a drop after an open is not a failure while reconnects remain" (`failure` stays null and
      a second socket is created).
   2. Rewrite "reports a hung reconnect after an open as lost, not unreachable" so that it is
      retried through the budget, never reports `unreachable`, and reports `lost` only after the
      last attempt.
   3. Add "after an open, exhausting the budget reports lost and stops" and "a terminal code after
      an open is still immediate".
   4. Then change `handleDrop`: after an open, a retryable failure is set only when
      `attemptRef.current >= MAX_RECONNECT_ATTEMPTS`.
   5. Confirm `usePeerConnection.test.ts` already covers "a teacher re-offers on a second
      `peer-joined` on the same connection". If it does not, add that test.
   6. Mutation check: restore the immediate `setFailure` and see the new tests fail.

5. [ ] **e2e: "a call survives a signaling drop" in `e2e/call.spec.ts`.** Put it in the existing
   serial describe, because it uses the same seeded session and room.
   1. Each page installs `routeWebSocket(/\/ws\/rooms\//, ws => { server = ws.connectToServer();
      ... })` and keeps the pair.
   2. Once both remote tiles show frames, cut every pair at once:
      - stop forwarding server-to-page traffic;
      - `server.close()`;
      - `ws.close({ code: 1012 })`.
   3. Then assert:
      - no `/connection.*lost/i` heading for 10 s;
      - the Leave button is visible;
      - `totalVideoFrames` on the remote tile has risen at +2 s and +8 s;
      - each route saw a second connection;
      - `pageErrors` is empty.
   4. Run it in port slot 1 or 2 (runbook §2).
   5. Mutation check: run it against a build with step 4 reverted and see the "lost" assertion
      fail.

   **Fallback** if `connectToServer` does not carry the token subprotocol (the relay would answer
   4401): wrap `window.WebSocket` in `addInitScript` and close the live sockets from the page with
   code 3000. A client-side close still fires `onclose`, and both sockets leaving empties the room
   just as a restart does.

6. [ ] **meta docs (unit meta worktree).**
   1. Write a new ADR, numbered by the conductor, that amends ADR-0037's "A deploy still drops
      calls" consequence. It records:
      - the fingerprint gate;
      - client resume;
      - the faster health gate;
      - why drain was rejected;
      - the M1 numbers.
   2. In `docs/runbook/signaling.md`:
      - rewrite "Deploys drop live calls";
      - in "Rotating the shared secret", step 3 now depends on compose's `env_file` hash, or on
        the fallback;
      - note that a manual `up -d signaling` must set `SIGNALING_SHA`.
   3. In `docs/runbook/deploy.md`, add one paragraph on `SIGNALING_SHA` in a rollback.
   4. Leave the ISSUES entries and the CLAUDE.md D3 row to the conductor's close-out batch:
      - the C3b "A deploy drops every live call" entry;
      - the "`lost` shows at the first signaling drop" entry;
      - the D3 `scheduling` call-client row gains this flow and its stated limits.

7. [ ] **Gates and hand-back** (runbook §2-3), in each worktree:
   1. Run `git merge --no-edit origin/main` (never a rebase).
   2. Run the gates for each repo:
      - **backend:** `"${R}/_tools/backend-gate.sh" "${R}/backend-${U}"` (full gate: pytest with
        coverage, ruff, lint-imports, mypy);
      - **dashboard:** `"${R}/_tools/dashboard-gate.sh" "${R}/dashboard-${U}"`;
      - **infra:** `bash scripts/test-deploy-lib.sh` and
        `.github/scripts/check-shipsh-services.sh`, run from the meta worktree against the infra
        worktree's files.
   3. In every repo, run `gitleaks-range.sh` over `origin/main..HEAD`, check that the tree is
      clean, and check that no floor was touched.
   4. Hand back with the mutation-check lines and `needs: infra/ship.sh + compose
      (hg-shipsh-review, pre-approved)`.

8. [ ] **After deploy (conductor, staging lock).**
   1. The first deploy after landing must log `signaling changed; recreating`, because the old
      image has no module.
   2. **M2:** repeat M1's call and forced recreate on the new bundle. Expect frames to keep rising
      on both pages, no terminal screen, a working camera, and a time from recreate to healthy of
      about 2 s.
      **If recreate-to-healthy exceeds 10 s**, raise `MAX_RECONNECT_ATTEMPTS` by one in a
      follow-up commit.
   3. **M3:** run
      `ssh kaleem 'docker inspect --format "{{.Id}} {{.State.StartedAt}} {{.Config.Image}}" kaleem-signaling-1'`
      before and after the next unrelated deploy. All three values must be identical, and the
      deploy log must show `signaling unchanged`.
   4. Add the numbers to the ADR in the close-out batch.

## Risks

- **A false "unchanged" leaves signaling stale.** The inputs are deliberately broad: the whole
  package, every installed distribution, the interpreter version and dpkg status. Any read
  failure falls back to a recreate. The `RELAYABLE` deploy-first rule still holds, because
  `app.py` is a fingerprint input.
- **`env_file` changes may not recreate the container.** Step 3 verifies this, and the fallback is
  stated there. Secret rotation relies on it.
- **The healthcheck may not shorten Traefik's gap** (the Engine is too old, or the measurement
  shows a different cause). M1 and M2 time it, and the rule in step 8 raises the reconnect budget
  by one.
- **Renegotiation on a live connection could disturb media.** It reuses the same transceivers
  (ADR-0039), and the e2e frame counter and M2 would show any stall.
- **`routeWebSocket` may not carry the subprotocol.** The fallback is in step 5.
- **Shared file `infra/scripts/ship.sh`:** lb-uptime-host-alerts, rch-backup-automation,
  lb-error-tracking, rch-redis-caching and msg-realtime also edit it. The changes touch step 3b,
  `restore_signaling` and the step-4 comment only, which keeps conflicts small. The conductor
  orders the merges.

## Verification

- Each step's tests go red first and are mutation-checked as listed.
- The full gates are green in all three repos.
- CI is green on the meta draft PR, and its e2e log names the new flow.
- On staging: M1, M2 and M3 are recorded with numbers, and the first post-landing deploy log
  reads "signaling changed".
- The whole unit is done when a forced signaling recreate during a staging call leaves both sides
  with rising frames and no terminal screen (M2), and an unrelated deploy leaves the signaling
  container untouched (M3).
