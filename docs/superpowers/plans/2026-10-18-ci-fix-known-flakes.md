---
spec: docs/superpowers/specs/2026-10-18-ci-fix-known-flakes-design.md
status: draft
---

Worktrees: meta `kaleem-worktrees/meta-ci-fix-known-flakes`, dashboard
`kaleem-worktrees/dashboard-ci-fix-known-flakes`, both on `feat/ci-fix-known-flakes`
(runbook §1). Brace every variable a colon follows (zsh). Agents never push.

## Steps

1. [ ] **Worktree.** Create the dashboard worktree off `origin/main` (runbook §1), then run
   `pnpm install --frozen-lockfile`.

2. [ ] **Fix 1, prove red first.** In e2e slot 1 (runbook §2), build `origin/main` and run
   `playwright test e2e/call.spec.ts -g "lobby has a way back"`. Record the failing height.
   It is expected to be 43, as it is known to fail locally. If it passes here, note that and
   carry on: the mutation check in step 4 is the proof that counts.

3. [ ] **Fix 1, write the hit-test.** In `e2e/call.spec.ts`, replace the `boundingBox()` and
   `Math.round(...) >= 44` lines with the following:
   - one `page.evaluate` call that runs `scrollIntoView({block:"center"})` on the exit;
   - a probe of `elementFromPoint` at `(cx±21, cy±21)`, requiring `el === hit || el.contains(hit)`;
   - a return of the four results, then `expect(...).toEqual([true,true,true,true])` with a
     message that names the target.

   Locate the exit with the existing role query, using `exit.evaluate(...)`. Add a comment
   saying that `REACH = 21` means "accepts 43px or more; 44 is the goal, and 1px allows for
   sub-pixel layout on different runners". The comment also cross-references
   `touch-targets.spec.ts`. Then re-run the step 2 command: it must be green.

4. [ ] **Fix 1, mutation-check.** Each of these changes is temporary and is never committed:
   - Set `src/features/call/ExitToSchedule.tsx` `h-11` → `h-10`, rebuild and re-run. The
     test must be red.
   - Revert that, then add an absolutely positioned `div` that covers the exit. The test must
     be red.
   - Revert again. The test must be green.

   Record all three results for the PR body. If the test stays green on a mutant, rework the
   hit-test. If that happens twice, escalate.

5. [ ] **Fix 1, keep the comment honest.** In `src/features/call/ExitToSchedule.test.tsx`,
   change the "measures a bounding box" comment to "hit-tests the target". Commit
   `test(e2e): hit-test the lobby exit instead of measuring its painted box`.

6. [ ] **Fix 2, the repro harness.** This is a scratchpad script, not committed. It
   reproduces a CI-shaped runner that is overloaded, without taking over the shared host.
   - Take one heavy slot by `flock` on `_locks/heavy-N.lock`, and wait while MemAvailable is
     below 6 GiB, the same as `dashboard-gate.sh` does.
   - Run everything under `taskset -c <4 free cores>`. `os.availableParallelism()` honours
     the affinity (measured: 28 normally, 4 under `taskset -c 0-3`), so vitest picks the
     same default worker count as CI's 4-vCPU runner.
   - Start 4 CPU burners (`node -e 'for(;;){}'`) on the same 4 cores. Kill them by PID
     afterwards.
   - Run `pnpm exec vitest run --coverage --reporter=json --outputFile=<n>.json` N times,
     with **no** `--maxWorkers`, so the default (before) or the config cap (after) is what
     gets measured. Keep stderr for each run.

   A run counts as a crash when either of these holds:
   - its `numTotalTestSuites` is below `git ls-files 'src/**/*.test.ts*' | wc -l`;
   - its stderr contains `installInterfaces`.

   Log the exit code and the wall-clock time of each run.

