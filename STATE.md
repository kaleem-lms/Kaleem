---
current_phase: "C — Scheduling. C0 (matching inputs) SHIPPED 2026-09-05; C1 (matching) SHIPPED 2026-09-05. C2 (booking + quota) SHIPPED 2026-09-05 (backend#43, dashboard#36, meta#162). C3 is decomposed further into C3a-C3e (ADR-0034); C3a (video room + provider seam) SHIPPED 2026-09-05 (backend#44, dashboard#37, meta#164). C3b (signaling) SHIPPED 2026-09-06 (backend#45, infra#6, meta#166) and is live on staging. Phase B (billing) is CLOSED as of 2026-09-04, dunning gate included. Phase C is decomposed because matching, booking and video are separate subsystems in a strict dependency order: C0 matching inputs, C1 matching, C2 booking + quota, then video as C3a rooms, C3b signaling, C3c STUN/TURN, C3d call client, C3e browser hardening. Note the roadmap calls scheduling 'B2'; that label is already taken by a closed billing spec, so scheduling is Phase C here."
active_spec: "none — C3c (STUN/TURN) SHIPPED and verified live on staging 2026-09-06. Next is C3d (the call client), which has no spec yet and is the first phase that can produce a working call."
active_branch: "none; backend, dashboard, infra and meta are all on their trunks. NOTE infra `main` is one commit ahead of the deployed pointer (the `log-file=stdout` fix, applied to staging by hand) — bump it with the next meta PR. TRUNK-BASED as of 2026-09-04 (ADR-0028) — `master` is the only long-lived branch; `develop` is deleted. Branch feat/… off master, PR into master."
last_green_ci: "meta #169 → master, 2026-09-06 (all 8 checks green; deploy-staging SUCCESS on the second attempt — the first failed loudly at `Sync infra config to staging` because a hand-created root-owned `/opt/kaleem/coturn` blocked the `deploy` user\'s tar, fixed with a chown). Staging is on **blue** at 43d6dea. Verified live: `https://ws-blue-staging.kaleem.academy/health/live/` returns healthy; a relay-only RTCPeerConnection pair connects through coturn (2.3 KB each way); the Sec-WebSocket-Protocol handshake accepts a valid token and refuses three bad cases with 4401. Both mutation-checked. ⚠ `ws-green-staging` has NO certificate until green is active (ISSUES). The `Stripe test clock` nightly was last green 2026-09-04."
---

# kaleem Project State

> **This file is the current position only.** Session history lives in
> [`docs/superpowers/journal/`](docs/superpowers/journal/) — the June–August log that used
> to live here is archived at
> [`docs/superpowers/journal/session-log-2026-06-to-08.md`](docs/superpowers/journal/session-log-2026-06-to-08.md).
> Keep this file under ~60 lines. If you are adding a fourth section, you are writing a
> journal entry — put it in the journal.

## Where we are

**Phase B (billing) is closed.** Both specs closed 2026-09-04, and the last gate — the
`past_due` → `unpaid` renewal path — is now exercised nightly against real Stripe via test
clocks (`docs/superpowers/specs/2026-09-04-stripe-test-clock-harness-design.md`). It is not
in the merge path by design; a residual gap is tracked in `ISSUES.md` (the harness runs
against the account's `basil` default, not production's `dahlia` pin).

Phase A (identity) is closed via ADR-0024, with one residual human check outstanding.

## ▶ Next actions, in order

1. **C3d — the call client.** The first phase that can produce a working call. Everything under
   it now exists and is proven live: rooms (C3a), an authenticated signaling relay (C3b), and a
   TURN relay with ephemeral credentials (C3c). C3d is `RTCPeerConnection`, the video grid and
   the controls, driven by `join_url` + `token` + `ice_servers` off the join grant.
2. **Bump the infra pointer** — `infra/main` carries the `log-file=stdout` fix, which was applied
   to staging by hand but is not in the deployed SHA.
3. From `ISSUES.md`, two C3c operational entries want closing before they bite: `ws-green-staging`
   has no certificate until green is active, and a coturn config-only change does not restart the
   running relay.
