---
spec: docs/superpowers/specs/2026-10-18-ntf-mail-e2e-harness-design.md
status: built
---

# Plan: ntf-mail-e2e-harness

Branches: `feat/ntf-mail-e2e-harness` in `backend`, in `dashboard` (worktrees made as
runbook §1 says) and in meta (this worktree). Order of landing: backend first (the seed
account and prune must exist before a flow uses them), then dashboard, then the meta PR
with ci.yml, the compose pin, the ADR and both pins.

Baseline: backend origin/main `48371cf`, dashboard origin/main `4768c0b`.
`ci-parallel-guards` has landed: the worker, the probe step and `seed_e2e_all` are on
meta master.

No migrations, no dependency changes and no floor edits. The dashboard's coverage is
unaffected because `e2e/` is outside vitest and `tsconfig.json` (`include: ["src"]`).
Biome still lints it.

## Steps

1. [x] **Seed: the reset account and the register prune (backend). Tests first.** In
   `kaleem/identity/tests/test_seed_e2e.py`:
   - Rename `test_seeds_the_five_accounts_with_their_profiles` to `..._six_...` and add
     `e2e.reset@kaleem.test` with a `ParentProfile`.
   - Add the reset account to `test_the_four_real_accounts_are_verified_and_can_authenticate`'s
     list, and rename it to match.
   - Add `test_reseeding_restores_the_reset_accounts_password`: set a different
     password, reseed, and assert `check_password(E2E_PASSWORD)`.
   - Add `test_prunes_registrations_left_behind_by_a_previous_e2e_run`: create
     `e2e.register.ab12cd34@kaleem.test` (8 hex characters, the shape `uniqueEmail`
     makes), reseed, and assert it is gone.
   - In `test_the_prune_leaves_everything_it_does_not_own_alone`, add
     `e2e.register.x@example.com` and assert it survives.

   See them fail. Then in `seed_e2e.py`: add `RESET_EMAIL`, `REGISTER_PREFIX =
   "e2e.register."`, a sixth `_account(...)` call commented with why it exists (the
   flow sets a new password; no other flow may share it), a prune clause for the
   prefix, and the success message "Seeded 6". Mutation-check: remove the prune clause
   and see the register prune test go red.

2. [x] **Settings comment (backend).** In `config/settings/local.py`, rewrite the
   email comment: the CI e2e job now runs its own mailpit and sets `DJANGO_EMAIL_HOST`.
   The override stays, because other users of these settings may have none. No code
   changes.

3. [x] **Backend gate and commit.** `backend-gate.sh <wt>
   kaleem/identity/tests/test_seed_e2e.py`, then the full `backend-gate.sh <wt>`.
   Commit: `test(identity): seed an e2e reset account and prune e2e registrations`.

4. [x] **Inbox helper (dashboard).** Write `e2e/support/inbox.ts`:
   - `MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025"`.
   - `clearInbox(request, to)`: `DELETE /api/v1/search?query=to:"<to>"`. Expect 200.
   - `waitForMail(request, { to, subject })`: polls `GET /api/v1/search` with
     `expect.poll` (20 s, 500 ms intervals) until a message has an exact subject match.
     Then it fetches `GET /api/v1/message/{ID}` and returns `{ subject, text }`. On
     timeout the failure message names `to` and `subject`.
   - `linkIn(mail, pathname)`: finds the first `https?://\S+` whose pathname equals
     `pathname`, and asserts its origin equals the `baseURL` origin (passed in by the
     caller from `test.info().project.use.baseURL`). Returns the URL string.

   Each function has a doc comment saying why it is shaped that way: clear-first stops
   stale links on retry; the origin check catches mail pointed at the wrong host.
   Mailpit returns CRLF text, so `\S+` must stop at `\r`. This was measured on v1.30.1.

5. [x] **Fixtures (dashboard).** In `e2e/fixtures.ts`: `uniqueEmail(kind: "child" |
   "alias" | "register")`, and update its doc comment so `seed_e2e`'s prune lists all
   three prefixes. Add `reset: { email: "e2e.reset@kaleem.test", name: "E2E Reset" }`
   to `ACCOUNTS`, with a comment that the reset flow changes its password, so no other
   spec may log in as it.

