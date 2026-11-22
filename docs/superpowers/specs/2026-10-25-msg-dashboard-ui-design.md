---
name: msg-dashboard-ui
phase: v1 (wave 3, msg stream)
modules: [messaging]
status: approved
created: 2026-10-25
closed: null
---

## Goal

`/messages` is a placeholder (`MessagesPage` renders `ModulePlaceholder`). The backend for
direct chats has landed (`msg-core-backend`, backend `origin/main`, mounted at
`/api/v1/messaging/`). This unit builds the dashboard on it: a chat list, a thread, a
composer, read state, an unread badge in the nav that polls, and the read-only view a parent
gets of an under-18 child's chats. Transport is polling (ADR-0050, accepted). It is a
dashboard-only unit: no endpoint, model or migration changes.

Decisions applied: `dec-msg-visibility` option 1 and `dec-safeguarding-under-18` option 1
(parents read their under-18 child's chats and never post; parent access ends at 18; no
birthdate counts as under 18; an under-18 student with no linked parent cannot chat and
the contact shows `guardian_required`), `dec-msg-realtime` (polling first),
`dec-group-sessions-scope` (no group chats). The unit's merge waits for `msg-privacy-docs`
(the chat DPIA addendum) and `ana-foundation` (programme `merge_after`), so chat does not
reach real users before the DPIA is signed off.

## User flow

Every role sees **Messages** in the nav (as today). Opening `/messages`:

1. **List.** The caller's chats, newest activity first (`GET chats/`), each with the other
   person's name, a relative time of the last message, an unread count when above zero,
   and a "Read only" chip when `access` is `read`. A parent's list also holds their
   children's chats with teachers, titled "{teacher} · {child}". No chats: an empty state
   with the **New message** action, or, when there are no contacts either, a line saying
   chats open once a teacher is linked.
2. **New message.** A dialog lists contacts (`GET chats/contacts/`). Picking one with a
   `chat_id` goes to that chat. Picking one without opens it (`POST chats/` with `user_id`
   **and** `kind`, so the "contact two ways" 400 never happens) and goes to it. A contact
   with `blocked: "guardian_required"` is shown disabled with the reason: to a student,
   "Ask a parent to link your account to start chatting"; to a teacher, "{name} needs a
   linked parent before you can chat".
3. **Thread** (`/messages/$chatId`). The newest 30 messages (`GET chats/<id>/messages/`),
   oldest at the top, with **Load earlier messages** following the cursor. Each message
   shows its author (resolved from `author_id` against the caller, `counterpart` and
   `student` of the chat summary), the body as plain text with line breaks kept, and the
   time. An erased message (`erased: true`) reads "Message removed". When the summary says
   `parent_visible`, a notice at the top tells the members: to the student, "Your parent can
   read this chat"; to the teacher, "{student}'s parent can read this chat".
4. **New messages arrive** by polling `?after=<newest id held>` every 10 s while the tab is
   visible; `has_more` fetches again at once. Results merge by id, so a message is never
   shown twice. The view stays pinned to the bottom only if the reader was already there.
5. **Send.** `access: post` shows the composer (`Textarea`, a Send button, Ctrl/Cmd+Enter).
   The body is trimmed; empty is not sendable and over 4,000 characters shows the count and
   blocks sending. While the request runs the button is busy; on 201 the message is
   appended and the draft cleared. On failure the draft is kept and the error is chosen by
   `error_code`, never by message text: `throttled` "You are sending quickly; wait a moment",
   `permission_denied` the chat is re-fetched and turns read-only, `not_found` the
   unavailable state, `validation_error` the length message, anything else (or no response)
   "Couldn't send. Try again."
