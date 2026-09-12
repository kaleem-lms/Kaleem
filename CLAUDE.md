# CLAUDE.md — kaleem operating manual for AI agents

This file is auto-loaded at the start of every Claude Code session. It is the single source of truth for how to work on kaleem. Keep it short, factual, and up to date. For the full roadmap, see `docs/superpowers/specs/2026-04-11-rebuild-roadmap-design.md`.

## What kaleem is

An LMS for teaching non-Arabic speakers Islamic sciences (Quran, Tafsir, Arabic language). Users are students, parents, teachers, and admins. Parents pay monthly subscriptions, teachers deliver 1-on-1 and group sessions via video (Zoom in v1, custom WebRTC in v2), and both sides rate each other and exchange session reports.

**Status:** currently in a controlled rebuild. An older MVP exists under `kaleem/` (the Django project inside this repo) as a **read-only reference**. All new work goes into a fresh modular-monolith structure. Do not extend the old code; only read it to understand what a feature needs to do.

## The one document you must read

`docs/superpowers/specs/2026-04-11-rebuild-roadmap-design.md` is the full rebuild roadmap. It covers decisions, module map, phases, process, risks, and escape hatches. If anything in this file contradicts that spec, the spec wins.

## Current phase

See `STATE.md` for the current phase and active spec. At the time of this file's creation, the project is in **Phase 0 — Bootstrap**. Features do not exist yet. The work is infrastructure, CI, documentation, and the agent-friendly setup. Resist the urge to skip to feature work.

## The architecture in 30 seconds

- **Modular monolith** — Django project split into business modules (`identity`, `billing`, `scheduling`, `assessment`, `curriculum`, `content`, `messaging`, `notifications`, `engagement`, `analytics`) plus a cross-cutting `platform` module.
- **Module boundaries are enforced** by `import-linter`. No module may import another module's models. All inter-module calls go through `<module>/services.py`. Breaking this fails CI.
- **Identity:** single `User` from django-allauth, plus optional `StudentProfile` / `TeacherProfile` / `ParentProfile` tables as `OneToOne`. A person may have multiple profiles. `Admin` is `User.is_staff=True`.
- **Auth:** session cookies + real CSRF. Frontend (`app-`) and API (`api-`) are same-site subdomains sharing cookies via `Domain=.kaleem.academy; SameSite=Lax` (see ADR-0019). No JWT, no CSRF-exempt hacks.
- **Frontend:** React 19 + TanStack Router + TanStack Query + Tailwind + shadcn (authenticated dashboard). Astro for the marketing site (separate submodule).
- **Infra:** self-hosted VPSes, Docker Compose.
- **Repo:** meta repo with git submodules (`backend`, `dashboard`, `marketing`, `infra`). `docs/` lives in the meta repo.

## The process (D1–D11) — non-negotiable

