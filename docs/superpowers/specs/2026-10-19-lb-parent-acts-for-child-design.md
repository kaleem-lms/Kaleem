---
name: lb-parent-acts-for-child
phase: v1 (wave 2, scheduling stream)
modules: [scheduling (booking, availability), dashboard (booking, scheduling, matching)]
status: approved
created: 2026-10-19
closed: null
---

## Goal

Let a parent book for their child, and let a student who takes two subjects book both. Product
spec BR-06 says "a parent can fully manage any child's account". Today they cannot book for one.

At backend `origin/main` 2f13d53, `booking.claim_slot(actor, weekday, start_time, *, reference_date)`
names neither a student nor a subject (`booking.py:189`). It books for the actor's single ACTIVE
assignment. That causes three things, listed in ISSUES.md as "the C2 scoping cluster":

- A student with two ACTIVE assignments is refused with "Booking a weekly time is not yet
  supported for a student with more than one subject" (`_active_assignment`, `booking.py:103`).
- A parent cannot claim a weekly time, list slot options, see the active slot or see the quota.
  Every booking view calls `_require_student` on the caller's own profile (`api/views.py:62`).
  Only `end_slot`'s service check already admits a parent, and its view still refuses one.
- A parent cannot edit a child's weekly availability. Slot options and matching are both computed
  from that availability. ISSUES.md lists this as a missing feature: "Editing a child's real
  availability remains a genuine missing feature".

The fix is the one ISSUES.md names: a `student` and a `subject` parameter, plus parent
authorisation and a child picker. Quota follows **dec-multi-subject-quota = option 1**, answered
by the owner on 2026-10-19: one quota per student, shared across all their subjects. The quota
read is already per student (`services._consumed` filters by `assignment__student_id`), so the
count does not change. What changes is the order in which a shared quota is spent (see below).

## User flow

**Parent, on `/schedule`:**

1. A "Booking for" picker lists each linked child. It also lists "Me" when the parent has a
   student profile of their own. The picker is hidden when there is only one choice.
2. For the chosen child the page shows, in order:
   - that child's weekly availability editor (the same editor and time-zone bar as `/account`);
   - that child's quota counter;
   - one booking card per ACTIVE assignment, labelled with the subject and the teacher.
3. In a card, the parent picks a time from that child and teacher's shared free times, then
   confirms. The card switches to the active weekly time, with an "End" control. Sessions appear
   in the list below, which already shows a parent their children's sessions.
4. A child with no assignment yet shows only the availability editor and the line
   "Still looking for a teacher". Matching uses the same availability.

**Student with two subjects, on `/schedule`:** one booking card per subject. Each card books its
own weekly time.

**Quota shared across subjects (option 1):** one counter per student. When the student has more
than one subject, the counter adds "Shared across all subjects". Sessions are created in date
order across all of the student's weekly times until the cycle's allowance is spent.

For example, take four sessions a cycle and two weekly times, Saturday (Quran) and Monday
(Arabic). The cycle then gets Sat, Mon, Sat, Mon, and nothing after that. If one subject was
booked earlier in the cycle and already used all four, a newly booked subject gets its first
sessions at the next renewal. Its card says so. An active weekly time shows "Next session:
{date}", or, when it has none this cycle, "No sessions left this cycle. This time starts after
{cycle end}."

**Errors:**

- Acting for someone who is not your child gives 404 "Student not found." The response is the
  same whether the account exists or not.
- Naming a subject the student has no ACTIVE assignment in gives 404 "Assignment not found."
- Leaving out the subject when the student has two or more subjects gives 400 on `subject`:
  "Choose which subject this weekly time is for."
- The existing refusals are kept: no assigned teacher (403), already booked for this
  assignment (409), teacher already booked (409), and a time outside the shared window (400).

## Data model delta

None. There is no new model, field or migration. Expand/contract is satisfied: every API change
below is an optional parameter or an added response field. The previous dashboard bundle,
during the blue-green window, sends neither and gets today's behaviour.

The one exception is in that window. A **multi-subject** student on the old bundle used to get
their first slot from `GET slots/`; they now get a 400. They could not book before either.

**Personal data (ADR-0023).** Nothing new is stored.

- **What is read.** A parent now reads and writes their linked child's weekly availability and
  time zone, and reads the child's quota and active weekly times.
- **Why.** BR-06: a parent manages a child's account. Many children will never log in to book.
- **Who sees it.** The child, and any parent linked through `ParentStudent`. Nobody else: the
  check is `identity_services.is_parent_of`.
- **How long.** Unchanged. These rows live and are erased exactly as they are today.
- **Added field.** `GET assignments/` gains `student_id`, the child's user id. A parent already
  receives that id in `/me` `children[].id`.

