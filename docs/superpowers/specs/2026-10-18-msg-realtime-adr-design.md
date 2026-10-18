---
name: msg-realtime-adr
phase: v1 (wave 1, msg stream)
modules: [signaling, messaging]
status: built
created: 2026-10-18
closed: null
---

## Result

[ADR-0049, chat transport](../../adr/0049-chat-transport.md) (`proposed`), with its evidence in
`assets/2026-10-18-msg-realtime-adr/`. S1 and S2 (the staging window) were not measured; the ADR
says so and lists what they need. `dec-msg-realtime` is asked with that ADR.

## Goal

Real-time chat delivery (unit msg-realtime) needs a transport, and the owner picks it in
`dec-msg-realtime` once this spike has produced evidence. Four candidates:

1. **Inside the signaling process.** An inbox WebSocket route in `signaling/app.py`, served by
   the same single uvicorn process that relays every live lesson's offers, answers and ICE.
2. **Its own container.** A sibling relay from the same backend image, beside `signaling` in
   the shared block of `docker-compose.production.yml`. This is escape hatch **E5**
   (roadmap 6.2: "not pre-approved, requires a full ADR with evidence"), taken a second time
   after ADR-0035. The ADR names it as E5.
3. **Django Channels.** A Django ASGI process with a Redis channel layer. ADR-0035 recorded
   this shape as an alternative for signaling and the owner rejected it there.
4. **Polling only.** No new process. The dashboard polls a messaging endpoint served by the
   existing gunicorn workers (3 per colour, `backend/Dockerfile`).

The question that decides it is **blast radius on live calls**: what each option can do to a
lesson in progress. This unit measures that, writes a proposed ADR ("chat transport") with
the evidence and a recommendation, and stops. It ships no product code.

What the code says today (backend `origin/main` 18888b2, infra `origin/main`):

- Signaling is one uvicorn process with no `--workers` (`docker-compose.production.yml`,
  service `signaling`). Every room is in one in-process `RoomRegistry` dict
  (`signaling/rooms.py`), so every live lesson shares one event loop.
- Its only inputs are a socket and a room-scoped HMAC token (`signaling/tokens.py`). An
  import-linter contract forbids it to import `kaleem` or `django` (`pyproject.toml`).
- `signaling` runs on `ghcr.io/kaleem-lms/backend:${DEPLOY_SHA}`. `ship.sh` step 4 recreates
  it on every deploy, which drops every live call's signaling socket (ADR-0037, ISSUES).
  lb-signaling-deploy-continuity may change that, for example by recreating only when
  signaling's own code changes.
- The client retries a lost signaling socket 5 times with backoff starting at 500 ms
  (`dashboard/src/features/call/useSignaling.ts`). Media flows peer-to-peer or through coturn
  and never touches signaling.
- `kaleem/messaging` is a scaffold: an empty `services.py` and an empty `urlpatterns`.
- `config/asgi.py` exists and nothing serves it. Channels is not a dependency.

## User flow

None. No user sees anything from this unit. The ADR is read by the owner when
`dec-msg-realtime` is put to them.

## Data model delta

None. No model, no migration, no merged code.

ADR-0023's four points:

- **What:** no personal data. Probe traffic is synthetic: numeric user ids, generated chat
  payloads, fake camera and microphone in the staging run.
- **Why:** to measure transport cost.
- **How long:** raw probe output lives only in the scratch directory and is deleted at
  close-out. The aggregated numbers committed with the ADR are timings, not data about people.
- **Who sees it:** the ADR is public. The staging run uses conductor-allocated pool accounts
  (`dec-d9-substitute`). Their credentials stay out of band and never touch a file.

Expand/contract: nothing reaches a trunk except docs, so the blue-green window is unaffected.

## API delta

None merged. The throwaway prototype adds, in a local backend worktree only:

- `WS /ws/inbox` on the signaling app (option 1) and the same route in a second uvicorn app
  (option 2). It authenticates with a **separate token purpose**, so a room token is refused
  on the inbox route and an inbox token is refused on a room route. This is the control that
  msg-realtime would need under options 1 and 2, and the ADR records it.
- Messages are published through Redis pub/sub, which stands in for msg-realtime's
  publish-on-commit.

The prototype is exported as a patch into the ADR's evidence folder. The backend branch is
never merged.

## Frontend

No dashboard slice: this unit is an ADR. The staging run drives the existing call UI with a
throwaway Playwright script and does not change it.