1. **D1 Spec-before-code.** Every feature starts with a spec in `docs/superpowers/specs/YYYY-MM-DD-<name>.md`. No code without a committed spec.
2. **D2 Plan-before-code.** Anything > 1 day gets an implementation plan in `docs/superpowers/plans/` before coding.
3. **D3 Test-driven development.** Failing test first, then the code. Coverage is a
   **ratchet floor, enforced in CI today** — not the aspirational 100% (ADR-0026 amends
   ADR-0021). The floor may only go up; **lowering it requires an ADR**, so a
   coverage-dropping PR goes red rather than being quietly waved through.

   | Repo | Floor (line/branch) | Where it lives | Enforced |
   | --- | --- | --- | --- |
   | `backend` | 97.7 | `pyproject.toml` `[tool.coverage.report]` | ✅ |
   | `dashboard` | 96.6 lines / 93.25 branches / 88.49 functions | `vitest.config.ts` | ✅ |
   | `marketing` | — | no test suite exists yet | ❌ |

   100% line+branch remains the target; exclusions are per-line and justified, never
   blanket file/directory exclusions of business logic. Raising a floor is a normal part
   of any PR that lifts coverage — do it.

   **End-to-end tests: in force for every user-facing area that has shipped.** A Playwright
   harness exists as of 2026-09-03 (`dashboard/e2e/`, ADR-0027) and blocks merge in CI. It
   runs against a real build and a real Django server on sibling subdomains, so it proves
   the ADR-0019 cross-subdomain session cookie — the thing no unit test can reach — and,
   since 2026-09-04, CSRF on real mutations across that same boundary.

   | Area | e2e | Notes |
   | --- | --- | --- |
   | `identity` — auth | ✅ 6 flows | login gate, session, sign-out, `_authed` guard, verify-email, RTL |
   | `identity` — account/email | ✅ 3 flows | add/remove an alias, wrong-password refusal, role-conditional panels |
   | `identity` — family | ✅ 3 flows | add a child, invite code, the non-parent empty state |
   | `scheduling` — availability | ✅ 6 flows | add/remove a range with a reload, end-before-start refused, and since C6: an unsaved edit surviving a refetch that brings back **different** data (identical data proves nothing — React Query structurally shares it, so the sync effect never re-runs either way), the navigation guard both ways, and copy-to-all's confirmation. The unsaved-edit flow needs a deliberate settle before asserting: `await refetch` only proves the response landed, and asserting immediately passed on a build with both guards reverted |
   | `curriculum` — subjects | ✅ 4 flows | teacher subjects, student interests, teacher gender, the parent empty state |
   | `scheduling` — matching | ✅ 3 flows | the student's searching state, a teacher accepting, and the offer gone after a reload |
   | `scheduling` — booking | ✅ 3 flows | generated sessions + quota, a refund visible after a reload, the teacher's view. The refund flow also asserts (C6) that a cancelled lesson **moves** to the past disclosure rather than ceasing to exist, and carries no controls there |
   | `signaling` (C3b) | ❌ by design | no user-facing behaviour — a relay with no client until C3d, so there is no flow to drive |
   | TURN + handshake (C3c) | ❌ by design | no user-facing behaviour, and CI has no coturn and no media. **Verified live on staging 2026-09-06 instead:** a relay-only `RTCPeerConnection` pair connected through coturn (2.3 KB each way, candidate `46.225.151.255:49195`), and the `Sec-WebSocket-Protocol` handshake accepted a valid token, refused a tampered one, a token-less offer and a no-subprotocol connection — each 4401. Both mutation-checked by breaking the secret (`401 Unauthorized`, 0 relay candidates) |
   | `scheduling` — call leave (C6) | ✅ 1 flow | the first tap on Leave does not leave and the URL does not move; cancelling keeps the room up; confirming returns to the schedule |
   | `scheduling` — video room | ✅ 3 flows | a student joins the lesson happening now (the grant *body* asserted, not just a 200), the teacher's control, a future lesson counting down |
   | `scheduling` — call client (C3d) | ✅ 2 flows | a real two-peer call with fake media: both sides assert a remote track is producing frames, and one leaving abruptly is seen by the other. **Proves host-candidate P2P only — CI has no coturn.** The relay path was verified live on staging 2026-09-07 instead: a relay-only call carried 443 KB/455 KB of real media through coturn (candidate `46.225.151.255:49553`). Fake media proves plumbing, never that audio is audible or video watchable — that stays a human check |
   | `scheduling`/`dashboard` — call diagnostics (C3e-a) | ✅ 2 flows | a contract test POSTs every failure code the client knows through the real `POST /sessions/<id>/diagnostics/` endpoint and asserts each is accepted, plus a check that an unknown code is refused with a 400 (that no row is written for it is a backend unit test — Playwright cannot see the table). Runs on Chromium. **The guard is directional**: it catches the client knowing a code the backend doesn't, not the reverse — a backend-only code is just an unused enum value, not a production failure. **What this does not and cannot prove: that Safari emits anything.** This project has no Apple device — no Mac, no iPhone, no iPad — and Playwright's WebKit on Linux is not iOS Safari and has no fake-media equivalent. The pipeline is verified; the reporter on the browser C3e exists for is not, and cannot be, here. **D9 deviation:** no manual click-through on the target browser is possible in this project; recorded in `journal/2026-W36.md` rather than skipped |
   | `scheduling`/`dashboard` — call fixes (C5) | ✅ 3 new flows, 4 updated | a phone held **upright** at 430×932 (the 360px flow is landscape-shaped and passed the whole time these were broken): no sideways scroll, every control ≥44px fully on screen, the settings sheet and every item inside it on screen, the self view clear of both header and control bar. A share that **stops** leaving the other side's layout — the one C5 defect no unit test can reach, because it is about what a real second browser does with a track that ended. A lobby that does not re-ask when the browser already holds a grant. Each was mutation-checked against a build with its fix reverted: the stale screen tile measured **921,600px²** thirty seconds after the share stopped, and the trigger-anchored panel measured 224px wide with **189px visible**. ⚠ **Measured, and load-bearing:** under `--use-fake-ui-for-media-stream` Chromium reports `prompt`, not `granted`, so the gesture gate is untouched and the lobby flow must build its own granted context to reach that branch |
