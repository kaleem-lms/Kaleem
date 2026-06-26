---
current_phase: "A"
active_spec: "2026-06-25-scheduling-availability-design — SHIPPED to develop 2026-06-26 (tz-aware weekly availability + Calendly-style editor; first slice of the Phase B scheduling module, started early per user direction = deviation). Built subagent-driven TDD (11 tasks, 2 repos); final whole-branch review READY TO MERGE. Matching/sessions/billing/video explicitly deferred. Earlier this session also shipped UI a11y-polish + frontend-only module scaffolds (deviation)."
active_branch: "meta feat/dashboard-styling-polish (open PR → develop) carries the dashboard styling pass screenshots + pointer bump. dashboard @ 4b74565 (PR #21 styling-polish, merged to main; layout-system #20 already in). backend pointer @ 38f64d4 (scheduling module). In-flight Phase A identity work still lives on feat/child-verification-spec + the email-privacy campaign."
last_green_ci: "develop→master #90 deploy-staging GREEN 2026-06-19. ⚠ develop is well AHEAD of master and NOT promoted: UI a11y-polish, module scaffolds, scheduling-availability, the dashboard layout-system, AND the dashboard styling pass all sit on develop, none on staging. Backend scheduling suite (18 tests) + ruff/mypy/import-linter green; dashboard suite (257 tests) + tsc + biome green — all LOCAL (submodules have no CI; dashboard coverage gate still unwired, see ISSUES). Next promotion ships all of it."
---

# kaleem Project State

## Current phase: Phase A — Identity

## Session 2026-06-26 (latest) — dashboard styling pass SHIPPED to develop (visual-quality audit)

User pushed back ("styling still sucks") after the layout-system fix. Ran a **multi-agent styling
audit** (8 dimensions → adversarial verification → synthesized plan; 34/39 findings confirmed),
implemented the confirmed P0/P1/P2 fixes, and re-verified in the running app across
light/dark/RTL/mobile (screenshots in the spec `assets/`, `v2-*`).

- **Biggest fixes:** dark-mode primary CTA was a pale mint reading as low-emphasis → deeper saturated
  deep-green + white label (AA 5.03:1); home's `—` Parent/Student cards → real empty states (icon +
  message + CTA + subtitle, two-up, en/ar); denser layout (page column 768→1024px, two-up grids on
  Account/Family, two-column availability); elevation/structure (bare-`border` → warm `--border`
  token, lifted/visible shadows, card-header dividers, Fraunces card titles); calmer chrome (gold
  active-nav block → tint + thin gold rail; topbar separator + 44px controls); availability editor on
  a card with row dividers + tabular times + on-token success color (was AA-failing raw green);
  aria-invalid input ring that doesn't suppress focus; global reduced-motion backstop.
- **Regression caught in-verify:** the new topbar separator re-introduced a 375px overflow → hidden
  below `sm`; re-measured `scrollWidth` 368 ≤ 375.
- **Verified:** vitest **257 green**, tsc + biome clean. **Merged:** dashboard #21 → main (`4b74565`).
  Meta PR (this branch) bumps the pointer + carries the v2 screenshots → develop. **NOT deployed.**
- **Deviation (ISSUES):** three dark/elevation token overrides live in the dashboard cascade (same
  pinned-git-tag reason as the layout tokens); promote on the next tokens release.

## Session 2026-06-26 (later) — dashboard layout system SHIPPED to develop (UI/UX audit)