6. [x] **The three flows (dashboard).** `e2e/inbox.spec.ts`, with a header citing the
   spec and the ADR, using English locale strings from `src/locales/en/common.json`:
   - `"registers, verifies from the inbox, then signs in"`: `/register`, fill Full
     name, Email (`uniqueEmail("register")`), Password, Date of birth (an adult date),
     and "I am a" = parent. Submit, then expect `/verify-pending`. `waitForMail`
     subject = the rendered allauth confirmation subject. Read it from the first
     local run's mail and assert it exactly; do not regex it. Then
     `linkIn(..., "/verify-email")`, goto, expect "Email verified. You can now sign in."
     Then sign in through the real form with the new credentials, and expect `/`.
   - `"resets a password from the inbox, then signs in with the new one"`:
     `clearInbox` for `e2e.reset`, `/forgot-password`, send, expect "If that account
     exists…". `waitForMail` "Reset your kaleem password", `linkIn(...,
     "/reset-password")`, set `randomUUID()`-based password, expect "Password reset —
     you can now sign in." Sign in with it and expect `/`. Then `waitForMail` "Security
     alert: a change was made to your kaleem account".
   - `"activates a child from the inbox, then the child signs in"`: `login(page,
     "parent")`, `/family`, add a child with a blank password, as `family.spec.ts`
     does. `waitForMail` "Set your kaleem password", `linkIn(..., "/reset-password")`,
     set the password, then sign in as the child in a fresh context and expect `/`.

   The sign-in helper for non-seeded accounts is a local function in the spec, not a
   `login()` overload. `login()` stays the seeded-account contract.

7. [x] **Local proof in an e2e slot.** Use the runbook §2 slot recipe plus:
   - `docker run -d --network <slot net> --name mailpit-<slot> -p 127.0.0.1:<8025+k*10>:8025 axllent/mailpit:v1.30.1`;
   - Django and the worker containers get `DJANGO_EMAIL_HOST=mailpit-<slot>`,
     `DJANGO_EMAIL_PORT=1025`,
     `DJANGO_FRONTEND_URL=http://app.kaleem.localhost:<APP>`, and no locmem override;
   - Playwright gets `E2E_MAILPIT_URL=http://127.0.0.1:<port>`.

   The worker must run in the slot; `ci-parallel-guards`' slot notes say how. Run
   `pnpm exec playwright test e2e/inbox.spec.ts` green. Then run the spec's four
   mutations one at a time (spec, Test plan table). Each must be red for the stated
   reason, and green again when restored. Record each failure line for the hand-back.
   Then run the full suite once, to check that no existing flow broke under the SMTP
   backend.

8. [x] **Dashboard gate and commit.** Run the full `dashboard-gate.sh <wt>` (biome lints
   `e2e/`). Commit: `test(e2e): inbox helper and register, reset and child-activation
   flows`.

9. [x] **ci.yml and compose (meta).** In the `e2e` job:
   - Add a `mailpit` service: `image: axllent/mailpit:v1.30.1`, `ports: [1025:1025,
     8025:8025]`, and `options: --health-cmd "/mailpit readyz" --health-interval 5s
     --health-timeout 5s --health-retries 10`.
   - In env, replace the locmem lines and their "No mailpit here" comment with
     `DJANGO_EMAIL_BACKEND: django.core.mail.backends.smtp.EmailBackend`,
     `DJANGO_EMAIL_HOST: localhost`, `DJANGO_EMAIL_PORT: "1025"`,
     `DJANGO_FRONTEND_URL: http://app.kaleem.localhost:4173` and `E2E_MAILPIT_URL:
     http://localhost:8025`. Add one comment saying why FRONTEND_URL must match
     `E2E_APP_URL`.
   - In "Prove the worker executes a task", after `result.get`, poll
     `http://localhost:8025/api/v1/search?query=to:"worker-probe@kaleem.test"` for up to
     30 s with `urllib`. Fail with the celery log if the count stays 0, and print
     "worker probe ok: mail reached mailpit" when it is found. Fix the "locmem means
     nothing leaves the runner" comment: mail goes to the runner's own mailpit.
   - In `docker-compose.local.yml`, change `axllent/mailpit:latest` to `:v1.30.1`.
   - Self-check: `python -c 'import yaml; yaml.safe_load(open(".github/workflows/ci.yml"))'`,
     plus `actionlint` if it is available.

   Local mutation: in the slot, a wrong `DJANGO_EMAIL_HOST` makes the probe's mail
   check fail.