| `dashboard` — browser hardening (C3e-b) | ✅ 2 flows | two ordinary browser mechanisms Chromium can honestly prove: **the gesture gate** — the Lobby shows no preview and calls no `getUserMedia` before a real tap — and **the tap-to-play control** — when the browser refuses to `play()` an unmuted remote tile, `VideoTile` shows a "Tap to turn on sound" control, and a real tap clears it. **The autoplay flow's limitation, stated rather than implied:** Chromium's `--autoplay-policy=user-gesture-required` could not be made to refuse inside the real join flow — the app's own Join tap permanently satisfies Chromium's (sticky, not transient) activation check for the rest of that page's life, confirmed by holding a session past any transient-activation window and watching `play()` still succeed regardless. The test instead overrides `play()` to reject only the FIRST call on an unmuted element and lets the retry run native `play()`; it proves the control and its click handler work, **not** that a real, unmodified browser would have refused first. **Nothing here is verified on Safari or iOS and cannot be, in this project.** This project has no Apple device — no Mac, no iPhone, no iPad — and Playwright's WebKit on Linux is not iOS Safari and has no fake-media equivalent. **D9 deviation:** no manual click-through on the target browser is possible in this project; recorded in `journal/2026-W36.md` rather than skipped |
   | app shell | ✅ 5 flows | role-aware nav both ways, `aria-current`, mobile drawer, Escape + focus restore |
   | scaffold routes | ❌ by design | placeholder pages with no behaviour beyond a heading |
   | `billing` | ❌ by design | the hosted Stripe redirect cannot run in Playwright (`ISSUES.md`); the `past_due` → `unpaid` dunning path is covered instead by a separate nightly Stripe test-clock harness (below), not Playwright |
   | anything needing an inbox | ❌ | registration, password reset, child activation — CI has no mail-catcher (`ISSUES.md`) |
   | change-password | ❌ | would rotate the shared seed password mid-suite; needs its own account |

   Adding a user-facing feature? Add its e2e spec. Say precisely what is and isn't covered
   rather than claiming coverage the harness does not have.

   ⚠ **Three places in the e2e suite hardcoded the call control bar's target count**
   (`>= 6`) and two more named a `"Layout"` button. C5 took the bar from seven targets to
   five and broke all of them. If you change what is in that bar, grep the suite for the
   count before assuming it only lives in one place. C6 left the count at five (the share
   control went from absent to present-and-disabled where the browser cannot share) and
   re-checked every one anyway.

   ⚠ **The in-call mic/camera toggles have ONE stable accessible name each** since C6
   ("Microphone", "Camera"), with state in `aria-pressed` alone — a flipping label plus
   the attribute made a screen reader say "Unmute microphone, pressed". Queries for them
   must be anchored (`/^microphone$/i`), or they also match the settings menu's headings.
   The **lobby's** own toggles keep their descriptive labels; they are different controls.

   **Nightly Stripe test-clock harness (not Playwright, not in the merge path).** The
   `past_due` → `unpaid` renewal path is exercised nightly against real Stripe test-mode
   objects (`.github/workflows/stripe-clock.yml`, spec
   `docs/superpowers/specs/2026-09-04-stripe-test-clock-harness-design.md`). It runs on a
   `schedule` plus `workflow_dispatch`, deliberately outside `deploy-staging`'s `needs:` —
   test clocks are account-scoped, forked PRs cannot read secrets, and a Stripe outage must
   not block every merge. A red run is a real failure, not noise. It does **not** prove two
   things: it forwards events at the Stripe account's default API version (`basil`), not
   production's pinned version (`dahlia`), so it does not prove production's exact payload
   shape (`ISSUES.md`); and it seeds the local `Subscription` row directly rather than
   driving kaleem's own checkout, so `_apply_checkout_completed` is not exercised by it.
   **Security and performance scanning: running as of 2026-09-04 (ADR-0030).** Two of
   the three are merge gates, one is nightly:

   | Scanner | Scope | Where | Blocks merge |
   | --- | --- | --- | --- |
   | `gitleaks` v8.30.1 | meta history + the whole checked-out tree (submodules included) | `ci.yml` `security` | ✅ |
   | `pip-audit` | `backend/requirements/production.txt` only | `ci.yml` `security` | ✅ |
   | Lighthouse | staging: marketing home + dashboard login page | `lighthouse.yml`, nightly | ❌ by design |
   | `semgrep` / `trivy` / `pnpm audit` | — | nowhere yet (`ISSUES.md`) | ❌ |

   Known historical leaks are allowlisted **by fingerprint** in `.gitleaksignore`, one
   annotated line each; never add a line to silence a new finding. Those credentials were
   **rotated 2026-09-05**, and the lines **stay** — rotation kills a credential but cannot
   remove it from history, so deleting them turns CI red (ADR-0032 amends ADR-0030).

   Lighthouse thresholds in `.lighthouserc.json` are ratchet floors in the ADR-0026
   sense — **lowering one needs an ADR.** Submodule git *histories* are not scanned by CI.

