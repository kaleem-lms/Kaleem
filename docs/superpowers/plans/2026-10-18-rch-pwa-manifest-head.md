---
spec: docs/superpowers/specs/2026-10-18-rch-pwa-manifest-head-design.md
status: approved
---

Size S, about one day. Dashboard only, on branch `feat/rch-pwa-manifest-head` in
`/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-rch-pwa-manifest-head`, created from
`origin/main` as runbook §1 describes. Then run `pnpm install --frozen-lockfile`. The unit
changes no dependency, migration or coverage floor.

## Files

| File | Change |
| --- | --- |
| `src/test/web-manifest.test.ts` | new: the unit gate |
| `e2e/manifest.spec.ts` | new: the browser gate |
| `scripts/render-interim-icons.mjs` | new: a one-off generator, never run by CI |
| `public/site.webmanifest` | new |
| `public/favicon-32.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | new (generated) |
| `public/favicon.svg` | deleted (the purple Vite placeholder) |
| `index.html` | title, description, icon, manifest and theme-color tags |
| `nginx.conf` | `location = /site.webmanifest` |

## Steps

1. [ ] **Unit test first (red).** Write `src/test/web-manifest.test.ts` with the checks the
   spec's test plan lists.
   - Read files from `process.cwd()` the way `font-faces.test.ts` does.
   - Parse PNG headers inline: bytes 0-7 are the signature, and 16-23 hold the big-endian
     width and height.
   - Get the colours from `resolveTheme(light|dark).background`, imported from
     `@kaleem/tokens/build.mjs`.
   - Write no hex literals, because G2 scans `src/`. The `#863bff` check builds its string
     from parts, with a comment saying why.

   Run `dashboard-gate.sh <WT> src/test/web-manifest.test.ts`. Expect red: the manifest
   missing and the title `kaleem-dash-tmp`.
2. [ ] **e2e first (red).** Write `e2e/manifest.spec.ts` with three tests:
   - The title is `kaleem`, and the description meta is not empty.
   - The manifest link returns 200, a `json` media type and the fields. Then each icon from
     the manifest, `apple-touch-icon` and the `icon` link returns 200 with `image/png`, PNG
     signature bytes and IHDR dimensions equal to the declared size. Use `page.request`, so
     no login is needed.
   - `Page.getInstallabilityErrors`, called through `page.context().newCDPSession(page)`,
     returns no error whose id is about the manifest or icons. **Measure it first.** Log the
     raw error list against the finished build, and write in the spec's "Corrections" the
     ids Chromium reports that are out of this unit's hands, such as a missing service worker
     or the incognito-like context. Filter those named ids explicitly, never by a broad
     pattern.

   Run it in an e2e port slot (runbook §2) or leave it to CI. Expect red.
3. [ ] **Generator.** Write `scripts/render-interim-icons.mjs`.
   - Use `chromium` from `@playwright/test` and set a viewport for each size: 32, 180, 192
     and 512.
   - Build a page from `@font-face` with the local
     `node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2`.
   - Draw a full-bleed square in `--primary`, with a centred lowercase `k` in
     `--primary-foreground` inside the middle 80%. Resolve both colours from
     `@kaleem/tokens/build.mjs` (light).
   - After `document.fonts.ready`, exit non-zero unless a `FontFace` with the Fraunces family
     has the status `loaded`. Never write a fallback-font icon.
   - Take the screenshots into `public/`.
   - Run it once with `node scripts/render-interim-icons.mjs` and look at the 512 and 32
     outputs with the Read tool.
4. [ ] **Manifest, head, nginx.**
   - Write `public/site.webmanifest` with the spec's fields. Its colours are the same
     resolved values, pasted in, because the unit test is what keeps them in step.
   - Edit `index.html`. Keep the theme script as it is.
   - Delete `public/favicon.svg`.
   - Add the nginx location block, with `default_type application/manifest+json`, `nosniff`,
     `no-cache` and `try_files $uri =404`.
5. [ ] **Green and mutation checks.** Run the unit test and then the e2e until both are
   green. Then make each spec mutation, see it red, and revert:
   - a manifest `sizes` change (unit);
   - `rm dist/icon-512.png` before `pnpm preview` (e2e; it must fail on the media type or
     bytes, not pass on the SPA fallback);
   - a `theme-color` hex change (unit).

   Record each failure line for the hand-back block.
6. [ ] **nginx check (local, no network).** After `pnpm build`:
   - Run `nginx:alpine` with `dist` and `nginx.conf` mounted read-only and `--network none`.
   - Use `docker exec … wget -S -O /dev/null http://127.0.0.1/site.webmanifest`. Expect
     `application/manifest+json` with `nosniff`.
   - `/icon-512.png` should come back `image/png`.
   - A missing `/site.webmanifest` should be a 404. Check this by `rm` in a copy of `dist`.
   - Kill the container by its ID.
7. [ ] **Full gate and hand-back.**
   - Run `dashboard-gate.sh <WT>`: tsc, lint (biome only covers `src/**`, then G2),
     `test:coverage`, build, and the built-CSS G2 check. Coverage is unchanged, because no
     `src/` logic changes.
   - Run the runbook §3 checks: freshness, a clean tree, `gitleaks-range.sh` and the floor
     grep.
   - Commit with explicit paths, for example
     `feat(dashboard): web app manifest, interim icons and a real document head`.
8. [ ] **Close (conductor or close step, meta).**
   - Measure on `app-staging` as the spec's staging bullet describes.
   - Add a D3 e2e table row: `dashboard` — manifest/head, ✅ the flows above, with what they
     do not prove (install on a device, which belongs to `rch-pwa-device-verification`).
   - Add an `ISSUES.md` line for the unused `public/icons.svg`.
   - Report any Lighthouse SEO change to the conductor.
   - Write the journal line and update `STATE.md`.

## e2e (D3)

Required: the area is user-facing, and the head and manifest are what a browser sees before
any route renders. The flows are `e2e/manifest.spec.ts`, listed above. It has no seed and no
login, so it cannot interfere with the shared database. Budget: under 5 s.

**What it does not prove:** that a real device installs the app, or that the icon looks
right. Both are human checks in `rch-pwa-device-verification`. It also does not cover
nginx, because CI's e2e serves the build through `pnpm preview`. Step 6 and the staging
measurement cover nginx.

## Risks

- **Chromium's installability may require a service worker.** In that case the CDP check
  can only assert that no manifest or icon error remains. The spec records the exact
  residual ids, and `rch-pwa-service-worker` inherits the full "installable" assertion.
- **The generator depends on the installed Fraunces file name and on Playwright's
  Chromium.** It fails loudly, never silently. Its output is committed, so CI does not
  depend on it.
- **Interim art becomes sticky.** An installed icon persists until the browser refreshes
  the manifest. The brand release keeps the same file names, so the swap is a file
  replacement. Chromium re-reads the manifest on its own schedule, and some devices may
  show the `k` for a while after v0.3.0.
- **`nginx.conf` is shared with `rch-pwa-service-worker`.** That unit depends on this one,
  so the edits are serialised. The new block is a separate exact-match location and does
  not touch `location /`.
- **Owner changes the art or copy at approval.** Only step 3's drawing and the two strings
  change. The tests check structure and colours, not the glyph.

## Verification

Each step's red-then-green is above. The whole unit is verified by:

- `dashboard-gate.sh` full rc 0;
- the e2e green in CI, with `manifest.spec.ts` present in the run log;
- the three mutation checks recorded;
- the nginx container check;
- after the deploy, the staging measurement of media types, bytes and dimensions on
  `app-staging`.