## API delta

All routes stay under `/api/v1/scheduling/`. There are no new routes.

- **`student`** (optional) is a student's user id. It defaults to the caller.
- **`subject`** (optional) is a subject slug. It defaults to the student's only ACTIVE
  assignment.
- `(student, subject)` names at most one ACTIVE assignment, because of the
  `unique_active_assignment` constraint.

| Method | Path | Change |
| --- | --- | --- |
| `GET`, `PUT` | `me/availability/?student=` | With `student`: the child's availability and time zone. Without it: unchanged. |
| `GET` | `slot-options/?student=&subject=` | Options for that assignment. |
| `GET` | `slots/?student=&subject=` | That assignment's ACTIVE slot, or 404. Adds `next_session_at`: the slot's next SCHEDULED session, or null. |
| `POST` | `slots/` body `{weekday, start_time, student?, subject?}` | Claims that assignment's slot. |
| `DELETE` | `slots/{id}/` | A parent of the slot's student may end it. The service already allows this; the view stops refusing. |
| `GET` | `quota/?student=` | The child's quota, or 404 when the child has no entitlement. |
| `GET` | `assignments/` | Adds `student_id` to each row. |

**Authorisation is written once.** A new `booking.student_for(actor, student_id)` returns the
target user when the target is the actor, or a child linked to the actor through `ParentStudent`.
Every other case raises `NotFoundError`. A teacher is not authorised to act for their own
student here. Who may book is the family's decision.

When `student` is absent, the views keep today's profile gate (`_require_student`). When it is
present, the parent link is the gate.

**Service signatures** (keyword-only):

- `claim_slot(actor, *, student_id, subject_slug, weekday, start_time, reference_date)`
- `slot_options(actor, *, student_id, subject_slug, reference_date)`
- `get_active_slot(actor, *, student_id, subject_slug)`

All three resolve the assignment through `booking.resolve_assignment(actor, student_id,
subject_slug)`, which replaces `_active_assignment`. Callers that pass `student_id` include the
two seeds (`seed_e2e_matching`, `seed_load_scheduling`), which change in the same PR.

**Locks.** `claim_slot` used to lock the teacher's ACTIVE assignments. It now locks, in one query
ordered by `id`, every ACTIVE assignment of the teacher **or** the student. A multi-subject
student's assignments with *other* teachers are then held before `generate_sessions` re-locks
them, so the two never take overlapping rows in opposite orders. `generate_sessions`'s
per-student lock also gains `order_by("id")`.

**Generation order.** `generate_sessions` groups active slots by student. It merges their
occurrences in `(starts_at, slot id)` order and creates sessions until `remaining` reaches 0.
Today it loops slot by slot in database order, so whichever slot comes first takes the whole
allowance every cycle, and a second subject could get no sessions at all.

## Frontend

- **Routes.** No new route.
  - `/schedule` (student, parent, teacher): the parent view gains the child picker, a per-child
    availability card, a quota card and per-assignment booking cards. The student view gains one
    booking card per assignment. The teacher view does not change.
  - `/account` does not change.
- **Components** (`features/booking`):
  - `BookingPanel({ studentId })` renders the availability card (parent only), the quota card
    and a list of `ClaimSlotCard`s.
  - `ClaimSlotCard({ studentId, subjectSlug })` gains props.
  - `QuotaBadge({ studentId, sharedAcrossSubjects })` gains props.
  - `StudentPicker` is built on the existing `Select` primitive.
  - `StudentAvailabilityCard({ studentId? })` moves its query and mutation onto keys that
    include the student. It gets the unsaved-edit guard behaviour the `/availability` page
    already has (the sync is skipped while dirty).
- **States.** Every card keeps its existing loading skeleton, error alert and empty state. A
  parent with no children sees today's parent schedule. A child with no assignment sees
  "Still looking for a teacher".
- **API calls.** These go through `src/lib/api.ts` with `params`. Query keys gain
  `studentId` and `subjectSlug`, so two children's data never share a cache entry. A claim or
  end invalidates that student's options, slot, quota and the sessions list.
- **Copy.** New `booking.*` keys go into `en` and `ar` `common.json`, using "session" per
  dec-cur-terminology. The Arabic is drafted and then batched for **hg-arabic-review**, which
  holds this spec's closure, not its merge.
- **RTL, a11y, 320px.** The picker and cards use existing primitives and tokens only. The picker
  has a visible label. Each card's heading names the subject and the teacher, so two cards are
  told apart by their names, not by their position on screen.

## Module boundaries

