---
name: inf-brand-brief-rewrite
phase: "n/a — brand stream, wave 2 of the v1 programme (ADR-0045)"
modules: [design-system]
status: draft
created: 2026-10-25
closed: null
---

## Goal

`docs/brand/brief.md` is the document every brand direction is judged against. The current
version (0cfd065, landed with #232) has been marked "being rewritten" since the owner chose
`dec-brand-direction: Rewrite brief` on 2026-10-17. Four exploration rounds (15 directions)
were judged against it, and the owner rejected all of them. The brand ledger's own diagnosis
was that the brief came from the agent's inference rather than from the product. No new
direction may be explored until the brief is rewritten (`inf-brand-direction` depends on this
unit).

This unit rewrites the brief from the product as it ships. On 2026-10-25 the owner delegated
the rewrite to the conductor ("do it yourself"). The brief therefore opens with
**"Drafted by the conductor, owner to review."** It is a brief: audience, voice, values,
constraints, what the mark and the type must do in both scripts, accessibility, and how a
direction is judged. It does not pick a direction or a typeface. Those belong to
`inf-brand-direction` and `dec-brand-typeface`.

The brand spec and plan (`2026-09-14-brand-identity-*`) are **amended**, not superseded. They
only lose their "being rewritten" status lines.

## What the old brief gets wrong (and the rewrite fixes)

Each row is checked against the code at `origin/main` (dashboard `src/locales/*/common.json`,
`src/features/shell/AppTopbar.tsx`, `src/ui/auth-layout.tsx`; marketing
`src/pages/index.astro`; tokens `src/*.tokens.json`, `brand/brand.json`) and against the brand
ledger (`.superpowers/sdd/2026-09-14-brand-identity/`).

| # | Old brief | What is true | The rewrite |
| --- | --- | --- | --- |
| W1 | The audience "does **not read Arabic**". | The dashboard ships a full Arabic locale with RTL, and the Arabic copy names the product **كَلِيم**. Teachers, and many parents, read Arabic. | Two readerships. To a non-reader كليم is a shape that must be recognisable. To a reader it is a word that must read correctly. Both are first-class. |
| W2 | "Parents and students". | Parents add **children** (identity family flows), adults also enrol as students, and teacher gender is a matching criterion (curriculum). | The audience names the child learner, the adult learner, the paying parent and the teacher. It also names who must be comfortable: a conservative family choosing a teacher for a child. |
| W3 | No voice. | Product copy writes "kaleem" in lowercase, in a calm second person ("Start learning with kaleem."). | A short voice section: lowercase Latin name, plain words, no hype, and the same register in Arabic. |
| W4 | No values. | Only the "must say" adjectives (trustworthy, rooted, modern). | Values the mark carries, each with the product fact behind it. |
| W5 | "Must not say" has four negatives. | Round 4 found the category's four clichés by research: an open book with wifi arcs, a minaret with a laptop, a green-to-gold gradient, and Montserrat. | Those four are added to "must not say". Also added: **no Quranic text, divine names or depicted mushaf in the mark**, because a mark is printed, cropped, resized and discarded. |
| W6 | Nothing about type. | Fraunces / Inter / IBM Plex Sans Arabic ship as tokens. Arabic `font-display` headings fall back to the platform serif (`ISSUES.md`), because Fraunces has no Arabic. | A type section says what the mark's Arabic outlines must do and that the display role needs an Arabic companion. It leaves the choice to `dec-brand-typeface`. |
| W7 | Nothing about accessibility. | WCAG 2.2 AA plus EN 301 549 (ADR-0020, ADR-0040). The mark's colours are token aliases (`brand.json`: `{primary-text}`, `{background}`), and the pairs are declared in `contrast-pairs.json`. | An accessibility section: an accessible name in each locale, contrast as a declared pair in both themes, monochrome-safe, and colour never the only signal. |
| W8 | "How we will know" has three criteria, and "dignified" has no test. | 15 directions were rejected without a criterion to point at. | Each criterion is a question the owner answers per artboard, so a rejection names the line it failed. |

## The brief's shape

`docs/brand/brief.md` keeps the plan's five headings (Task 1), so `inf-brand-direction` and
ADR-0044 can quote them. Three sections are added:

1. Status line: `> Drafted by the conductor (2026-10-25), owner to review.` and a pointer to
   this spec.
2. `## Who this is for` (W1, W2)
3. `## Voice` (W3), new
4. `## Values` (W4), new
5. `## What the mark must say`
6. `## What it must not say` (W5)
7. `## Hard constraints`
8. `## The mark and the type in both scripts` (W1, W6), new
9. `## Accessibility` (W7), new
10. `## How we will know it worked` (W8)

**Hard constraints are kept unchanged.** The brief keeps: كليم, Arabic-first and
calligraphic; colour only from the ADR-0040 palette; reads at 16px and crops to a square; RTL
and LTR lockups; lowercase Latin "kaleem". It adds only constraints the spec and plan already
bind: letterforms come from an OFL typeface's outlines, never from a generated image; and the
source SVGs use `currentColor` only (ADR-0043). Because no hard constraint is dropped, the
brand spec's Decisions table and Global Constraints stand. The amendment to them is limited to
the status text below.

## Amendments to the brand spec and plan

- Spec Errata **E11**: "marks the brief as being rewritten" becomes "the brief was rewritten
  on 2026-10-25 (`inf-brand-brief-rewrite`), drafted by the conductor, owner to review".
- Plan Errata **E11** and Task 1's **Status** line: the same change. Task 1's embedded brief
  text stays as the record of what rounds 1–4 were judged against. It is not edited.

## Data model delta / API delta / Frontend

None. Documentation only. No submodule is touched, and nothing user-facing changes.

## Module boundaries

`design-system` docs only. `import-linter` is not engaged.

## Out of scope

- Picking a direction or a typeface (`inf-brand-direction`, `dec-brand-typeface`,
  `hg-brand-direction-pick`).
- Any palette change (ADR-0040).
- Fixing the Arabic display-font fallback. The brief states the requirement, and the fix
  belongs to the brand units.
- The stale `brand/` package at the meta root (June 2026, made for Stitch on the pre-ADR-0040
  v0.1.1 palette). The new brief says it is not an input. Deleting or rewriting it is a
  one-line `ISSUES.md` entry (D10), not this unit.
- ADR-0044 (`inf-brand-close`).

## Test plan

There is no code, so the check is a fact check, as in `inf-brand-docs-land`. A script outside
the repo, `_ops/checks/inf-brand-brief-rewrite-facts.py` (not committed), reads the landed
files. It fails on `origin/master` and must pass after the rewrite. It asserts that:

- the brief opens with the "Drafted by the conductor … owner to review" status line, and no
  longer says "being rewritten";
- it has all ten sections above, in order, and each is non-empty;
- every hard constraint is still present: كليم, "Arabic-first", "calligraphic", "ADR-0040",
  "16px", "square", "RTL", "LTR", lowercase "kaleem";
- W1: it names both readerships and does not say the audience does not read Arabic;
- W2: it names children, adult learners, parents and teachers;
- W5: it names the four category clichés and the no-Quranic-text rule;
- W6: it names the display-role Arabic gap and `dec-brand-typeface`, and names no chosen face
  as decided;
- W7: it names WCAG 2.2 AA, EN 301 549, an accessible name, `contrast-pairs.json`, and both
  themes;
- W8: "How we will know it worked" is a list of questions;
- the spec and plan E11 lines and the plan's Task 1 status no longer say "being rewritten".

Run on `origin/master` first: every assertion except the hard-constraint one must fail (that
is the mutation check). CI's `security` job and a local `gitleaks-range.sh` over the branch
must be clean. D3 requires no e2e flow, because nothing user-facing changes.

## Open questions

None that block the unit. The owner delegated the rewrite (2026-10-25), and
`dec-brand-direction` is resolved. The brief lists two points for the owner's review without
deciding them: the reading of the name the mark should carry (كليم bare, or vocalised كَلِيم as
the Arabic UI writes it), and the name's meaning as a resource for the direction. Neither
blocks the rewrite.