7. [ ] **Fix 2, the baseline.** Run the harness 12 times on unchanged `origin/main`.
   - **At least 2 crashes:** proceed to step 8.
   - **0 or 1 crashes:** raise the burners to 8 on the same 4 cores, and run 12 more times.
   - **Still fewer than 2 crashes:** stop and escalate. Ask: "the jsdom crash does not
     reproduce on this host; ship no change, or ship remedy A unproven?" Ship nothing
     unproven.

   Record the counts and the median wall-clock time.

8. [ ] **Fix 2, remedy A (config only).** In `vitest.config.ts`, inside `test`, set
   `pool: "forks"` explicitly, plus `maxWorkers` (start at `"50%"`). Add a 3-line comment
   that cites the spec. Do not touch `coverage.thresholds`. Then run the harness 24 times
   under the same conditions as the baseline.
   - **0 crashes, and the median time is at most 125% of baseline:** go to step 10.
   - **Crashes remain:** try a lower cap once more. If crashes still remain, go to step 9.
   - The local gate's `--maxWorkers=6` still overrides the cap, which is fine on the 28-core
     host.

9. [ ] **Fix 2, remedy B (pin; only if A fails).** Hand back to the conductor first, to get
   dashboard's dependency slot (execution protocol step 4). Then:
   - Pin `jsdom` to an exact version. Prefer an earlier 29.x or 28.x, or a later release
     whose changelog mentions `installInterfaces`/`createWindow`.
   - Run `npx -y pnpm@10.28.0 install`, then `pnpm install --frozen-lockfile`.
   - Re-run the harness 24 times under the step 7 conditions.
   - If B also fails, escalate (the gate is red twice for a reason that cannot be fixed in
     scope).

10. [ ] **Fix 2, commit.** Commit `vitest.config.ts`, or `package.json` and `pnpm-lock.yaml`
    for remedy B, as `fix(test): <remedy> to stop jsdom dropping a file under load`. The PR
    body carries the before and after tables.

11. [ ] **Gates.**
    - `_tools/dashboard-gate.sh <wt>`: the full gate (tsc, biome, coverage with the floors
      unchanged, build, built-CSS check).
    - The full e2e suite in slot 1, as a local smoke test. CI is the authority.
    - `_tools/gitleaks-range.sh` over `origin/main..feat/ci-fix-known-flakes`.

12. [ ] **Meta docs**, in the meta worktree, in the same meta PR as the pointer bump:
    - `ISSUES.md`: mark both entries **FIXED** with the date, with the remedy and its numbers. These
      are "call.spec.ts's ... 44px with zero tolerance" and "The dashboard unit suite flakes:
      jsdom ...". Add one line to the "under memory pressure" gotcha pointing at the cap.
    - Do not edit CLAUDE.md's D3 table: the flow count is unchanged.
    - The conductor drops "call.spec.ts:207 (43 px)" from runbook §2's list of known
      local-only failures.

## Risks

- **The crash does not reproduce here** (step 7). In that case, escalate rather than ship a
  guess.
- **A cap in the config slows the suite.** Bounded by the 125% bar. CI's 4-vCPU runner
  already defaults to about 3 workers, so a `"50%"` cap changes CI by at most one worker.
- **The cap fixes the crash locally, but CI's own rate is unknown.** CI runs Node 22 and the
  host runs Node 24. The guard here is the ADR-0027 §5 rule: any later pass-on-rerun is
  reported with its run URL.
- **The hit-test hits a child of the exit** (the SVG or the text). The check is `contains`,
  so a child counts as a hit.
- **Remedy B carries risk from a jsdom major-version change** (DOM API differences in tests).
  The full gate catches it. If it means test edits beyond the version pin, the scope has
  grown, so escalate.

## Verification

- Step 2 or step 4 red, then step 3 green, for the lobby flow. The mutation results are
  recorded.
- The harness numbers: at least 2 crashes in 12 runs before, and 0 in 24 after, with the
  wall-clock ratio. These go in the PR body and the ISSUES entry.
- `dashboard-gate.sh` green. CI green on the first attempt, with no retry used, and the e2e
  log shows the lobby test passed on attempt 1.
- No migrations, no new unit tests (no `src` behaviour changes), and the coverage floors
  are untouched.