4. Still standing from C2 under **Blocks launch**: the quota cycle is keyed by an exact
   `current_period_end`, and a mid-cycle rewrite would hand out a second allowance.

## In flight

- **Nothing.** C3c shipped and was verified live on 2026-09-06.
- ⚠ **A merge to `master` is a deploy** (ADR-0028).
- ⚠ **Deploy between lessons.** A deploy still drops every call in progress — the drain is
  unbuilt, and it is the last surviving half of the split-room issue (`ISSUES.md`).

## Recently verified (2026-09-03 → 06)

- **Phase C3c (STUN/TURN) SHIPPED and verified live** (backend#46, infra#7/#8/#9, dashboard#38,
  meta#169). A self-hosted `coturn` relay with HMAC ephemeral credentials delivered as
  `ice_servers` on the join grant; the capability token moved out of the URL query string into
  `Sec-WebSocket-Protocol`; a room pinned to one deploy colour; `GRANT_TTL` deleted in favour of
  the join window's close. Backend 881 at 97.76%; dashboard 545, floors → 93.6/90.4/86.6/93.6;
  e2e unchanged at 33 by design.

  **The relay genuinely relays** — first media path ever to traverse kaleem's infrastructure.
  Mutation-checked in both directions.

  ⚠ **The backend coverage floor did NOT move: it stays 97.7.** 97.76% measured, but
  `fail_under = 97.8` FAILS even though the report displays "97.8%". `pyproject.toml`'s
  `precision = 1` comment describes a rounding rule coverage.py does not follow. Logged.

  ⚠ **Five Criticals were found and fixed, none by a test or a review.** Three lived in the plan
  and docs: coturn takes `${VAR}` in its config file *literally* (an open relay); compose
  supplying `wss://${WS_BLUE_DOMAIN}` made an unset variable expand to the truthy string `wss://`,
  defeating the app's own fail-closed guard and persisting a broken pin; and four documents
  asserted a `ship.sh` rollback that does not exist, because its signaling health check is
  container-local and cannot see a dead Traefik router. Two more surfaced only at deploy time:
  `coturn` was absent from `ship.sh`'s explicit shared-services list (so the relay would never
  have started), and CI did not sync `turnserver.conf` (so the bind mount would have become an
  empty directory and unfenced the relay). **Every one lived in the gap between a config file and
  the process that consumes it — the gap nothing in this repo tests.** Full account:
  `journal/2026-W36.md`.

