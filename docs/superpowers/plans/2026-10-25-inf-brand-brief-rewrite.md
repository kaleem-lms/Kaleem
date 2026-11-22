---
spec: docs/superpowers/specs/2026-10-25-inf-brand-brief-rewrite-design.md
status: draft
---

This unit touches only the meta repo, and only docs. Work in
`/home/abdulkhalek/Projects/kaleem-worktrees/meta-inf-brand-brief-rewrite` on
`feat/inf-brand-brief-rewrite`. It involves no submodule worktree, migration, dependency or
coverage floor, and needs no e2e flow (spec, Test plan). Read code facts as git objects at
`origin/main` of each submodule, never from the owner's checkouts.

Files touched:
- `docs/brand/brief.md` (rewritten)
- `docs/superpowers/specs/2026-09-14-brand-identity-design.md` (E11 line only)
- `docs/superpowers/plans/2026-09-14-brand-identity.md` (E11 line and Task 1 Status only)
- `ISSUES.md` (one line: the stale root `brand/` package)

## Steps

1. [ ] **Red: write the fact check.** Create
   `/home/abdulkhalek/Projects/kaleem-worktrees/_ops/checks/inf-brand-brief-rewrite-facts.py`.
   It is not committed. Run it with `python3 -I <script> <WT>`. It prints one line per failing
   assertion and exits 1 if any fail. It makes every assertion in the spec's Test plan. Match
   section headings exactly, and match the Arabic as the exact code points of كليم (U+0643
   U+0644 U+064A U+0645).
   Run it on the untouched branch (= `origin/master`). Every assertion except "hard
   constraints present" must fail. Paste that output into the hand-back. This is the mutation
   check.

2. [ ] **Re-verify the facts the brief cites.** Before writing, read each fact again at
   `origin/main`: `ar/common.json` (`newToKaleem`, `registerSubtitle`); `AppTopbar.tsx:43` and
   `auth-layout.tsx:10` (lowercase wordmark); tokens `src/scale.tokens.json` (the three font
   families); `brand/brand.json` (the `{primary-text}` and `{background}` aliases); and the
   `ISSUES.md` Arabic `font-display` entry. Read the four category clichés from the ledger's
   `canvas/Category.dc.html`. A fact that has moved is corrected in the brief, not copied from
   the spec.

3. [ ] **Green: write `docs/brand/brief.md`.** Replace the file with the ten sections in the
   spec's order. Keep it to about one screen per section at most, because it is a brief.
   - Status line first: drafted by the conductor (2026-10-25), owner to review. Link the spec.
     State that the root `brand/` package is not an input.
   - Keep the five hard constraints word for word. Add the two the spec and plan already bind
     (OFL outlines, never generated letterforms; `currentColor` source).
   - "The mark and the type in both scripts": what the Arabic mark must do for a reader and
     for a non-reader; how the Latin wordmark pairs with it in each lockup; that the mark's
     outlines come from an OFL face chosen under `dec-brand-typeface`; that the display role
     needs an Arabic companion to Fraunces. Name candidates only as candidates.
   - "Accessibility": an accessible name per locale (`kaleem` / كليم); each mark-on-surface
     pair is declared in `contrast-pairs.json` and passes in both themes; the mark survives
     monochrome; it does not rely on colour alone; it holds at 16px and 32px.
   - "How we will know it worked": questions the owner answers per artboard, each tied to a
     section above.
   - End with "For the owner's review": the reading of the name (كليم or كَلِيم), and the name's
     meaning as a direction resource. Both are listed and neither is decided.
   Re-run the fact check. Only the spec/plan E11 assertion may still fail.

4. [ ] **Amend the brand spec and plan (E11).** In the spec's Errata, change the E11 sentence
   to say that the brief was rewritten on 2026-10-25 by `inf-brand-brief-rewrite`, drafted by
   the conductor, owner to review. Make the same change to the plan's E11 bullet and to Task
   1's **Status** line. Do not touch Task 1's embedded brief text, which is the record of what
   rounds 1–4 were judged against. Re-run the fact check. It must exit 0.

5. [ ] **D10 line.** Add one entry to `ISSUES.md`: the root `brand/` package (9448fe3, Stitch,
   v0.1.1 palette) predates ADR-0040 and contradicts the shipped palette. It needs to be
   deleted or marked historical by the brand stream.

6. [ ] **Commit and scan.** Run
   `git add docs/brand/brief.md docs/superpowers/specs/2026-09-14-brand-identity-design.md docs/superpowers/plans/2026-09-14-brand-identity.md ISSUES.md`,
   then `PIP_CONFIG_FILE=/dev/null git commit -m "docs: rewrite the brand brief from the product"`.
   Then run `/home/abdulkhalek/Projects/kaleem-worktrees/_tools/gitleaks-range.sh <WT> origin/master..HEAD`,
   which must exit 0.

## Risks

- **The rewrite becomes a direction pick.** It names a typeface, a colour pairing or a
  composition. Mitigation: step 1's W6 assertion fails if a face is stated as chosen. A
  reviewer reads the brief for anything an artboard could simply copy.
- **A hard constraint is quietly softened.** The spec and plan would then contradict the
  brief. Mitigation: the constraints are kept word for word and the fact check asserts each.
  If the owner's review drops one, the spec and plan are amended in the same PR, as the unit
  summary requires.
- **The owner reads the delegated draft as a decision.** Mitigation: the status line, and the
  "For the owner's review" list. `hg-brand-direction-pick` remains the owner's gate before any
  mark is made.
- **A conflict on `ISSUES.md` with other units.** It is one appended line. The conductor
  resolves it at merge.

## Verification

- The fact check is red on `origin/master` (step 1) and exits 0 after step 4.
- `gitleaks-range.sh` is clean. CI `security` is green on the PR.
- Review against the spec's W1–W8 table and the public-repo disclosure rule. Nothing in the
  brief is security-sensitive.
- No e2e, coverage floor or staging check applies: the change is documentation only.
