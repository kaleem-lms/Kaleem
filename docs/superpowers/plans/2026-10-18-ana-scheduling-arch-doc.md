---
spec: docs/superpowers/specs/2026-10-18-ana-scheduling-arch-doc-design.md
status: draft
---

Meta-only and docs-only. Work in `/home/abdulkhalek/Projects/kaleem-worktrees/meta-ana-scheduling-arch-doc`
on `feat/ana-scheduling-arch-doc`. No submodule worktree, no migration, no dependency, and no
coverage floor is involved.

**Source of truth:** backend `18888b2` and dashboard `e61e23e`, the `origin/main` heads on
2026-10-18. Read them as git objects, for example
`git -C /home/abdulkhalek/Projects/kaleem/backend show 18888b2:kaleem/scheduling/models.py`, or
through codegraph. Never edit, check out or switch branches in the owner's checkouts. If
`origin/main` has moved by build time, keep the two SHAs, write the doc against them, and let the
"Describes" line in the header say so. Later units update the doc.

## Steps

1. [ ] **Write the failing fact check (TDD, red first).** Create
   `/home/abdulkhalek/Projects/kaleem-worktrees/_ops/checks/ana-scheduling-arch-doc-facts.py`.
   It is not committed and not wired into CI (spec, Out of scope). It runs under
   `python3 -I`, takes the doc path as an argument, and reads the code at the two SHAs with
   `git show`. It fails, listing each missing name, unless the doc contains all of these:
   - every `class X(models.Model)` in `kaleem/scheduling/models.py` (8);
   - every top-level `def` without a leading underscore in `kaleem/scheduling/services.py`;
   - every `path("...")` string in `kaleem/scheduling/api/urls.py` (15);
   - every `CELERY_BEAT_SCHEDULE` key starting `scheduling-` in `config/settings/base.py` (2);
   - every `[[tool.importlinter.contracts]]` name in `pyproject.toml` whose contract
     has `source_modules = ["kaleem.scheduling"]` (4), plus
     `signaling imports neither kaleem nor django`;
   - every `CallDiagnostic.Code` value (10, `gum-denied` through `line-mismatch`);
   - `4400`, `4401`, `4409` and `4410`, and every entry of signaling's `RELAYABLE`;
   - the headings `Owns`, `Public API`, `Depends on` and `Does not do`;
   - the strings `18888b2` and `e61e23e`.

   Run it against the missing file: **red**, exit 1. Paste the first lines of output into the
   hand-back.

2. [ ] **Skeleton and the four fixed fields.** Create `docs/architecture/scheduling.md` in the
   house style of `identity.md` and `curriculum.md`. Give it the `# scheduling — architecture`
   title, a one-paragraph purpose, and a line that lists the specs (C0-C6 and
   `ana-scheduling-read-api`) and the ADRs (0033, 0034, 0035, 0036, 0037, 0039, 0046). Add the
   "Describes backend 18888b2 · dashboard e61e23e" line. Then write the four fixed fields exactly
   as the spec's Module boundaries section states them. Each field gets a pointer to the code
   that proves it: the `services.py` docstring, the contract names, the model list. Run the
   check; only the later sections' names should still be missing.

3. [ ] **Data model.** A `mermaid` `erDiagram` that copies `identity.md`'s syntax. It shows
   `User` and `Subject` as external, plus the eight tables and their FKs. Under it, one line per
   table with the invariant the database holds and the reason in the code comment beside it.
   Name each constraint: `unique_open_match_request`, `unique_active_assignment`,
   `unique_match_decline`, `unique_active_slot_per_assignment`, `unique_active_teacher_slot`,
   `unique_session_instant`, `room_one_active_per_session`,
   `availability_end_after_start` and `availability_weekday_in_range`. Cover CASCADE against
   RESTRICT, and UTC (slot) against local (availability).

4. [ ] **Behaviour sections.** Matching, Booking and quota, Rooms, Diagnostics, then Signaling
   and TURN, in that order. Each section is a few short paragraphs, and states only what the
   code at 18888b2 does. Read each function before describing it. The module docstrings of
   `matching.py`, `booking.py`, `rooms.py` and `diagnostics.py`, `_consumed`,
   `_passes_hard_filters`, `accept_offer`, `_apply_cancellation`, `join_window`,
   `is_participant`, `end_rooms_for_session`, `signaling/app.py`, `signaling/tokens.py` and
   `providers/turn.py` are the sources. Constants go in with their names and values:
   `CANCELLATION_NOTICE`, `JOIN_OPENS_BEFORE`, `JOIN_CLOSES_AFTER`, `RETENTION` and
   `SESSION_DURATION_MINUTES`. Operations stay out: link `docs/runbook/signaling.md`,
   `turn.md` and `video-call.md`. Apply the disclosure rule as you write. Describe the control,
   and name no secret value, host, address or unfixed weakness.

