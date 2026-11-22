---
spec: docs/superpowers/specs/2026-10-18-inf-brand-tokens-pipeline-design.md
status: draft
---

## Basis

This plan carries out brand plan Tasks 4, 6 and 8a
(`docs/superpowers/plans/2026-09-14-brand-identity.md`). The code for those tasks is used
as written in that plan, with errata E1, E3, E5, E7, E12 and E15. This plan records only
where it departs from them:

- Task 4 Step 6 (`files`/`exports`) is not done here. It moves to `inf-brand-mark-assets`.
- `svgIssues` is stricter: it checks paint values, `<feImage>`, `data:image` and
  `<title\b`.
- A test checks the package surface (E15).
- Determinism is measured under node 22.
- All imports in `test/brand.test.mjs` go at the top of the file. The brand plan appends
  them task by task.

**Worktree:** `/home/abdulkhalek/Projects/kaleem-worktrees/tokens-inf-brand-tokens-pipeline`,
branch `feat/inf-brand-tokens-pipeline`, created per runbook section 1 with `S=tokens`.
Base is `origin/main` 2a78fb0, which is v0.2.4.

**Dependency change:** this unit changes dependencies in `tokens`, the repo's first
lockfile. Hold the conductor's per-repo dependency slot for `tokens` before step 4.
`tokens/package.json` is a declared shared file.

## Steps

1. [ ] **Presence gate (Task 4), red, then green.**
   - Fixtures:
     - `test/fixtures/brand/brand.json` declares the `color` block and two sources.
       `mark` is `src/mark.svg`, `viewBox="0 0 24 24"`. `og-card` is `src/og-card.svg`,
       `viewBox="0 0 1200 630"`. Each source has a `<title>` and only `fill="currentColor"`
       paths. Neither has `<text>`. `emitted: []` for now.
     - `test/fixtures/brand/brand-missing.json` declares `gone` →
       `test/fixtures/brand/src/gone.svg`.
   - Write the four Task 4 tests and watch them fail with `Cannot find module '../brand.mjs'`.
   - Add `brand/brand.json`: the colour block with `{primary-text}` and `{background}`,
     and empty lists.
   - Add `brand.mjs` with `loadManifest`, `manifest`, `declared` and `missing`. Green.
   - Commit `test: gate that every declared brand asset exists, on fixtures until the mark lands`.

2. [ ] **Hygiene gate (Task 6), red, then green.**
   - Tests: the fixture sources are clean (loop over `FIXTURE` and the shipped manifest).
     One test per rejection, each asserting on the issue text:
     - a hex fill;
     - `fill="black"`;
     - `style="fill:red"`;
     - `<image href>`;
     - `<feImage href="data:image/png;base64,AA">`;
     - live `<text>`;
     - no `viewBox`;
     - no `<title>`.
   - One acceptance test: `<svg viewBox="0 0 1 1"><title id="t">k</title><path
     fill="currentColor" fill-rule="evenodd" d="M0 0"/><path fill="none"
     stroke="currentColor" d="M0 0"/></svg>` gives `[]`. This proves `fill-rule` and
     `fill="none"` are not false positives.
   - Red: `svgIssues` is not exported.
   - Implement Task 6's `svgIssues`, with these changes:
     - Paint check:
       `/(?<![\w-])(fill|stroke|stop-color|flood-color|lighting-color|color)\s*(?:=\s*["']|:\s*)([^"';>]+)/g`.
       Every value must match
       `/^(currentColor|none|inherit|url\(#[^)]*\))$/i`, or the issue says
       `<prop> is "<v>", not currentColor`.
     - The raster check also matches `<feImage\b` and `data:image`.
     - The title check is `/<title\b/`.
   - Green. Commit `test: source marks carry shape only, gate mutation-checked`.

3. [ ] **Colour and PNG sizing (Task 8a Step 3), red, then green.**
   - Tests:
     - `markColor` resolves to `/^#[0-9a-fA-F]{6,8}$/` in light and dark, not `#863bff`.
     - `markColor("light","nope")` throws.
     - A manifest whose `color.mark` is `{color.primary.text}` throws (the original E1 bug).
     - `pngSize(Buffer.from("not a png"))` throws.
   - Implement `markColor` and `pngSize` as written in Task 8a. Green.

4. [ ] **Emitter, drift and icon-set gates (Task 8a Steps 1, 4 and 5), red, then green.**
   - Run `npx -y pnpm@10.28.0 add -D -E @resvg/resvg-js@2.6.2`, which writes
     `pnpm-lock.yaml`. Then `pnpm install --frozen-lockfile` must pass. Confirm
     `.gitignore` already covers `node_modules/` (it does at 2a78fb0).
   - Extend the fixture manifest's `emitted` list:
     - `favicon-svg` → `test/fixtures/brand/dist/favicon.svg` (svg, from `mark`);
     - `icon-192` → `dist/icon-192.png` (192x192, from `mark`);
     - `og-card` → `dist/og.png` (1200x630, from `og-card`).

     All use `color: "mark"`.
   - Add Task 8a's seven tests. Red: `pngSize`/`emit` are not exported, or the fixture
     `dist/` is missing.
   - Implement `emit`, `drift`, `iconSetIssues` and the CLI exactly as written in Task 8a
     Step 4. Generate the fixture output with
     `node brand.mjs test/fixtures/brand/brand.json`. Green.

