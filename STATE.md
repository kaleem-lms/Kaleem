---
current_phase: "C — Scheduling. C0 (matching inputs) SHIPPED 2026-09-05; C1 (matching) SHIPPED 2026-09-05. C2 (booking + quota) SHIPPED 2026-09-05 (backend#43, dashboard#36, meta#162). C3 is decomposed further into C3a-C3e (ADR-0034); C3a (video room + provider seam) SHIPPED 2026-09-05 (backend#44, dashboard#37, meta#164). C3b (signaling) SHIPPED 2026-09-06 (backend#45, infra#6, meta#166) and is live on staging. C3d (call client) SHIPPED and verified live on staging 2026-09-07. C3e is split into C3e-a (call diagnostics) SHIPPED and verified live on staging 2026-09-07 (backend#48, dashboard#40, meta#176), and C3e-b (the seven Safari/iOS hardening fixes) SHIPPED and verified live on staging 2026-09-07 (dashboard#41, meta#178/#179). **Phase C is COMPLETE** — C0, C1, C2 and C3a–C3e are all shipped and live. Note what Phase C is NOT: the roadmap's own Phase B happy path is still open, because `assessment` (session reports, ratings) and `analytics` (the role dashboards) were never built — a lesson can be booked and delivered, but nothing records what happened in it. Phase B (billing) is CLOSED as of 2026-09-04, dunning gate included. Phase C is decomposed because matching, booking and video are separate subsystems in a strict dependency order: C0 matching inputs, C1 matching, C2 booking + quota, then video as C3a rooms, C3b signaling, C3c STUN/TURN, C3d call client, C3e browser hardening. Note the roadmap calls scheduling 'B2'; that label is already taken by a closed billing spec, so scheduling is Phase C here."
active_spec: "docs/superpowers/specs/2026-09-07-session-ui-redesign-design.md — SHIPPED 2026-09-07, status: shipped, closed: 2026-09-07 (dashboard `feat/session-ui-redesign` @ c12ea2a, meta `feat/session-ui-redesign-spec` PR #185). Redesigned the session list (responsive grid, grouped by local day) and the call room (fluid stage, visible identity header, real terminal/waiting screens), restructured via ADR-0036 (`use<Feature>` hook + presentational components) — chosen over a presentation-only reskin as a deliberate D10 deviation. **Verified: dashboard unit suite (734→ many more) and 2 new Chromium e2e flows only — the session card's reflow at two viewport widths (mutation-checked red), and the Lobby scrolling rather than clipping at one short landscape viewport (NOT mutation-checked red — see next line).** **Spec correction, made in Task 18:** the original Goal framed `overflow-y-auto` on the Lobby as fixing a bug ('clips its own content and cannot scroll'). Chromium does not reproduce that clipping bug at all — reverting to the literal pre-fix CSS left the e2e flow green, and a minimal bare-metal repro (flex column, min-height:100vh, justify-center, 2000px child, 400×220 viewport, no overflow set) scrolled fine. The change is defensive hardening against a plausibly-Safari-only bug, unverifiable here, not a demonstrated fix. Nothing here is verified outside Chromium at the two tested viewport sizes — not Safari, not iOS, not any other viewport. D9 deviation: no click-through on iOS Safari is possible in this project, same as C3e-a/b. Next phase not yet chosen — see journal 2026-W36, 2026-09-07 entry, for the full account."
active_branch: "meta `feat/session-ui-redesign-spec`, PR #185 OPEN (docs only so far; this session adds the Task 18 close-out docs + dashboard pointer bump, not yet pushed/merged). dashboard `feat/session-ui-redesign` @ c12ea2a, code-complete, no PR opened yet. TRUNK-BASED (ADR-0028) — branch feat/… off the trunk, PR in. A merge to meta `master` IS a deploy."
last_green_ci: "meta #172 → master, 2026-09-07 (all 8 checks green, deploy-staging SUCCESS). Staging is on **blue**. ⚠ The e2e job FAILED first: it never ran the signaling service and never set DJANGO_VIDEO_PROVIDER, so it fell back to FakeVideoProvider whose join_url points at a host that does not resolve — the two-peer call test could never have passed in CI. Fixed in ci.yml (uvicorn signaling on :9000, ws.kaleem.localhost in /etc/hosts, five env vars). Verified live after deploy: a relay-only two-peer call carried real media through coturn."
---

# kaleem Project State

> **This file is the current position only.** Session history lives in
> [`docs/superpowers/journal/`](docs/superpowers/journal/) — the June–August log that used
> to live here is archived at
> [`docs/superpowers/journal/session-log-2026-06-to-08.md`](docs/superpowers/journal/session-log-2026-06-to-08.md).
> Keep this file under ~60 lines. If you are adding a fourth section, you are writing a
> journal entry — put it in the journal.

