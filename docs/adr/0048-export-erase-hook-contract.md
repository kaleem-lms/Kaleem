---
number: 0048
title: Personal-data modules join one export/erase hook registry
status: proposed
date: 2026-10-18
---


## Context

ADR-0023 promised a data-subject-request flow before public launch. Two v1 units build
it: self-serve export (lb-gdpr-data-export) and account erasure (lb-gdpr-erasure). Eight
more units add personal data to new modules, children's data among it. If each unit
invented its own export and erase code, the export would silently miss modules and
erasure would leave data behind, and nothing would notice.

The constraints:

- Module boundaries are enforced (ADR-0001 and the import-linter contracts): `platform`
  imports no business module, and a business module may import `kaleem.platform`.
- Erasure follows lb-dec-erasure-semantics: anonymize in place. A cascade on deleting the
  user is not the method.
- Retention is a per-domain product decision. It must not be baked into a shared
  interface.

## Decision

`kaleem.platform.personal_data` holds a registry of **export** and **erase** hooks. Each
module that stores personal data fills it in its own PR.

1. **Filled at startup by the modules.** A module keeps its hooks in
   `kaleem/<m>/personal_data.py` and registers them from `AppConfig.ready()`. The
   registry never imports a module to find hooks, so the platform contract holds.
   Registering the same function twice is a no-op, because Django may call `ready()`
   more than once. A different function under a taken name raises `ImproperlyConfigured`.
2. **Two hook kinds, covered per model.** An export hook is read-only, deterministic and
   returns a JSON-serializable value. An erase hook removes or anonymizes one user's data
   and is idempotent, so a failed erasure can simply be retried. Each hook declares the
   model labels it covers as strings. A CI guard fails when a `kaleem.*` model is covered
   by no export hook and no erase hook, unless it is listed as not personal with a reason
   or its app is on a pending list that names the unit that removes it. The pending lists
   can only shrink.
3. **One transaction, outside work on commit.** `erase_user` runs every erase hook in a
   single `transaction.atomic()`. If any hook raises, every database change is rolled
   back. Hooks that touch outside systems (storage, Stripe) defer that work with
   `transaction.on_commit`, so a rolled-back erasure never touches them.
4. **Order.** Erase hooks run by ascending `order` (default 500), ties broken by name.
   Convention: identity's hook uses 900 and runs last, so other modules can still resolve
   relationships through identity's services while they erase.
5. **A contract helper.** `assert_hooks_honour_contract` in
   `kaleem.platform.personal_data_contract` lets a module's tests prove its pair of hooks
   obeys the rules above, including that erasing one user leaves another's export
   unchanged. A module that cannot meet a rule escalates; it does not loosen the helper in
   its own PR.
6. **Retention is outside the interface.** The registry says how data is exported and
   erased. How long data is kept, and the purge jobs that enforce it, belong to each
   module's retention unit.

## Alternatives considered

- **One hook per app instead of per model.** Simpler to write, but a new model in a module
  that already joined would be exported and erased by nobody, and no check could see it.
  Model-level coverage turns that into a red CI run.
- **`pre_delete` or `post_delete` signals on User.** Erasure here keeps the user row and
  anonymizes in place, so a delete signal never fires on the path that matters. Signals
  also hide ordering and make the rollback boundary implicit.
- **A cascade on deleting the user.** Rejected by lb-dec-erasure-semantics: records that
  must outlive a person (a lesson both sides took part in, a payment) would be destroyed
  or would block deletion.
- **A hard-coded list of modules in the platform.** Needs editing for every new module and
  would import business modules, breaking the platform contract.

## Consequences

- A foundation unit that adds a model must join the registry, or give a reason, in the
  same PR. The reviewer checks the reason.
- Adding a hook costs one small file and one `ready()` method per module.
- The registry is process-local state with no storage of its own and no endpoint. Nothing
  runs the hooks until lb-gdpr-data-export and lb-gdpr-erasure call the runners.
- Third-party apps (allauth's `EmailAddress`) are outside the guard, which only walks
  `kaleem.*` apps. Identity's hooks own those rows; `docs/architecture/platform.md` says so.
- Not covered by this decision: erasure of linked accounts (parent and child), Django
  admin `LogEntry` rows, sessions, logs and backups. Each belongs to lb-gdpr-erasure or a
  retention unit.
