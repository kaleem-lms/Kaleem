---
number: 0050
title: Chat transport
status: accepted
date: 2026-10-18
---

## Context

`msg-realtime` (v1, stream `msg`) will push new chat messages to a recipient's open browser.
ADR-0035 and ADR-0037 already put one real-time process in production: `signaling`, a single
uvicorn process (no `--workers`) that holds every live lesson's room in one in-process dict
and relays offers, answers and ICE between exactly two sockets. Chat needs a second
long-lived connection per online user. The owner picks where it runs in `dec-msg-realtime`.
This ADR is the evidence for that pick. It is `proposed`: it makes no decision for the owner
and ships no product code.

What the code does today (backend `18888b2`, infra `origin/main`):

- `signaling` shares the backend image, imports neither `kaleem` nor `django` (an
  import-linter contract), and takes two inputs: a socket and a room-scoped HMAC token.
- `ship.sh` step 4 recreates `signaling` on **every** deploy, which drops every live call's
  signaling socket (ISSUES.md, "A deploy drops every live call"). Media is peer-to-peer or
  through coturn and never touches signaling, so a restart interrupts negotiation, not the
  frames already flowing.
- The dashboard retries a lost signaling socket 5 times, after 0.5, 1, 2, 4 and 8 seconds
  (`useSignaling.ts`): a **15.5 s** window. The attempt counter resets on a successful open.
- `kaleem/messaging` is a scaffold. `config/asgi.py` exists and nothing serves it. `channels`
  is not a dependency. Redis (`redis:8-alpine`) is already in the shared block, for Celery.
- The Django API is `gunicorn config.wsgi --workers 3` per colour.

The question that separates the options is **blast radius on a lesson in progress**: what
each option can do to a call that is already running.

## The four options

All four keep one design rule: the real-time channel is a **notifier, not a carrier**. The
browser is told "chat 12 has something new" and fetches the message through the authenticated
API, so the API stays the one place that decides who may read what, and a real-time failure
degrades to polling instead of losing or leaking a message. That rule is part of the
proposed Decision below. The options do not differ on it.

**1. Inside the signaling process.** An inbox route (`WS /ws/inbox`) in `signaling/app.py`,
served by the same uvicorn process as every live lesson, fed by a Redis subscription.

**2. Its own container (escape hatch E5).** The same backend image and the same pattern as
`signaling`, as a second container beside it in the shared block of
`docker-compose.production.yml`. This is **E5** (modular monolith to service split, roadmap
section 6.2: "Not pre-approved. Requires a full ADR with evidence"), taken a second time
after ADR-0035. It is named here, so that choosing it needs no further ADR for the hatch.

**3. Django Channels.** A Django ASGI process with a Redis channel layer. ADR-0035 recorded
it as an alternative for signaling and the owner rejected it there.

**4. Polling only.** No new process. The dashboard polls a messaging endpoint served by the
existing gunicorn workers.

## Evidence

Everything below is in `docs/superpowers/specs/assets/2026-10-18-msg-realtime-adr/`: the
harness, the raw results, and `inbox_prototype.patch`, the throwaway option 1/2 prototype
(never merged). The README there says how to reproduce each number.

**Setup.** The relay under test ran in the `kaleem-gate` image (Python 3.13, uvicorn 0.54 with
uvloop, websockets 17), pinned to two physical cores and 2 GiB (option 2: the two containers
share those two cores and 1 GiB each). The load generator, the probe and Redis ran in other
containers on other cores of the same Docker network. The host is a desktop (28 threads)
with a normal session running; its load average was 1 to 4 during the runs. This is not the
staging VPS, so **every number is relative: with and without chat load on the same budget,
never a capacity.** One deliberate deviation from the spec: the relay is pinned with
`--cpuset-cpus` rather than `--cpus=2`, because option 2 has to put two containers on one
shared cpuset.

