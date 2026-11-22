---
spec: docs/superpowers/specs/2026-11-22-rch-dashboard-code-splitting-design.md
status: draft
---

Worktree `WT=/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-rch-dashboard-code-splitting`,
branch `feat/rch-dashboard-code-splitting`. Round 1 left this worktree in place. It is
fast-forwarded to dashboard `origin/main` 756146c and installed. No dependency change,
migration, `ci.yml` change or floor edit. Meta: this worktree's spec and plan, plus the guide
update in step 9.

TDD loop: `_tools/dashboard-gate.sh "${WT}" <test path>`. Full gate before hand-back.

## Steps

1. [ ] **Exact budget line (red, then green).** In `scripts/check-bundle-budget.test.mjs`,
   assert that `main()` logs `initial JS: <n> files, <bytes with separators> bytes raw,
   <headroom> under budget` (or `over budget`). Red against today's `579.6 KB` line. Change
   only the log line in `check-bundle-budget.mjs`. Then run `pnpm exec vite build && node
   scripts/check-bundle-budget.mjs` and record the **before** line (local
   579,807 / CI 579,631).

2. [ ] **Key guard (green on main, mutation-checked).** Write `src/locales/key-usage.test.ts`
   with the spec's two rules. Walk `src` with `node:fs`, skipping `*.test.*` and `src/test/`.
   - Rule 1: closed literals `"<seg>.<path>"` whose `<seg>` is a top-level key of
     `en/common.json` or a `FEATURE_CATALOGUES` name, excluding file-like suffixes
     (`.json`, `.ts`, `.tsx`). Each must resolve in `en/common.json`.
   - Rule 2: for every `const { t[: alias] } = useTranslation(<args>)`, each
     `<alias>("<key>"…)` call without `ns:` must resolve in `<args>`' namespaces, in order.
   - Resolution accepts a plural family. The test reports `file: key` per failure.
   - The scratchpad prototype found 0 failures on main and 205 with `family` and `billing`
     deleted. Mutation-check it the same way before going on.

3. [ ] **Loader tests (red).** Extend `src/lib/i18n-namespaces.test.ts` in the existing
   `unload` → `loader()` → `hasResourceBundle` pattern:
   - `/billing` → billing; `/family` → family; `/availability` → availability;
     `/match-requests` → matching;
   - `/account` → account, availability, matching;
   - `/schedule` → reschedule, booking, availability;
   - plus one assertion that `i18n.getFixedT("en", ["account", "common"])` resolves a moved
     key and `auth.*`.

   Red: the namespaces and loaders do not exist.

4. [ ] **Catalogues (green for step 3).** Write a throwaway script in the scratchpad, not
   committed, that parses both `common.json` files, moves each block per the spec's table
   (residual keys stay), merges into `account.json` (root, plus `subjects` and
   `teacherProfile` objects), and writes every file back with tabs and a trailing newline.
   - Assert in the script that the union of leaves before equals the union after, per
     locale.
   - Add the five `FEATURE_CATALOGUES` entries and the route loaders. Several namespaces
     load as `loader: () => Promise.all([...]).then(() => undefined)`.
   - Run steps 2 and 3. Step 2 is now **red** and lists every reference to rewrite. Run
     `parity.test.ts` and `terminology.test.ts`, which must be green.

5. [ ] **Rewrite references (step 2 green).** Work file by file from the guard's list: set
   `useTranslation(["<ns>", "common"])` and strip the prefix of moved keys only.
   - Files that a no-loader surface renders keep `useTranslation()`: `ManageBillingButton`,
     `DunningBanner`, `groupSessionsByDay`, `CallStatus`, `RoomPage`, `OfflineScreen` and
     `AccountLocaleSync`. If one of them needs a moved key, that key goes back to common.
   - A component rendered on more than one route needs its namespace loaded by every one of
     them (step 3's list). Check with `codegraph_callers` on the component before choosing.
   - Run `tsc --noEmit` and the guard.

6. [ ] **Component tests.** Run the touched feature directories, then the full suite
   (`test:coverage`, through the full gate).
   - A test that now shows a raw key gets `import "@/test/feature-i18n";`. Add nothing
     else.
   - Update the key strings in `groupSessionsByDay.test.ts`,
     `WeeklyAvailabilityEditor.test.tsx` and `parity.test.ts` where they name moved keys.
   - Coverage must not drop. The same lines are exercised.

7. [ ] **e2e `e2e/feature-catalogues.spec.ts`.**
   - Reuse `login` from `fixtures.ts` and the route entries in `e2e/routes/`. Build the
     raw-key set from the moved catalogue JSON (dotted leaf paths, plural suffix stripped,
     bare and `<ns>.`-prefixed).
   - Per entry, reach the route twice: client-side from Home (click the nav link), then by
     `page.goto`. After `settle`, collect visible text nodes and `aria-label`,
     `placeholder` and `title` values, and expect none to be in the set.
   - Run `/family` once more in Arabic, set the way `arabic-sweep.spec.ts` sets it.
   - Budget is 30 s or less. Mutation: drop the family loader, see red, then restore.
   - Locally, use e2e slot 1 from runbook section 2 if it is free. CI is the authority.

8. [ ] **Measure after.** Run `pnpm build` and record the after line. The spec's target is
   ≤ 555,000 on CI.
   - Compare the `ui-*.js` size (214.6 KB before), and list which chunks are new and lazy
     (`booking-*`, `billing-*` and the others, two per namespace) and confirm none are
     preloaded (`grep modulepreload dist/index.html`).
   - Update the measured-value comment over `INITIAL_JS_BUDGET`, leaving the constant at
     580,000.

9. [ ] **Docs (meta worktree).** In `docs/developer-guide/i18n.md`, extend the feature
   catalogue table with the five new rows. Add the residual-key rule and the
   `useTranslation(["<ns>", "common"])` form, and note that `key-usage.test.ts` enforces
   both. Commit as `docs: feature catalogues for booking, billing, availability, family,
   matching`.

10. [ ] **Hand-back.** Run the full dashboard gate, then `git fetch` and
    `git merge --no-edit origin/main` (merge, never rebase). Re-run the gate if the merge
    brought anything. Then run `gitleaks-range.sh` and the floor-touch grep, and write the
    runbook section 3 block with the before and after budget lines.

## Risks

- **A moved key shown on a surface the reachability trace missed** shows the raw key.
  Covered by the guard (static), the component tests and the e2e on the real build.
  Fallback: put the key back in common.
- **Array-namespace fallback behaves differently than assumed.** Step 3's `getFixedT`
  assertion fails first, before any component changes. Fallback: residual keys are read with
  `{ ns: "common" }`, as the call room already does.
- **Merge conflicts in `common.json`** with units landing meanwhile, such as staff or
  earnings adding keys. Resolve by rerunning the step-4 script on the trunk's file (guide
  rule 4), never by hand.
- **Bundler regrouping eats part of the saving** (round 1 and the PWA unit both saw shared
  chunks shift). Measured, not assumed, in step 8. If the result is above 555,000, report it
  rather than reach for the out-of-scope levers.
- **Raw-key matcher false positives** (a real UI word equal to a lowercase leaf key). The
  match is exact and case-sensitive on whole text nodes. A real hit is fixed in the matcher,
  with a comment.

## Verification

Each step's tests, red and then green as stated, with mutation checks in steps 2 and 7.
The full dashboard gate passes. CI's `dashboard-build` and e2e jobs pass, with the new spec
present in the e2e log. The CI `initial JS:` line is at or under 555,000 bytes. After the
deploy, the conductor runs a staging pass of the six routes in English and Arabic.