4. **D4 Module boundary enforcement** via `import-linter` in CI. Violations fail.
5. **D5 Green CI before merge.** No `--no-verify`, no exceptions.
6. **D6 One feature branch at a time.** No WIP sprawl.
7. **D7 Weekly review** every Friday: fill `docs/superpowers/journal/YYYY-WW.md`, update `STATE.md`, re-read the roadmap, write ADRs for any decisions.
8. **D8 ADRs** in `docs/adr/NNNN-*.md` for any non-trivial decision.
9. **D9 Definition of Done:** spec closed, plan done, tests passing, boundary check green, **coverage floor green (D3 table)**, **e2e green where the harness covers the area (D3 table)**, manual browser click-through, staging deploy, arch doc updated, journal entry, `STATE.md` updated. `/ship` walks this list. See ADR-0021, ADR-0026, ADR-0027.
10. **D10 No refactoring sprees.** Spotted a problem while working on something else? Add it to `ISSUES.md` in 15 seconds and keep going. Do not "clean up while you're here".
11. **D11 No heroes.** Sustainable pace. No 3-day marathons. Energy check in the weekly journal; if ≤ 2/5 for two weeks, stop and re-plan.

## Git workflow (trunk-based) — non-negotiable

**Every repo uses `feat/<name>` → PR → trunk. There is no `develop`/`dev` branch
anywhere.** See ADR-0028 (which supersedes ADR-0014's branching clause).

- Branch `feat/<name>` (or `fix/…`, `docs/…`, `chore/…`) off the trunk, work there, open
  a PR into the trunk. Green CI + review, then merge.
- **Never commit directly to the trunk.** Everything lands through a PR. No direct pushes.
  No `--no-verify` (D5).
- **Merge commits, not squashes,** for anything carrying submodule pointers — squashing is
  what used to drop pointer bumps silently.
- The trunk is `main` in the submodules and `master` in the meta repo.
- ⚠ **A merge to the meta trunk is a deploy.** `deploy-staging` runs on push to `master`,
  and there is no integration branch any more. The coverage and e2e gates are the only
  thing between a PR and staging — merge accordingly.
- **The meta repo is not a working repo.** Do not do feature/code work there. The
  only things that belong in the meta repo are (1) docs — `docs/**`, ADRs, specs,
  `STATE.md`, `ISSUES.md`, `CLAUDE.md` — (2) CI config, and (3) submodule pointer bumps.
  All still go through `feat → PR → master`.
- All real feature code lives in the submodules.

## API versioning — non-negotiable

**Every product API route lives under `/api/v1/`, and every client reaches it through a
versioned base.** See ADR-0017 (the scheme) and ADR-0029 (the rule + its enforcement).

- New module? Mount it under `config.api_router`, never straight onto `config/urls.py`.
- Exactly three product exceptions, and the list is closed: health probes, allauth
  (`/accounts/`), the Django admin. **A fourth needs an ADR.**
- Clients put the version in the configured base (`VITE_API_URL` ends `/api/v1/`) and use
  relative paths per call, so a version bump is one config change, not a sweep.
- **CI enforces this** — `backend/tests/test_api_versioning_is_enforced.py` walks the
  resolved URLconf and fails on anything unversioned outside the allowlist.

## The "don't do this" list

These are the specific patterns that produced the current messy MVP. Do not repeat any of them in the rebuild.

1. **Don't use Django multi-table inheritance for roles** (`Student(User)`, etc.). Use single User + optional profile tables.
2. **Don't leave CSRF disabled.** Session auth + real CSRF, always.
3. **Don't store role-specific data as JSON blobs** on User. Typed profile tables.
4. **Don't put business logic on models.** Services live in `services.py`. Models are dumb data structures.
5. **Don't import another module's models.** Public API (`<module>.services`) only. `import-linter` will block you.
6. **Don't register a ViewSet and forget to wire it in the router.** The old `TrialViewSet` was orphaned. Don't repeat.
7. **Don't use `OneToOneField` for things that happen over time** (subscriptions, memberships). Always many-over-time.
8. **Don't catch bare `Exception`** and stringify it as the API error. Use typed exceptions with proper error mapping.
9. **Don't leave `print()` in production code.** Use structured logging. The old code had `print(profile_data)` in a serializer — never again.
10. **Don't hardcode URLs in the frontend.** Use env vars.
11. **Don't commit `.env*` files.** Pre-commit blocks them; do not bypass.
12. **Don't add a feature without a spec.** D1. Always.
13. **Don't refactor while implementing another feature.** D10. `ISSUES.md` and keep going.
14. **Don't code past bedtime.** D11. Sleep fixes more bugs than caffeine.
15. **Don't commit directly to the trunk, and don't do feature work in the meta repo.** Trunk-based `feat → PR → trunk` in every repo, no `develop` branch; meta is docs + CI + pointer bumps only. See ADR-0028.
16. **Don't add an API route outside `/api/v1/`.** The allowlist of unversioned paths is closed and CI enforces it. See ADR-0029.

## Where things live

| Thing | Path |
| --- | --- |
| Full rebuild roadmap | `docs/superpowers/specs/2026-04-11-rebuild-roadmap-design.md` |
| Current project state | `STATE.md` |
| Spotted-a-problem backlog | `ISSUES.md` |
| Active specs | `docs/superpowers/specs/` |
| Active plans | `docs/superpowers/plans/` |
| ADRs (architecture decisions) | `docs/adr/` |
| Product/business decisions | `docs/decisions/` |
| Weekly journal | `docs/superpowers/journal/` |
| Per-module architecture docs | `docs/architecture/<module>.md` |
| Runbooks | `docs/runbook/` |
| Developer onboarding | `docs/developer-guide/` |
| Templates | `docs/templates/` |
| Old code (read-only reference) | `kaleem/` |

## Code intelligence: use CodeGraph before grepping

A local [CodeGraph](https://github.com/colbymchenry/codegraph) index of the whole tree
(backend + dashboard + marketing) is wired in as an MCP server via `.mcp.json`. It stays
current automatically (file-watch). **Prefer it over grep/read when exploring code** — it
costs far fewer tokens. Tools:

- `codegraph_explore` — survey an area / answer "how does X work" (start here)
- `codegraph_search` — find a symbol by name
- `codegraph_callers` / `codegraph_callees` — trace a function's call relationships
- `codegraph_impact` — blast radius of changing a symbol (use before refactors)
- `codegraph_node` — one symbol's details + full source
- `codegraph_files` / `codegraph_status` — file structure / index health

Setup on a new machine: install the CLI (`curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh`), then `codegraph init` at the repo root. The `.codegraph/` index is gitignored. See ADR-0012.

## Agent commands (slash commands)

- `/new-feature <name>` — start a feature spec (D1).
- `/new-adr` — record an architecture/technical decision (D8).
- `/new-decision <slug>` — record a **product/business** decision (pricing, scope, policy). Not auto-committed.
- `/handoff` — session-end ritual: update `STATE.md`, write a memory, append to the journal. Run before ending a working session.
- `/journal` — open this week's journal (D7 Friday review).
- `/ship` — walk the Definition of Done (D9).

## Standard commands (via justfile, once Phase 0 ships)

```
just setup          # clone submodules, install deps, create DBs, seed data
just dev            # bring up everything locally
just test           # run all tests (backend + frontend + boundary linter)
just lint           # ruff + mypy + biome + tsc + import-linter
just migrate
just shell          # Django shell_plus
just deploy
just seed           # reset DB and load seed_basic fixture
just new-module X   # scaffold a new backend module
```

## What to do at session start

1. Read `STATE.md` to learn the current phase and active spec.
2. Read the top of `ISSUES.md` to see what is watching.
3. If there is an active spec, read it. That is your next task.
4. If there is no active spec, ask the user what to work on — do not pick something yourself.

## What to do at session end

Run `/handoff`: update `STATE.md`, capture any non-obvious in-flight context as a memory, and append a line to the week's journal. This is what lets the next session resume without re-deriving where things stand.

## What to do when asked to add a feature

1. **Do not start coding.** Check for a spec. If none exists, write one via `/new-feature <name>` (or the spec template in `docs/templates/spec.md`). Commit it.
2. **Write the plan** via the spec's linked implementation plan in `docs/superpowers/plans/`. Commit it.
3. **Write the failing test first.** Then the code. Then the next test. Then the next code.
4. When done, run `/ship` (or walk the Definition of Done checklist manually).
5. Write a journal entry for the week (in the Friday review if it is mid-week).

## What to do when you spot a bug or mess unrelated to the current work

Add a one-line entry to `ISSUES.md`. Keep working. Do not fix it. D10.

## What to do when the user asks you to violate D1–D11

Push back. Explain which principle applies and why it exists. If the user insists after understanding the reasoning, proceed — they are in charge. Record it in the journal as an explicit deviation. Do not silently skip the rule.

## Escape hatches (pre-approved alternate paths)

If certain pain points appear, there are pre-approved fallback paths documented in the roadmap spec (Section 6). Do not invent new alternate paths silently — use the hatches as written, or write an ADR first. Named hatches: **E1** submodules → pnpm monorepo, **E2** self-hosted → managed platform, **E3** sessions → JWT (mobile only), **E4** big v1 → phased public launch, **E5** modular monolith → service split, **E6** allauth → custom auth (discouraged), **E7** Django → another framework (forbidden).

## When something is genuinely unclear

Ask the user. Don't guess at architecture, scope, or product decisions. The roadmap is opinionated precisely so these questions don't come up often — if you find one that isn't answered, it probably needs an ADR.

## Meta

- This file is committed to git and should be updated when conventions change. Treat edits to it as decisions requiring an ADR.
- `AGENTS.md` is a symlink to this file so Cursor, Aider, and Continue see the same rules.
- `.github/copilot-instructions.md` mirrors the most critical bullets for GitHub Copilot.
- If you (an agent) find yourself disagreeing with this file, say so. Then write an ADR proposing the change.