Every run carries 50 background call pairs (100 sockets, 2 frames/s each way, a heavier
signaling load than a real established call). The probe is a separate 2-socket room
exchanging timestamped `ice` frames at 20/s each way for 60 s; timestamps are the intended
send time, so a late sender counts as latency. The inbox sockets are real WebSockets
authenticated with a second token purpose (below); chat messages travel Redis pub/sub to the
socket.

### R0: the instrument can see a stall (positive control)

A 200 ms blocking sleep injected into the relay path once per 2 s. 30 s runs, no background
load:

| Run | Frames sent / received | p99 | Max |
| --- | --- | --- | --- |
| clean | 1200 / 1200 | 2.0 ms | 2.2 ms |
| 200 ms stall injected | 1200 / 1200 | 202.1 ms | **203.7 ms** |
| clean again | 1200 / 1200 | 2.7 ms | 3.8 ms |

The probe sees a 200 ms stall as a 204 ms maximum and loses no frame, so its "no effect"
readings below mean something.

### R1: runtime coupling

Added latency to a live call's signaling, by inbox sockets held and chat messages published
per second. Baseline (unmodified signaling, 50 pairs, no inbox): p99 1.9 to 3.4 ms and max
3.2 to 7.6 ms across six baseline runs, bracketing the cells. Every cell delivered 2400 of
2400 probe frames. (2000-socket rows: the `nofile=65536` rerun, see below.)

| Option | Inbox sockets | Publish/s | p99 | Max stall | Loop lag max (server side) |
| --- | --- | --- | --- | --- | --- |
| 1, in signaling | 0 | 0 | 2.5 ms | 3.9 ms | 2.9 ms |
| 1 | 0 | 50 | 2.3 ms | 5.1 ms | 3.7 ms |
| 1 | 500 | 0 | 1.9 ms | 3.1 ms | 1.7 ms |
| 1 | 500 | 50 | 2.7 ms | 4.3 ms | 2.2 ms |
| 1 | 2000 | 0 | 1.9 ms | 4.5 ms | 2.5 ms |
| 1 | 2000 | 50 | 2.1 ms | 5.1 ms | 5.1 ms |
| 2, own container | 0 | 0 | 3.3 ms | 4.9 ms | 4.2 ms |
| 2 | 0 | 50 | 2.0 ms | 6.0 ms | 2.9 ms |
| 2 | 500 | 0 | 2.8 ms | 3.6 ms | 3.3 ms |
| 2 | 500 | 50 | 3.8 ms | 4.9 ms | 5.8 ms |
| 2 | 2000 | 0 | 2.7 ms | 6.4 ms | 5.2 ms |
| 2 | 2000 | 50 | 2.6 ms | 5.5 ms | 5.1 ms |

**Threshold, fixed before measuring:** option 1 is "no measurable runtime coupling" only if
every cell adds at most 50 ms to p99 and at most 250 ms to the maximum stall over baseline.
**Held only with the descriptor limit raised (`nofile=65536`). Not held at the container
default of 1024**, where both 2000-socket cells failed (below). With the limit raised, by a
wide margin: the worst p99 in any cell is 1.4 ms above the baseline mean (3.8
against 2.4 ms) and the worst maximum is 1.3 ms above the baseline mean (6.4 against 5.2 ms). At this scale the
chat load is not a CPU question for either option. Inbox delivery itself (Redis to socket,
loopback) had p99 2 to 4 ms and a maximum of up to 9 ms in the complete cells.

**The descriptor limit changes that, and it is the first real blast-radius finding.** The
first grid ran under the containers' default soft `nofile` limit of 1024 on the measuring host
(`results-relay-nofile1024.*`). With option 1 and 2000 inbox sockets requested, only 910
connected, the descriptor table of the single signaling process was full, and **the probe's
call could not join** (`did not receive a valid HTTP response`, in both 2000-socket cells).
With option 2 the same load filled the inbox container's own table (1010 sockets up) and the
call probe in the unmodified signaling container was unaffected. So at the default limit
option 1 **did not meet the threshold**: chat sockets and lesson joins draw on one descriptor
budget. The grid was re-run with `nofile=65536` for the 2000-socket cells
(`results-relay-2000.*`); the table above uses those rows. The production limit is to be
confirmed before an option-1 build; whatever it is, option 1 needs the limit raised in the compose file as part
of the change, and a per-process socket cap well under it.

