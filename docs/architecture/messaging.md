# messaging — architecture

Direct chats between a teacher and a student, or a teacher and a parent. Text only. The
dashboard polls (ADR-0050); nothing here holds a socket.

**Describes backend `feat/msg-core-backend`** (unit `msg-core-backend`, written 2026-10-18).
A change to the module updates the section it touches in the same PR.

Spec: `2026-10-18-msg-core-backend-design.md` · ADRs: 0023 (personal data), 0048 (export and
erase hooks), 0050 (chat transport), 0055 (the messaging to scheduling edge). Product
decisions applied: `dec-msg-visibility`, `dec-safeguarding-under-18` (option 1 each),
`dec-msg-retention`, `lb-dec-erasure-semantics`.

## The four fixed fields

### Owns

Three tables in `kaleem/messaging/models.py`, migration `0001_initial`. No other module reads or
writes them. None is registered in the Django admin: staff reads arrive audited, in
`msg-moderation`.

- **Chat**: `kind` (`student_teacher` or `parent_teacher`), `teacher`, `counterpart` (the
  student or the parent), `created_at`, `last_message_at`. Unique on `(kind, teacher,
  counterpart)`: the pair is the identity, so opening is get-or-create. Never deleted when an
  assignment ends; it becomes read-only, which is a rule, not a column.
- **ChatMembership**: `chat`, `user`, `last_read_message_id` (an id, not a foreign key; `0` is
  "nothing read"; it only moves forward). Two rows are written with each chat. Unique on
  `(chat, user)`. A parent who reads a child's chat has no row and no pointer.
- **Message**: `chat`, `author`, `body` (database check: at most 4,000 characters),
  `created_at`, `erased_at`. Never edited. Index `(chat, -id)` serves both history and polling.

### Public API

`kaleem.messaging.services`. It returns frozen DTOs (`Contact`, `ChatSummary`, `MessageInfo`,
`Person`), never models, except `open_direct_chat` and `readable_messages`, which the module's
own views use. Other modules do not call it yet; `msg-notifications` and `msg-moderation` will.

| Function | Does |
| --- | --- |
| `list_contacts(user)` | who `user` may open a chat with, with the chat id or `None`, and `blocked="guardian_required"` for an under-18 student with no linked parent |
| `open_direct_chat(user, other_user_id, kind=None)` | get-or-create; `(chat, created)`. `kind` only when one person is a contact two ways |
| `list_chats(user, chat_id=None)` | the user's chats plus their under-18 children's, newest first, with `access`, `parent_visible` and `unread_count` |
| `get_access(user, chat_id)` | `Access.READ` or `Access.POST`; anything else is `NotFoundError` |
| `readable_messages(user, chat_id)` | an authorised queryset for cursor paging |
| `messages_after(user, chat_id, after_id)` | polling: newer messages, ascending, at most 100, plus `has_more` |
| `send_message(user, chat_id, body)` | needs `Access.POST` |
| `mark_read(user, chat_id, up_to_message_id)` | members only; forward only; another chat's id is ignored |

Every one of them answers a chat the caller may not read exactly like an unknown id
(`NotFoundError`), so existence cannot be probed. Age-dependent functions take an optional
`today` so the 18th-birthday boundary is testable.

### Depends on

- `identity.services`: `get_users`, `get_children`, `get_parent_user_ids` and the batch
  `get_parents_of_students` (added by this unit), for birthdates and parent links.
- `scheduling.services`: `active_assignments(user, role=...)`, for who is actively linked to
  whom. The edge is ADR-0055. The import-linter contract names the one transitive edge it
  tolerates (`scheduling.services -> billing.services`) and a mirror forbids
  `scheduling.models`.
- `platform`: `exceptions`, `pagination` (`NewestFirstCursorPagination`, new, for history),
  `personal_data`.

### Depended on by

Nothing yet.

## The access rule

`kaleem/messaging/policy.py` is pure functions over facts that `services` has already looked
up in batches, so each branch is one table row in `tests/test_policy.py`.

- A **member** reads their chat for good and posts while the link holds. The link is an
  ACTIVE teaching assignment between the pair (`student_teacher`), or between the teacher and
  any of the parent's children (`parent_teacher`). Once it ends the chat is read-only for both
  members, history intact.
- A student **under 18 with no linked parent** cannot chat: the chat is read-only for both
  until a parent links, opening is refused, and contacts show `guardian_required`.
- A **linked parent of a student under 18** reads that student's chat and never posts. From
  the student's 18th birthday the parent reads nothing, history included. A parent's
  read access follows age, not only the link.
- **Under 18** is evaluated per request from `User.birthdate`. No birthdate counts as under
  18. The 18th birthday itself is an adult; a 29 February birthday turns 18 on 1 March in a
  year with no 29 February.
- Anyone else, staff included, reads nothing.

## API surface

Mounted at `/api/v1/messaging/`. Session auth and CSRF as everywhere; an anonymous caller gets
the project-wide 403.

| Method and path | Result |
| --- | --- |
| `GET chats/` | `{id, kind, access: post\|read, counterpart:{id,name}, student:{id,name}\|null, parent_visible, unread_count\|null, last_message_at}`, page-number paginated |
| `GET chats/contacts/` | `[{user_id, name, kind, chat_id\|null, blocked: null\|"guardian_required"}]` |
| `POST chats/` `{user_id, kind?}` | 201 new or 200 existing; 403 not a contact or blocked; 400 ambiguous without `kind` |
| `GET chats/<id>/messages/` | cursor page, newest first; with `?after=<id>`, ascending with `has_more` (at most 100) |
| `POST chats/<id>/messages/` `{body}` | 201; 403 read-only or a parent; 400 empty or over 4,000 characters after trimming; 429 |
| `POST chats/<id>/read/` `{up_to_message_id}` | 204; 403 for a reading parent |

404 is both "unknown chat" and "a chat you may not read", with bodies that differ only in the
id; a bad `after`, body or message id on such a chat is still 404, never 400. Sending is
throttled by scope `chat-send`: 30 per minute per user in `base.py`; `local.py` (e2e) and
`test.py` raise it.

## Personal data (ADR-0023)

- **What:** message bodies, who wrote them and when, chat membership, read positions.
- **Why:** lesson-related communication between a teacher and a family.
- **How long:** until `msg-retention` purges at assignment end plus 12 months
  (`dec-msg-retention`). This unit stores no field for that: the end date is scheduling's.
- **Who sees it:** the two members; a linked parent of an under-18 student, read-only;
  nobody else through this API.

Registered from `MessagingConfig.ready()` as `messaging.chats` (ADR-0048). Export returns the
person's own chats (id, kind, created) and the messages they wrote. Erase blanks the body of
the person's messages and sets `erased_at` (once; a second erase keeps the first time),
resets their read pointers, and leaves the thread for the other member.

## Tests

- `test_access_matrix.py`: every caller by every chat by list, read, post and mark-read, plus
  open, through the real endpoints on real rows around the 18th birthday. This is the
  end-to-end substitute until the Messages UI exists; there is no e2e flow.
- `test_policy.py`, `test_services.py`, `test_api.py`, `test_personal_data.py`,
  `platform/tests/test_pagination.py`, and a settings test for the throttle override.
- Every regression test was mutation-checked against the code it guards.

## Not here

Attachments, push, notifications, reports, staff reads, unsend, the purge, group chats,
editing, and the privacy notice. The Messages UI is `msg-dashboard-ui`.