## Where we are

**Phase C (scheduling) is closed as of 2026-09-07.** C0 matching inputs, C1 matching, C2
booking + quota, and C3a–C3e video are all shipped and live on staging. A parent can pay, a
student can be matched to a teacher, book a recurring slot, and the two of them can hold a
real video call that relays through our own coturn.

What Phase C does *not* close is the roadmap's Phase B happy path. `assessment` (session
reports, symmetric ratings) and `analytics` (the three role dashboards) do not exist —
neither module is in `backend/kaleem/`. A lesson can now be delivered and nothing records
what happened in it, so the roadmap's own exit criterion ("teacher completes the session and
writes a report; student and parent see it") is unmet. Note also that **preview mode never
ran** — the roadmap makes it a non-optional gate before opening any further spec, and it has
not happened.

**Phase B (billing) is closed.** Both specs closed 2026-09-04, and the last gate — the
`past_due` → `unpaid` renewal path — is now exercised nightly against real Stripe via test
clocks (`docs/superpowers/specs/2026-09-04-stripe-test-clock-harness-design.md`). It is not
in the merge path by design; a residual gap is tracked in `ISSUES.md` (the harness runs
against the account's `basil` default, not production's `dahlia` pin).

Phase A (identity) is closed via ADR-0024, with one residual human check outstanding.

## ▶ Next actions, in order

1. **Choose the next phase with the user.** Phase C is closed and nothing is in flight. The
   two obvious candidates: `assessment` (session reports + symmetric ratings), which closes
   the roadmap's Phase B happy path and is what makes a delivered lesson leave a trace; or
   `notifications`, which the roadmap puts in its own Phase C and which every other feature
   ends up needing. Do not pick one unilaterally — the roadmap says Phase C priorities are
   provisional until preview feedback, and preview mode has not run.
2. Once live, watch C3e-a's `CallDiagnostic` codes — `gum-no-gesture`, `autoplay-blocked`,
   `backgrounded`, `device-lost`, `ice-restart-unsupported` — for real Safari/iOS traffic. That
   is the only verification loop this phase has; see `journal/2026-W36.md`.
3. From `ISSUES.md`, one C3c operational entry wants closing before it bites: a coturn
   config-only change does not restart the running relay, so a `turnserver.conf` fix reaches the
   VPS and does nothing until someone restarts it by hand. (The `ws-green-staging` certificate
   entry proved smaller than predicted — see `ISSUES.md`.)
4. Still standing from C2 under **Blocks launch**: the quota cycle is keyed by an exact
   `current_period_end`, and a mid-cycle rewrite would hand out a second allowance.

## Standing warnings

- ⚠ **The C3d fixture passwords proved unstable, and I could not explain why.** On 2026-09-07 the
  documented password for `c3d.student@example.com` worked at 06:34 and no longer matched the stored
  hash by 09:18. Nothing in between should have touched it: the C3e-b deploy ran `migrate` only, and
  C3e-b is dashboard-only so there were no backend changes at all. `check_password` is a direct hash
  check, independent of rate limiting or lockouts, so the hash genuinely differed. Both accounts were
  reset back to `KaleemC3d!2026` to finish the live check. **If a future session finds these
  credentials refused, reset them rather than assuming a regression** — and if it happens a third
  time, find the cause, because something on staging is rewriting a password and that is worth
  knowing before real accounts exist.
- ⚠ **Session 3 was repositioned to `now` on 2026-09-07 09:20** so the live check could reach the
  Lobby; it had aged out of its join window. It is a standing joinable lesson again.
- ⚠ **One throwaway diagnostic row on staging**, written by the 2026-09-07 live check: session 3,
  `autoplay-blocked`, a synthetic iPhone-Safari `User-Agent` and hand-built redacted stats. It is
  evidence the pipeline works end to end, not real user data. Delete it on the next staging DB
  reset, or leave it — the 90-day purge job will take it on 2026-12-06 either way.

- ⚠ **A merge to `master` is a deploy** (ADR-0028).
- ⚠ **Deploy between lessons.** A deploy still drops every call in progress — the drain is
  unbuilt, and it is the last surviving half of the split-room issue (`ISSUES.md`).

## Recently verified (2026-09-03 → 07)