6. **Read state.** When the thread is on screen and the tab is visible, the caller's read
   pointer moves to the newest message held (`POST chats/<id>/read/`), only if it is newer
   than the last one sent and only for a member (`unread_count !== null`; a parent reading a
   child's chat has no pointer and the backend refuses the call). The list and the badge
   then refresh. On opening, a "New messages" divider sits above the first unread message,
   which is the oldest of the newest `unread_count` messages written by the other side.
7. **Read only.** `access: read` replaces the composer with a notice. For a parent reading a
   child's chat (`unread_count === null`): "You can read {child}'s chats with their
   teachers. Only they can send messages here." For a member whose link ended or whose
   student needs a guardian: "You can't send messages in this chat any more. Earlier
   messages stay here." with the guardian wording of step 2 when the matching contact is
   `guardian_required`.
8. **Not available.** A chat id the caller cannot read answers 404 exactly like an unknown
   one (backend rule); the thread shows "This chat isn't available" with a link back to the
   list. A non-numeric id shows the same state without a request.
9. **Badge.** The nav's Messages item shows the total unread count (sum of `unread_count`
   over `GET chats/?page_size=100`), polled every 30 s while the tab is visible, hidden at
   zero, "99+" above 99. Its accessible name is "Messages, {n} unread".

Errors loading the list or the thread show an inline error with **Try again**.

Layout: at `md` and wider, the list is a column beside the thread; below `md`, `/messages`
is the list and `/messages/$chatId` is the thread with a back link. Logical properties
throughout (RTL), 44 px targets, reflow at 320 px.

## Data model delta

None.

**Personal data (ADR-0023).** The UI stores nothing new. Message bodies, names and read state
are fetched from the endpoints above and held only in the React Query cache in memory for the
tab's life. No draft or message is written to `localStorage` (shared and family devices).
Who sees what is decided by the backend; the UI only renders what it is given. Retention is
the backend's (`dec-msg-retention`).

## API delta

None. Consumed, all relative to `VITE_API_URL` (`/api/v1/`), session cookie and CSRF via the
shared `api` client:

| Call | Used for |
| --- | --- |
| `GET messaging/chats/?page=&page_size=` | list (paged, "Show more"), badge (`page_size=100`, first page) |
| `GET messaging/chats/contacts/` | New message dialog; guardian wording |
| `POST messaging/chats/` `{user_id, kind}` | open (201 or 200) |
| `GET messaging/chats/<id>/messages/?cursor=` | history, newest first |
| `GET messaging/chats/<id>/messages/?after=<id>` | polling, ascending, `has_more` |
| `POST messaging/chats/<id>/messages/` `{body}` | send |
| `POST messaging/chats/<id>/read/` `{up_to_message_id}` | read pointer |

**Polling cost** stays inside ADR-0050's P1 envelope: the badge is one request per 30 s per
visible tab, the list adds one per 30 s only on `/messages`, and the thread one per 10 s only
while a thread is open. All pause while the tab is hidden (React Query's default).

**Expand/contract.** Frontend only; it calls endpoints already deployed. The previous bundle
never calls them.

## Frontend

- **Routes.** `src/routes/_authed/messages.tsx` becomes a layout route whose `loader` is
  `loadNamespace("messaging")` (as `curriculum.tsx`), with `messages.index.tsx` (list, empty
  state) and `messages.$chatId.tsx` (thread). All roles; the backend decides content.
- **Copy.** A new lazily loaded `messaging` feature catalogue (`src/locales/{en,ar}/
  messaging.json`, registered in `FEATURE_CATALOGUES`), loaded by the route above. The only
  new key in `common.json` is the badge's accessible name (`nav.messagesUnread`, plural
  forms), because the shell renders on every route. Arabic strings are drafts until
  `hg-arabic-review`.
- **Bundle.** Initial JS budget 580,000 bytes, about 572 KB used. The only code that reaches
  the initial chunk is the badge: a small hook and query function in
  `features/messaging/unread.ts`, imported **by path** from the shell, never through the
  feature barrel. The build's budget check must stay green without raising the budget.
- **Components** (`src/features/messaging/`): `ChatList`, `NewChatDialog`, `ChatThread`,
  `MessageItem`, `Composer`, `ReadOnlyNotice`, `ParentVisibleNotice`, plus `api.ts`,
  `queries.ts`, `schemas.ts` (TypeScript types of the payloads), `errors.ts` (the
  `error_code` to catalogue-key map). Primitives from `@/ui` only (`Textarea`, `Button`,
  `Dialog`, `EmptyState`, `Skeleton`, `StatusChip`, `Alert`), styles from tokens.
