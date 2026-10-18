---
name: msg-core-backend
phase: v1 (wave 2, msg stream)
modules: [messaging]
status: approved (owner, 2026-10-18)
created: 2026-10-18
closed: null
---

## Goal

Families and teachers have no way to write to each other in kaleem. This unit builds the
backend of **direct chats**: a `Chat`, a membership row per participant with a read pointer,
and `Message`. It covers opening a chat, listing chats and messages, sending, marking read,
and the export/erase hooks. There is no UI here; `msg-dashboard-ui` builds it.

Who may chat, who may read, and when a chat becomes read-only all come from the scheduling
read API (`ana-scheduling-read-api`) and identity. Transport is polling (ADR-0050, accepted):
the dashboard polls the endpoints below, and no socket is involved.

Decisions this spec applies: `dec-msg-visibility` and `dec-safeguarding-under-18` (both
**resolved 2026-10-18**, option 1 each, see Resolved decisions), `dec-msg-retention` (assignment plus 12 months, purged by
`msg-retention`), `dec-group-sessions-scope` (group chats stay deferred),
`lb-dec-erasure-semantics` (anonymize in place).

## User flow

Read as the API's behaviour. "Linked" means `identity.services.is_parent_of`. "Active link"
means an ACTIVE `TeacherAssignment` between teacher and student, in any subject.

1. **Contacts.** A student sees their actively linked teachers. A teacher sees their actively
   linked students and those students' linked parents. A parent sees the teachers actively
   linked to any of their children. Each contact carries the existing chat id or null.
2. **Open.** Either side opens a chat with a contact. It is get-or-create: one student/teacher
   chat per pair, one parent/teacher chat per pair. Opening with anyone not in the contacts
   list is refused (403).
3. **Send.** A member posts plain text, 1 to 4,000 characters after trimming. Refused (403)
   when the active link is gone: the chat is then **read-only** for both members and keeps its
   history. A parent/teacher chat stays writable while the teacher actively teaches any of the
   parent's linked children.
4. **Read.** Members read their chat. **A linked parent of an under-18 student reads that
   student's chats with teachers and cannot post in them** (`dec-msg-visibility` option 1,
   `dec-safeguarding-under-18` option 1). Age is evaluated at request time from
   `User.birthdate`; **a student with no birthdate counts as under 18**. When the student turns
   18, parent read access ends, history included. Every chat payload tells the student whether
   it is parent-visible, so the UI can say so.
5. **Unread.** Each member has a read pointer that only moves forward. The chat list carries an
   unread count of the other side's messages above the pointer. A parent reading a child's chat
   moves no pointer.
6. **Polling.** `GET .../messages/?after=<id>` returns newer messages, ascending, at most 100,
   with `has_more`. History pages backwards with an opaque cursor.

Errors: unauthenticated (the project-wide 403, as in every other module); 403 not a contact, not a member, read-only, or a parent posting;
404 unknown chat **and** a chat the caller may not read (no existence leak); 400 empty or too
long; 429 send throttle.

## Data model delta

All new, in `messaging` (migration `0001_initial`, additive only):

```text
Chat                         ChatMembership                 Message
  id                           id                             id (ordering key)
  kind  student_teacher |      chat  FK Chat                  chat    FK Chat
        parent_teacher         user  FK User                  author  FK User
  teacher      FK User         last_read_message_id  int ≥0   body    text (≤ 4,000)
  counterpart  FK User         created_at                     created_at
    (the student or parent)    UNIQUE (chat, user)            erased_at  null
  created_at                   INDEX (user)                   INDEX (chat, -id)
  last_message_at  null
  UNIQUE (kind, teacher, counterpart)
```

Two membership rows are written with each chat. User FKs are `CASCADE`, as in scheduling.
No model is registered in the Django admin (staff reads arrive audited, in `msg-moderation`).

**Personal data (ADR-0023).** *What:* message bodies, who wrote them and when, chat
membership and read positions. *Why:* lesson-related communication between a teacher and a
family. *How long:* until `msg-retention` purges at assignment end plus 12 months
(`dec-msg-retention`); this unit stores no extra field for that, since the end date is
scheduling's. *Who sees it:* the two members; a linked parent of an under-18 student, read-only;
nobody else through this API. **Export** returns the user's chats (id, kind, created) and the
messages they wrote. **Erase** blanks the body of the user's messages, sets `erased_at` and
resets their read pointers; the thread stays for the other member.

## API delta

Mounted at `/api/v1/messaging/` (already in `config/api_router.py`). Session auth and CSRF as
everywhere.

| Method and path | Who | Result |
| --- | --- | --- |
| `GET chats/` | any | chats the caller is a member of, plus parent-readable ones; `{id, kind, access: post\|read, counterpart:{id,name}, student:{id,name}\|null, parent_visible, unread_count\|null, last_message_at}`, newest first, page-number paginated |
| `GET chats/contacts/` | any | `[{user_id, name, kind, chat_id\|null, blocked: null\|"guardian_required"}]` (`blocked` per Open question 2c) |
| `POST chats/` `{user_id}` | contact | 201 new or 200 existing chat |
| `GET chats/<id>/messages/` | member, reading parent | cursor page, newest first; or `?after=<id>` ascending with `has_more` |
| `POST chats/<id>/messages/` `{body}` | member with an active link | 201 message; throttle scope `chat-send` |
| `POST chats/<id>/read/` `{up_to_message_id}` | member | 204; never moves backwards |

