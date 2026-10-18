---
name: adm-staff-shell
phase: v1 (wave 1, admin stream)
modules: [identity, platform, dashboard shell]
status: draft
created: 2026-10-18
closed: null
---

## Goal

ADR-0013 says staff work in the shared dashboard, gated on `User.is_staff`. Nothing in the
dashboard knows who is staff today. `src/features/admin/index.ts` is empty, nothing under
`src/` reads `is_staff`, and `GET /api/v1/identity/me/` does not return it. Every later
admin unit needs the same four pieces:

- the flag on `/me`;
- a server permission;
- a route guard;
- a place in the nav.

That covers `adm-teacher-onboarding`, `adm-families-and-subscriptions`,
`adm-sessions-and-teacher-change`, `adm-manual-match`, `adm-overview`,
`asm-admin-oversight`, `msg-moderation`, `cur-content-moderation`, `pay-payout-runs` and
`sched-teacher-no-show`. This unit builds the four pieces once, plus a seeded staff account
so e2e can drive them. It also records the owner's `dec-admin-surface` answer as an
ADR-0013 amendment. The answer: day-to-day staff work happens in the dashboard, and Django
admin is for break-glass and reference config only.

## User flow

1. A staff user signs in. The sidebar and the mobile drawer show a **Staff** entry.
2. Selecting it opens `/staff`. The page has a heading and one line saying staff tools
   appear here as they ship. No staff tool ships in this unit.
3. A non-staff user (student, parent or teacher) sees no **Staff** entry. If they type
   `/staff`, the guard replaces the URL with `/` and they land on Home. No error page is
   shown, and no staff content renders before the redirect.
4. A signed-out visitor who opens `/staff` goes to `/login`, through the existing `_authed`
   guard.

The dashboard guard only controls navigation. Each staff endpoint is protected by the
server permission (`IsStaff`). A stale cached `/me` can show the entry for up to its 60 s
`staleTime`, but it can never get a staff endpoint to answer.

## Data model delta

None. `is_staff` already exists on `identity.User` (migration 0001). The unit adds no
migration.

## API delta

- `GET /api/v1/identity/me/`, `PATCH /api/v1/identity/me/` and the login response all build
  their body in `_me_payload` (`kaleem/identity/api/views.py`). They gain
  `"is_staff": <bool>`, and `MeResponseSerializer` declares it for the schema. The change is
  additive: the previous dashboard bundle ignores the field.
- `PATCH /me/` still accepts only `full_name`. A body that carries `is_staff` changes
  nothing, and a regression test pins this.
- New `kaleem.platform.permissions.IsStaff` (DRF `BasePermission`). It allows the request
  only when the user is authenticated **and** `is_staff`. It behaves the same as DRF's
  `IsAdminUser`, but uses kaleem's "staff" vocabulary and gives the project one place to
  tighten the rule later. No endpoint uses it in this unit. The admin units add the
  consumers.

**Personal data (ADR-0023).** One boolean, the caller's own `is_staff`. It is needed to
render the staff section. It is kept for as long as the account exists, because it is an
existing column and nothing new is stored. Only the user sees it, on their own `/me`. The
seeded staff account is fixture data at `@kaleem.test`, and `seed_e2e` only creates it when
`DEBUG` is on.

## Frontend

- `Me` in `src/features/identity/schemas.ts` gains `is_staff?: boolean`. A missing value
  counts as not staff, so the dashboard fails closed.
- `src/features/admin/require-staff.ts` exports `requireStaff(context)`, re-exported from
  `src/features/admin/index.ts`. It reads `/me` through `ensureAuthed`. When `is_staff` is
  not `true`, it throws `redirect({ to: "/", replace: true })`.
- Routes:
  - `src/routes/_authed/staff.tsx` is the layout. Its `beforeLoad` calls `requireStaff`,
    and later admin units nest their pages under it.
  - `src/routes/_authed/staff/index.tsx` renders `StaffHomePage` from
    `src/routes/_authed/-pages/`, using `PageContainer` and `PageHeader`. It shows the
    heading and the "tools appear here" line. There is no loading, empty or error state of
    its own, because the guard has already resolved `/me`.
  - The URL is `/staff` rather than `/admin`, so that nobody confuses it with Django admin.
