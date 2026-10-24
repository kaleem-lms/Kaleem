---
name: stripe-test-clock-harness
phase: B
modules: [billing, platform]
status: in-progress
created: 2026-09-04
closed: null
---

> **Reopened 2026-10-19** by `inf-stripe-clock-harness-red` (first shipped and closed
> 2026-09-04). The harness has been red since 2026-09-24. The amendment below states the
> cause and the fix; everything after it is the original spec, unchanged.

## Amendment 2026-10-19: red since 2026-09-24

### Goal

Get the weekly harness green again, find out why it broke, and make the next break of
this kind explain itself in the log. Plan:
[2026-10-19-inf-stripe-clock-harness-red.md](../plans/2026-10-19-inf-stripe-clock-harness-red.md).

### Diagnosis (from the run logs and the Stripe CLI source)

| Run | Date | CLI installed | Result |
| --- | --- | --- | --- |
| 35201027095 | 2026-09-17 | 1.50.11 | 5 passed |
| 35975540211 | 2026-09-24 | 1.51.1 | 5 errors at setup |
| 36847477236 | 2026-10-01 | 1.53.0 | 5 errors at setup |
| 37764709960 | 2026-10-08 | 1.53.1 | 5 errors at setup |
| 38704936926 | 2026-10-15 | 1.53.1 | 5 errors at setup |

- Every red run fails in the `webhook_secret` fixture with "`stripe listen` never reported
  'Ready!' within 60s". The message is wrong about the time. Each fixture errored about
  0.7 s after it started. `readline()` returned EOF, so the forwarder **exited**. It did not
  time out. Its output was read and thrown away, so the log never showed why.
- `stripe listen --print-secret` succeeded in every red run. If it had not, its own
  failure message would have shown. So the key authenticates. **The key is not the
  cause.** `hg-stripe-key-conditional` does not fire.