5. [ ] **Surface, jobs, data, clients, non-goals.** These are the HTTP table (15 routes, method
   and who may call each, read from `api/views.py`), the beat entries with their crontab times,
   the two management commands, the "Personal data held" section from the spec, the four
   dashboard routes and feature folders at e61e23e, and "Deliberately not here". Run the check:
   **green**, exit 0.

6. [ ] **Mutation-check the fact check.** Delete one name from the doc, for example
   `line-mismatch`, and the check goes red naming it. Restore it and the check is green. Repeat
   with one route and one model name. Record all three in the hand-back. A check that stays
   green with a name removed is broken. Fix the check, not the doc.

7. [ ] **overview.md (shared file).** Add `scheduling --> curriculum` under the scheduling
   edges. Change the scheduling node label to
   `scheduling<br/>availability, matching, sessions, video`. Touch no other line. Run
   `git diff --stat` and confirm it shows two changed lines in that file.

8. [ ] **ISSUES.md.** Strike the entry "There is no `docs/architecture/scheduling.md`…" in the
   file's convention: `~~**…**~~ **FIXED 2026-10-18** (meta, feat/ana-scheduling-arch-doc).`
   Add one sentence pointing to the doc. Change no other entry.

9. [ ] **Commit and hand back.** Commit with explicit paths only:
   `git add docs/architecture/scheduling.md docs/architecture/overview.md ISSUES.md`, then
   `PIP_CONFIG_FILE=/dev/null git commit -m "docs(scheduling): architecture doc with the four fixed fields"`.
   Then run runbook section 3's ready checks with `origin/master` in place of `origin/main`:
   the tree is clean, `origin/master` is an ancestor (otherwise merge it, never rebase), and
   `/home/abdulkhalek/Projects/kaleem-worktrees/_tools/gitleaks-range.sh <meta worktree> origin/master..HEAD`
   ends `CLEAN: N of N`. The hand-back block carries the head SHA, the gitleaks line, and the
   red, green and three mutation outputs from steps 1, 5 and 6.

## Gates

- **Local:** the fact check (steps 1, 5 and 6) and `gitleaks-range.sh`. Do not run the backend
  or dashboard gates: no code changes, and ADR-0038's change detection skips those jobs on a
  docs-only meta PR.
- **CI:** gitleaks runs on docs too (ADR-0042) and must be green. The conductor reads it.

## e2e

**None, by design.** The unit changes no behaviour, so D3 asks for no flow and no time budget.
The D3 table needs no new row.

## Migrations

None.

## Risks

- **The doc drifts from the code.** Wave-1 units `ana-session-outcomes` and
  `lb-parent-acts-for-child` will change booking soon after this lands. Mitigations: the pinned
  SHAs in the header, the spec's rule that each scheduling unit updates its own section, and the
  fact check, kept under `_ops/checks` for reuse. A doc that is right as of a stated SHA is the
  goal, not one that stays right forever.
- **Overstating.** It is easy to describe the intended design instead of the code: the stale
  roadmap entry says Zoom and trials. Every sentence is sourced from 18888b2 / e61e23e in step 4,
  and the reviewer spot-checks five claims against the code.
- **Disclosure.** The public repo rule. Signaling and TURN are written as controls. If the build
  finds a real weakness while reading, it goes to
  `/home/abdulkhalek/Projects/kaleem-worktrees/_ops/private/ana-scheduling-arch-doc.md` (mode
  600) and the private channel, never into the doc or ISSUES.md.
- **Shared-file conflicts.** `overview.md` (this unit's declared shared file) and `ISSUES.md`
  are edited by other units. Both edits are two to three lines, and on conflict the conductor
  takes master's file and re-applies them.
- **Mermaid fails to render on GitHub.** Copying syntax already rendering in `identity.md`
  limits this. No local renderer is installed, and none is added for this.
- **Scope.** Finding a defect is not fixing it. A one-line ISSUES.md entry for each, and keep
  going (D10).

## Verification

- Step 1 is red on the missing doc, step 5 is green, and step 6's three mutations each go red
  and then green again.
- The reviewer reads the doc against the spec's four fixed fields and the code at 18888b2, and
  checks the diff touches only the three files in step 9.
- D9 for a docs unit: spec closed and plan done, CI green (gitleaks), and staging unaffected
  (docs only). The conductor adds the journal line in `docs/superpowers/journal/2026-W42.md` and
  `STATE.md` at close-out. There is no click-through, because nothing renders.
