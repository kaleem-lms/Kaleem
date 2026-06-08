Session-end handoff ritual. Capture state so the next session resumes without re-deriving where things stand. Pairs with the session-start read defined in CLAUDE.md.

Steps:
1. Update STATE.md: current phase, what's in progress, and the concrete next step. Update the frontmatter (active_spec, active_branch, last_green_ci) if it changed.
2. Write or update a `project`-type memory in the auto-memory directory capturing any non-obvious in-flight context (decisions made, dead ends hit, what to do next) that isn't already in STATE.md, a spec, or the code. Add/refresh its one-line pointer in MEMORY.md. Skip if nothing non-obvious changed.
3. Append a one-line progress note to this week's journal entry (docs/superpowers/journal/YYYY-WW.md); create it from the template if missing.
4. Summarize to the user what you recorded and what the next session should pick up. Do not auto-commit unless the user asks — STATE.md/journal are fine to commit, but let the user decide.