- **Session UI redesign SHIPPED** (dashboard `feat/session-ui-redesign` @ c12ea2a, meta PR
  #185, not yet merged — **not** yet live on staging). Not a phase; a standalone spec that
  redesigned the schedule's session list and the call room and restructured both into a
  `use<Feature>` hook plus presentational components (ADR-0036). **Verified: the dashboard
  unit suite and 2 Chromium e2e flows only.** One is mutation-checked red (the session card's
  reflow); the other (the Lobby scrolling at a short landscape viewport) is not, because the
  bug it guards against does not reproduce in Chromium at all — the spec originally claimed
  it fixed a real clipping bug and that claim is now corrected in the spec itself. Full
  account, including the uncovered `expiredCalledRef` guard Task 2's mutation check caught
  and the vacuous `viewport-units.test.ts` probe fixed in Task 15: `journal/2026-W36.md`,
  2026-09-07 entry. D9 deviation: no iOS Safari click-through possible here, same as C3e-a/b.

- **Phase C3e-b (browser hardening) SHIPPED and verified live on staging** (dashboard#41,
  meta#178/#179). No backend or infra change.
  `docs/superpowers/specs/2026-09-07-phase-c3e-b-browser-hardening-design.md`. Seven fixes,
  all dashboard-only: `min-h-dvh` on the three call surfaces and the root container; `getUserMedia` moved behind a
  tap (a visible product change — the Lobby now has an explicit "Turn on camera"
  step); a "Tap to turn on sound" control for a refused autoplay; `restartIce`
  feature-guarded; backgrounding/screen-lock recovery reusing `handleRetryConnection`;
  device changes hot-swapped via `sender.replaceTrack()` (no renegotiation); camera/microphone
  choices persisted in `localStorage`. Dashboard floors raised to 95.5/91.6/87.2/95.5
  (measured 95.66/91.75/87.38/95.66); e2e adds 2 Chromium flows (the gesture gate, the
  tap-to-play control). Verified live on Chromium: the deployed CSS carries `min-height:100dvh`,
  the deployed bundle carries all four new strings, the Lobby renders the gesture gate, and no
  false diagnostic row was written by the room navigation, a refused join window, or the gate.
  **Closes under a D9 deviation** — no manual click-through on the target browser, because this
  project has no Apple device and Playwright's WebKit is not iOS Safari. None of the seven
  fixes is verified on the browser it exists for; the verification loop is watching C3e-a's
  diagnostic codes once real traffic arrives, per `journal/2026-W36.md`.

- **Phase C3e-a (call diagnostics) SHIPPED and verified live on staging** (backend#48,
  dashboard#40, meta#176).
  `docs/superpowers/specs/2026-09-07-phase-c3e-a-call-diagnostics-design.md`. One endpoint
  (`POST /api/v1/scheduling/sessions/<id>/diagnostics/`), a closed eight-code vocabulary, WebRTC
  stats redacted client-side by an allow-list before anything leaves the browser, 90-day
  retention, and four emitters wired to failures the code already detected. Backend 902 passed
  at 97.78% (floor stays 97.7); dashboard floors raised to 95.2/91.5/87.0/95.2; e2e 35 → 37.
  **Closes under a D9 deviation** — no manual click-through on the target browser, because this
  project has no Apple device and Playwright's WebKit is not iOS Safari. The pipeline is
  verified on Chromium; that Safari emits anything is not verified and cannot be, here.
- **Phase C3d (the call client) SHIPPED and verified live on staging** (backend#47,
  dashboard#39, meta#172/#173). A real two-peer call now connects: relay-only through coturn,
  443 KB sent / 455 KB received of real media, both remote tracks arriving, over the
  colour-pinned `ws-blue-staging` host. Dashboard: 645 unit tests, 95.28/91.52/87.44/95.28
  (floor 95.1/91.4/86.6 at the time); e2e 33 → 35 flows.

  ⚠ **CI caught a bug no local run could.** `e2e/call.spec.ts` passed locally and failed in CI:
  the `e2e` job never ran the signaling service and never set `DJANGO_VIDEO_PROVIDER`, so it
  fell back to `FakeVideoProvider`, whose `join_url` points at a host that does not resolve —
  the test could never have passed in CI. It had only ever run locally under a
  `docker-compose.override.yml` created for the run and deleted afterwards. Fixed in `ci.yml`.
  Full account: `journal/2026-W36.md`.

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

- ⚠ **C3d throwaway staging accounts**, password `KaleemC3d!2026`: `c3d.student@example.com` and
  `c3d.teacher@example.com`, with a matched Arabic assignment, a recurring slot and one session
  positioned on `now` (session id 3). Built by hand for the C3d live call check. **They are a
  standing joinable lesson** — clear them on the next staging DB reset, or reuse them for C3e's
  Safari/iOS checks rather than rebuilding the fixture.
- Throwaway staging accounts, all password `KaleemStaging!2026`: `billing.clickthrough@`
  (id 7), `billing.recheck@` (id 8), `billing.failcard@` (id 9), plus the two older `*.smoke@`
  users. Clear them all on the next staging DB reset.
