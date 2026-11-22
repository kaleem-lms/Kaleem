---
spec: docs/superpowers/specs/2026-10-18-inf-fraunces-display-font-design.md
status: draft
---

A tokens release, so the order follows the runbook's section 5 exception (G3 needs the
gitlink to equal the tag commit). It runs as tokens first, then a tag, then both
consumers, then one meta PR that moves all three pointers. Consumer merges freeze while
it lands (`serialization_points`, "@kaleem/tokens releases"). It is the only
dependency-changing unit in dashboard and marketing while it holds the slot.

Bases at writing: tokens `03d139e` (v0.2.2), dashboard `9d21e01`, marketing `2efb535`,
meta `789400c`.

## Steps

### 1. tokens: the failing tests (worktree `tokens-inf-fraunces-display-font`)

1. [ ] Add to `test/build.test.mjs`:
   - `font.display` resolves to `"Fraunces Variable", "Fraunces", Georgia, serif`.
   - `scale.font` has no `quran` key, and neither `tokens.css` nor `theme.css` contains
     `--font-quran`.
   - The `--font-*` names emitted in `tokens.css` and in `theme.css` each equal
     `Object.keys(scale.font)`.
2. [ ] Run `node --test test/*.test.mjs`. The first two must fail. The third passes today,
   and it is there to guard the refactor in step 3.

### 2. tokens: the fix

3. [ ] `src/scale.tokens.json`:
   - Set `font.display` to `"\"Fraunces Variable\", \"Fraunces\", Georgia, serif"`.
   - Delete `font.quran`.
4. [ ] `build.mjs`: replace both `["sans", "display", "arabic", "quran"]` literals with
   `Object.keys(scale.font)`. Then run `node build.mjs` to regenerate `tokens.css` and
   `theme.css`.
5. [ ] Bump `package.json` to `0.2.3`.
6. [ ] Run the package's CI steps locally: `node build.mjs --check`, `node contrast.mjs`,
   `node --test test/*.test.mjs`. All must be green.
7. [ ] Mutation check: put `"Fraunces"` back as the first family and see the display test
   go red, then restore it.
8. [ ] Commit `fix(tokens): name the shipped Fraunces face, drop the unbacked --font-quran`.
9. [ ] Hand back. The conductor then pushes, opens the PR, merges with `--merge`, tags
   the merge commit `v0.2.3` and pushes the tag. Steps 10 onward wait for the tag.

### 3. dashboard: the failing tests (worktree `dashboard-inf-fraunces-display-font`)

10. [ ] Add `src/test/font-faces.test.ts`, which runs in Node through `node:fs`:
    - Resolve `@kaleem/tokens/tokens.css` and parse every `--font-<k>:` value's first
      family.
    - Read `src/index.css`. For each `@import "@fontsource…"`, resolve the file the way
      CSS does: a bare package name means the package's `index.css`, and a subpath is
      that file. Collect every `@font-face` `font-family`.
    - Assert that every token's first family is in that set.
    - Guard against a test that checks nothing: at least the `sans`, `display` and
      `arabic` tokens are checked, and every import produced at least one face.
    - Run it with `"${R}/_tools/dashboard-gate.sh" "${WT}" src/test/font-faces.test.ts`.
      It must fail on v0.2.2 with `"Fraunces" not in {Fraunces Variable, Inter, IBM Plex
      Sans Arabic}`.
11. [ ] Add `e2e/display-font.spec.ts`, one flow with a budget of about 5 s:
    - Pin `locale: "en-US"`.
    - On `/design-preview`, with no login, and on `/account` after
      `login(page, "teacher")`:
      - Wait for `document.fonts.ready`.
      - Take the H1's `getComputedStyle().fontFamily`, keep the first family and strip
        its quotes. Assert it is `Fraunces Variable`.
      - Assert that `[...document.fonts]` holds a face whose quote-stripped `family` is
        `Fraunces Variable` with `status === "loaded"`.
    - Do not use `document.fonts.check()` (see the spec).
    - Name the found and expected families in the failure message.

### 4. dashboard: the fix