### R2: fault coupling

Faults injected into the inbox code while the 50 pairs and the probe run (40 s runs, fault at
about 10 s). Reported as observed, not scored.

| Fault | Option 1 (same process as calls) | Option 2 (own container) |
| --- | --- | --- |
| 500 ms blocking call in the inbox frame handler | **The call pair saw a 459 ms maximum stall and a 509 ms gap between frames** (p99 110 ms over the run). Every live room waited. | No effect (max 3.7 ms) |
| Unhandled exception in the inbox frame handler | No effect on calls. That socket closed abnormally (1006) in 5 ms; the traceback was logged once. | The same. |
| Unhandled exception in the Redis-to-socket delivery path | No effect on calls. **Delivery stopped for everyone, silently**: the socket stayed open, 0 of 76 published messages arrived, the container log showed no traceback during the run, and the health endpoint stayed `healthy`. | The same. |

Two things follow. First, one event loop shares a *stall* with every call by construction,
and a blocking call in chat code is an ordinary bug. Second, in **both** options a failure in
the delivery task is invisible to the health check, because the task is not what the check
exercises. That is the repository's recurring failure mode (something fails, the code
carries on, nobody is told), so whichever option is chosen, the relay's health endpoint must
report whether the subscriber task is alive, and the client must keep its polling fallback
running at a slow interval even while the socket looks healthy.

### R3: memory

| Process | Resident memory |
| --- | --- |
| signaling, idle, unmodified | 39 MB |
| inbox process (option 1 or 2) idle | 41 MB |
| inbox process holding 2000 sockets | **91 MB** (about 25 KB per socket) |
| `uvicorn config.asgi:application` idle, after a few requests (the floor for option 3) | **78 MB** |

Option 3's number is a floor: Channels itself is not installed (no dependency change in a
spike), and a consumer process loads every Django app, which signaling and the inbox relay
do not.

### P1: what polling costs

An authenticated `GET /api/v1/identity/me/` through the Django test client, as a lower-bound
proxy (no messaging endpoint exists): **mean 1.75 ms, p50 1.58 ms, p99 3.25 ms** over 2000
requests. The test client omits gunicorn, the network and the production middleware, so the
real cost is higher; the table gives the share of the 3 gunicorn workers for three service
times.

| Online users, interval | Requests/s | At 1.75 ms (measured floor) | At 5 ms | At 10 ms |
| --- | --- | --- | --- | --- |
| 500, 30 s | 17 | 1.0% | 2.8% | 5.6% |
| 500, 15 s | 33 | 1.9% | 5.6% | 11.1% |
| 2000, 30 s | 67 | 3.9% | 11.1% | 22.2% |
| 2000, 15 s | 133 | 7.8% | 22.2% | 44.4% |

Positive control: with a 50 ms sleep injected into the view's path the measured mean rose by
54.0 ms; with the injection removed it rose by 0.28 ms (review rerun) and the control failed, as it should.

### R4: what one signaling restart costs, locally

Three `docker restart`s of the signaling container under a reconnecting pair using the
dashboard's backoff (500 ms doubling, 5 attempts): the container was healthy again in about
1.0 s each time, the peers saw close code **1012** (service restart) and were paired again
about 1.0 s after the close, against a 15.5 s retry window. This is the local cost of the
*process* restarting. It models neither the compose recreate on the VPS nor whether video
keeps decoding through the gap (see "Not measured").

### Controls the prototype needs (and was tested for)

