# kaleem Architecture Overview

## Module map

```mermaid
graph TD
    platform[platform<br/>cross-cutting utilities]

    identity[identity<br/>users, profiles, auth]
    billing[billing<br/>plans, subscriptions, stripe]
    scheduling[scheduling<br/>availability, matching, sessions, video]
    assessment[assessment<br/>reports, ratings, progress]
    curriculum[curriculum<br/>courses, lessons]
    content[content<br/>resources, files]
    messaging[messaging<br/>chat, messages]
    notifications[notifications<br/>in-app, email, push, reminders]
    engagement[engagement<br/>points, badges, streaks]
    analytics[analytics<br/>dashboards, aggregation]

    scheduling --> identity
    scheduling --> billing
    scheduling --> curriculum
    scheduling --> notifications
    billing --> identity
    billing --> notifications
    assessment --> notifications
    curriculum --> notifications
    content --> notifications
    assessment --> identity
    assessment --> scheduling
    curriculum --> identity
    curriculum --> content
    content --> identity
    messaging --> identity
    messaging --> scheduling
    messaging --> notifications
    notifications --> identity
    engagement --> identity
    analytics --> identity
    analytics --> scheduling
    analytics --> assessment
    analytics --> billing
    analytics --> engagement
```

## Boundary rules

1. No business module imports another module's models
2. All inter-module calls go through `<module>/services.py`
3. `analytics` is read-only — it never writes to other modules
4. `platform` is imported by all, imports from none
5. No circular dependencies at the module level
6. Enforced by `import-linter` in CI

## Current state

**Phase 0** — only `platform` module exists. All other modules are planned for later phases.

## Dashboard: the service worker and the offline copy

The dashboard registers a service worker (ADR-0065). It caches only the build's own files and never
answers an API request; updates wait for a tap and never happen in a call. The page keeps a small,
named-field copy of the signed-in person's upcoming lessons in Cache Storage, shown only on the
offline screen and wiped on sign-out, deletion, a lost session, an account switch, age and the kill
switch. `requireAuth` throws `OfflineError` instead of redirecting when there is no connection. Code:
`dashboard/src/sw/` (the worker), `src/lib/offline/` (projection and store), `src/lib/sw/register.ts`
(lazy registration), `src/features/shell/OfflineScreen.tsx`. Operating it: `docs/runbook/service-worker.md`.
