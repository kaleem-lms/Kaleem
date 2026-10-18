---
spec: docs/superpowers/specs/2026-10-18-inf-brand-docs-land-design.md
status: draft
---

This unit touches only the meta repo, and only docs. Work in
`/home/abdulkhalek/Projects/kaleem-worktrees/meta-inf-brand-docs-land` on
`feat/inf-brand-docs-land`. It involves no submodule worktree, migration, dependency or
coverage floor, and needs no e2e flow (spec, Test plan). Read the code facts behind E1–E13
as git objects at the SHAs the spec names. Never read them from the owner's checkouts.

## Steps

1. [ ] **Bring #232 into the branch.** Run
   `git -C <WT> merge --no-ff origin/docs/brand-identity -m "Merge PR #232 branch docs/brand-identity"`.
   A trial merge on 2026-10-18 was clean: #232 adds four new files, and no ADR-0043 or
   0044 exists on `master`. The result must be a merge commit, because #232 lands with its
   history intact, not squashed.

2. [ ] **Red: write the fact check.** Create
   `/home/abdulkhalek/Projects/kaleem-worktrees/_ops/checks/inf-brand-docs-land-facts.py`.
   It is not committed. Run it with `python3 -I <script> <WT>`. It prints one line per
   failing erratum and exits 1 if any fail. For each erratum it checks:
   - E1: `{color.primary.text}` and `{color.background}` are gone from the plan, and
     `{primary-text}` is present.
   - E2: ADR-0043 no longer contains `color.brand.primary`.
   - E3: the plan names `pnpm-lock.yaml`, a frozen install in the tokens CI, and the
     rewritten "No dependencies" comment. ADR-0043's costs mention the CI install.
   - E4: the plan's `outline.py` imports `uharfbuzz`, and the "isolated glyph forms" note is
     gone.
   - E5: `svgIssues` in the plan reports `<text`, and a test feeds it one.
   - E6: no `webmanifest()` and no `site.webmanifest` in any `cp` line of the plan. Spec
     line 198 no longer says "referenced by `site.webmanifest`". The spec's deliverables no
     longer list `site.webmanifest`.
   - E7: the plan has "Task 8a" and "Task 8b" headings, `test/fixtures/brand/`, and no
     "Commit the red gate".
   - E8: Task 10 names `auth-layout.tsx`, `auth-layout.test.tsx` and `TEXT_ON_SURFACE_ALLOW`.
   - E9: Task 11 has no `<h1 role="img"`, has no `content="/og.png"`, and names
     `tests/home.test.ts`. The plan no longer says marketing has "no test suite".
   - E10: the plan no longer says "SES email template", and Task 12 names
     `ntf-email-foundation`.
   - E11: the brief has a status line naming `inf-brand-brief-rewrite`.
   - Both amended documents have an `## Errata (2026-10-18)` section.

   Run it after Step 1. All eleven must fail. Paste the output into the hand-back. This is
   the mutation check: the script has been seen failing on the uncorrected text.

3. [ ] **ADR-0043 (E2, E3).** At line 44, change the alias example to `{primary-text}` and
   add "theme aliases are flat: no `color.` prefix". Under Bad / costs, add that the tokens
   CI gains its first install step and a committed lockfile. Leave its status `accepted` and
   its number. ADRs 0043 and 0044 are reserved for the brand stream (programme
   serialization rule).

4. [ ] **Brief (E11).** Under the title, add one status line saying that the brief is being
   rewritten by owner decision (2026-10-17), that `inf-brand-brief-rewrite` replaces it, and
   that no direction may be judged against this version. Leave the body unchanged.

5. [ ] **Spec (E6, E9c).** Change line 125 to "Favicon set + app icons (the web manifest
   belongs to each consumer)". Change line 198 to `| icon set | every declared icon is
   emitted at its declared size; the manifest that references them is the consumer's |`.
   Correct the Out of scope bullet (lines 182–183): marketing has had a vitest suite and an
   e2e harness since `rch-mkt-test-harness`. Add `## Errata (2026-10-18)` after the
   front matter, with one line per erratum.