10. [x] **ADR (meta).** Use `docs/adr/NNNN-e2e-reads-a-real-inbox.md`, with the number
    from the conductor (0050 if free), "Amends ADR-0027". It covers:
    - the decision: mailpit pinned as an e2e service, and a version bump goes through
      an API re-check;
    - the helper's three guarantees;
    - what it does not prove (spec, Out of scope);
    - the cost (one service container, about 30 s);
    - that ADR-0027's "dev settings serve two masters" consequence now includes the
      email host.

    Commit with step 9: `ci(e2e): run mailpit and read a real inbox in e2e`
    and `docs: ADR-NNNN e2e reads a real inbox`.

11. [ ] **Close-out text for the conductor (step 12, not committed here).**
    - The D3 table replaces the "anything needing an inbox ❌" row with `identity —
      inbox` ✅ 3 flows. It names the four mutations and states that mailpit proves
      the app sends the right mail with a working link, never delivery by the real
      provider. Add a ⚠ line that the reset account's password is not the fixture
      password after a run.
    - In ISSUES.md, the "structurally cannot reach" bullet is struck through as
      FIXED with the date. The change-password and billing exclusions stay.
    - Add a journal line.

## Deviations found while building

- **ADR number.** 0050 was already taken (`chat-transport`), so the ADR is 0051,
  provisional until the conductor confirms the number.
- **`e2e/` is not linted by biome.** The plan said the dashboard gate lints it; `biome.json`
  has `files.includes: ["src/**"]`. The new files were formatted by piping them through
  `biome format --stdin-file-path=src/<name>.ts` so they match the rest of `e2e/`. Widening
  the include is its own change.
- **Register-flow selectors.** Labels carry a required-field asterisk in the DOM, so
  `getByLabel("Password", { exact: true })` finds nothing; role and accessible name
  (`getByRole("textbox", { name: "Password", exact: true })`) is what works.
- **The allauth subject is `[Kaleem] Please Confirm Your Email Address`**, read from the
  first local mail as the plan said. The body greeting is "Hello from !" (an empty site
  name); out of scope, noted for ISSUES.md.
- **Probe mutation.** A wrong `DJANGO_EMAIL_HOST` makes the task itself fail (three
  retries), so it trips the existing result check. The case the new mail check exists for
  is a worker whose backend accepts the task but sends nowhere (the old locmem), and that
  is the mutation recorded.

## Risks

- **The email throttle on a developer's machine.** `EmailScopedThrottle` (5/hour per
  address) keeps its counts in Redis. A sixth local run of the reset flow within an
  hour gets a 429. CI starts with a fresh Redis, so CI is unaffected. Fallback: flush
  that Redis DB locally. Do not raise the production rate, and do not add a `local.py`
  override for the `email` scope, which would weaken a security control's dev parity
  for convenience.
- **Wrong subject or link format guessed.** The confirmation subject is rendered by allauth's
  subject template. Step 6 reads the real mail before it asserts. Do not guess.
- **The service starts after the probe.** Actions waits for a service's health check
  before running steps, and the explicit `--health-cmd` makes that certain.
- **Stale mail on retry.** Clearing the recipient's mail first covers the fixed
  reset address. Every other address is unique per run.
- **An existing flow breaks under SMTP.** Today, mail sent in the add-alias and
  add-child flows goes to locmem. Every send already goes through the worker (no
  synchronous `send_mail` exists outside `platform.tasks`), so an SMTP failure would be
  a task retry, not a 500. Step 7's full run proves it.
- **The `e2e/` type errors reach no gate.** `tsc` excludes `e2e/`, and Playwright only
  transpiles it. Catch them in step 7's run. This is pre-existing and out of scope.
- **Mailpit API drift.** The version is pinned in both places. The ADR requires a
  re-check when the version is bumped.

## Verification

- Backend: the focused and full `backend-gate.sh` runs are green, and the prune
  mutation is red.
- Dashboard: the full `dashboard-gate.sh` is green. Step 7 shows the inbox spec green
  locally, the four mutations red for their stated reasons, and the full suite green.
- Meta: the YAML parses. The PR run's e2e log shows "worker probe ok: mail reached
  mailpit", all three inbox flows passed with no retry, and every existing flow passed.
- Gitleaks over each repo's `origin/main..HEAD` is CLEAN, using
  `gitleaks-range.sh`.
- The hand-back block (runbook §3) lists the mutation failure lines.
