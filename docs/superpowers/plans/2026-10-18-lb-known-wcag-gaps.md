---
spec: docs/superpowers/specs/2026-10-18-lb-known-wcag-gaps-design.md
status: draft
---

This is a tokens release, so the order is the same as for v0.2.3 (`inf-fraunces-display-font`):

1. tokens
2. the tag
3. both consumers
4. one meta PR that moves all three pointers

Consumer merges freeze while it lands. The tag comes from tokens `main` **before** the brand
pipeline merges into tokens (`serialization_points`, "@kaleem/tokens releases"). It is the
only dependency-changing unit in dashboard and marketing while it holds the slot.

Bases at writing:

| Repo | Base |
| --- | --- |
| tokens | `68567a3` (v0.2.3) |
| dashboard | `4b123b0` |
| marketing | `7415349` |
| meta | `962e18c` |

Worktrees go under `/home/abdulkhalek/Projects/kaleem-worktrees`, named
`<repo>-lb-known-wcag-gaps`, on branch `feat/lb-known-wcag-gaps` (runbook section 1).

## Steps

### 1. tokens: failing tests

1. [ ] Add to `test/build.test.mjs`: every key of `color.light.tokens.json` and
   `color.dark.tokens.json` except `$`-keys and `overlay` appears as `--<key>:` in
   `tokens.css` and as `--color-<key>:` in `theme.css`. It is green on main.
2. [ ] Add to `test/contrast.test.mjs`: `evaluateAll().results` contains a blocking 1.4.11
   result with foreground `control-border` on each of `background`, `card` and `popover`,
   in both themes. It is red because the token and the pair do not exist yet.
3. [ ] Add `control-border` to both theme JSON files:
   - light: `{color.sand.500}`
   - dark: `{color.ink.500}`
   - Give each a `$description` that says why it is not `--input` or `--border`.

   Run `node --test test/*.test.mjs`. Test 1 must now go **red**: the token is in the
   source but `BASE` does not emit it. This is the silent drop the test exists for.

### 2. tokens: the fix

4. [ ] Add `"control-border"` to `BASE` in `build.mjs`, after `"input"`.
5. [ ] Add the `nonText` pair to `src/contrast-pairs.json`:
   - `control-border` on `background`, `card` and `popover`
   - min `3.0`, SC `1.4.11`
   - label "secondary button boundary"
6. [ ] Run `node build.mjs`, then add the README rule line and bump `package.json` to
   `0.2.4`.
7. [ ] Run the package CI steps: `node build.mjs --check`, `node contrast.mjs` and
   `node --test test/*.test.mjs`. All must be green.
8. [ ] Mutation check: alias light `control-border` to `{color.sand.300}` (1.62:1) and
   confirm the gate goes red, then restore it.
9. [ ] Commit `feat(tokens): control-border, the secondary button's boundary (v0.2.4)`.
   Hand back. The conductor pushes, merges with `--merge`, tags `v0.2.4` and pushes the
   tag. Steps 10 onward wait for the tag.

### 3. dashboard: re-pin and failing tests

10. [ ] Re-pin `@kaleem/tokens` to `github:kaleem-lms/tokens#v0.2.4` with
    `npx -y pnpm@10.28.0 install`, then confirm `pnpm install --frozen-lockfile` passes.
11. [ ] `src/test/a11y.test.tsx`: in "is actually asserting something", assert that some
    blocking result has `foreground === "control-border"` and `sc === "1.4.11"`. Prove it
    is red on the v0.2.3 install by stashing the re-pin, then green on v0.2.4.
12. [ ] `src/ui/button.test.tsx`: the secondary button's class list contains `border` and
    `border-control-border`. It is red.
13. [ ] `src/ui/select.test.tsx`: `<Select aria-invalid>` carries
    `aria-invalid:border-destructive`. It is red.
14. [ ] `WeeklyAvailabilityEditor.test.tsx`: add three cases. The first two are red. The
    third passes on main, and it guards the fix against a stale `aria-invalid`.
    - **End before start:**
      - `getByLabelText("End time")` has `aria-invalid="true"` and
        `toHaveAccessibleDescription(/end time must be after start time/i)`.
      - The start select has no `aria-invalid` and no description.
    - **Overlap**, with the existing "refuses a range overlapping" setup: both selects
      are invalid and described by the overlap message.
    - **Recovery:** after a failing Add, choose a valid range and Add. The range is
      added, and no element in the row keeps `aria-invalid`.

### 4. dashboard: the fix

15. [ ] `button.tsx`: the `secondary` variant gets `border border-control-border`.
16. [ ] `select.tsx`: copy `Input`'s recipe,
    `aria-invalid:border-destructive aria-invalid:not-focus-visible:ring-2 aria-invalid:not-focus-visible:ring-destructive`.
17. [ ] `WeeklyAvailabilityEditor.tsx` (`InlineEditor`):
    - Hold the error as `{ message, fields: "end" | "both" }`.
    - Render it through `FormError` with an id from `useId()`.
    - On each `Select`, set `aria-invalid` and `aria-describedby` when that select is in
      `fields`.
    - Keep `role="alert"`; `FormError` already carries it.
18. [ ] Run `"${R}/_tools/dashboard-gate.sh" "${WT}" <file>` per test file. All must be
    green.
19. [ ] Mutation checks: revert each fix in steps 15–17 one at a time and confirm its
    test goes red.

### 5. dashboard: e2e