- **Shell.** `nav.ts` (a shared file) gains an optional `badge: "messages"` on the Messages
  item; `AppSidebar` renders the count for an item that has one.
- **States.** List and thread each have loading (skeleton), empty, error (retry), and loaded;
  the thread also has not available, read only, parent view, sending and send failed.
- **Done** = built, deployed to staging, and clicked through as teacher, student and parent
  in both themes, Arabic RTL and 320 px (`dec-d9-substitute`).

## Module boundaries

`dashboard/src/features/messaging` owns all of it. It reads `useMe` from
`features/identity` (the caller's id, to tell own messages from others). The shell imports
`features/messaging/unread.ts` by path. No backend module is touched.

## Out of scope

- **"Seen" receipts for the other side.** The API exposes only the caller's own unread count,
  not the counterpart's read pointer; showing "Seen" needs a backend field and is a
  follow-up (an `ISSUES.md` line). Receipts here are the caller's own: unread counts, the
  "New messages" divider and the pointer moving on view.
- An unread indicator on the mobile drawer's trigger (the badge is on the nav item).
- Attachments (`msg-attachments`), real-time push (`msg-realtime`), notifications
  (`msg-notifications`), reporting and unsend (`msg-moderation`), search, editing or
  deleting messages, group chats, drafts that survive a reload.

## Test plan

Unit (vitest, mocked `queries`/`api` as the matching feature does):

- list: rows, unread count, read-only chip, the parent's "{teacher} · {child}" title, empty
  with and without contacts, error with retry;
- new chat: existing chat navigates without a POST, a new one POSTs `{user_id, kind}`,
  `guardian_required` disabled with the role-specific reason;
- thread: oldest at top, load earlier, author labels for member and parent views, erased
  message, `parent_visible` notice per role, 404 and non-numeric id show not available;
- polling merge: `?after=` uses the newest id, merges without duplicates, re-fetches on
  `has_more`;
- composer: trims, blocks empty and 4,001 characters, clears on 201, keeps the draft and
  shows the right text for each `error_code` (`throttled`, `permission_denied`, `not_found`,
  `validation_error`, none);
- read: posted for a member when the newest id grows, never for `unread_count === null`,
  never twice for the same id; divider position from `unread_count`;
- badge: sums, hides at zero, "99+", accessible name; `nav.ts` badge field;
- i18n: the catalogue's parity and lazy-loader checks pass (existing tests, new file);
  `common.json` gains only the badge key.

e2e (`dashboard/e2e/messaging.spec.ts`, budget 40 s on CI), on seeded relationships
(`e2e.teacher` actively teaches `e2e.booked`, an under-18 student linked to `e2e.guardian`;
`e2e.family.teacher` teaches `e2e.multi`, who has no parent):

1. **Send and see after reload:** the teacher opens the chat with the booked student and
   sends a message; the student signs in, sees the unread badge, opens the chat, reads the
   message and replies; after a reload both messages are there and the badge is gone.
2. **Parent cannot post:** the guardian sees the child's chat titled with both names, reads
   the messages, has no composer and sees the read-only notice.
3. **Non-members refused:** `e2e.family.teacher` visits the first flow's chat URL and gets
   "This chat isn't available".
4. **Guardian required:** `e2e.family.teacher`'s New message dialog shows `e2e.multi`
   disabled with the reason.
5. **RTL:** the thread in Arabic: `dir="rtl"`, no sideways scroll at 320 px, axe clean in
   both themes. `/messages/$chatId` goes in `NOT_SWEPT` citing this flow; `/messages` is
   added to the sweep as student and parent too.

## Open questions

None blocking. Resolved owner decisions are listed in Goal. The out-of-scope "Seen" receipt
is this spec's reading of "receipts" in the unit summary; the owner confirms it with the
spec approval.
