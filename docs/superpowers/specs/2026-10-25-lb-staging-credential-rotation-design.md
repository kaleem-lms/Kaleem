---
name: lb-staging-credential-rotation
phase: v1 programme (wave 1, ops stream)
modules: [staging (ops), docs]
status: shipped
created: 2026-10-25
closed: 2026-10-25
---

## Goal

Close the `ISSUES.md` *Blocks launch* entry "Staging passwords are world-readable on a public
`master`". The owner rotated the staging passwords of the seven listed accounts on 2026-10-25
(gate `hg-staging-rotation`). This unit **proves** the rotation and closes the record: it shows
that neither leaked value authenticates any staging user, without ever printing, logging or
committing a password, then updates the docs that describe the exposure. Rotation cannot remove
the strings from git history (ADR-0032), so the entry closes as "rotated and verified", not as
"removed".

Closing this unblocks the two units the programme gates on it: `prv-preview-mode` and
`launch-go-no-go`.

## User flow

No end-user behaviour changes. The operator flow:

1. **Old values file.** The two leaked values are extracted from a pinned meta commit into a
   mode-600 file in the private ops directory, by a pipeline that never echoes them. Only its
   line count is printed (must be 2).
2. **Account-side check (authoritative).** On the staging host, inside the running Django
   container, a read-only Django shell snippet reads the old values from **stdin** and, for
   **every** staging user (not only the seven), asks Django's own password check whether either
   value matches. It prints counts and, only for a match, the matching account's address. It
   first runs an in-process control (a fresh random password set on an unsaved user must match
   itself and must not match a changed value), so a broken check cannot report "none accepted".
   Run by the conductor over the staging SSH alias; the exact command is in the private record.
3. **Login-side check (end to end).** From the workstation, a probe logs in at
   `api-staging.kaleem.academy/api/v1/identity/login/` the way the dashboard does, once per
   listed account with each old value and once with a fresh random value, and classifies each
   response as ACCEPTED, REFUSED or INCONCLUSIVE (`LoginView`/`LoginSerializer` at backend
   `origin/main`: success is 200, or the "not verified" 400 that is only reached after the
   password matched; refusal is the 400 "Invalid credentials."). Anything else is
   INCONCLUSIVE and fails the run; it is never counted as a refusal. It prints only address,
   which attempt, and verdict.
4. **Close.** Both checks green: the docs are updated (below) and the old values file is
   shredded.

Error cases:

- **An old value is still accepted anywhere.** The unit stops, nothing public changes, and the
  result goes to the owner through the private channel (escalation trigger "any security
  finding"). The entry stays open.
- **INCONCLUSIVE responses** (429, 403, 5xx, network): re-run once after a pause; twice →
  escalate. Never treat as refused.
- **Fewer than seven listed accounts exist** (deleted rather than rotated): also closed for
  that account; the record says which were deleted.

## Personal data (ADR-0023)

- **What:** the checks read staging `User` rows (email, `is_active`, password hash) through
  Django's own APIs. Staging holds only test and throwaway accounts; no real user exists yet.
- **Why:** to prove that no account accepts a leaked value.
- **How long:** the output (counts, test-account addresses, verdicts) lives only in the private
  ops record until the unit closes; the old values file is shredded at close.
- **Who sees it:** the conductor and the owner. Nothing is written to the database, and the
  public docs carry only the outcome.

## Data model delta

None.

## API delta

None. The probe uses the existing `identity/csrf/`, `identity/login/` and `identity/logout/`
routes under `/api/v1/` exactly as the dashboard does.

## Frontend

None. No route, component or string changes.

## Docs delta

Edited only after both checks are green:

- `ISSUES.md`: the entry is deleted, per the file's own rule that resolved entries are deleted
  rather than struck through (git keeps it). The two lasting facts move to `STATE.md`: the strings
  stay in history for good, and new staging credentials never enter the repo.
- `STATE.md`: the standing warning about world-readable staging passwords is replaced by the
  closed state; the C3d fixture warning keeps its "reset rather than assume a regression"
  advice and loses the password.
- `docs/superpowers/plans/2026-10-17-v1-parallel-programme.md`: the ADR-0032 deviation row and
  the wave-1 line stop saying "deferred".

Untouched on purpose: `.gitleaksignore` (it fingerprints the separate 588a1e35 credentials and
its lines stay, ADR-0032; it holds no line for these values), and the dated journals, ADR-0042
and the two C3e plans that quote the old values. Those are historical records, the values are in
history regardless, and after this unit they are dead.

## Module boundaries

None touched. Meta docs only; no submodule change, no pointer bump.

## Out of scope

- Rotating anything else (Django secret key, Stripe, coturn, SES): not part of this exposure.
- A history rewrite (rejected in ADR-0032).
- Making the meta repo private, or a scanner rule for these strings: the new values are not in
  the repo, and gitleaks' tree scan stays the guard against a new credential being committed.
- Recovering or resetting the walk or pool accounts (`hg-staging-accounts`).
- The weekly journal line and the programme file's gate status: conductor close-out.

## Test plan

There is no product code, so the tests are the two checks and their controls:

- **Account-side check, mutation-checked locally first:** against a disposable local stack with
  the e2e seed accounts, stdin = the e2e seed password plus a random line must report the four
  seeded accounts as accepted and exit non-zero; two random lines must report none and exit 0.
  On staging: control passes, `accepted=0`, exit 0.
- **Login-side check, mutation-checked locally first:** against a local stack, the e2e seed
  account with its seed password → ACCEPTED; with a random value → REFUSED. On staging: every
  old-value attempt and every random-value attempt is REFUSED, with an identical response for
  both, so a leaked value is indistinguishable from a wrong one.
- **No secret leaves the private directory:** `gitleaks-range.sh` CLEAN over the branch, and a
  grep of the branch's **added** lines, and of the final `ISSUES.md` and `STATE.md`, for the
  leaked values' prefix finds nothing.
- **e2e:** none (D3: no user-facing behaviour).

## Open questions

None. `hg-staging-rotation` is answered (owner rotated, 2026-10-25); the conductor's use of the
staging SSH alias is pre-approved by the owner's access delegation.