- **Phase C3b (signaling) SHIPPED** (backend#45, infra#6, meta#166), live on staging. Escape hatch E5 (ADR-0035).
  Backend 852 at 97.78% (floor 97.6 → 97.7); `lint-imports` 11 kept / 0 broken with the new
  contract **verified by breaking it in both directions**; e2e stays at 33 by design.
  Walked by hand over real sockets: presence both ways, relay both ways, departure, and every
  refusal code (4400 malformed/binary, 4401 expired, 4409 room full, 4410 replaced).

  ⚠ **The final review found a Critical the whole green suite could not see:** uvicorn logged the
  capability token in its handshake line on every join, so a live grant to a child's room sat in
  `docker logs` for its 30-minute life. Every signaling test runs in-process through Starlette's
  `TestClient`; nothing exercised uvicorn, which is exactly the layer the bug lived at. Fixed with
  a log filter, verified by reproducing it before and after.


- **Phase C3a (video room + provider seam) SHIPPED** (backend#44, dashboard#37, meta#164). A `Room` row per live session, participant + window authorization, and a
  `VideoProvider` seam with a `FakeVideoProvider` default. **It contains no video** — the join URL
  points at a host that does not resolve; signaling, TURN and the call client are C3b-C3e.
  Backend 753 at 97.61% (floor 97.3 → 97.6 — see the warning below); dashboard 543 at 93.63/90.48/86.69/93.63 (floors →
  93.5/90/86.5/93.5); **e2e 30 → 33**. Verified in a real browser as a student in English, a
  student in Arabic with RTL, and a teacher.

  ⚠ **Measure backend coverage with `pytest --cov=kaleem`, never a bare `pytest --cov`.** The
  bare form falls back to the `include` filter and omits files no test imports, reading ~0.55
  higher. C3a set the floor to 98.1 from a bare reading and turned CI red at 97.61% with all 753
  tests passing. The `pyproject.toml` comment now says so beside the `precision = 1` warning.

  ⚠ **Three defects were caught by review or by the manual walk, not by the suites:** the row lock
  was untested (the "one room per session" test made three *sequential* calls and passed with
  `select_for_update` deleted); the lock also covered the `curriculum.Subject` row, so one join
  would have blocked every join of that subject once a real provider does I/O; and a teacher who
  is also a parent would have seen no Join button at all. Full account: `journal/2026-W36.md`.


- **Phase C2 (booking + quota) SHIPPED** (backend#43, dashboard#36, meta#162).
  Weekly slots, a daily idempotent generator bounded by `sessions_per_cycle`, and cancellation with
  a 24-hour refund rule. Backend 710 at 97.58% (floor 97.2 → 97.3); dashboard 512 at
  93.5/90.27/86.68/93.5 (floors → 93/89.5/86/93); **e2e 27 → 30**, mutation-checked. Full account:
  `journal/2026-W36.md`.

- ⚠ **C2 fixed a shipped C1 bug: account deletion was broken in production.** Deleting any matched
  student raised `ProtectedError` — `TeacherAssignment.source_request` was `PROTECT`, and Django's
  collector evaluates `PROTECT` per cascade branch without noticing the protecting row is itself
  being deleted. Both that field and the new `Session.slot` are now `RESTRICT`. **The GDPR erasure
  work under "Blocks launch" would have hit this wall.**


- **Phase C1 (matching) SHIPPED** (backend#42, dashboard#35, meta#157, ADR-0033). Backend 608 passed at 97.29% (floor 97 → 97.2); dashboard 427 at
  92.79/88.99/85.35/92.79 (floors → 92.5/88.5/85/92.5); **e2e 24 → 27**, mutation-checked;
  `lint-imports` 10 kept / 0 broken with both new contracts verified by breaking them.
  Verified in a real browser in English and Arabic. Full account: `journal/2026-W36.md`.

  ⚠ **`precision = 1` is load-bearing in `pyproject.toml`.** coverage.py rounds the total to
  `precision` decimals before comparing it to `fail_under`, so a fractional floor with the
  default precision of 0 compares 97.28% as `97` and fails. The floor raise alone would have
  turned CI red. Do not drop that line when next raising the floor.

- **The leaked credentials are ROTATED** (2026-09-05) — the `sk_live_` Stripe key, the AWS
  access key and secret, the Django `SECRET_KEY`, and the Postgres and Flower passwords from
  `588a1e35`. This was the only active exposure on the list and it is closed.

  Their `.gitleaksignore` fingerprints **stay**, and that is a deliberate reversal:
  ADR-0030 said to delete a line once rotated, but rotation makes a credential *dead*, not
  *absent* — the strings are still in history, so deleting the lines would make gitleaks
  report them again and turn CI permanently red. **ADR-0032** amends that clause; the file
  is a rotation record now.

- **Phase C0 shipped** (backend #41, dashboard #34, ADR-0031). A new `curriculum` module
  owns `Subject` plus the teacher/student links; `TeacherProfile.gender` closes a gap open
  since Phase A, where students could state a `teacher_gender_preference` that no teacher
  could satisfy. Backend 534 passed at 97.39% with `curriculum` at 100%; dashboard 391
  passed; e2e 20 → 24. Both new import-linter contracts were written before any code and
  the boundary one was verified by breaking it. Two plan defects were found by executing
  it — see the journal.

- **Two `ISSUES.md` gates closed, each verified by breaking it first** (backend #40,
  marketing #5). `scheduling` now forbids direct `kaleem.identity.models` imports — the
  hole was real, a probe import passed all five contracts before the fix. The marketing
  home page has a `<meta name="description">`; its `interface Props` turned out to enforce
  nothing (marketing has no type-check in CI, now logged), so the guard is a runtime throw
  the build surfaces.

- **The mobile drawer restores focus to the hamburger** (dashboard #33). `AppShell` names
  the destination in `onCloseAutoFocus`, because the drawer opens from shell state and
  Radix has no `Dialog.Trigger` to restore to. `e2e/shell.spec.ts` now *asserts* focus
  restore where it used to explain in a comment why it couldn't. Mutation-checked in a
  real browser — reverting the fix turns that assertion red; the full 20-flow suite passes
  locally against a real stack.

- **Security and performance scanning runs for the first time** (ADR-0030): `gitleaks` and
  `pip-audit` block merges in `ci.yml`'s `security` job; Lighthouse runs nightly against
  staging with ratchet floors in `.lighthouserc.json`. All three were validated locally
  before the PR — gitleaks green with `.gitleaksignore`, `pip-audit` clean on the
  production dependency set, `lhci autorun` green against real staging (3 runs × 2 URLs).
  The first run found live credentials in git history — **rotated 2026-09-05**, see the
  entry below — a stray
  `portal-snapshot.md` Playwright dump at the repo root carrying a Stripe test-mode portal
  secret (deleted), and four page-quality findings logged to `ISSUES.md`.

- **The `past_due` → `unpaid` dunning path is exercised nightly against real Stripe**
  (backend #39, meta #145 + #146). Verified three ways: locally twice (5 passed, 2m49s and
  4m19s), in CI on master (5 passed, 4m01s), and **mutation-checked** — breaking
  `_apply_invoice_payment_failed` to write `ACTIVE` turns the harness red. It found three
  real defects: the Stripe account was set to *cancel* rather than *mark unpaid* (so
  `unpaid` was unreachable in production too, leaving that branch of `_is_paid_through` and
  the `unique_live_subscription_per_user` unpaid clause dead); the probe tests leaked a
  Stripe customer per run; and a workflow env var that would have made the nightly
  permanently red. Two limitations are recorded rather than hidden — it runs at the
  account's `basil` default not production's `dahlia` pin (`ISSUES.md`, *Blocks launch*),
  and it seeds the local `Subscription` row so `_apply_checkout_completed` is not exercised.

- **e2e extended past identity, 6 flows → 20** (meta #140); every new flow is a *write*, so
  CSRF on mutations across the ADR-0019 boundary is now covered. Two defects logged, not
  fixed (D10). **Both billing specs closed** (meta #141). Detail in `journal/2026-W36.md`.
- **Billing verified end to end on staging** — subscribe → checkout → portal → cancel, twice;
  kaleem and Stripe agreed exactly. Webhook endpoint pinned to `2026-08-26.dahlia` with
  `DJANGO_STRIPE_API_VERSION` set explicitly — keep it that way in every new environment.
- **Trunk-based flow adopted** (ADR-0028) and **API versioning enforced in CI** (ADR-0029,
  backend #37) — a test walks the resolved URLconf and fails on any unversioned route.
- ⚠ **C0's staging click-through is partial, and this is the reason.** Verified live:
  the routes are deployed, the data migration ran (`GET /api/v1/curriculum/subjects/`
  returns Quran/Tafsir/Arabic), role gating holds (the teacher endpoint 403s a parent),
  and a parent sees neither subject panel. **Not** verified live: the teacher and
  student panels rendering and saving. Staging has no teacher account, and a child
  created to get a student profile cannot log in because its email is unverified and
  CI/staging have no mail-catcher (`ISSUES.md`). Both panels are covered by unit tests
  and by 4 e2e flows against a real stack, so this is a gap in *manual* D9 coverage
  only — close it by making a teacher on staging via Django admin.

- Throwaway staging accounts, all password `KaleemStaging!2026`: `billing.clickthrough@`
  (id 7), `billing.recheck@` (id 8), `billing.failcard@` (id 9), plus the two older `*.smoke@`
  users. Clear them all on the next staging DB reset.