- Nav: `NavItem` gains `staff?: true`. `visibleNavItems(items, profiles, { isStaff })`
  hides a `staff` item unless `isStaff` is true, and the third argument defaults to not
  staff. `AppShell` passes `me?.is_staff === true`. Home still calls the function with two
  arguments, so Home shows no staff tile. `adm-overview` owns the staff Home section. The
  entry uses a `lucide-react` icon and comes last, after Account.
- Copy: `nav.staff` and `staff.title` / `staff.description` in `en` and `ar`. The Arabic is
  reviewed in `hg-arabic-review`'s batch, which holds this spec's closure but not its
  merge. Styles come only from existing primitives and tokens. RTL comes from logical
  properties already in those primitives.
- **Nav ordering with `ana-foundation`.** This unit merges after `ana-foundation`
  (`merge_after`), which restructures the nav and includes the staff entry point.
  `ana-foundation` cannot read `is_staff`, because this unit adds it. So the staff gate and
  `/me` flag are this unit's work, and they are fitted into whatever entry-point shape
  `ana-foundation` lands at freshness. If that shape already gates on a staff flag, this
  unit adopts it and drops its own `staff?: true`.

## Module boundaries

`identity` owns the flag and the seed. `platform` owns `IsStaff`, which imports only DRF,
so the `platform` forbidden contract `plat-module-scaffolds` writes still holds. On the
dashboard, `features/admin` imports `features/identity/queries` (`ensureAuthed`), the same
way `features/identity/require-auth.ts` does. No new events, and no import-linter contract
changes.

`assessment/services.py` `_sees_every_report_of` already reads `user.is_staff` directly. It
is a service-level visibility rule, not a view permission, so it stays as it is. Changing it
would be a refactor (D10).

## Out of scope

- Any staff tool, staff endpoint or staff Home section. Those belong to the `adm-*` units
  and `adm-overview`.
- Changes to Django admin or `DocsPermission`. `DocsPermission` could use `IsStaff`, but
  switching it is a refactor (D10).
- Granting or revoking staff from the dashboard. Staff accounts are made out of band
  (Django shell or Django admin break-glass).
- In-component role gates for the existing pages (ISSUES: `/availability` 403s for a
  parent).

## Test plan

Backend (pytest, written first):

- `/me` returns `is_staff: false` for an ordinary user and `true` for a staff user. The login
  response carries the same field.
- `PATCH /me/` with `{"is_staff": true}` leaves the user non-staff.
- `IsStaff` refuses anonymous and non-staff users and allows staff. This is tested directly,
  and through a throwaway `APIView` built with `APIRequestFactory`, where a non-staff user
  gets 403.
- `seed_e2e`:
  - the staff account exists, is verified, can authenticate, is `is_staff`, and holds no
    profile;
  - every other declared account is not staff;
  - reseeding resets an `is_staff` that drifted on a non-staff account.

Dashboard (vitest):

- `visibleNavItems` hides `staff` items by default and shows them with `isStaff: true`.
- `requireStaff` resolves for staff. It redirects to `/` for `is_staff: false` and for a
  missing `is_staff`.
- `AppShell` shows the Staff link only to staff.
- `Home` shows no staff tile even to staff.
- `StaffHomePage` renders its heading.
- The `parity` locale test covers `ar`.

e2e (Playwright, `e2e/staff.spec.ts`, budget 20 s):

- staff see Staff in the nav, open it, and see the heading with `aria-current`;
- a teacher and a parent see no Staff link, and opening `/staff` lands them on `/` without
  the staff heading.

`/staff` as `staff` joins the Arabic and reflow sweeps through `e2e/routes/admin.ts`. The
sweep's completeness check requires that entry.

## Open questions

None. `dec-admin-surface` is resolved (option 1). Nothing here touches children's data,
money or legal text.