20. [ ] `e2e/design-preview.spec.ts`, new flow: "a secondary button's boundary clears 3:1
    in every mode".
    - For each `preview-<mode>` panel, read every `Button` whose text is `secondary` or
      `size sm|md|lg`.
    - Assert that `borderTopStyle === "solid"` and `borderTopWidth >= 1px`. Without this,
      a missing border would let `currentColor` pass.
    - Walk up to the first ancestor with an opaque `backgroundColor`, then assert that the
      contrast between `borderTopColor` and that colour is at least 3. Compute it with the
      WCAG formula written inline in the test; no hex literals (G2).
    - Mutation check: remove the class and the flow goes red, quoting the 1.09 ratio.
21. [ ] `e2e/availability.spec.ts`, "refuses a range that ends before it starts": add
    `toHaveAttribute("aria-invalid", "true")` and `toHaveAccessibleDescription` on
    `friday.getByLabel("End time")`. Mutation-check it.
22. [ ] Optional: run the local e2e slot (runbook section 2). CI is the authority.
23. [ ] Run the full gate, `"${R}/_tools/dashboard-gate.sh" "${WT}"`: tsc, lint, coverage,
    build and `check-colors --built`. Grep the built CSS for `control-border` to confirm
    that the utility was emitted.
24. [ ] Commits:
    - `chore(deps): pin @kaleem/tokens v0.2.4`
    - `fix(ui): give the secondary button a 3:1 boundary`
    - `fix(scheduling): link the availability error to its select`

### 6. marketing

25. [ ] Re-pin to `#v0.2.4` with pnpm 10.28.0, then run
    `pnpm install --frozen-lockfile && pnpm check && pnpm build`.
26. [ ] Commit `chore(deps): pin @kaleem/tokens v0.2.4`.

### 7. Hand back and the meta PR

27. [ ] Run the runbook section 3 checks in each worktree: contained, clean,
    `gitleaks-range.sh` CLEAN and no floor touched.
28. [ ] The conductor merges both consumers, then opens one meta PR that does the
    following:
    - Moves the `tokens`, `dashboard` and `marketing` gitlinks. The tokens gitlink must
      equal the `v0.2.4` commit for G3.
    - Deletes both `ISSUES.md` entries.
    - Adds the `outline` entry (spec, Out of scope).
    - Updates the CLAUDE.md D3 row "design-system — rendered contrast" from 3 to 4 flows,
      and notes the new availability assertion.

## Gates

- tokens: `node build.mjs --check`, `node contrast.mjs` and `node --test`. Tokens has no
  runbook script; these are its `ci.yml` steps.
- dashboard: `dashboard-gate.sh`, focused then full.
- marketing: `pnpm check && pnpm build`.
- meta: G3 and the e2e job, both in CI only. G3 cannot run in a worktree.
- No migrations. No backend change.

## Risks

- **Light `control-border` clears its pair at 3.04:1.** That is the same margin `--input`
  has had since v0.2.0. A later sand retune can tip it, and the pair turns that into a red
  gate rather than a silent regression. If the brand work wants more headroom, sand.600
  measures 4.34:1.
- **The brand pipeline merges into tokens before v0.2.4 is tagged.** Then the tag would
  ship half-built pipeline code. The conductor holds the tokens slot until the tag is
  pushed. If it is missed, tag the pre-pipeline commit and escalate rather than tagging
  `main`.
- **Layout.** The border adds 2px of width to a secondary button. `reflow` (320px) and
  `touch-targets` must stay green. **Found while building:** a border *can* shrink the hit
  area of `size="sm"`. Its 2px bleed is a `::after` inset from the padding box, so a 1px
  border left a 42px target and `touch-targets` ("the dense controls accept more than they
  paint") went red. The secondary-and-sm compound variant now bleeds 3px. The same
  arithmetic applies to `variant="outline"` with `size="sm"`, which already has a border;
  it is logged in `ISSUES.md`, not fixed here (D10).
- **Built CSS.** A utility named in a comment or test selector is emitted (Tailwind v4).
  `border-control-border` is a real token utility, so emitting it is intended. Step 23
  checks for it.
- **Stale entry.** The `ISSUES.md` entry named the wrong component. If review finds another
  unlinked error, it goes to `ISSUES.md`, not into this unit.

## Verification

Each step has its own test and a mutation check that turns it red.

The whole unit is verified this way:

1. Green CI on the meta PR, including G3 and the e2e job. Read the log for the two
   new or changed test names.
2. Then the staging pass from the spec's "Done": light and dark, Arabic RTL, 320px.

## Build notes (2026-10-18)

- **Steps 10 and 25 (the re-pins) are the conductor's.** `pnpm-lock.yaml` records the tokens
  commit SHA, and the SHA of the v0.2.4 merge commit does not exist until the conductor has
  merged and tagged the tokens PR. The dashboard branch carries the code and tests only. To
  finish it, in each consumer worktree: `npx -y pnpm@10.28.0 add "github:kaleem-lms/tokens#v0.2.4"`
  (dashboard and marketing), then `pnpm install --frozen-lockfile`. Until then
  `src/test/a11y.test.tsx` ("declares the secondary button's boundary") is red on the v0.2.3
  install, which is the point of it.
- The dashboard gates were run with `@kaleem/tokens` temporarily linked to the tokens worktree
  (`file:`); that change to `package.json` and the lockfile was reverted before the commits.
  Marketing's `pnpm check && pnpm build` was run the same way and was clean.
