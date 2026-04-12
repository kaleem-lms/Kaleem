# Contributing to kaleem

## Process

Every feature follows this lifecycle (no exceptions):

1. **Spec** — write a spec in `docs/superpowers/specs/` from the template
2. **Plan** — write an implementation plan in `docs/superpowers/plans/`
3. **Tests** — write failing tests first
4. **Code** — make tests pass
5. **Review** — self-review against the spec + boundary check
6. **Ship** — merge to main, deploy to staging
7. **Journal** — one-paragraph entry for the week

## Rules

- One feature branch at a time (D6)
- CI must be green before merge (D5)
- No `--no-verify`, no `--force` (D5)
- Module boundaries enforced by import-linter — no cross-module model imports
- See CLAUDE.md for the full operating manual