Message: `{id, author_id, body, created_at, erased}`.

Throttle `chat-send`: `30/minute` per user in `base.py`, raised in `local.py` (e2e) and
`test.py`; the real limit is tested with `override_settings`.

`platform/pagination.py` gains `NewestFirstCursorPagination` (DRF `CursorPagination`,
ordering `-id`, page size 30, max 100). Nothing else uses it yet.

**Expand/contract.** New tables and new routes only. The previous dashboard bundle never calls
them, so the blue-green window is safe.

## Frontend

None in this unit. `msg-dashboard-ui` builds the Messages UI on these endpoints.

## Module boundaries

`messaging` owns all of it. It calls `identity.services` (`get_children`, `is_parent_of`,
`get_parent_user_ids`, `get_users`) and, new, **`scheduling.services`** (`active_assignments`
for contacts, `is_active_teacher_of` for the post rule). The new edge gets an ADR (number from
the conductor): it removes `kaleem.scheduling` from messaging's forbidden list, adds a mirror
contract forbidding `kaleem.scheduling.models` with `allow_indirect_imports`, and ignores
exactly the transitive edges the probe finds (`scheduling.services -> billing.services` is
expected). The alternative, widening the `platform.teaching` port with a `teacher_ids_of`, is
recorded there. No events; notifications are `msg-notifications`.

DSAR hooks register from `MessagingConfig.ready()` (ADR-0048).

## Out of scope

Attachments (`msg-attachments`), real-time push (`msg-realtime`), notifications
(`msg-notifications`), reports, staff reads and unsend (`msg-moderation`), the purge
(`msg-retention`), group chats (deferred), editing or deleting messages, assignment history in
scheduling (`msg-retention` needs the end date; this unit needs only "active now"), and the
privacy notice (`msg-privacy-docs`).

## Test plan

- **Access matrix** (the e2e substitute, per the unit entry): one parametrized test over
  caller × chat × action, with rows for student, teacher, linked parent of a 17-year-old, of a
  student whose 18th birthday is today, of a student with no birthdate, unlinked parent, other
  teacher, staff, and both members after the assignment ends. Actions: list, read, post, mark
  read, open.
- Open is idempotent and refuses non-contacts; the unique constraint holds under a race
  (`transaction=True`).
- Send: trims, rejects empty and 4,001 characters, updates `last_message_at`, 429 at the real
  rate.
- Polling: `after` returns only newer, ascending, capped at 100 with `has_more`; history cursor
  pages without gaps or repeats.
- Read pointer never moves back, ignores another chat's id, and unread counts only the other
  side.
- 404 for an unreadable chat id, identical to an unknown one.
- CSRF enforced on a POST (`enforce_csrf_checks=True`).
- DSAR: `assert_hooks_honour_contract("messaging", ...)` and the platform coverage guard.
- Query count bounded on `GET chats/` for 20 chats.

## Resolved decisions

The owner approved this spec on 2026-10-18 and accepted both decisions exactly as the flows
above read them. Nothing is open.

1. **`dec-msg-visibility` option 1:** student/teacher and parent/teacher chats; parents read
   their child's chats and do not post in them.
2. **`dec-safeguarding-under-18` option 1, as applied to chat:**
   a. parent read access follows **age**, not just the link: a parent of an 18+ student does
      not read that student's chats, history included;
   b. a missing birthdate counts as under 18 (children created by a parent have none today);
   c. **an under-18 student with no linked parent** cannot chat until a parent links: the
      contacts list shows the teacher with `blocked: "guardian_required"`, opening is
      refused (403), and an existing chat of such a student is read-only for both members.
      The invite flow already exists;
   d. counsel input is not a gate on this unit; counsel reviews the chat DPIA in
      `msg-privacy-docs`.

## Build notes

Details fixed while building, none of which changes the flows above.

- `POST chats/` takes an optional `kind` beside `user_id`. One person can be a contact in
  two ways (a teacher who teaches the caller and also teaches the caller's child); without
  `kind` that case answers 400 and asks for it.
- Parent-visibility needs "who are this student's parents" for many students at once, or the
  teacher's chat list is one query per student. `identity.services` gains one batch read,
  `get_parents_of_students(student_user_ids)`, beside `get_parent_user_ids`.
- Message `body` is blanked (not deleted) on erasure; `erased` in the payload tells the UI.
- An anonymous caller gets the project-wide 403, not the 401 the first draft named: the API
  uses session authentication, which has no `WWW-Authenticate` challenge, and every other
  module answers 403.
- A bad input on a chat the caller cannot read (a malformed `after`, an empty body, a missing
  message id) is 404, never 400: authorisation runs before validation, so a 400 cannot tell
  a stranger the chat exists.
- Messaging's tests build teaching links with the models of identity, scheduling and
  curriculum, so the contracts exempt `kaleem.messaging.tests.*` from exactly those three,
  as scheduling's and assessment's tests are. ADR-0053 records it.
- A minor with no linked parent who somehow has a chat (a parent link removed later) keeps
  the history and cannot post, for both members.