`scheduling` owns all of this. It calls `identity.services` (`is_parent_of`, `get_children`,
`get_user`) and `billing.services` (`get_session_allowance`, through `get_quota`). Both edges
already exist. There is no new import-linter contract, event or ADR.

The e2e seed adds two lines to the backend seed manifest. On the dashboard, `features/booking`
reads assignments through `@/features/matching`'s public index, and the availability card is
reused from `features/identity`.

## Out of scope

- **A parent setting a child's subject interests.** This is a `curriculum` endpoint
  (`me/student-subjects/` is self-only), and a child gets no match request without it. Today the
  child sets their interests themselves. It goes into ISSUES.md as its own unit.
- Staff booking for a family (`adm-*`), rescheduling (`sched-reschedule`) and booking
  notifications (`ntf-booking-notifications`).
- A quota per subject or a plan per subject (rejected options 2 and 3).
- Concurrency tests with two threads. The lock change is pinned by a query-shape test, as C2
  left the claim race.

## Test plan

**Backend, in `kaleem/scheduling/tests/`. Each test is written first and mutation-checked.**

`test_booking_claim.py`:

- A parent claims for their child. The slot belongs to the child's assignment and the child's
  sessions are generated.
- A parent naming another family's child gets `NotFoundError`, and no slot row is written.
- A teacher naming their own student gets `NotFoundError`.
- A two-subject student claims each subject in turn, by slug, and ends up with two ACTIVE slots.
- A two-subject student who leaves out the subject gets `ValidationError` on `subject`. This
  replaces `test_a_student_with_two_active_assignments_cannot_claim_a_slot`.
- An unknown slug, or a subject with no ACTIVE assignment, gets `NotFoundError`.
- The claim lock is one `SELECT … FOR UPDATE`. It covers the teacher's and the student's
  assignments and is ordered by id, asserted with `CaptureQueriesContext`.

`test_booking_generation.py`:

- Two slots, a quota of 4 and five or more weeks in the cycle give sessions in date order,
  alternating between the subjects, with exactly four created. This is the mutation check for
  the per-slot loop, which gives four sessions to one subject.
- A second subject claimed after the first has spent the quota gets 0 sessions this cycle and
  gets them on the next cycle's run.

`test_booking_api.py`:

- These change from 403 to allowed: a parent may GET `slots/?student=`, may end a child's slot,
  may GET `quota/?student=`, may GET `slot-options/?student=&subject=`, and may claim with a
  `student` in the POST body.
- `test_a_parent_cannot_get_a_slot` keeps its no-parameter form and still gets 403.
- A cross-family `student` gets 404 on every endpoint above.
- `GET slots/` carries `next_session_at`, which is null once the quota is spent before the
  slot's first occurrence.

`test_api.py`:

- A parent's `me/availability/?student=` GET and PUT go round, with the time zone applied to
  the child.
- A stranger, or a teacher, naming that student gets 404.
- Without `student`, behaviour is unchanged.

`test_matching_api.py`: `assignments/` rows carry `student_id`.

`test_seed_e2e_family_booking.py`: the new seed converges and is idempotent.

**Dashboard (vitest):**

- `StudentPicker` lists the children and "Me", and is hidden with one option.
- `BookingPanel` renders one card per assignment of the chosen student.
- The query keys include the student, so switching child refetches and never shows the
  previous child's slot.
- `ClaimSlotCard` posts `student` and `subject`, and shows `next_session_at` or the
  "No sessions left this cycle" line.
- `QuotaBadge` shows "Shared across all subjects" only when the student has two or more
  assignments.
- The parent `StudentAvailabilityCard` sends `?student=`.
- Each negative assertion ("not shown") gets a positive control on the same locator.

**e2e (D3).** These run on new seeded accounts, so no existing flow's state is touched. Added
budget is about 40 s.

1. `booking.spec.ts`: a parent picks their child and claims a time. The child's counter moves
   off "0 of N used" and the slot is still there after a reload.
2. `booking.spec.ts`: a two-subject student books Quran and then Arabic, and sees two active
   times and "Shared across all subjects". The second card says "No sessions left this cycle",
   because the first claim spent the allowance. That asserts the option-1 consequence in a
   browser.
3. `availability.spec.ts`: a parent edits the child's availability, saves, reloads and still
   has the change.

The D3 row for `scheduling` (booking) gains these three. It states what is not covered: the
lock order, which is a unit test only, and cross-cycle generation, which is a unit test only.

## Open questions

None blocking. dec-multi-subject-quota was answered by the owner on 2026-10-19 (option 1). The
date-order spending of a shared quota, and the "a later subject waits for renewal" consequence
under User flow, follow from that answer. They are new product behaviour, so they are stated
here for the owner's approval of this spec.
