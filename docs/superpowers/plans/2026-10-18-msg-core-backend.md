---
spec: docs/superpowers/specs/2026-10-18-msg-core-backend-design.md
status: approved (owner, 2026-10-18)
---

The owner approved the spec and answered its open questions on 2026-10-18. Backend work in
`/home/abdulkhalek/Projects/kaleem-worktrees/backend-msg-core-backend` (runbook section 1),
meta work (ADR, docs) in `meta-msg-core-backend`, both on `feat/msg-core-backend`. Gates only
through `_tools/backend-gate.sh`. Every regression test is mutation-checked: revert the code
it guards, see red, restore.

## Steps

1. [ ] **Boundary probe and ADR.** In a scratch edit, add `from kaleem.scheduling import
   services` to `messaging/services.py` and run `lint-imports`; record which contracts break and
   through which edges. Write the ADR (number from the conductor): the edge, the mirror
   contract, the exact `ignore_imports`, and the port alternative. Change
   `backend/pyproject.toml`: drop `kaleem.scheduling` from "messaging imports no business
   modules except identity", add "messaging does not reach past scheduling's public API"
   (`forbidden_modules = ["kaleem.scheduling.models"]`, `allow_indirect_imports = true`).
   *Check:* `lint-imports` green; a scratch `from kaleem.scheduling.models import
   TeacherAssignment` in messaging turns it red.
2. [ ] **Models and migration.** Tests first in `messaging/tests/test_models.py`: duplicate
   `(kind, teacher, counterpart)` raises `IntegrityError`; duplicate `(chat, user)` membership
   raises. Then `models.py` per the spec and `makemigrations messaging` (`0001_initial`).
   *Check:* the gate's `makemigrations --check`.
3. [ ] **Access policy.** `messaging/policy.py`, pure functions over identity and scheduling
   reads: `is_minor(user, today)` (no birthdate → True; 18th birthday → False) and
   `access(user, chat, today) -> none | read | post`. Tests first in `test_policy.py`, the
   parametrized **access matrix** from the spec's test plan, plus the birthday boundary and the
   Open question 2c row as decided.
4. [ ] **Services.** `messaging/services.py`: `list_contacts`, `open_direct_chat` (get-or-create
   inside `transaction.atomic`, `IntegrityError` → re-read), `list_chats` (unread count by
   `Subquery`, one query for the page), `list_messages(before cursor | after id)`,
   `send_message` (trim, length, post rule, `last_message_at` in the same transaction),
   `mark_read` (monotonic, chat-scoped). Typed errors from `platform.exceptions`, never bare
   `except`. Tests first in `test_services.py`, including the `transaction=True` open race and
   `django_assert_max_num_queries` on `list_chats` for 20 chats.
5. [ ] **Pagination.** Test in `platform/tests/test_pagination.py` (pages of 30, no gap or
   repeat across a page boundary with an insert in between), then `NewestFirstCursorPagination`
   in `platform/pagination.py`.
6. [ ] **API.** `messaging/api/{serializers,views,urls}.py` per the spec's table. Settings: scope
   `chat-send` `30/minute` in `config/settings/base.py`, `1000/minute` in `local.py` (with the
   e2e comment pattern already there) and `test.py`. Tests first in `test_api.py`: every status
   code in the spec, unreadable id → 404 byte-identical to unknown, CSRF refused with
   `enforce_csrf_checks=True`, 429 under `override_settings` at the real rate, the
   `/api/v1/` versioning test still green.
7. [ ] **DSAR hooks.** `MessagingConfig.ready()` registers export and erase with
   `models=["messaging.Chat", "messaging.ChatMembership", "messaging.Message"]`. Test first:
   `assert_hooks_honour_contract("messaging", seed=..., make_user=..., assert_erased=...)`,
   where `seed` creates a counterpart teacher; `assert_erased` checks bodies are blank and the
   counterpart's messages are untouched.
8. [ ] **Full gate and hand-back.** `_tools/backend-gate.sh <wt>` green (coverage is read, the
   floor is never edited); `_tools/gitleaks-range.sh`; commit with explicit paths. Meta: the
   ADR, `docs/architecture/messaging.md` (models, access rule, endpoints, the four ADR-0023
   points), and the D3 row: "`messaging` — core: ❌ no UI until `msg-dashboard-ui`; access
   matrix in backend tests".

## Migrations

`messaging/0001_initial` only: three new tables, nothing altered. No data migration, so no
reseed fixture change. Safe under blue-green: the old colour never reads these tables.

## e2e

None (unit entry: "None; access matrix in backend tests"). There is no UI to drive; the first
e2e flows arrive with `msg-dashboard-ui`. e2e time budget: 0 s.

## Risks

- **Transitive contract break** through `scheduling.services -> billing.services`. Step 1
  measures it before any code; if more than the expected edges break, take the port
  alternative in the ADR instead, and escalate if that grows the unit.
- **Age logic is safeguarding logic.** The matrix is the guard; each row is mutation-checked.
  A wrong default (null birthdate as adult) would expose minors' chats with no parent view.
- **N+1 on the chat list** under polling. Bounded by the query-count test.
- **Erasure against safeguarding evidence.** Erase blanks the user's own messages; whether a
  reported thread must survive erasure is `msg-moderation`'s and counsel's call, noted in the
  ADR's consequences, not solved here.
- **Throttle in e2e.** A missing `local.py` override would 429 the later UI suite; step 6
  writes it in the same PR.

## Verification

Each step's tests red, then green, then mutation-checked. Whole unit: the full backend gate,
then CI on the PR. Staging click-through (step 11) has no UI to click; the conductor verifies
the endpoints on staging with two pool accounts through the browsable API instead.
