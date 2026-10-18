# Product & business decisions

This is the home for **product and business** decisions made about kaleem —
pricing, scope, policy, partnerships, target users, go-to-market, and similar
calls that get made in conversation and would otherwise vanish.

It is deliberately separate from `docs/adr/`, which is for **architecture /
technical** decisions only.

## How to use it

- One file per decision: `docs/decisions/YYYY-MM-DD-<slug>.md`.
- Run `/new-decision <slug>` to create one from the template, or copy
  `docs/templates/decision.md` by hand.
- Keep it short — context, the decision, why, and who decided. A few sentences each.
- Supersede rather than rewrite: if a decision changes, add a new file and mark
  the old one superseded with a link.

## A note on committing

Decision *content* here is often governance / financial-adjacent. These files are
**written but not auto-committed** — the author decides when (and whether) to
commit each one. The log structure itself is committed; the individual decision
files are up to you.

## Index

<!-- newest first: - [YYYY-MM-DD title](file.md) — one-line hook -->
- [2026-10-17 v1 kickoff decisions](2026-10-17-v1-kickoff-decisions.md) — the owner's 45
  before-start answers for the v1 programme: 37 took the recommended default, 8 did not.
- [2026-10-17 The full v1 supersedes the product spec's out-of-scope lines](2026-10-17-v1-scope-supersedes-product-spec.md)
  — line-by-line disposition of the product spec's "Out of Scope (v1)" list; group sessions
  stay deferred.
