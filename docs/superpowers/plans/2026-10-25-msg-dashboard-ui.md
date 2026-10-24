---
spec: docs/superpowers/specs/2026-10-25-msg-dashboard-ui-design.md
status: approved
---

Repos: `dashboard` only (worktree `/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-msg-dashboard-ui`,
branch `feat/msg-dashboard-ui` off `origin/main`, runbook section 1) and meta docs in
`meta-msg-dashboard-ui`. No backend change, no migration, no dependency change, no new env
var. TDD loop: `_tools/dashboard-gate.sh <WT> <test file>`; every step writes its test first
and sees it red.

## Steps

1. [ ] **Catalogue and routes.** Tests first: extend `src/lib/i18n-namespaces.test.ts`
   with a case that the `/messages` layout loader resolves `loadNamespace("messaging")`
   (as the curriculum case does); the existing parity, terminology and static-import tests
   pick up the new files without edits. Then add `src/locales/{en,ar}/messaging.json`, the
   `messaging` line in `FEATURE_CATALOGUES`, turn `src/routes/_authed/messages.tsx` into a
   layout (`loader`, `Outlet`) with `messages.index.tsx` and `messages.$chatId.tsx`; run
   `pnpm build` once to regenerate `routeTree.gen.ts` and commit it. Delete
   `-pages/MessagesPage.tsx`; keep `modules.messages.*` in `common.json` (`Home.tsx` reads
   the description).
2. [ ] **API layer.** `features/messaging/schemas.ts` (types of Chat, Contact, Message,
   the two page shapes), `api.ts` (the seven calls of the spec table), `errors.ts`
   (`error_code` to key). Tests first in `api.test.ts`: paths and bodies (`open` sends
   `kind`), `messagesAfter` passes `after`, `history` passes the cursor; `errors.test.ts`:
   each of `throttled`, `permission_denied`, `not_found`, `validation_error`, an unknown
   code and a network error maps to its key, reading `parseApiError(...).code`.
3. [ ] **Badge.** Tests first: `features/messaging/unread.test.tsx` (sum over
   `unread_count`, null as 0, `refetchInterval` 30 000, `page_size=100`), `nav.test.ts`
   (the Messages item carries `badge: "messages"`), `AppSidebar.test.tsx` (count shown,
   hidden at 0, "99+", accessible name from `nav.messagesUnread`). Then `unread.ts`, the
   `badge` field in `nav.ts`, the render in `AppSidebar.tsx`, the plural key in both
   `common.json` files. Import `unread.ts` by path from the shell.
4. [ ] **Chat list and New message.** Tests first (`ChatList.test.tsx`,
   `NewChatDialog.test.tsx`, mocked `queries`): rows, unread, read-only chip, the parent's
   "{teacher} · {child}" title, both empty states, error + retry, "Show more" paging;
   existing chat navigates with no POST, new chat POSTs `{user_id, kind}` then navigates,
   `guardian_required` disabled with the student and the teacher wording. Then
   `queries.ts` (`useChats` infinite by page, `useContacts`, `useOpenChat` invalidating the
   list), the components and `messages.index.tsx`.
5. [ ] **Thread read path.** Tests first (`ChatThread.test.tsx`, `useThread.test.tsx`):
   oldest at top, Load earlier follows `next`, author labels for a member and for a parent
   view, erased message, `parent_visible` notice per role, 404 and a non-numeric id show
   not available, polling asks `after=<max id>`, merges without duplicates and re-fetches on
   `has_more`, interval 10 000, stays pinned only when at the bottom. Then `useThread`
   (history infinite query plus the polling query, merged by id), `ChatThread`,
   `MessageItem`, `ParentVisibleNotice`, `messages.$chatId.tsx`, and the two-column layout
   at `md`.
6. [ ] **Composer and read-only.** Tests first (`Composer.test.tsx`,
   `ReadOnlyNotice.test.tsx`): trims, empty not sendable, 4,001 blocked with the count,
   Ctrl/Cmd+Enter sends, busy while pending, cleared and appended on 201, draft kept and the
   right message for each `error_code`, `permission_denied` refetches the chat; read-only
   shows the parent wording for `unread_count === null`, the ended-link wording, and the
   guardian wording when the contact is `guardian_required`. Then the components and
   `useSendMessage`.
7. [ ] **Read pointer and divider.** Tests first (`useMarkRead.test.tsx`): posts the newest
   id for a member when it grows and the tab is visible, never for `unread_count === null`,
   never twice for the same id, invalidates the list and the badge; divider sits above the
   oldest of the newest `unread_count` messages from the other side. Then the hook.
8. [ ] **a11y and RTL in unit tests.** `jest-axe` cases in `ChatList.test.tsx` and
   `ChatThread.test.tsx`, LTR and RTL (`DirectionProvider`, as `src/test/a11y.test.tsx`
   does); the thread is `role="log"`; every control is reachable by keyboard.
9. [ ] **e2e.** `e2e/messaging.spec.ts`, the five flows of the spec's test plan, using
   `login()` from `fixtures.ts` and accounts already seeded (`teacher`, `booked`,
   `guardian`, `familyTeacher`, `multi`). Each message body
   carries a unique suffix (seeded messaging rows are not pruned between local runs). Add
   `/messages` as `student` and `guardian` to `e2e/routes/messaging.ts`, and
   `/messages/$chatId` to `NOT_SWEPT` citing flow 5. Mutation-check flows 1 to 3: break the
   merge-by-id, render the composer for `access: read`, and render the thread on a 404, and
   see each go red.
10. [ ] **Docs (meta worktree).** `docs/architecture/messaging.md` gains a Frontend section;
    `docs/developer-guide/i18n.md`'s namespace table gains `messaging`; the CLAUDE.md D3 e2e
    table gains the `messaging` row stating what it does and does not cover; an `ISSUES.md`
    line for the counterpart "Seen" receipt.
11. [ ] **Hand-back.** `git merge --no-edit origin/main` (never rebase), full
    `dashboard-gate.sh`, the five runbook section 3 checks, and the hand-back block. No floor
    edit (`dec-floor-ownership`).

## Risks

- **Initial bundle (about 8 KB headroom).** The badge is the only code in the entry chunk.
  If the budget check fails, the fix is to shrink what the shell imports (by-path import,
  no barrel, no date library), never to raise the budget; still red twice, escalate.
- **Polling merge bugs** (a duplicate or a gap between history and `?after=`). The merge is
  keyed by id and tested on its own; e2e flow 1 reloads to prove persisted order.
- **Shared file `nav.ts`.** Other units edit it; the change is one optional field and one
  property on one item, merged by hand at freshness.
- **Catalogue conflicts** at freshness are resolved by script (i18n guide rule 4).
- **Seed drift.** The e2e flows rely on `e2e.teacher` actively teaching `e2e.booked` (no
  birthdate, linked to `e2e.guardian`) and `e2e.multi` having no parent. If a later unit
  changes either, the flows fail loudly, not silently.
- **Arabic copy** is a draft until `hg-arabic-review`; that holds spec closure, not merge.
- **Merge order.** The conductor holds the merge until `msg-privacy-docs` and
  `ana-foundation` have landed (`merge_after`).

## Verification

- Each step: its new test red before the code, green after; the mutation checks of step 9.
- Whole: full `dashboard-gate.sh` (tsc, lint, `test:coverage`, build with the bundle
  budget, built-CSS check) green; CI e2e log lists `messaging.spec.ts` and the sweep and
  reflow entries; staging click-through as teacher, student and guardian in both themes,
  Arabic and 320 px (`dec-d9-substitute`).