- Stripe CLI **v1.51.0** (released 2026-09-17 22:37 UTC, after the last green run)
  shipped "Redesign stripe listen event selection flags" (stripe/stripe-cli#2006). In
  `pkg/cmd/listen.go` at v1.51.1 and at v1.53.1, the `--events` default changed from
  `["*"]` to `[]`, and `validateForwardingConfig` now refuses `--forward-to` unless one of
  `--events`, `--all-snapshot` or `--all-thin` is given: "must specify events to forward
  using --events, --all-snapshot, or --all-thin". The check runs before credentials are
  resolved, and `--print-secret` is exempt from it. That matches both observations above.
  The harness runs `stripe listen --forward-to <url> --skip-verify` with no event flag.
- The workflow installs whatever the apt repo's `stable` channel holds, so the change
  arrived unannounced.
- The 2026-09-10 red run has a different cause: submodule checkout failed ("could not read
  Username"), and the next run was green. That cause is not in this amendment's scope.

Confidence: high, from source and logs. The CLI was not run locally, because sub-agents
cannot download release binaries. The first dispatch confirms the cause, and the
deliberate red below confirms it directly.

### Decisions

1. **Forward with `--all-snapshot`.** This restores exactly what the old default
   (`--events '*'`, all snapshot events) did. kaleem consumes no thin events. An explicit
   event list would be narrower, but the delivery probe relies on `customer.created`, an
   event kaleem's handlers ignore. Tightening that probe is an existing `ISSUES.md` entry
   and is not part of this fix.
2. **Pin the CLI to an exact release, verified by SHA-256.** Install the GitHub release
   tarball `stripe_1.53.1_linux_x86_64.tar.gz` (asset digest
   `sha256:032fe0b849a9d6a222488bc846445bafeae993af1026b78a8121d02321ca1fd1`, read from
   the GitHub release API on 2026-10-19), not the apt package. Release assets cannot be
   changed after publishing, and the digest check fails closed. An apt channel may not
   keep old versions, so pinning there is not reliable. 1.53.1 is the binary the last red
   run used, so the fix is proven against the exact CLI that failed. The workflow asserts
   `stripe version` equals the pin. Bumping the pin is a deliberate PR: change the version
   and digest, then dispatch. The runbook records this.
3. **The CLI's output goes into the failure message, redacted.** When the forwarder fails
   to report ready, the message says whether it **exited** (with its exit code) or is still
   running after the timeout, followed by the last lines it printed. The repo and its
   Actions logs are public, so `whsec_…` and `sk_/rk_` key values are masked before
   printing. GitHub masks only the registered secret, and the CLI's `whsec_` is not one.
   The `--print-secret` failure message gets the same redaction.
4. **Proof is two dispatches, run by the conductor.** First, a green `workflow_dispatch` on
   this branch. Second, a deliberate red on a throwaway branch whose backend pin drops
   `--all-snapshot` again. That run must go red, and its log must show the CLI's own
   "must specify events" line and a non-zero exit code. This one run proves the cause, the
   fix and the new diagnostic together. A `cancelled` conclusion is not a result.

### Scope delta

- **Personal data (ADR-0023):** none new. The harness creates synthetic `example.com`
  users in a throwaway CI database and Stripe test mode.
- **User flow, data model, API, frontend:** unchanged. No migration, so there is no
  expand/contract step.
- **Modules:** test code under `backend/tests/` (outside coverage measurement, so the
  floor cannot move), `.github/workflows/stripe-clock.yml`, and
  `docs/runbook/stripe-billing.md`. The local-dev command in the runbook,
  `stripe listen --forward-to …`, breaks on CLI ≥ 1.51 for the same reason, so it gets
  `--all-snapshot` too.
- **e2e:** none. The harness is the end-to-end check, and its runtime (about 3 to 5 min)
  does not change.

### Out of scope (D10)

These stay as `ISSUES.md` entries: the readiness `readline()` that can block without a
bound, the stale-clock sweep, the API key on argv, the loose delivery probe, and the
basil-vs-dahlia gap. Also out of scope: making the harness gate deploys, and changing the
cron.

### Test plan

- Unit tests with no network, in the default backend run: the forward command names its
  events; redaction masks `whsec_`/`sk_`/`rk_` values; a child process that exits early is
  reported with its exit code and its output, quickly and without "within 60s"; a child
  process that prints `Ready!` is reported ready. Each is mutation-checked.
- A green `stripe-clock` dispatch on the branch: 5 passed, and the `stripe version` line
  equals the pin.
- A red `stripe-clock` dispatch on the mutant branch, showing the CLI's refusal in the log.

### Open questions

None. If the green dispatch gets past setup and then fails on
`test_forwarded_events_match_our_configured_api_version`, the Stripe account's default API
version has moved since 2026-09-17. That is a separate signal and needs the owner, so it
is escalated, not fixed here.

## Goal

Exercise the **`past_due` → `unpaid` dunning path end to end against real Stripe**, using
Stripe **test clocks** to advance a live test-mode subscription through a failing renewal.

This is the sole remaining gate on closing Phase B. `ISSUES.md` scopes the gap precisely,
and the scoping is what makes this spec small:

> *Covered by tests at the provider seam:* `invoice.payment_failed → past_due`; `past_due`
> entitled; `unpaid` not; child inherits `past_due` but not `unpaid`; an `unpaid` row blocks
> a second checkout. *Covered manually:* a declined card **at checkout**. *Covered by
> nothing:* that real Stripe's renewal failure emits those events, in the shape we parse, on
> an already-`active` subscription.

So the state machine is not what is untested. **The wiring is** — from Stripe's actual wire
format, through signature verification, through `verify_and_parse_webhook`, into handlers
that are already well covered. And it matters more than its size suggests: `past_due` keeps
full access by design (OQ-B2-1), so `unpaid` is the only state that actually revokes
entitlement, and it is reachable *only* through a renewal failure. The one transition that
removes access is the one nobody has ever observed.

A declined card at checkout does not substitute. That path never creates a subscription at
all; this one starts from an `active` subscription with a card that used to work.

**No new ADR.** This executes ADR-0021's test requirement for a path that could not be
reached by clicking. It decides nothing about architecture.

## Decisions taken

Four, settled before writing:

1. **The harness runs in CI**, not as a manual runbook procedure. A documented check that
   only runs when someone remembers is the exact failure mode ADR-0026 and ADR-0027 were
   written to end — and this repo has a live example still open (`pip-audit`/`gitleaks`,
   documented since Phase 0, never executed).
2. **Nightly and on demand, not per PR, and not gating `deploy-staging`.** Rationale in
   *Cadence* below.
3. **All the way to `unpaid`**, not stopping at `past_due`. Stopping early would leave the
   access-revoking transition unobserved and only half-close the `ISSUES.md` entry.
4. **Set up via the Stripe API, not through kaleem's checkout.** The hosted Checkout page is
   precisely what cannot be automated — it is why billing is excluded from Playwright — and
   checkout is already verified manually (2026-09-03). This harness is about the *renewal*.

## Cadence, and why it does not gate the deploy

Nightly `schedule` on `master`, plus `workflow_dispatch`, in its own workflow file, with
`concurrency: stripe-clock` so a manual run cannot overlap the scheduled one. It is **not**
added to `deploy-staging`'s `needs:` list.

Three reasons, in order of weight:

- **Test clocks are account-scoped.** Two runs advancing clocks on the same Stripe test
  account concurrently is a collision, and per-PR means parallel PRs. Nightly-on-master is
  serial by construction.
- **Forked PRs cannot read secrets.** A gating job that needs `STRIPE_SECRET_KEY` is red or
  skipped for any outside contributor — and `ISSUES.md` already carries an entry about a
  skipped job looking like success (`deploy-staging` on #88). Do not add a second one.
- **It puts a third party in the merge path.** A Stripe outage would block every merge, to
  catch a class of drift that changes on Stripe's release calendar, not on ours.

The cost is stated plainly: a renewal-path regression is caught within 24 hours rather than
before merge. That is the right trade for drift in an external payload shape, and the wrong
one for anything we author ourselves — which is why the coverage and e2e gates stay
blocking and this one does not. **A red nightly is a real failure and gets fixed, not
muted.** If it is ever muted for more than a week, this whole harness has become the thing
it was built to replace.

## Architecture

Three pieces, each independently understandable.

### 1. Delivery — how a Stripe event reaches a GitHub runner

Stripe cannot call inbound to a runner, so a registered webhook endpoint is not an option.
The **Stripe CLI** solves it in the direction that works: `stripe listen` holds an
*outbound* connection to Stripe and forwards received events to a local URL.

```
Stripe (test mode)  ──outbound conn──▶  stripe listen  ──HTTP──▶  live_server/api/v1/billing/webhook/
```

The CLI signs each forwarded request with its **own** `whsec_`, printed at startup and
handed to Django as `DJANGO_STRIPE_WEBHOOK_SECRET`. Signature verification is therefore
genuinely exercised — `verify_and_parse_webhook` verifies a real signature over real bytes,
which is the half of the seam a fixture payload can never test.

### 2. Placement — a deselected-by-default pytest module

`backend/kaleem/billing/tests/test_stripe_test_clock.py`, every test marked
`@pytest.mark.stripe_clock`, with `-m "not stripe_clock"` added to `addopts` in
`pyproject.toml`. Consequences, all intended:

> **Corrected during implementation (2026-09-04).** This spec originally placed the
> harness in `kaleem/billing/tests/`. That package's `conftest.py` has an
> `autouse=True` fixture swapping in `FakePaymentProvider`, so a harness placed
> there would have run against the fake and passed while touching no Stripe at all
> — the exact failure this slice exists to prevent. It lives in the top-level
> `backend/tests/stripe_clock/` instead, which is also already outside coverage
> measurement (`include = ["kaleem/**"]`).

- The normal `backend-test` job is unchanged and unslowed.
- These tests **cannot move the coverage ratchet** (ADR-0026) in either direction — they
  are not in the measured run. A network-dependent test flattering the floor would corrupt
  the one number the D3 gate rests on.
- A developer with a Stripe key can run exactly what CI runs: `pytest -m stripe_clock`.

It uses pytest-django's **`live_server`** fixture rather than the test client: the CLI
forwards over real HTTP to a real port, and the test client would bypass the very seam under
test. `live_server` implies `django_db(transaction=True)`, so the webhook thread and the
test see the same committed rows.

### 3. Scenario — a card that worked and then stopped

| # | Step | Assertion |
| --- | --- | --- |
| 1 | Create a `TestClock` frozen at a known time; create a `Customer` on it carrying `user_id`/`plan_id` metadata identical to what `create_checkout_session` writes | — |
| 2 | Attach `pm_card_visa`, create the subscription on our real test Price | Our row reaches `ACTIVE`; `current_period_end` matches Stripe |
| 3 | Swap the default payment method to `pm_card_chargeCustomerFail` | — |
| 4 | Advance the clock past `current_period_end`; renewal invoice is created and the charge fails | `invoice.payment_failed` arrives, row is `PAST_DUE`, **and the user is still entitled** (OQ-B2-1) |
| 5 | Advance through Stripe's Smart Retries schedule until retries are exhausted | Row is `UNPAID` and the user is **not** entitled |
| 6 | Delete the test clock | Customer and subscription cascade away — no residue |

Step 3 is the point of the whole design. A card that fails from the start never produces an
`active` subscription, and `past_due` only arises from a renewal failing on one that is
already active. This models the real event: a card that worked in March and expired in April.

Step 6 matters more than it looks. `ISSUES.md` carries five throwaway staging accounts
awaiting a manual DB reset; a nightly job would add 365 subscriptions a year. Deleting the
clock is the cleanup, and it runs in a `finally`.

**What this harness does not exercise.** Step 1 seeds the local `Subscription` row directly
rather than driving it through kaleem's own checkout — because kaleem only ever creates that
row from a `checkout.session.completed` webhook, and the hosted Checkout page is exactly
what cannot be automated (decision 4, above). The cost: `_apply_checkout_completed` is not
exercised by this harness. It is covered elsewhere — unit tests, and the manual staging
checkout of 2026-09-03 — but not here. A harness that quietly proves less than it claims is
this project's recurring failure mode, so this is stated plainly rather than left implicit:
this harness proves the *renewal* wiring, not row creation.

## Required Stripe configuration

Two settings that the harness depends on and cannot itself create. Both belong in
`docs/runbook/stripe-billing.md`, because an environment missing either produces a harness
that passes while testing nothing:

1. **Dunning must be set to "mark subscription as unpaid" after retries** (Stripe Settings →
   Subscriptions → manage failed payments). The alternatives — cancel, or leave `past_due`
   forever — make `unpaid` unreachable. If it is misconfigured, step 5 times out; the spec
   requires the timeout message to name this setting, so the failure diagnoses itself.
2. **`STRIPE_SECRET_KEY`** (test mode) as a repository secret.

The harness runs against the **same Stripe test account as staging**. Test-clock objects are
namespaced to their clock and deleted on teardown, so they cannot be confused with staging's
own data. A dedicated account would be cleaner in principle but buys nothing here and costs
a second set of Prices to keep in lockstep.

## The API-version assertion

`stripe listen` forwards events at the **account default** API version and offers no way to
forward at an arbitrary pin — only the account default or `--latest`. So the harness cannot
assert the forwarded payload matches our production pin (`DJANGO_STRIPE_API_VERSION`); that
mechanism does not exist. What it does instead: it reads `api_version` off a real
`stripe.Event` and asserts it equals the account default the harness is configured to expect
(`DJANGO_STRIPE_API_VERSION` set to that same value for the harness run — see the runbook),
guarding **that** value against silent movement.

This is deliberately a feature, not a check on the harness. `ISSUES.md` records watching the
SDK's default move from `2026-07-29.dahlia` to `2026-08-26.dahlia` **between two deploys on
the same day**, because `requirements/base.txt` allows `stripe>=15.5,<16.0`. The payload
shapes we parse — `_subscription_period_end`, `_invoice_subscription_id` — already carry
basil-vs-legacy fallbacks written because of exactly this. An account-default upgrade would
otherwise reshape our inbound payloads silently, and this assertion turns it into a red
nightly with a name attached.

**Residual gap, corrected during implementation (2026-09-04):** the account default
(`2025-06-30.basil`, verified off three live events) and the production webhook pin
(`2026-08-26.dahlia`) are not the same version. Both shapes parse today because of the
fallbacks above, but this means the harness proves the dunning state machine against an
*older* payload shape than production actually receives — it does not prove the shape
production meets. See the `ISSUES.md` entry ("nightly dunning harness exercises
`basil`-shaped webhook payloads, but production receives `dahlia`-shaped ones") for the full
scope of what remains open.

## Out of scope

- **Dunning UX.** Retry notices, email nudges, a recovery banner beyond the existing
  `past_due`/`unpaid` copy. Already deferred in `ISSUES.md`; unchanged here.
- **Frontend.** Nothing user-facing changes, so there is no dashboard slice, no route, and
  no e2e spec. The existing `SubscriptionCard` already renders both statuses and both
  recovery messages; this harness proves the backend can *reach* them.
- **Data model and API.** No new tables, fields, endpoints, or migrations. The harness only
  reads `Subscription` and drives the existing webhook view.
- **`incomplete` / `incomplete_expired`.** Reached at checkout, not by renewal.
- **Making this gate the deploy.** A separate decision if the nightly proves stable; it
  would need the concurrency and fork-secret problems solved first.
- **`pip-audit` / `gitleaks` / Lighthouse.** The other un-run gates. Same shape, different
  slice, and bundling them would hide both.

## Test plan

The harness *is* the test, so this section is what must be true of the harness itself.

**Must pass:**

- The full six-step scenario above, green, against live Stripe test mode.
- `past_due` asserts entitlement **survives**; `unpaid` asserts it is **gone**. Asserting
  only the status would pass even if the entitlement rule were inverted — and B1 stated that
  rule backwards in four places for eight weeks, so this is a live risk, not a hypothetical.
- The forwarded API version equals `DJANGO_STRIPE_API_VERSION`.

**Must not happen:**

- The normal `backend-test` run must not execute these tests. Verified by running `pytest`
  with no `STRIPE_SECRET_KEY` present and confirming they are deselected, not errored.
- The coverage floor must be unchanged by this slice.
- No Stripe object may outlive the run. Verified by listing test clocks after a green run.

**Failure modes that must be legible, not mysterious:**

- Missing/invalid `STRIPE_SECRET_KEY` → fail fast at session start with that message, rather
  than a timeout twenty minutes in.
- Dunning misconfigured → the step-5 timeout names the required Stripe setting.
- The CLI failing to start or print its secret → fail before any clock is created.

**Mutation check.** Per ADR-0027's precedent of proving a harness rather than merely running
it: break `_apply_invoice_payment_failed` (write `ACTIVE` instead of `PAST_DUE`) and confirm
the harness goes red. A green run against deliberately broken code is the only outcome that
would invalidate this whole slice.

## Module boundaries

`billing` only. No new inter-module calls, no new events, no `import-linter` contract
changes. The harness talks to `billing.services` state through the ORM and to the existing
webhook view over HTTP.

Note an adjacent, deliberately untouched item: `ISSUES.md` records that the **`scheduling`**
import-linter contract does not forbid `kaleem.identity.models`. That is a real D4 hole and
it is not this slice's (D10).

## Open questions

None. The four decisions above were taken before this spec was written, and the two Stripe
settings are configuration to be applied during implementation, not questions to resolve.

The one judgement worth revisiting after a month of nightly runs: **is non-gating still
right?** If the job proves stable and fast, promoting it to gate `deploy-staging` on push to
`master` (not per PR — the concurrency argument holds regardless) is a small change. If it
proves flaky, the honest response is to fix or delete it, never to mute it.
