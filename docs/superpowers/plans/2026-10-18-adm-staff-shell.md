---
spec: docs/superpowers/specs/2026-10-18-adm-staff-shell-design.md
status: draft
---

Worktrees: `backend-adm-staff-shell`, `dashboard-adm-staff-shell` and `meta-adm-staff-shell`,
each on `feat/adm-staff-shell` (runbook section 1). Base: backend `fe415f1`, dashboard
`c70a0f4` and meta `a9e5242`. The unit has no migration and no dependency change. Every test
listed is written first and seen red. Each regression test is then mutation-checked: revert
the fix and see red again.

## Steps

### Backend (`backend-adm-staff-shell`)

1. [ ] **`is_staff` on `/me`.**
   - Tests first, in `kaleem/identity/tests/test_api_auth.py`:
     - `test_me_reports_is_staff_false_for_an_ordinary_user`;
     - `test_me_reports_is_staff_true_for_staff`;
     - `test_login_response_carries_is_staff`;
     - `test_patch_me_cannot_grant_staff`, which sends `{"full_name": "x", "is_staff": true}`
       and asserts the response is 200 and the user is still not staff in the database.
   - Code: in `kaleem/identity/api/views.py`, add `"is_staff": user.is_staff` to
     `_me_payload`. In `kaleem/identity/api/serializers.py`, add
     `is_staff = serializers.BooleanField()` to `MeResponseSerializer`.
   - Mutation: add `is_staff` to `MeUpdateSerializer` and apply it in `MeView.patch`. The
     PATCH test must go red.
2. [ ] **`IsStaff`.**
   - Tests first, in the new file `kaleem/platform/tests/test_permissions.py`:
     - anonymous is refused;
     - an active non-staff user is refused;
     - staff is allowed;
     - a throwaway `APIView(permission_classes=[IsStaff])` driven by `APIRequestFactory` and
       `force_authenticate` returns 403 to a non-staff user and 200 to staff.
   - Code: `class IsStaff(BasePermission)` in `kaleem/platform/permissions.py`.
     `has_permission` returns `bool(user and user.is_authenticated and user.is_staff)`. It
     imports nothing outside DRF.
3. [ ] **Staff fixture.**
   - Tests first, in `kaleem/identity/tests/test_seed_e2e.py`:
     - `test_seeds_a_staff_account_with_no_profile` checks that it is verified, can
       authenticate, `is_staff`, and has no student, parent or teacher profile;
     - `test_no_other_seeded_account_is_staff`;
     - `test_reseeding_clears_a_drifted_staff_flag` sets `is_staff=True` on the teacher,
       reseeds, and expects False.
     - No test reads the "Seeded 8" message today, so only the message changes.
   - Code, in `seed_e2e.py`:
     - add `STAFF_EMAIL = "e2e.staff@kaleem.test"` ("E2E Staff");
     - `_account(..., profile_model=None, staff=False)` sets `user.is_staff = staff` on every
       run, and creates a profile only when one is given;
     - the success message counts 9.
   - Mutation: drop the unconditional `is_staff` assignment, and the drift test must go red.
4. [ ] Full gate: `"${R}/_tools/backend-gate.sh" "${WT}"` (migrate, `makemigrations --check`,
   pytest with coverage, ruff, ruff format, lint-imports). Commit
   `feat(identity): expose is_staff on /me and seed a staff account` and
   `feat(platform): add the IsStaff permission`.

### Dashboard (`dashboard-adm-staff-shell`)

5. [ ] **Nav gate.**
   - Tests first, in `src/features/shell/nav.test.ts`:
     - a `staff: true` item is hidden with no options and hidden with `isStaff: false`;
     - it is shown with `isStaff: true`;
     - `NAV_ITEMS` ends `"/account", "/staff"`;
     - `visibleNavItems(NAV_ITEMS, ["teacher"])` has no `/staff`.
   - Code, in `nav.ts`:
     - add `staff?: true` to `NavItem`;
     - give `visibleNavItems` a third parameter, `{ isStaff = false } = {}`;
     - append `{ to: "/staff", labelKey: "nav.staff", icon: ShieldCheck, staff: true }`.
6. [ ] **`Me` and the guard.**
   - Add `is_staff?: boolean` to `Me` in `src/features/identity/schemas.ts`.
   - Tests first, in `src/features/admin/require-staff.test.ts`, with a `QueryClient` seeded
     with `meQueryKey`:
     - it resolves for `is_staff: true`;
     - it throws a redirect to `/` for `false`;
     - it throws a redirect to `/` when `is_staff` is absent.
   - Code: `src/features/admin/require-staff.ts`, re-exported from
     `src/features/admin/index.ts`.
   - Mutation: change the check to `!== false`, and the "absent" case must go red.