6. [ ] **Plan, tokens tasks (E1, E3–E7).**
   - Task 4: change the aliases to `{primary-text}` and `{background}`. The manifest is
     read from a path argument that defaults to `brand/brand.json`. The shipped manifest
     has empty `source` and `emitted` lists. The presence tests run on
     `test/fixtures/brand/`. Step 7 commits a green gate.
   - Task 5: rewrite `outline.py` to shape with `uharfbuzz` (direction `rtl`, script
     `Arab`), then draw the shaped glyph IDs with fontTools' `SVGPathPen` at the returned
     advances and offsets, flipping y. The venv installs `fonttools uharfbuzz`. Replace the
     "isolated forms" note.
   - Task 6: `svgIssues` also reports `contains live text (<text>)`, and add a test that it
     catches one. Step 4 expects six tests.
   - Task 7: the Latin "kaleem" in each lockup is outlined, extracted the same way from the
     Inter or Fraunces files the consumers already ship.
   - Task 8: split it into **8a** (pipeline: `markColor` with flat keys, `pngSize`, `emit`,
     `--check`, the size and drift gates on fixtures, the resvg devDependency, the lockfile
     and the tokens CI install step, with that comment rewritten) and **8b** (mark: the real
     `emitted` entries without `webmanifest`, `node brand.mjs`, and the committed `dist/`).
     Delete `webmanifest()` and its `json` branch. The drift mutation check targets
     `brand/dist/favicon.svg`.
   - Task 9: the reversed pair is `"foreground": "background"` on `"surfaces": ["primary"]`.
   - Add a line to each of Tasks 4–9 naming the unit that owns it: `inf-brand-tokens-pipeline`
     for 4, 6 and 8a; `inf-brand-mark-assets` for 5, 7, 8b and 9.

7. [ ] **Plan, consumer tasks (E8–E10).**
   - Task 10: `Wordmark` replaces `AppTopbar.tsx:43` and `src/ui/auth-layout.tsx:10`. Both
     tests change to `getByRole("img", { name: /kaleem/i })`. Both `TEXT_ON_SURFACE_ALLOW`
     entries are deleted, and the G2 gate is shown red once by restoring a `text-accent`.
     Step 3 copies `favicon.svg`, `favicon-32.png`, `icon-192.png`, `icon-512.png` and
     `apple-touch-icon.png` only. Step 6 adds the SVG icon link next to the head that
     `rch-pwa-manifest-head` built, and does not touch the manifest link.
   - Task 11: `<h1><span role="img" aria-label="kaleem" set:html={markSvg} /></h1>`. Build
     `og:image` as an absolute URL from the site origin (`Astro.site`;
     `inf-brand-marketing` sets `site`). Copy the image files and `email-header*.png`, but
     not the manifest. Step 4 runs `pnpm test`, `pnpm check`, `pnpm build` and the e2e,
     after changing `tests/home.test.ts` to assert the h1 holds the named mark.
   - Task 12: replace it with the swap into `ntf-email-foundation`'s header slot, with the
     URL taken from an env var (`hg-vps-env` applies). Fix File Structure line 56 to match.
   - Self-Review: remove `webmanifest()` from the type-consistency line, and change the
     "Known gap" line about marketing.
   - Add `## Errata (2026-10-18)` after the plan's header block, with one line per erratum.

8. [ ] **Green.** Re-run the fact check. It must exit 0. Then commit with explicit paths:
   `git add docs/adr/0043-tokens-carries-brand-assets.md docs/brand/brief.md docs/superpowers/specs/2026-09-14-brand-identity-design.md docs/superpowers/plans/2026-09-14-brand-identity.md`
   and
   `PIP_CONFIG_FILE=/dev/null git commit -m "docs: errata for the brand identity docs (#232)"`.

9. [ ] **Hand-back checks** (runbook section 3, with `master` in place of `main`):
   `merge-base --is-ancestor origin/master HEAD`, a clean tree, and
   `"${R}/_tools/gitleaks-range.sh" "${WT}" origin/master..HEAD` ending in `CLEAN`. If
   `origin/master` has moved, merge it in (never rebase) and re-run the fact check.

**Landing (conductor).** The branch contains `ecc3936`, so `docs/brand-identity` can be
fast-forwarded to it: `git push origin feat/inf-brand-docs-land:docs/brand-identity`.
Then merge #232 with a merge commit. That lands this unit's spec and plan with it. Another
way is a new PR from `feat/inf-brand-docs-land`, closing #232 as landed by it. Either way
the change is docs only, so triage skips the gate jobs and runs `security`.

## Risks

- **Another unit reads #232 before this lands.** `rch-pwa-manifest-head`'s spec already
  cites "Task 8 as corrected by the errata". Until this merges, the plan on `origin` still
  says Task 8 emits the manifest. Land this unit early in wave 1.
- **The errata becomes a redesign.** E7 changes how the manifest path is passed. It stays
  at the level of what to do, not finished code. If a correction needs a decision the plan
  cannot make, it goes to `ISSUES.md` or is escalated, not decided here.
- **`uharfbuzz`'s API is described from memory.** The pipeline unit verifies it when it
  runs Task 5. The errata names the approach and the library. It does not pin call
  signatures.
- **Line numbers drift** after Step 1's merge. Find each target by its text, not by line
  number.

## Verification

The fact check goes red after Step 1 and green after Step 8. `gitleaks-range.sh` is clean.
The `security` job in CI passes on the PR. Before the commit, read the four diffs once
against spec E1–E13.