A room token must not open an inbox, and an inbox token must not open a room. The prototype
uses a separate token purpose with two independent layers: the HMAC key is derived per
purpose, and the claim set names the purpose. Seven tests (`test_spike_inbox.py`) cover both
refusals at the socket and each layer on its own. Each was mutation-checked against a build
with the control reverted:

| Mutation | Tests that went red |
| --- | --- |
| inbox key = the room key | `test_inbox_signature_is_not_the_room_signature`, `test_room_verifier_refuses_an_inbox_signed_token` |
| purpose claim not checked | `test_inbox_claims_must_name_the_inbox_purpose` |
| both reverted, claims read leniently | `test_room_token_is_refused_on_inbox` and the three above |
| room route falls back to the inbox verifier | `test_inbox_token_is_refused_on_room` |

The prototype also showed what it lacks, and a real build must add: a cap on sockets per
user (the room registry already displaces a user's older socket; the prototype inbox
registry does not), a global cap below the descriptor limit, closing a socket when its token
expires, and the subscriber-liveness health check from R2.

## Deploy coupling

This is the second blast-radius finding, and R1 does not show it.

**Option 1 under today's `ship.sh`.** Chat sockets drop on every deploy together with the
calls. For chat that is harmless: the client reconnects (R4) and refetches.

**Option 1 once deploys stop dropping calls.** `lb-signaling-deploy-continuity` is the unit
that would make `signaling` recreate only when its own code changes (for example a content
hash). Under option 1 the inbox code is signaling's code, so **every chat release restarts
signaling and drops every live call's signaling socket**. Every later chat change that touches the
relay (a new event type, attachments) is such a release, so this is the likely steady state,
not an edge case. Under option 2 a chat release recreates the inbox container only. It
needs one rule: the inbox relay lives in its own top-level package, not inside `signaling/`,
so the content hash for each service covers only its own code (plus the token codec both
import).

**Option 3 and option 4.** Neither touches signaling's lifecycle. Option 3 adds a Django
process that must follow the API's blue-green rules, since it loads the same code and the
same schema.

**Flip side of option 2.** Both containers run `ghcr.io/kaleem-lms/backend:${DEPLOY_SHA}`, so
until a hash gate exists, option 2 is recreated on every deploy exactly like signaling. It
costs nothing extra today and removes the coupling the day the gate lands.

## New moving parts

| | 1. In signaling | 2. Own container (E5) | 3. Channels | 4. Polling |
| --- | --- | --- | --- | --- |
| Container | none | `inbox`, shared block, same image | an ASGI service following blue-green | none |
| Compose / `ship.sh` step-4 list | `ulimits.nofile` on `signaling` | new service, added to the `up -d` list, health check | new service pair, rollback path | none |
| Traefik / DNS | none | a route: a `PathPrefix(/ws/inbox)` rule on the existing `WS_DOMAIN` host, or a new host (`hg-vps-env`); neither verified here | route to the ASGI service | none |
| `ci.yml` | none | `--cov=inbox` and the e2e job starts the process (the deploy file list already carries compose and `ship.sh`) | e2e starts the process | none |
| Env vars | none | `DJANGO_INBOX_URL` on the API (compose-set); no new secret if the per-purpose derived key is kept | channel-layer settings | none |
| Dependencies | none | none (`redis`, `websockets`, `uvicorn` are present) | `channels`, `channels-redis` (one dependency-changing unit at a time) | none |
| Boundaries | amends ADR-0035: signaling's inputs grow to include a Redis subscription and a second token purpose | new package, new `forbidden` import contract like signaling's; ADR-0035 and ADR-0037 unchanged | consumers run all apps; module rules apply inside it | stays in `kaleem.messaging`, mounted under `config.api_router` (ADR-0029) |
| Memory | +50 MB at 2000 sockets | 41 MB idle, +50 MB at 2000 sockets | 78 MB idle floor | none |
| Session or token | token | token | session cookie works, with an origin check | session |

## Alternatives considered

- **Option 1** is the least infrastructure, and R1 shows it is not a CPU problem. It loses on
  R2 (a blocking bug stalls every call), on the shared descriptor budget, and on deploy
  coupling.
