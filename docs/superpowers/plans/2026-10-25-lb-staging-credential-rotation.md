---
spec: docs/superpowers/specs/2026-10-25-lb-staging-credential-rotation-design.md
status: done
---

Size S, meta docs only. Branch `feat/lb-staging-credential-rotation` in the meta worktree
`kaleem-worktrees/meta-lb-staging-credential-rotation`. No submodule worktree, no migration, no
pointer bump, no ADR. Exact commands, the snippet and the probe's classification table are in
the private record `_ops/private/lb-staging-credential-rotation.md` (mode 600), not here.

**Secret handling, every step:** values move only by file and stdin. Never `cat`, `echo`,
`print`, a command-line argument or an environment variable. Outputs are counts, addresses and
verdicts. Anything in a terminal that looks like a password is an incident: stop and escalate.

## Steps

1. [ ] **Old values file (agent).** Extract the two values from meta commit `4472576` into
   `_ops/private/lb-staging-credential-rotation.old` (umask 077) with the private record's
   pipeline. Verify: it prints `old values: 2 lines`, and `stat` shows mode 600.

2. [ ] **Account-side check, red first (agent, local).** Bring up a disposable stack from
   `_tools/backend-gate.compose.yml` under its own `GATE_PROJECT`, run `migrate` and `seed_e2e`,
   then the snippet with stdin = the e2e seed password plus one random line.
   - Must print `control=ok`, `accepted>=4` and exit 1. This is the mutation check: it proves
     the snippet can see a match.
   - Then two random lines: must print `accepted=0` and exit 0.
   - Also break the control on purpose (compare against `v` for both assertions): it must fail
     with `CONTROL FAILED`.
   - Tear the stack down (`down -v --remove-orphans`).

3. [ ] **Login-side probe, red first (agent, local).** Same stack plus `runserver` on its
   network, and the probe pointed at it.
   - The e2e seed account with its seed password → ACCEPTED, exit 1.
   - A random value → REFUSED, exit 0.
   - The CSRF GET pointed at a wrong path → INCONCLUSIVE, exit 2. A broken request must never
     read as a refusal.
   - Tear the stack down.

4. [ ] **Account-side check on staging (conductor).** Run the private record's command over the
   staging SSH alias, with the old values file on stdin. Pass: `control=ok`, `named=7` (or fewer,
   each missing account recorded as deleted), `accepted=0`, exit 0. Paste the output into the
   private record, never into a PR or commit.

5. [ ] **Login-side probe on staging (agent).** Use the addresses from step 4's `named` list.
   For each: old value 1, old value 2, one random value, spaced at least 1 s apart. Pass: every
   line REFUSED, with the same status and body for the old and random attempts. Any ACCEPTED:
   stop and go to Risks. Any INCONCLUSIVE: one re-run after 10 minutes; twice → escalate.

6. [ ] **Docs (agent), only after steps 4 and 5 pass.**
   - `ISSUES.md`: strike the entry's headline and add **FIXED 2026-10-25**. Name the two checks
     and their outcome (accounts checked, none accepted) and drop the literal values. Keep:
     history holds them for good, and new credentials never enter the repo. Drop the deferral
     paragraph's open-exposure wording. Keep the paragraph separating rotation from the walk
     account.
   - `STATE.md`: replace the world-readable warning with one closed line. Strip the password
     from the C3d fixture warning.
   - `docs/superpowers/plans/2026-10-17-v1-parallel-programme.md`: the ADR-0032 deviation row
     and the wave-1 bullet for this unit say "rotated 2026-10-25 and verified".
   - Mark the spec `status: shipped`, `closed: 2026-10-25`, and this plan `status: done`.

7. [ ] **Hand back (agent).**
   - Shred the old values file (`shred -u`).
   - Commit with explicit paths (`ISSUES.md`, `STATE.md`, the programme plan, this spec and
     plan) as `docs: close the staging credential exposure (rotated, verified)`.
     `PIP_CONFIG_FILE=/dev/null`, never `--no-verify`.
   - Run the runbook section 3 hand-back checks.

## Gates

- `_tools/gitleaks-range.sh <meta worktree> origin/master..HEAD`: must end `CLEAN: N of N`.
- No leaked value in what this branch adds:
  `git diff origin/master...HEAD | grep '^+' | grep -cE 'Kaleem(C3d|Staging)!'` prints `0`,
  and the same grep over the final `ISSUES.md` and `STATE.md` prints `0` per file. This greps
  for a prefix and prints only a count.
- `.gitleaksignore` untouched: `git diff --quiet origin/master...HEAD -- .gitleaksignore`.
- Tree clean, branch contains `origin/master`, no floor touched (runbook section 3).
- e2e: none required (D3). This unit has no user-facing behaviour, and the spec says so. No
  coverage, migration or import-linter gate applies (no code).

## Risks

- **An old value still works.** This is a security finding. It goes to the private channel only
  (escalation trigger), with no public edit; the entry stays open and the owner re-rotates.
  Re-run steps 4 and 5 afterwards.
- **A secret reaches a terminal, log or commit.** Mitigated by stdin-only transport, a snippet
  that never echoes its input, and the step 7 grep. If it happens anyway, stop: the value
  printed counts as exposed, and the owner decides.
- **A false "refused".** Covered by the control in the snippet, the INCONCLUSIVE class in the
  probe, and the red-first local runs in steps 2 and 3. A check that has not been seen to fail
  is not trusted.
- **Check side effects.** Django rewrites a hash only when a value matches and its hasher needs
  an upgrade, which is the failure case. The probe logs out at once after any 200. Failed
  attempts leave ordinary log lines with test-account addresses.
- **The staging Django container cannot be found** (mid-deploy). The command exits 3. Re-run
  outside a deploy window; staging deploys are serialised by the merge queue.
- **`ISSUES.md` conflicts with another unit** (it is a shared file). Edit only this entry and
  merge `origin/master` before hand-back.

## Verification

- Steps 2 and 3: red and green on the local stack, as listed, before anything touches staging.
- Steps 4 and 5: both staging checks green, outputs recorded privately.
- Step 7: the gates above.
- Whole unit: the `ISSUES.md` entry is closed, `prv-preview-mode` and `launch-go-no-go` lose
  this gate, and no password appears in the branch, a terminal transcript or the hand-back.
