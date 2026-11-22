---
name: eng-points-levels
phase: v1 (wave 4, engagement stream)
modules: [engagement]
status: approved
approved: 2026-11-22
created: 2026-11-22
closed: null
---

## Goal

Give students points for lessons they actually had, and a level computed from those points.
This is the first gamification piece in the roadmap (Phase D2: "Points ledger", "Levels
(computed from points)"), and the first real subscriber on the event bus (ADR-0063). Streaks,
badges, leaderboards and the dashboard card build on it later (`eng-streaks`, `eng-badges`,
`eng-leaderboards`, `eng-dashboard-ui`).

The unit adds an append-only points ledger, a level table, one event handler, one read
endpoint, and the personal-data hooks. Engagement is a scaffold today: it has no models, no
routes and no migrations.

**The owner approved this spec on 2026-11-22** and answered all seven open questions as
recommended, which also answers `dec-eng-audience-points` (students only). The answers are
recorded under **Decisions** at the end. Points are about students, and many students are
children, so the rules on what earns points and who sees them are product decisions, not
implementation details.

Read for this spec: backend `origin/main` e543505 (`eng-event-bus-publish` and
`pay-earnings-ledger` merged) and meta `origin/master` 414752c.

## User flow

No screen ships here. The dashboard card is `eng-dashboard-ui`.

1. **A teacher closes a lesson out as delivered.** That is `complete_session`, outcome `held`.
   The close-out publishes `scheduling.session_completed` (`booking._close_out` step 8). After
   it commits, the worker delivers it to `engagement.points_lesson_delivered`. That handler
   writes one ledger line for the student: reason `lesson_delivered`, amount
   `POINTS_PER_DELIVERED_LESSON` (10, see Q3).
2. **Nothing is earned for** `student_absent`, any cancellation, or an event version the
   handler does not know. Points count delivered lessons only (`dec-lesson-outcomes`,
   answered). The handler does not subscribe to `scheduling.session_cancelled`.
3. **A lesson earns once.** This holds however many times its event is delivered: a retry, a
   double beat dispatch, a sweep, `replay_events`, or a second event for the same lesson.
   `HandledEvent` covers the first four. A unique key on `(reason, source_id)` covers the
   last.
4. **A student asks for their state.** `GET /api/v1/engagement/me/` returns their total, their
   level, and the next level's threshold. A user with no student profile gets 403
   `permission_denied`. Nobody can read another person's points through this endpoint.
5. **A student whose user row is gone.** An event can still name a hard-deleted user, because
   seeds delete users and the log has no foreign key. The handler logs a warning and records
   nothing. It does not raise, so the sweep does not retry it every 10 minutes for a day.

Errors: if the handler raises, its own transaction rolls back (both the line and the
`HandledEvent` row) and the bus retries it. The close-out is never affected, because it
committed before delivery.

## Data model delta

There are two migrations. Their numbers are allocated by the conductor, and engagement has
none yet. `engagement/0001` creates two new tables. `engagement/0002` seeds the levels with
`update_or_create`, following `curriculum/0002_seed_subjects`. Both are additive: the old
release never reads these tables, so they are safe in the blue-green window. No backfill
migration (see Q7).

```
User 1──* PointsEntry                          LevelDefinition (reference data)
  student      FK User, CASCADE                  number      PositiveSmallInteger, UNIQUE
  reason       char, choices: lesson_delivered   min_points  PositiveInteger, UNIQUE
  source_id    PositiveBigInteger (lesson id)
  amount       PositiveInteger, CHECK > 0
  occurred_at  datetime (the event's occurred_at)
  created_at
  UNIQUE (reason, source_id)
  INDEX (student)
```

- **The ledger is append-only.** No code path updates or deletes a line, except the erase
  hook. A total is always `SUM(amount)` at read time. There is no cached counter, so it
  cannot race.
- **`source_id` is a plain integer, not a foreign key.** Engagement may not import scheduling
  (import contract), and the line must survive the session row, which seeds delete. Postgres
  never reuses an id.
- **The line holds the student and the lesson id, and nothing about the teacher**: no
  subject, no time beyond `occurred_at`.
- **`CASCADE` on `student`** only matters for hard deletes in tests and seeds. Erasure is
  anonymize-in-place (`lb-dec-erasure-semantics`), so the erase hook deletes the rows itself.
- **Levels are numbers only.** The seed holds ten levels (Q4). The level is the highest
  `number` whose `min_points` is less than or equal to the total. If no row matches (an empty
  table, which only a test database flush produces), the level is `null`. Changing the
  thresholds later is a data migration. A staff screen for it is out of scope.

**Personal data (ADR-0023).**

- *What:* the lessons a student was credited for (lesson id, time, amount) and the total and
  level derived from them.
- *Why:* to show the student their progress, and later their streaks and badges.
- *How long:* the account's lifetime. The lines are erased on account deletion
  (`dec-retention-new-domains`, answered). No time-based purge exists or is needed. "Purge"
  for this domain is the erase hook.
- *Who sees it:* the student, through `me/` and their data export. Nobody else in this unit.
  A parent seeing their linked child's points is Q5 and `eng-dashboard-ui`. Leaderboards are
  `eng-leaderboards`, under `dec-eng-leaderboard` and `dec-safeguarding-under-18`.

The registry entry is `engagement.points`, covering `engagement.PointsEntry`:

- **Export:** the total, the level number, and each line as `{reason, amount, occurred_at}`.
  No ids.
- **Erase:** deletes the person's lines. Default order. Idempotent.

`engagement.LevelDefinition` joins `NOT_PERSONAL` in
`tests/test_personal_data_hooks_cover_every_model.py`: a catalogue row linked to no person.

The event log's own hooks (`platform.events`) already erase every event naming the person.
So a `replay_events` after an erasure cannot re-award points to the anonymized user.

## API delta

`GET /api/v1/engagement/me/` (session auth, CSRF-safe read):

```json
{ "points": 30,
  "level": { "number": 1, "min_points": 0 },
  "next_level": { "number": 2, "min_points": 50 } }
```

- `next_level` is `null` at the top level. `level` is `null` only on an empty level table.
- If the caller has no student profile, the response is 403 with `error_code`
  `permission_denied`. The message goes through `pgettext_lazy("error action", ...)` and has
  an Arabic catalogue entry.

Public service names in `kaleem.engagement.services`:

- `get_user_state(user_id) -> PointsState`. A frozen dataclass: points, level, next level.
  `eng-dashboard-ui`'s parent view and analytics will read it.

`award_points` stays internal (`engagement/points.py`). It becomes public when
`eng-more-sources` needs it, under that unit's spec.

## Frontend

None. `eng-dashboard-ui` builds the card, and this endpoint is its source. No dashboard bundle
change is made in this unit.

## Module boundaries

Engagement owns the ledger. It imports `kaleem.platform` (`events`, `personal_data`,
`exceptions`) and `kaleem.identity.services` (`get_student_profile`, `get_users`). The existing
contracts already allow both, so **no import contract changes and no ADR**.

- The handler is registered from `EngagementConfig.ready()` with
  `events.subscribe("scheduling.session_completed", "engagement.points_lesson_delivered", fn)`.
- It reads the payload as a mapping: `student_id`, `session_id` and `outcome`. It never
  imports scheduling. Engagement's tests may not import scheduling either, so they publish
  through `events.registry.type_named(...).cls`.
- The real close-out-to-points path is wired and tested once, in top-level `tests/`, as
  `tests/test_curriculum_assignment_wiring.py` does.
- **No new Celery task.** The handler runs inside the existing `deliver_event` task.
- **Blue-green:** an old-colour worker does not know the handler. `deliver` skips it, and the
  sweep runs the missing pair once the new colour is up.

## Out of scope

- Streaks (`eng-streaks`), badges (`eng-badges`), leaderboards (`eng-leaderboards`), and other
  point sources such as curriculum completion (`eng-more-sources`).
- Any dashboard UI or parent endpoint (`eng-dashboard-ui`).
- A staff screen for levels or for adjusting points.
- Taking points back:
  - for a lesson later adjudicated `teacher_absent` (Q6);
  - by a negative or correcting line (the `CHECK > 0` forbids it until a unit needs it).
- Teachers earning points (Q1).

## Test plan

**Models** (`engagement/tests/test_models.py`):

- `UNIQUE (reason, source_id)` and `CHECK amount > 0` hold in the database, bypassing the
  service.
- The seeded levels start at `min_points = 0` and rise strictly with `number`.

**Points** (`engagement/tests/test_points.py`):

- `award_points` writes one line, and a second call with the same `(reason, source_id)`
  writes nothing and returns `False`.
- `get_user_state` at these boundaries:
  - 0 points gives level 1;
  - threshold − 1 stays on the lower level;
  - exactly the threshold moves up;
  - top level, and beyond it, gives `next_level = null`;
  - an empty level table gives `level = null`;
  - another student's lines are never counted.

**Handler** (`engagement/tests/test_handlers.py`). Each case publishes through the registry's
class and runs `events.deliver`:

- `held` awards 10.
- `student_absent` awards nothing.
- An unknown version awards nothing.
- Delivering twice awards once.
- Two events for one lesson award once.
- A missing user awards nothing, does not raise, and logs a warning.
- The subscription is registered under exactly that type and handler name.

**API** (`engagement/tests/test_api.py`):

- A student gets 200 with the shape above, including the zero state.
- A teacher-only or parent-only user gets 403 `permission_denied`.
- Anonymous gets the platform's unauthenticated response.
- Only the caller's own points are returned.

**Personal data** (`engagement/tests/test_personal_data.py`):

- `assert_hooks_honour_contract("engagement.points", ...)` passes.
- The export is exactly the person's lines.
- Erasure removes them and leaves another student's lines alone.

**Wiring** (`tests/test_engagement_points_wiring.py`): a real `complete_session`, then the
captured on-commit delivery, then `get_user_state` shows 10 points. This is mutation-checked
by removing the `subscribe` call: the test must go red.

**e2e: none (D3).** No user-facing surface ships. The worker path from a commit to a handler
is already proven in CI by `event_bus_probe`. The points card's flow belongs to
`eng-dashboard-ui`. The D3 table gets an "`engagement` — points" row saying exactly this.

## Decisions

The owner approved on 2026-11-22 and answered every question as recommended. The
"recommended" text below is therefore the decision.

1. **`dec-eng-audience-points`: who earns points?** *Decided (as recommended): students only.* Teachers
   earn nothing in v1.
2. **What earns points in this unit?** *Decided (as recommended): a delivered lesson only* (outcome
   `held`). A student absence earns nothing. A cancellation earns nothing, whoever cancels and
   however early. This is `dec-lesson-outcomes`' "points count delivered only", restated for
   approval. Completed curriculum lessons and streaks come later, in their own units.
3. **How many points is a delivered lesson worth?** *Decided (as recommended): 10, the same for every
   subject and every lesson.*
4. **Levels: how many, at what thresholds, and named or numbered?** *Decided (as recommended): ten levels,
   numbered only ("Level 3"), with no names.* Names would need Arabic and religious-term
   review. The thresholds, with the lessons each takes at 10 points per lesson, are:

   | Level | Points | Lessons |
   | --- | --- | --- |
   | 1 | 0 | 0 |
   | 2 | 50 | 5 |
   | 3 | 150 | 15 |
   | 4 | 300 | 30 |
   | 5 | 500 | 50 |
   | 6 | 750 | 75 |
   | 7 | 1050 | 105 |
   | 8 | 1400 | 140 |
   | 9 | 1800 | 180 |
   | 10 | 2250 | 225 |

   At 2 to 3 lessons a week, level 2 arrives in the first month and level 10 after about two
   years. Level 10 is the top: points keep counting past 2250, and no level 11 is defined.
5. **Who sees a student's points?** *Decided (as recommended):*
   - The student sees their own.
   - A linked parent sees their child's, in `eng-dashboard-ui`.
   - Teachers do not.
   - No one else sees them until `eng-leaderboards` is decided.
6. **If staff later rule that a "delivered" lesson was really a teacher no-show
   (`sched-teacher-no-show`), are the points taken back?** *Decided (as recommended): no.* The student
   attended. Removing points a child has already seen punishes them for the teacher's absence.
7. **Lessons delivered before this ships.** *Decided (as recommended): no backfill migration.* After the
   first staging deploy, the conductor runs
   `replay_events --handler engagement.points_lesson_delivered` once, which credits what is
   still in the 90-day log. Production is not live yet, so no real student is short-changed.

Conductor allocations: migrations `engagement/0001` and `engagement/0002`. There is no
ADR, no beat slot and no e2e fixture.
