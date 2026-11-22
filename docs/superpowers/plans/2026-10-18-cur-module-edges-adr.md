---
spec: docs/superpowers/specs/2026-10-18-cur-module-edges-adr-design.md
status: draft
---

Worktrees: meta `kaleem-worktrees/meta-cur-module-edges-adr`, and backend
`kaleem-worktrees/backend-cur-module-edges-adr`, created per runbook section 1. Branch
`feat/cur-module-edges-adr` in both. Gates run only through `_tools/backend-gate.sh`. No
migration, no dependency change, no floor edit.

## Steps

1. [ ] **Port tests first.** Create `backend/kaleem/platform/tests/test_teaching.py`. Each
   test saves and restores the module's provider with `monkeypatch`, so the real
   registration survives.
   - `test_teaches_without_a_provider_raises_improperly_configured`
   - `test_student_ids_taught_by_without_a_provider_raises_improperly_configured`
   - `test_registering_the_same_pair_twice_is_a_no_op`
   - `test_registering_a_different_pair_raises`
   - `test_teaches_delegates_to_the_provider` (stub returns True for one pair only)
   - `test_student_ids_taught_by_returns_the_providers_ids_as_a_frozenset` (a stub that
     returns a list comes back as a `frozenset`)

   Run `backend-gate.sh <wt> kaleem/platform/tests/test_teaching.py`. It must fail on import.
2. [ ] **Port.** Write `backend/kaleem/platform/teaching.py`: a frozen `_Provider` dataclass,
   a module-level `_provider`, and the three functions from the spec. The module docstring
   gives the contract in five lines, as `personal_data.py` does. It imports no business
   module. Step 1 goes green.
3. [ ] **Scheduling read tests first.** Add them to
   `backend/kaleem/scheduling/tests/test_read_api.py`, under the existing
   `active_assignments and is_active_teacher_of` block, reusing its `teacher`, `student`,
   `assignment`, `other_teacher` and `other_student` fixtures and `_assign`:
   - `test_active_student_ids_of_lists_each_actively_taught_student_once`: two subjects,
     one id
   - `test_active_student_ids_of_drops_an_ended_assignment`
   - `test_active_student_ids_of_is_empty_for_a_non_teacher`: the student's id, and a
     stranger's
   - `test_the_teaching_port_answers_from_scheduling`: through `kaleem.platform.teaching`
     with no stubs. `teaches` is True for the pair, then False after the assignment is
     updated to ENDED. `student_ids_taught_by(teacher.id) == frozenset({student.id})`
     before it ends.

   Red.
4. [ ] **Scheduling provider.** Add `active_student_ids_of` to
   `backend/kaleem/scheduling/services.py` (one `values_list(...).distinct()` on ACTIVE
   rows) and list it under "Id-scoped reads" in the docstring. Add `ready()` to
   `backend/kaleem/scheduling/apps.py`, which imports `kaleem.platform.teaching` and the
   services module and registers `is_active_teacher_of` and `active_student_ids_of`. Step 3
   goes green.
   **Mutation checks:** (a) delete the `register_provider` call, and the wiring test must go
   red with `ImproperlyConfigured`. (b) Drop the ACTIVE filter, and the ended-assignment test
   must go red. Restore both and see green. Record both failure lines.
5. [ ] **Contracts.** Edit `backend/pyproject.toml` as in the spec's Module boundaries
   table. Each changed contract gets a comment that cites the ADR. The scheduling ignore's
   comment says why the edge exists and that the warning disappears when cur-lesson-resources
   lands.
   `lint-imports` (via the full gate) gives 24 kept, 0 broken, 1 warning.
6. [ ] **Contract mutation checks.** Run the seven probes in the spec's Test plan table, one
   at a time, in the backend worktree. Use one-line imports appended to the named file, and
   `kaleem/content/models.py` as a stub where a probe needs it. Each probe runs
   `backend-gate.sh` (lint step) and is then reverted with `git checkout -- <file>` or
   `rm` for the stub. Record each `BROKEN` line. Before committing, `git status` must be
   clean of probes.
   These were all run once on a scratch copy of `origin/main` while writing the spec, and
   each matched its expected row. This step re-proves them on the branch.
7. [ ] **ADR and docs (meta worktree).** Write
   `docs/adr/<NNNN>-teaching-link-port-and-content-curriculum-edges.md` from
   `docs/templates/adr.md`, status `proposed`, with the number the conductor allocates.
   Sections:
   - Context: the three units and the probe table.
   - Decision: the spec's five points.
   - Alternatives: five, from the spec.
   - Consequences:
     - Good: no cycle; the roadmap arrow is honoured; one check for two modules.
     - Owed: import-linter cannot see the runtime dependency (the wiring test is the
       guard); the warn-mode ignore until cur-lesson-resources; content.md will cite this
       ADR.

   Then update the Boundaries section of `docs/architecture/curriculum.md`, add the port to
   `docs/architecture/platform.md`'s table and registry-pattern section, and add the
   provider and the new read to `docs/architecture/scheduling.md`.
8. [ ] **Full gate and hand-back.** Run `backend-gate.sh <wt>` (full). Then:
   - Commit the backend with explicit paths, as `feat(platform): teaching-link port provided
     by scheduling` and `build(imports): content/curriculum edges per ADR-<NNNN>`.
   - Commit meta as `docs: ADR-<NNNN> content/curriculum edges and the teaching-link port`.
   - Run the five hand-back checks from runbook section 3, gitleaks range included.
   - Hand back the block with the mutation lines.

## Risks

- **Shared files.** `pyproject.toml` is shared with every unit that opens an edge.
  `scheduling/services.py` and `apps.py` may be touched by sched-stream units and by the
  data-subject-request units (`ready()`). Fallback: the conductor's freshness merge. These
  are additive hunks.
- **A dead-looking ignore.** Until cur-lesson-resources lands, the scheduling ignore matches
  nothing and prints a warning (rc 0, measured). If someone flips it to `error`, CI goes
  red. The comment says why. If import-linter's option ever disappears, the fallback is to
  delete the ignore here and have cur-lesson-resources add it with the edge. The ADR states
  the exact line either way.
- **The invisible runtime edge.** Someone could later "simplify" a consumer into a direct
  `scheduling` import. The content and curriculum sibling contracts stay forbidding, so CI
  stops it. That is probes 5 and 6.
- **Scope.** If a consumer turns out to need names or subjects from the port, that is an
  additive port change in that consumer's unit under this ADR. It is not done here.

## Verification

- Steps 1 and 3 seen red, then green. Step 4's two mutation checks and step 6's seven
  probes are recorded with their output lines.
- Full backend gate rc 0: pytest with the coverage floor, ruff, `lint-imports` 24 kept, 0
  broken.
- e2e: none. There is no user-facing behaviour (the spec's Test plan). CI's existing suite
  must stay green.
- D9 manual click-through: not applicable, because nothing is rendered. The staging deploy
  proves that `ready()` registers under the production settings, since a missing provider
  would raise on the first consuming call. There is no caller until the consumers land, so
  the wiring test is the proof here.
