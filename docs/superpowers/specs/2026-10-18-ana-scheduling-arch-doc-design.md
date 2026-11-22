---
name: ana-scheduling-arch-doc
phase: v1 (wave 1, scheduling stream)
modules: [scheduling]
status: draft
created: 2026-10-18
closed: null
---

## Goal

Write `docs/architecture/scheduling.md`, which has never existed. D9 asks for an architecture
doc every phase, and C0, C1, C2, C3a-C3e, C5 and C6 each skipped it (ISSUES.md; journal
2026-W36). `scheduling` is now the largest module, and the later scheduling-stream units are
told to update this doc. They need a doc to update. `identity`, `billing`, `curriculum` and
`platform` already have one.

The doc describes the module as it is on backend `origin/main` 18888b2 and dashboard
`origin/main` e61e23e, the read API from `ana-scheduling-read-api` included. It states those two
SHAs, so a reader can tell how fresh it is. It describes code; it changes no code.

## User flow

None. No endpoint, route, payload, model or behaviour changes.

The readers are developers and agents. A later unit (`ana-session-outcomes`,
`lb-parent-acts-for-child`, `sched-reschedule`, `ntf-*`, `adm-*`) opens this doc, finds the
section its change touches, and updates it in the same PR.

## Data model delta

None. No model, field, index or migration.

**Personal data (ADR-0023).** This unit stores nothing. The doc gets a short section that
**describes** the personal data scheduling already holds: availability, match requests and
declines, assignments, slots, sessions and their cancellation actor, rooms, and call
diagnostics (user agent plus client-redacted stats). It also gives the one retention period in
code, call diagnostics purged after 90 days (`diagnostics.RETENTION`). And it states that
scheduling has not joined the personal-data registry yet: it is on the pending lists that
`lb-gdpr-data-export` and `lb-gdpr-erasure` clear (docs/architecture/platform.md).

## API delta

None.

## Frontend

None. The doc lists the four dashboard routes that use the module (`/availability`,
`/match-requests`, `/schedule`, `/sessions/$sessionId/room`) and the feature folders behind them
(`scheduling`, `matching`, `booking`, `call`). It points to them; it does not document the call
client's internals, which ADR-0036, ADR-0039 and `docs/runbook/video-call.md` already cover.

## Module boundaries

The doc follows the roadmap's rule (Section 2): a module's architecture doc carries **four fixed
fields**, which are Owns, Public API, Depends on and Does not do. They open the doc, ahead of the
detail. Every claim is checked against the code at the two SHAs
above:

- **Owns.** Eight tables: `WeeklyAvailability`, `MatchRequest`, `MatchDecline`,
  `TeacherAssignment`, `RecurringSlot`, `Session`, `Room` and `CallDiagnostic` (migrations
  0001-0012). The signaling service holds rooms in memory only and owns no table.
- **Public API.** `kaleem.scheduling.services`: availability, the quota and the typed reads that
  return frozen `SessionInfo` / `AssignmentInfo`, never models. The doc keeps
  `services.py`'s split between the role rule (user-scoped reads) and "the caller authorizes"
  (id-scoped reads). `booking`, `matching`, `rooms` and `diagnostics` are internal; only the
  module's own views call them.
- **Depends on.** `identity`, `curriculum` and `billing`, each through its `services` module only
  (ADR-0033). This is held by the four scheduling import-linter contracts, which the doc names.
  It also imports `signaling.tokens`, one token codec shared with the signaling service
  (ADR-0035); the reverse import is forbidden. No other module imports scheduling today.
- **Does not do.** Notifications, which are `ntf-*` work, and producers will call
  `notifications`. Trials, dropped in ADR-0046. Group lessons (ADR-0034). Session reports and
  ratings (`assessment`). Teacher earnings (`billing`, `pay-earnings-ledger`). Media relay
  beyond TURN, and recording.

`docs/architecture/overview.md` is this unit's one shared file. Its module map lacks the real
`scheduling --> curriculum` edge (ADR-0033), and its scheduling node label predates matching and
video. This unit fixes those two lines and nothing else in that file (D10). The planned
`scheduling --> notifications` edge stays: `ntf-core` opens it.

### What the doc covers after the four fields

Each item is short, mostly a pointer to the code, spec, ADR or runbook that already holds the
detail.

1. **Data model.** A mermaid ER diagram plus one line per table, covering the invariants the
   database holds. Those are the partial unique constraints, CASCADE against RESTRICT and why
   (`Session.slot`), UTC slot times against local availability times, Saturday-first weekdays,
   and the stored `consumes_quota`.
2. **Matching.** Offers are computed, never stored. Then the single hard-filter rule, which fails
   closed on unknown gender or preference. Then `sync_match_requests`, which is pull-based so
   billing never imports scheduling. Then the accept race, held by `select_for_update` plus
   `unique_active_assignment`.
3. **Booking and quota.** Slot options, claiming a slot, generating sessions (nightly and on
   claim), the quota's cycle-key rule, the 24-hour cancellation notice, ending a slot, and
   completion.
4. **Rooms.** The `VideoProvider` seam (ADR-0034), the join window, `is_participant` (which
   excludes parents), one ACTIVE room per session, `Room.signaling_url`, and rooms ending on
   cancel and complete.
5. **Diagnostics.** The closed code vocabulary, the user agent read server-side, and the 90-day
   purge.
6. **Signaling and TURN.** A separate service that imports no Django, with the token carried in
   the WebSocket subprotocol, its close codes, a two-peer room and the relayable message types.
   It is shared, not blue-green (ADR-0037). TURN uses time-limited HMAC credentials and fails
   closed without configuration. Operations stay in `docs/runbook/signaling.md` and
   `turn.md`; the doc links to them.
7. **HTTP surface.** All 15 routes under `/api/v1/scheduling/`, with who may call each.
8. **Jobs.** Two beat entries and two management commands (`sync_match_requests`,
   `seed_e2e_matching`).
9. **Personal data held** (above), **clients** (above), and **deliberately not here**.

**Disclosure rule (rch-d-security-disclosure).** The doc describes controls: token transport,
fail-closed credentials, participant checks, redaction. It names no secret, host, address or
unfixed weakness beyond what ISSUES.md already says. Nothing in this unit needs the private file.

## Out of scope

- Any code change in any repo. A defect found while reading goes to ISSUES.md (D10), or to the
  private channel if it is a security finding.
- Rewriting the roadmap's Section 2.1 scheduling entry, which is stale on Zoom, trials and the
  notifications dependency. ADR-0046 owns the roadmap reconciliation.
- Every other line of `overview.md`, including its stale "Current state".
- Runbook content, and the dashboard call client's internals.
- A CI check that keeps the doc in step with the code. The plan's fact check runs locally only.

## Test plan

A docs unit has no unit tests. The equivalent, written first (plan step 1), is a local fact check
that reads the code at the pinned SHAs and fails unless the doc names each of the following:

- every model class in `models.py`;
- every public function in `services.py`;
- every route in `api/urls.py`;
- both `scheduling-*` beat entries;
- every scheduling import-linter contract name;
- every `CallDiagnostic.Code` value;
- the four signaling close codes;
- the four fixed-field headings.

It is red on a missing doc, green on the finished one, and red again when any one name is
deleted (the mutation check). The mermaid blocks reuse the `erDiagram` / `graph TD` syntax that
`identity.md` and `overview.md` already render.

## Open questions

None. No owner decision is needed: the unit has no `decision_ids`, no `human_gates` and needs no
ADR.