## Module boundaries

The ADR has to state what each option does to the boundaries:

- Option 1 widens signaling's inputs beyond "a socket and a signed token" (ADR-0035) to a
  Redis subscription and a second token purpose. That amends ADR-0035.
- Option 2 adds a top-level package with its own `forbidden` import contract, the same as
  `signaling`. That is E5, named.
- Option 3 loads every Django app in a long-lived ASGI process and adds `channels` and
  `channels-redis` (one dependency-changing unit at a time).
- Option 4 stays inside `kaleem.messaging` behind `config.api_router` (ADR-0029).

## Out of scope

- Building msg-realtime, the messaging API (msg-core-backend) or any dashboard code.
- Making the decision. The ADR is `proposed`. `dec-msg-realtime` is the owner's.
- Any load against staging. Where load tests may run is the open decision
  `rch-d-loadtest-env`, so every load cell runs locally. The staging run is one ordinary
  lesson.
- Absolute capacity per VPS size. That is rch-capacity-measurement. Every number here is
  relative: with and without chat load, on the same CPU budget.
- Fixing deploys that drop calls (lb-signaling-deploy-continuity).

## Test plan

A spike's tests are its measurements. Each instrument proves it can see a fault before its
"no effect" result counts.

**Local, staging-shaped.** All of it runs in the `kaleem-gate` image on a private Docker
network. The relay under test is held to `--cpus=2 --memory=2g`, the roadmap's minimum host
(staging's real size is not visible to agents). The load generator runs in a separate
container.

- **R0, probe validity (positive control).** The relay probe is a pair of sockets in one room
  exchanging timestamped `ice` frames at 20/s. A known `time.sleep(0.2)` injected into the
  relay path must show as a ≥ 200 ms maximum stall, and every frame sent must arrive. If the
  probe cannot see an injected stall, its other readings mean nothing.
- **R1, runtime coupling.** Relay latency p50, p99 and max, plus event-loop lag, for
  baseline signaling against option 1 and option 2. Both carry 50 background call pairs. The
  grid is inbox sockets {0, 500, 2000} × publish rate {0, 50 msg/s}. For option 2 the two
  containers share one 2-CPU cpuset, so host contention is counted.
- **R2, fault coupling.** A 500 ms blocking call, and then an unhandled exception, in the
  inbox handler. Record what the call pair sees in options 1 and 2.
- **R3, memory.** Idle RSS of signaling, of the option 1 process holding 2000 inbox sockets,
  and of a Django ASGI process (`uvicorn config.asgi:application`) as the floor for option 3.
- **P1, polling cost.** Per-request cost of an authenticated `GET /api/v1/identity/me/`
  (`MeView`) as a lower-bound proxy, since no messaging endpoint exists yet. From it, compute
  the share of 3 gunicorn workers that 500 and 2000 online users take at 15 s and 30 s
  intervals. Positive control: an injected 50 ms sleep must raise the measured cost by
  ≥ 50 ms.

**Staging window.** Held under the staging lock with conductor-allocated pool accounts and a
lesson inside its join window:

- **S1.** A real two-browser call with fake media through Traefik, TLS and coturn. Baseline
  relay round trip and time to first remote frame.
- **S2.** The same call held across one deploy that the conductor schedules into the window.
  Record the signaling close code, the time until both sides see `peer-joined` again, and
  whether inbound video keeps decoding (`framesDecoded` rising per second) through the gap.
  This prices "one signaling restart", which option 1 adds to every chat-only release if
  signaling ever stops restarting on every deploy. If lb-signaling-deploy-continuity
  measures the same thing first, its run is cited and S2 is not repeated.

**Thresholds, fixed before measuring.** Option 1 is "no measurable runtime coupling" only if
every R1 cell keeps the added p99 at ≤ 50 ms and the maximum stall at ≤ 250 ms over
baseline. R2 is reported as observed and is not scored. The ADR states which thresholds held
and does not move them afterwards.

**D3 e2e:** none. Nothing user-facing ships.

## Open questions

None block the spike. One condition is the conductor's to arrange: a staging window
containing one scheduled deploy, plus a pool teacher/student pair with a lesson inside its
join window. If the window cannot be had within the unit, the ADR ships with local evidence
and S1/S2 marked as not measured, and the conductor decides whether `dec-msg-realtime` waits
for them.