User-triggered UI/UX audit of the authed dashboard ("huge layout sizing problem"). Full process:
brainstorm → spec (`docs/superpowers/specs/2026-06-26-dashboard-layout-system-design.md`) → plan
(`docs/superpowers/plans/2026-06-26-dashboard-layout-system.md`) → TDD → **visual before/after run**
(real running stack, Playwright @ 1440/768/375, screenshots in the spec's `assets/`) → merged.

- **Root cause:** the shell `<main>` had no max-width/centering, so each page rolled its own width
  wrapper (448 / 672 / 768px) and `mx-auto` centered within the post-sidebar region → content drifted
  right into a void and the width jumped page-to-page. **Fix:** content-width `@theme` tokens
  (`--container-page/narrow/wide`) + `PageContainer` + `PageHeader` primitives; every page + the
  module placeholders routed through them (standard pages now all 768px; availability `wide`, double
  padding removed; Account gained its missing `<h1>`); shell `<main>` owns vertical rhythm only;
  sidebar links `min-h-11` (44px). Also fixed a **pre-existing 375px topbar horizontal-overflow**
  (user-name button → name now hides below `sm`).
- **Verified:** vitest **257 green** (53 files, +15 tests), tsc + biome clean; 375px overflow gone
  (`scrollWidth` 372 ≤ 375). Visual after-shots confirm consistent width + no right-drift.
- **Merged:** dashboard #20 → main (`4f8c4ea`). Meta PR (this branch) bumps the pointer + carries
  spec/plan/screenshots → develop. **NOT deployed** (sits on develop with the prior work).
- **Deviation logged (ISSUES):** layout tokens live in the dashboard `@theme`, not `@kaleem/tokens`
  (pinned-git-tag consumption would need publish→rebuild + break HMR verification); promote on the
  next tokens release.

## Session 2026-06-26 — scheduling availability SHIPPED to develop (Phase B started early)

First real slice of the **Phase B `scheduling`** module, started early at user direction
(deviation — recorded in journal W26). Full process: brainstorm → spec
(`docs/superpowers/specs/2026-06-25-scheduling-availability-design.md`) → plan
(`docs/superpowers/plans/2026-06-25-scheduling-availability.md`) → subagent-driven TDD (11 tasks,
2 repos) → final whole-branch review (**READY TO MERGE**) → merged.

- **What shipped:** teachers and students set a **recurring weekly availability in their own
  timezone** via a Calendly-style per-day editor (layout B). Backend `scheduling` module with a
  queryable `WeeklyAvailability` table, `GET/PUT /api/v1/scheduling/me/availability/` (full-replace,
  merges overlaps, typed 400/403), `User.timezone`, and a tested `to_utc_intervals` tz-conversion
  primitive. The student's old `StudentProfile.time_preferences` JSON was **removed** (availability
  now lives in scheduling); `teacher_gender_preference` stays in identity. Dashboard:
  `WeeklyAvailabilityEditor` + `TimezoneBar` on a teacher `/availability` page + the student
  `/account` card; en/ar + RTL + jest-axe.
- **Explicitly OUT (future specs):** the matching engine (overlap search + rule filters + broadcast
  to teachers + first-accept-claim + linking), sessions/bookings/Zoom, billing/entitlement,
  cross-user availability viewing. `to_utc_intervals` is the only matching-facing primitive built.
- **Merged:** backend #28 → main (`38f64d4`), dashboard #19 → main (`8aff4b5`), meta #106 (spec+plan)
  → develop. Pointers bumped on develop. Final-review follow-ups logged in ISSUES (route teacher-gate,
  parseApiError shared-lib, stale child `time_preferences:[]` payload, tz picker Escape, weekday
  DB-constraint, DST/multi-tz).
- **NOT deployed:** sits on develop with the prior a11y + scaffolds work; a `develop → master`
  promotion ships all three to staging. Manual browser click-through is the remaining D9 step
  (post-deploy, as with prior slices).

## Session 2026-06-25 — UI a11y polish + module scaffolds (on develop, NOT deployed)

Triggered by "set up UI/UX" → turned out the **Serene Scholar** design system already
exists, so the work was an **audit + improve** pass, then (at user request) **frontend
scaffolds**. All merged to develop; **not yet on staging**.