7. [ ] **Shell wiring.**
   - Tests first, in `src/features/shell/AppShell.test.tsx`: a staff `me` shows the "Staff"
     link, and a non-staff `me` does not.
   - In `src/routes/_authed/index.test.tsx`: a staff `me` gets no Staff tile on Home.
   - Code: `AppShell` passes `{ isStaff: me?.is_staff === true }`. Home is unchanged.
8. [ ] **Route and page.**
   - Tests first, in `src/routes/_authed/staff.test.tsx`:
     - with a memory history at `/staff`, a staff `me` renders the `level: 1` heading "Staff";
     - a teacher `me` ends at `/` with no such heading.
   - Code:
     - `src/routes/_authed/staff.tsx`: `beforeLoad: ({ context }) => requireStaff(context)`
       and `component: Outlet`;
     - `src/routes/_authed/staff/index.tsx`;
     - `src/routes/_authed/-pages/StaffHomePage.tsx`.
   - Regenerate `routeTree.gen.ts` through `pnpm build`, and commit it.
   - Add `nav.staff`, `staff.title` and `staff.description` to `src/locales/en/common.json`
     and `src/locales/ar/common.json`. The `parity` and `terminology` tests must pass.
9. [ ] **e2e.**
   - New `e2e/accounts/admin.ts`, exporting
     `ADMIN_ACCOUNTS = { staff: { email: "e2e.staff@kaleem.test", name: "E2E Staff" } }`.
     Spread it into `ACCOUNTS` in `e2e/fixtures.ts`.
   - New `e2e/routes/admin.ts` with `[{ path: "/staff", as: "staff" }]`, added to
     `AUTHED_ROUTES` in `e2e/routes/index.ts`.
   - New `e2e/staff.spec.ts` with three flows:
     - staff open Staff from the nav: the heading is visible and the link is
       `aria-current="page"`;
     - a teacher has no Staff link, and `page.goto("/staff")` ends at `/` with no "Staff"
       heading;
     - the same for a parent.
   - Mutation: make `requireStaff` resolve unconditionally, and the two refusal flows must go
     red. Optional local run in an e2e slot. CI is the authority.
10. [ ] Full gate: `"${R}/_tools/dashboard-gate.sh" "${WT}"` (tsc, lint, coverage, build,
    built-CSS check). Commit `feat(admin): staff route guard, section and nav entry`.

### Meta (`meta-adm-staff-shell`)

11. [ ] **ADR.** Write the ADR-0013 amendment, numbered by the conductor (next free when this
    was written: 0056). It records `dec-admin-surface` option 1:
    - day-to-day staff work happens in the dashboard;
    - Django admin is for break-glass and reference config only;
    - a new piece of config kept in Django admin needs its own ADR.

    Also add `amended_by` to ADR-0013's front matter.
12. [ ] **Docs.**
    - `CLAUDE.md` D3 table: add the row `admin` — staff shell, ✅ 3 flows.
    - `docs/architecture/identity.md`: `/me` carries `is_staff`, and the seed has a staff
      account.
    - `docs/architecture/platform.md`: `IsStaff`.
    - Commit `docs: ADR and docs for adm-staff-shell`.
13. [ ] Hand-back checks from runbook section 3 in both submodule worktrees:
    - ancestry;
    - a clean tree;
    - `gitleaks-range.sh ... origin/main..HEAD` ends CLEAN;
    - no floor touched.

## Risks

- **`ana-foundation` lands first and reshapes the nav or Home.** This unit only adds an
  optional parameter and one item, so the freshness merge stays small. If `ana-foundation`
  already provides a staff entry point, adopt its shape and delete the `staff?: true`
  field. Do not keep two gates.
- **The e2e harness's `login()` waits for `/`.** A profile-less staff user lands on Home with
  no spotlight. That path is already handled (`spotlight` can be `null`), and step 9 proves
  it in a real browser.
- **Arabic copy.** The strings must be real Arabic: the sweep allowlist is at its ceiling.
  `hg-arabic-review` holds spec closure, not the merge.
- **Staging click-through (D9).** This needs a staff account in the `hg-staging-accounts`
  pool, which is owner-access. Ask the conductor to add a staff role to that pool before
  step 11 of the protocol. Do not create one on staging yourself.
- **A stale `/me`.** The cache can show the Staff link for up to 60 s after staff is revoked.
  This is accepted: `IsStaff` on the server is the control. No staff endpoint exists yet.

## Verification

- Per step: the named tests red, then green, plus the stated mutation checks.
- Whole: both full gates are green, and CI's e2e log lists the three `staff.spec.ts` flows and
  the `/staff` sweep entries.
- Staging: the protocol's step 11 click-through as staff, teacher and parent, in both
  themes, Arabic RTL and at 320px.