5. [ ] **Surface test (E15), red, then green.** Test: `package.json` `files` does not
   include `brand.mjs` and `exports` has no key or value naming `brand.mjs`. Prove it can
   fail: add `"./brand.mjs": "./brand.mjs"` to `exports` and see it go red. Revert. Green.

6. [ ] **Wire scripts and CI (Task 8a Step 6).**
   - `package.json`:
     - `"test": "node build.mjs --check && node brand.mjs --check && node --test test/*.test.mjs"`
     - `"brand": "node brand.mjs"`
   - `.github/workflows/ci.yml`:
     - add `pnpm/action-setup@v6` with `version: 10` before `setup-node`;
     - add `pnpm install --frozen-lockfile`;
     - replace the "No dependencies by design" comment with Task 8a's wording;
     - add a step "Emitted brand assets are current: `node brand.mjs --check`" beside
       `build.mjs --check`.

     Keep `timeout-minutes: 5`, and leave the existing action versions alone (D10).
   - Commit `feat: brand emitter with colour resolved from tokens, size- and drift-gated on fixtures`.

7. [ ] **Mutation checks.** Each check must be seen red before the gate is trusted, then
   restored.
   - **Drift (Task 8a Step 7 / E12), as written.** Append a byte to
     `test/fixtures/brand/dist/favicon.svg`. Expect `cli rc=1`, naming that file, and
     `suite rc=1`. Restore, then expect both at 0.
   - **Presence.** Make `missing()` return `[]`. The "reports an absent file" test goes red.
   - **Hygiene.** Remove the paint check. The `fill="black"` and `fill:red` tests go red.
   - **Size.** Make `iconSetIssues` return `[]`. The mis-declared icon test goes red.
   - **Colour.** Drop the `!value` throw. The E1 alias test goes red.
   - Record each red line in the hand-back block.

8. [ ] **Determinism under CI's node.** Mount the worktree read-only and run:

   ```
   docker run --rm -v "${WT}:/w:ro" -w /w node:22 sh -c 'node build.mjs --check && node brand.mjs --check && node brand.mjs test/fixtures/brand/brand.json --check && node --test test/*.test.mjs'
   ```

   The `node_modules` binary is linux-x64-gnu, which is CI's platform. Also run
   `node brand.mjs test/fixtures/brand/brand.json` twice on the host, then confirm
   `git status --porcelain` is empty. Fixture PNGs that are not byte-stable stop the
   unit (Risks).

9. [ ] **Full local gate and hand-back (runbook section 3).**
   - Run `pnpm install --frozen-lockfile && npm test && node contrast.mjs` on the host.
   - Run the step-8 container command.
   - Run the gitleaks range: `"${R}/_tools/gitleaks-range.sh" "${WT}" origin/main..HEAD`.
   - Confirm the tree is clean and the branch contains `origin/main`.
   - The floor grep does not apply, because tokens has no coverage floor (D3 table).
   - No meta pointer bump, and no tag.

## Gates

- **Local:** the step 9 commands.
- **CI authority:** the tokens `verify` job on the PR and on `main` after the merge.
- **Not needed here:**
  - meta CI: no pointer moves.
  - G3 (`check-token-pin.mjs`): only on a release.
  - backend and dashboard gates: not touched.

## e2e

None (D3). Nothing renders, and no consumer changes. The fixtures and the gates' own
negative tests prove the behaviour. The rendered checks (favicon in a real browser, OG
card, both themes and directions) belong to `inf-brand-dashboard`,
`inf-brand-marketing` and `inf-brand-release-deploy`.

## Migrations

None.

## Risks

- **resvg output not byte-stable.** The cause would be the platform, the node version or
  run-to-run variation. Step 8 measures it.
  - Fallback if node 24 and node 22 differ: generate the fixture PNGs inside `node:22`,
    which is CI's environment, and note this in the CI comment.
  - Fallback if output varies run to run: escalate. Do not loosen the drift gate to a
    size-only check.
- **Fixture `dist/` committed against the wrong paths.** `emit()` keys on
  manifest-relative paths from the package root. Running the generator from another
  directory writes nowhere useful. Always run it from the worktree root.
- **pnpm 10 build-script blocking.** `@resvg/resvg-js` 2.6.2 has no install script.
  Its binaries come as optional platform packages, so nothing needs
  `onlyBuiltDependencies`. If the frozen install still fails, that is an escalation
  trigger (runbook).
- **A hotfix tag before v0.3.0.** It would ship the same package contents as v0.2.4,
  because `files` and `exports` are unchanged. `brand.mjs` and `brand/` are outside
  `files`. Low risk by construction.
- **Hex false positive.** `url(#abc)` looks like a hex colour and is reported. The gate
  fails closed, and the author renames the id. This is accepted and noted in the
  `svgIssues` comment.

## Verification

- Each step is red before it is green, and each gate is mutation-checked once (step 7).
- The node 22 container run (step 8) matches CI.
- Tokens CI is green on the PR, and the conductor merges into tokens `main`.
- The `inf-brand-mark-assets` brief must carry three items:
  - the `files`/`exports` step and the wildcard-aware fix to the exports test;
  - the shipped-manifest hygiene loop;
  - the Task 8b drift mutation check on `brand/dist/favicon.svg`.
