---
number: 0057
title: Day-to-day staff work lives in the dashboard; Django admin is break-glass and reference config only
status: accepted
date: 2026-10-18
amends: ADR-0013
---

## Context

ADR-0013 put admin UX in the shared dashboard and kept Django admin as an internal
utility. It left one question open that the v1 admin units now need answered: when a
piece of staff work is small, is it acceptable to ship it in Django admin first? The
owner answered that question (`dec-admin-surface`): no. Ten later units
(`adm-teacher-onboarding`, `adm-families-and-subscriptions`, `adm-manual-match` and the
rest) each need somewhere to put their screens, and without a rule each would choose
for itself.

`adm-staff-shell` builds the common pieces: `is_staff` on `/me`, the `IsStaff` DRF
permission, a `/staff` route guard and a Staff nav entry.

## Decision

1. Day-to-day staff work happens in the dashboard, under `/staff`, going through each
   module's `services.py` like every other feature.
2. Django admin is for break-glass and reference configuration only. It is not where
   routine staff tasks are built, and it is not extended for them.
3. A new piece of configuration that is kept in Django admin needs its own ADR saying
   why the dashboard is the wrong place for it.
4. The dashboard's staff guard controls navigation only. Each staff endpoint is
   protected on the server by `kaleem.platform.permissions.IsStaff`, so the control
   holds when a client is stale or hand-built.

ADR-0013 stays accepted. This ADR narrows its "Django admin stays enabled but
internal-only" clause into the rule above.

## Alternatives considered

- **Ship small staff tools in Django admin first.** Cheapest per tool. Rejected for the
  reasons ADR-0013 gave, and because each tool built there is later rebuilt in the
  dashboard, so the saving does not last.
- **Leave it to each unit.** Rejected: ten units would produce several surfaces and
  several permission checks.
- **A separate staff app.** Rejected by ADR-0013: admin is one role view of the one
  dashboard.

## Consequences

Good:

- One place, one auth stack, one permission for staff work.
- A reviewer has a rule to check a staff unit against.

Bad / costs:

- Every staff tool needs a dashboard screen before it can be used, even a small one.
- Break-glass needs mean Django admin must stay restricted to staff; it is not a place
  to relax access.
