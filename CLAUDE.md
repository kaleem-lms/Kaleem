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
- **Auth:** session cookies + real CSRF, same-origin frontend/backend. No JWT, no CSRF-exempt hacks.
- **Frontend:** React 19 + TanStack Router + TanStack Query + Tailwind + shadcn (authenticated dashboard). Astro for the marketing site (separate submodule).
- **Infra:** self-hosted VPSes, Docker Compose.
- **Repo:** meta repo with git submodules (`backend`, `dashboard`, `marketing`, `infra`). `docs/` lives in the meta repo.

## The process (D1–D11) — non-negotiable

1. **D1 Spec-before-code.** Every feature starts with a spec in `docs/superpowers/specs/YYYY-MM-DD-<name>.md`. No code without a committed spec.
2. **D2 Plan-before-code.** Anything > 1 day gets an implementation plan in `docs/superpowers/plans/` before coding.
3. **D3 Test-driven development.** Failing test first, then the code. Target ≥ 80% coverage on services/models.
4. **D4 Module boundary enforcement** via `import-linter` in CI. Violations fail.
5. **D5 Green CI before merge.** No `--no-verify`, no exceptions.
6. **D6 One feature branch at a time.** No WIP sprawl.
7. **D7 Weekly review** every Friday: fill `docs/superpowers/journal/YYYY-WW.md`, update `STATE.md`, re-read the roadmap, write ADRs for any decisions.
8. **D8 ADRs** in `docs/adr/NNNN-*.md` for any non-trivial decision.
9. **D9 Definition of Done:** spec closed, plan done, tests passing, boundary check green, coverage OK, manual test in browser, staging deploy, arch doc updated, journal entry, `STATE.md` updated. `/ship` walks this list.
10. **D10 No refactoring sprees.** Spotted a problem while working on something else? Add it to `ISSUES.md` in 15 seconds and keep going. Do not "clean up while you're here".
11. **D11 No heroes.** Sustainable pace. No 3-day marathons. Energy check in the weekly journal; if ≤ 2/5 for two weeks, stop and re-plan.

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

## Where things live

| Thing | Path |
| --- | --- |
| Full rebuild roadmap | `docs/superpowers/specs/2026-04-11-rebuild-roadmap-design.md` |
| Current project state | `STATE.md` |
| Spotted-a-problem backlog | `ISSUES.md` |
| Active specs | `docs/superpowers/specs/` |
| Active plans | `docs/superpowers/plans/` |
| ADRs | `docs/adr/` |
| Weekly journal | `docs/superpowers/journal/` |
| Per-module architecture docs | `docs/architecture/<module>.md` |
| Runbooks | `docs/runbook/` |
| Developer onboarding | `docs/developer-guide/` |
| Templates | `docs/templates/` |
| Old code (read-only reference) | `kaleem/` |

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