- **Option 3** buys session authentication and the ORM inside consumers, and costs a
  dependency pair, 2x the idle memory, a second Django deployment type, and a decision the
  owner already made the other way in ADR-0035. It does not isolate calls any better than
  option 2 does.
- **Option 4** costs almost nothing at v1 scale (P1) and is the fallback in every other
  option. Its cost is latency: a reply appears up to one interval late.

## Decision

Accepted by the owner on 2026-10-18 (dec-msg-realtime), as recommended below. The staging
measurements S1/S2 were not waited for.

1. **Ship messaging with polling (option 4) first.** It is what `msg-core-backend` and
   `msg-dashboard-ui` need, it is the fallback of every other option, and P1 says 2000 online
   users at a 15 s interval is under a tenth of three workers even at the measured floor.
2. **For real-time (`msg-realtime`), build option 2: a separate container, E5 taken and
   named here.** The chat relay is a notifier on the pattern of `signaling` (same image, own
   package, own import contract, token purpose separate from the room token, Redis pub/sub
   fed on commit by `messaging`). Runtime CPU is not why. The reasons are the three things
   R1 and R2 and the deploy analysis found: a blocking bug in chat code must not stall a
   lesson (R2), chat sockets must not share a descriptor budget with lesson joins (R1), and
   a chat release must not restart signaling once `lb-signaling-deploy-continuity` stops
   deploys restarting it anyway.
3. **Not Channels**, for the reasons in ADR-0035 and the numbers above, unless the owner
   wants session-cookie authentication on the socket badly enough to pay for it.
4. **Whichever option is chosen:** notifier-only payloads (ids, never message bodies); a
   slow polling timer that keeps running while the socket looks healthy; a health endpoint
   that reports whether the subscriber task is alive; per-user and global socket caps below
   the descriptor limit, which is raised in compose; sockets closed at token expiry.
5. If the owner prefers the least infrastructure and picks option 1 anyway, it is acceptable
   only with the descriptor limit raised and capped, a rule that chat handlers never block,
   and the acceptance that a chat release is a signaling release.

## Not measured

- **S1 and S2, the staging window.** A real two-browser call through Traefik, TLS and coturn,
  held across one scheduled deploy to price a signaling restart (close code, time to the next
  `peer-joined`, whether `framesDecoded` keeps rising through the gap). Not done: it needs the
  staging lock, a conductor-allocated pool pair with a lesson inside its join window, and a
  scheduled deploy, none of which the agent that wrote this had. R4 is the local stand-in for
  the signaling half only. `lb-signaling-deploy-continuity` measures the same thing; its run
  should be cited here when it exists. **The conductor decides whether `dec-msg-realtime`
  waits for it.**
- The staging VPS's size, its descriptor limit, and TLS and Traefik overhead on the socket.
- Absolute capacity (`rch-capacity-measurement`), and any load against staging (where load
  tests may run, `rch-d-loadtest-env`, is still an open decision).
- Safari and iOS socket behaviour, including backgrounded tabs. This project has no Apple
  device.
- Channels itself, more than one relay replica, group chats, large payloads, and Redis
  failure or restart under load.
- That Traefik routes `/ws/inbox` by path on the existing signaling host.

## Consequences

**Good.** The owner gets a pick backed by measurement rather than by taste, and one that is
cheap to be wrong about: polling ships regardless, and the relay is a notifier, so removing it
loses latency, never messages.

**Bad.** Option 2 is a third container type to health-check, deploy and keep in `ci.yml`'s
e2e job, and it spends E5 a second time. The two real-time services can drift in their
token and handshake code unless the shared handshake is extracted (the prototype did: a
`handshake.py` both routes import), which touches signaling's code and needs its own review.

**Neutral.** Nothing here changes ADR-0035 or ADR-0037. An option 1 decision would amend
ADR-0035; an option 3 decision would record the owner reversing it.