- **UI a11y polish** (dashboard #17 → main; meta #101 docs): 44px touch targets,
  role-correct `Alert`, 16px mobile inputs (no iOS zoom), color+icon toasts, a
  `PasswordInput` show/hide primitive across all 7 password fields, required-field
  markers, locale-aware `Spinner`, hover-shade buttons. 181 tests green.
- **Frontend-only module scaffolds** (dashboard #18 → main): `ModulePlaceholder` + 6
  navigable placeholder routes (schedule, curriculum, assessments, messages, billing,
  insights) behind role-gated nav, en/ar. **⚠ DELIBERATE ROADMAP DEVIATION** — these
  modules have no backend and are later phases; built as placeholders at user request,
  recorded in journal W26. They *look* built-out but are non-functional. Role gating +
  which modules appear in nav are **provisional** until each module's real D1 spec.
- Pointer bumps: meta #102 (a11y) + #104 (scaffolds) → develop now records dashboard
  **7a10a48**. Journal W26 (#103) records the deviation. develop is clean/consistent.

**Next step (roadmap-true):** do NOT keep scaffolding. Close **Phase A** (child-verification
+ email-privacy campaign), green its exit criteria, then open **Phase B (billing)** with a
proper backend+frontend D1 spec — the scaffold billing page gets replaced by the real slice.
Optional now: promote develop→master to put the a11y polish + scaffolds on staging.

## Email verification & login integrity (+ fixes) — ✅ SHIPPED to staging + verified (2026-06-19)

Identity hardening from `tasks.todo` (#9/#1/#2/#6). Spec/plan:
`docs/superpowers/specs|plans/2026-06-18-email-verification-login-integrity*`.

- **#9** login gate now checks the *submitted* email's verification, not "any verified email"
  (backend #18). **#1** old-email-keeps-working invariant locked in with tests.
- **#2** verification links already route to the frontend `/verify-email`.
- **#6** "/verify-email spins forever" — first attempt (dashboard #11) still hung in dev. Real cause:
  the confirm ran as a `useMutation` in `useEffect`, whose result React StrictMode's dev double-mount
  drops → stuck spinner (worked only in prod builds). FIXED (dashboard #12) by modelling the confirm
  as a StrictMode-safe **keyed `useQuery`**; missing key now shows an error. Verified live (StrictMode
  on): register → mailpit link → success; bad/missing key → error.
- **Verification URL invalid in production:** `FRONTEND_URL` defaulted to `app.kaleem.localhost`.
  Production now *requires* `DJANGO_FRONTEND_URL` (backend #19, fail-loud) — **must be set on the VPS**.

Merged to main: backend #18+#19+#21 (`88f774b`), dashboard #11+#12 (`89c9594`). Promoted `develop → master`
via meta **#90** → **deploy-staging GREEN** (run 27797446993, 2026-06-19). `DJANGO_FRONTEND_URL` set on the
VPS. **Verified live on staging:** `/verify-email?key=bad` → terminal error ("link is invalid or has
expired" + sign-in link), no infinite spinner. Success path covered by unit tests + dev mailpit run.
Pre-existing CI/coverage gaps logged in `ISSUES.md`.

**Still open (email config, twin of the prod-URL fix):** `tasks.todo` — "email verify email has invalid
domain in subject" (allauth subject likely renders the Django Site default `example.com`).

## Dashboard-completion roadmap (shell → email → children/invites → onboarding)

Building out the authenticated dashboard identity surface in four specced slices,
each via brainstorm → spec → plan → subagent-driven build → whole-branch review →
git-flow merge. All TDD, en/ar + RTL, jest-axe, biome/tsc clean.

- **Spec 1 — app shell** ✅ shipped (dashboard PR #7): sidebar + topbar + mobile drawer,
  data-driven nav, user menu, sign-out.
- **Spec 2 — email-management UI** ✅ shipped (dashboard PR #8): `/account` page; list/add/
  verify/set-primary/remove email addresses.
- **Spec 3 — children + invites UI** ✅ shipped (dashboard PR #9, merged to `main` @ `7bb4b37`,
  2026-06-18): role-aware `/family` page. Parent manages children (list, add-by-name,
  set-password) + generates invite codes (copy + 24h expiry); student accepts a code to link
  to a parent. Frontend-only (consumes existing `children/`+`invites/` endpoints). 119 dashboard
  tests green. Meta docs + ISSUES (child-login limitation) + pointer bump on
  `feat/children-invites-spec` → PR to `develop`.
- **Spec 4 — student onboarding preferences UI** ✅ shipped (backend PR #17 → `main` @ `942cfef`;
  dashboard PR #10 → `main` @ `b30b494`; 2026-06-18): student-only "Learning preferences" card on
  `/account` (teacher-gender + repeatable time-slot rows). Added a small backend `GET
  me/student-profile/` so the form pre-fills (was POST-only). 135 dashboard tests green; backend
  GET tested (ruff/mypy clean). Two-repo feature; meta docs + ISSUES + both pointer bumps on
  `feat/student-preferences-spec` → PR to `develop`.

**Dashboard-completion roadmap is COMPLETE (all 4 specs shipped).** The authenticated dashboard
now has the app shell, email management, children/invites, and student preferences.

Not yet deployed to staging — the merged work sits on dashboard `main` (+ backend `main`) + meta
`develop`; promotion `develop → master` to staging (and the browser click-through) is the next
step, alongside closing Phase A.

## Active spec

docs/superpowers/specs/2026-06-08-identity-module.md

## Phase A identity — DONE ✅ (DoD fully closed 2026-06-10)

All 8 plan steps implemented with TDD (78 tests; models.py 93% / services.py 96%
coverage; ruff + mypy + import-linter green). Spec + plan shipped/done. Backend is
live on staging and the previously-broken register flow now works.

**Staging is green and functional.** A live smoke test first found
`POST /api/identity/register/` → 500 (production had no email config: SMTP defaulted
to localhost:25). Fixed with env-driven SMTP + AWS SES (ADR-0016); deployed via #39.
Live re-test on `staging.kaleem.academy`: register → **201** (SES sends, out of
sandbox), login-before-verify → **400 not verified**, unauth mutation → **403**. The
full verified flow (verify→login→/me→child→invite→accept) is proven locally on the
identical code; on staging the verification link now lands in a real inbox via SES, so
the final click-through is a human check (register with a real address).

Note: two throwaway test users exist in the staging DB (`stg.smoke@example.com`,
`ses.smoke@example.com`) from smoke testing — clear them via admin or on the next DB
reset.

Definition-of-Done:

- ✅ Golden-path smoke test over real HTTP against the live dev stack (real CSRF,
  sessions, and allauth verification via the console email backend): register parent →
  confirm email → login → GET /me/ → add child → create invite, then register adult
  student → confirm → login → accept invite (`linked: true`).
- ✅ Edge cases: unverified login → 400; invalid invite code → typed 400; authenticated
  mutation without CSRF → 403. (Anonymous register without CSRF returns 201 — confirmed
  standard DRF SessionAuthentication behaviour, not a bug.)
- ✅ Admin teacher flow: superuser logs into Django admin → selects teacher → "Send
  password-set email" action → teacher receives a reset email. (`create_teacher_account`
  service also unit-tested.) Note: the eventual teacher-create UX lives in the React
  dashboard, not Django admin — see docs/adr/0013-custom-admin-dashboard.md.
- ✅ Architecture doc `docs/architecture/identity.md`.
- ✅ Weekly journal entry `docs/superpowers/journal/2026-W24.md`.

- ✅ Staging deploy. `develop → master` (#33) deployed green via the `deploy-staging`
  job: backend image built + pushed to GHCR, SSH to VPS, blue-green via
  `infra/scripts/ship.sh`. First attempt failed at `migrate` on stale staging-DB
  migration history (`account.0001` before `identity.0001`); resolved by recreating the
  staging `kaleem` database (pre-launch, no data) and re-running the deploy on
  2026-06-10. VPS-internal readiness check passed; `Deploy complete: blue → green`.

  Getting here also required pushing previously-local-only backend/infra submodule
  commits to their remotes and fixing a ruff pre-commit/CI version skew — see git
  history (backend #1/#2, infra #1, meta #32–#35).
- ✅ Live staging smoke test (register 201 / login-before-verify 400 / unauth 403) after
  wiring production email (AWS SES SMTP, ADR-0016; backend #3, infra #2, meta #37/#39).

## Frontend delivery pipeline — SHIPPED to staging ✅ (2026-06-13)

The dashboard and marketing site now deploy end-to-end (ADR-0019). Both are nginx
images built + pushed to GHCR by CI and served as Compose singletons behind Traefik:

- Dashboard (the app): `app-staging.kaleem.academy`
- API (Django): `api-staging.kaleem.academy` (moved off `staging.`)
- Marketing: `staging.kaleem.academy`

Same-site session auth across `app-`/`api-` via `Domain=.kaleem.academy; SameSite=Lax`
cookies + CORS allow-list. Deploy verified green: all routes 200 over HTTPS (certs
issued), DB-backed `/health/ready/` ok, immutable asset caching, CORS preflight echoes
the dashboard origin with credentials and rejects others.

Process change: every feature now ships its frontend slice (spec template has a required
`## Frontend` section; D9 DoD includes browser-verified frontend).

**Cross-subdomain cookie gate is BLOCKED on the identity UI not existing yet.** The
dashboard is still the Phase-0 scaffold — only route is `/` (a placeholder); there is no
login/register/`/me` UI (`features/identity/` is an empty stub). So `/me` just hits the
SPA fallback and renders the placeholder. The Phase A identity *backend* shipped without
any frontend (it predates the every-feature-ships-its-frontend rule). The register→login
click-through can't happen until the identity frontend slice is built.

Gotchas hit + fixed: the blue-green readiness probe curls `/health/ready/` on localhost,
so `ALLOWED_HOSTS` must include localhost — now hardcoded in `production.py` so it can't
break on operator env. The VPS `.env.production` needed `APP_DOMAIN` renamed to
`API_DOMAIN` (not synced by CI — managed on the box).

## Design system + visual identity — SHIPPED (code), promotion pending (2026-06-13)

Brainstormed, specced (`docs/superpowers/specs/2026-06-13-design-system-visual-identity-design.md`),
planned, and built via subagent-driven execution. **Serene Scholar** brand (emerald + gold
on cream), Fraunces + Inter + IBM Plex Sans Arabic, light+dark, full RTL. See
`docs/architecture/design-system.md` and ADR-0020 (a11y/i18n/l10n baseline).

- **`@kaleem/tokens`** repo published, tagged **v0.1.1** (added here as the 5th submodule
  `tokens/`). CSS vars on shadcn's contract + Tailwind v4 `@theme` preset.
- **Dashboard** (merged to `main` @ `afce34d`): consumes tokens; `src/ui/` shadcn primitives
  (Button, Input, Label, Field/FormError, Card, Alert, Spinner) + theme/locale toggles +
  auth shell; ThemeProvider (light/dark, no-flash); i18n + DirectionProvider (full RTL);
  lucide icons; `/design-preview` route; a11y + AA-contrast (both themes) + RTL gate;
  **23 tests green**. Browser-verified light/dark/RTL.
- **Marketing** (merged to `main` @ `481fe91`): consumes the same tokens (cross-build-system
  proven). Branded hero only.
- **Fixed a latent bug:** `index.html` pointed at the dead vanilla `main.ts` (the React app
  was never built/deployed — staging was serving the Vite counter demo). Now `main.tsx`.
- **Animations** were considered and **dropped** (user decision) — keeps the calm brand.

**DEPLOYED to staging ✅ (2026-06-13).** Promoted `develop → master` (PR #69); `deploy-staging`
green (run 27461511438) — dashboard + marketing images built (BuildKit token secret + pnpm 10)
+ pushed to GHCR + deployed to the VPS. Verified live: `app-staging.kaleem.academy` now serves
the **real React app** (`<div id="root">` + React bundle, not the old vanilla scaffold);
`/design-preview` renders the Serene Scholar design system (light/dark/RTL); marketing brand
applied; API health 200.

CI plumbing that got us here (all merged): `TOKENS_REPO_TOKEN` (read `kaleem-lms/tokens`) on the
meta repo for runner `git insteadOf` + Docker BuildKit secret; tokens submodule uses an https URL
(SSH broke `actions/checkout`); **pnpm bumped 9 → 10** (pnpm 9 + Vite 8/rolldown choked on the
git-dep node_modules path); `GHCR_PAT` needs `write:packages`.

## Dockerized one-command dev environment — SHIPPED ✅ (2026-06-14)

Spec: `docs/superpowers/specs/2026-06-13-docker-dev-environment-design.md` | Plan: `docs/superpowers/plans/2026-06-13-docker-dev-environment.md`

`just dev` brings the full stack behind Traefik subdomains (`*.kaleem.localhost`) mirroring the ADR-0019 staging topology. Containers run as the host UID/GID — no root-owned files. HMR works through the proxy. 104 backend tests pass in-container. Developer guide: `docs/developer-guide/local-dev.md`.

## Identity frontend slice — spec + plan done; Phase 1 (auth core) BUILT, PRs open (2026-06-14)

Spec `docs/superpowers/specs/2026-06-14-identity-frontend-design.md` (D1) and plan
`docs/superpowers/plans/2026-06-14-identity-frontend-phase1-auth-core.md` (D2) written. Full
identity surface decided, delivered in 3 phases (auth core → parent → student); auth via
TanStack Query `useMe` + `_authed` guard; custom `/verify-email` landing; role-aware home;
weekly availability grid (Phase 3); react-hook-form + module-mocked tests.

**Phase 1 (auth core) is fully implemented (TDD, subagent-driven) and open as PRs — not yet merged/deployed:**

- **backend** `feat/verify-email-endpoint` → [PR #15](https://github.com/kaleem-lms/backend/pull/15):
  `POST /api/v1/identity/verify-email/` (confirm-by-key) + adapter override so verification
  links point at `{FRONTEND_URL}/verify-email?key=…`. New `FRONTEND_URL` setting. 99 tests,
  ruff/mypy/import-linter green.
- **dashboard** `feat/identity-auth-core` → [PR #6](https://github.com/kaleem-lms/dashboard/pull/6):
  register/login/verify-pending/verify-email/role-aware home/profile, `useMe`+guard, full
  i18n+RTL+a11y. 47 tests, tsc/biome green. Removed the Phase-0 placeholder `/` and
  `/design-preview`.
- **meta docs** `feat/identity-frontend-spec` → [PR #75](https://github.com/kaleem-lms/Kaleem/pull/75): spec + plan.

Verified end-to-end against the **local dockerized stack**: register → mailpit link →
verify-email → login → `/me` all succeed (proves B1+B2 live).

## Next (immediate) — M1: merge + close Phase A

1. **Merge the two submodule PRs to `main`** — CI is now green/CLEAN on both (checked
   2026-06-16): backend #15, dashboard #6. They are mergeable now.
2. **Bump the `backend`/`dashboard` submodule pointers** in meta once those PRs merge
   (the dashboard working pointer is already at the unmerged `8f8c61d` — do NOT commit it
   until #6 merges), then update this STATE — all via a meta `feat → develop` PR.
3. **On the VPS:** set `DJANGO_FRONTEND_URL=https://app-staging.kaleem.academy` in
   `.env.production` (not synced by CI — managed on the box, like `API_DOMAIN`).
4. **Promote meta `develop → master`** → triggers `deploy-staging`. Then do the **real
   browser click-through** on `app-staging` (register with a real email → click SES link →
   verify-email → login → `/me`) — this proves the cross-subdomain session cookie and
   **closes Phase A.**
5. Then **Phase 1 wrap** (journal/DoD) and start **Phase 2** (parent flows: children +
   invites) with its own plan, then **Phase 3** (student: invite-accept + availability grid).

### ⚠ In-flight (meta working tree)

- The `VITE_API_URL` `/api/v1`-prefix fix is **already committed** (`51ca644`) — the earlier
  "uncommitted" note was stale. If you recreate the dashboard container, vite picks up the
  env: `docker compose -f docker-compose.local.yml up -d --force-recreate dashboard` (with
  `GH_TOKEN`/`HOST_UID`/`HOST_GID`).
- The `dashboard` submodule pointer is modified in the working tree (points at the unmerged
  `8f8c61d` on `feat/identity-auth-core`). Left **uncommitted on purpose** — only bump it
  after dashboard PR #6 merges to `main` (M1 step 2).
- A global session hook now runs a security + performance gate on every `/handoff`
  (`~/.claude/hooks/handoff-security-perf-scan.sh`): OWASP/dep-audit scanners that are
  installed run automatically, and it injects a web-standards (OWASP Top 10 + Core Web
  Vitals/WCAG 2.2 AA) checklist. Install `semgrep`/`gitleaks`/`pip-audit`/`lhci` to deepen it.