12. [ ] In `package.json`, set `@kaleem/tokens` to `github:kaleem-lms/tokens#v0.2.3`.
    Write the lockfile with `npx -y pnpm@10.28.0 install`, then check that
    `pnpm install --frozen-lockfile` passes.
13. [ ] Run step 10's test again. It must now be green.
14. [ ] Mutation checks. Each must go red, then be restored:
    - Re-pin v0.2.2. The unit test goes red.
    - Delete `@import "@fontsource-variable/fraunces"`. The unit test goes red, and so
      does the e2e in an e2e slot if one is free. CI is the authority for the e2e.
15. [ ] Full gate: `"${R}/_tools/dashboard-gate.sh" "${WT}"` (tsc, lint, coverage, build,
    built-CSS colour check). The new test lives in `src/test/**`, which coverage
    excludes, so the floors do not move. Never edit a floor (dec-floor-ownership).
16. [ ] Commit `fix(dashboard): re-pin @kaleem/tokens v0.2.3 and gate token families
    against shipped faces`.

### 5. marketing (worktree `marketing-inf-fraunces-display-font`)

17. [ ] Re-pin `package.json` to `#v0.2.3` and write the lockfile as in step 12.
18. [ ] Run `pnpm check && pnpm build`. Then grep `dist/` CSS for
    `--font-display:"Fraunces Variable"` and for `font-family:"Fraunces Variable"` (or
    the unquoted minified form). There is no test suite until `rch-mkt-test-harness`,
    so this grep is the check. Record its output in the hand-back.
19. [ ] Commit `fix(marketing): re-pin @kaleem/tokens v0.2.3`.

### 6. meta (this worktree, by the conductor)

20. [ ] One PR that bumps `tokens` to the `v0.2.3` tag commit, plus `dashboard` and
    `marketing`, with the ancestry guard on each. G3 (`scripts/check-token-pin.mjs`)
    must pass. `display-font.spec.ts` must appear in the e2e log.
21. [ ] Docs, in the same PR or the unit's close-out:
    - Close the Fraunces entry in `ISSUES.md`.
    - Add the Arabic-heading fallback entry (spec, Out of scope).
    - Add the `display-font` row to the CLAUDE.md D3 e2e table: 1 flow, English only,
      and what it does not prove.

## e2e (D3)

There is one new flow, `display-font.spec.ts`. It is mutation-checked in step 14. These
existing specs must stay green because the metrics of the heading font change:
`reflow.spec.ts` (320/360/430), `touch-targets.spec.ts`, `design-preview.spec.ts` and
`session-ui.spec.ts`. Marketing has no Playwright, and its H1 is checked on staging in
step 22.

## Migrations

None.

## Risks

- **`FontFace.family` quoting differs between browsers.** Chromium can return the name
  with its quotes. The spec strips quotes before comparing, and the fallback is to
  compare against both forms.
- **Wider glyphs could break reflow at 320px.** Fraunces is wider than Georgia at the
  same size. If `reflow.spec.ts` goes red, the fix stays in the component's wrapping
  inside this unit. If it would need a new token, escalate (scope).
- **The tag is pushed before the consumers prove it.** A bad v0.2.3 cannot be moved, so
  the fix would be v0.2.4, which is already allocated to the secondary button. The
  mitigation is to run tokens' own CI and steps 6 and 7 before the merge. A consumer
  failure then means a v0.2.3-fix release, renumbered with the conductor.
- **The lockfile conflicts with another dependency-changing unit.** The serialization
  rule holds the slot. On conflict, take main's lockfile and reinstall with
  pnpm 10.28.0.
- **G3 cannot run in a worktree.** CI is the authority for it.

## Verification

22. [ ] Staging, under the staging lock, with an agent Playwright pass
    (`dec-d9-substitute`):
    - The dashboard `/account` H1 and the marketing home H1 have a loaded
      `Fraunces Variable` face, in light and dark.
    - There is no sideways scroll at 320px.
    - In Arabic RTL, layout only.
    - This unblocks `hg-visual-owed`, `inf-brand-tokens-pipeline`, `lb-known-wcag-gaps`,
      `inf-call-specs-close`, `rch-mkt-foundation` and `inf-design-sync-disposition`.
