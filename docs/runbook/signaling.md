# Signaling Runbook

## What it is

The signaling service is a standalone WebSocket relay that lets the two
participants of a 1-on-1 lesson exchange WebRTC negotiation messages (SDP
offers/answers, ICE candidates) so their browsers can open a direct peer
connection. It ships in the same backend image as Django but runs as its own
process (`uvicorn signaling.app:app`), imports no Django, and has no database
and no ORM (ADR-0035).

**What it is not:** it does not carry any lesson media. Audio and video flow
peer-to-peer between the two browsers once negotiation completes; the
signaling service never sees a media byte. It only relays small JSON control
messages (`offer`, `answer`, `ice`) between exactly two sockets in a room, and
drops a message rather than queuing it if the other peer is not there.

## Environment variables

| Variable | Set on | Purpose |
| --- | --- | --- |
| `DJANGO_SIGNALING_SECRET` | both the API (Django) container and the signaling container | HMAC key used to mint (API) and verify (signaling) the short-lived, room-scoped join token. **Must be byte-for-byte identical in both containers.** |
| `DJANGO_SIGNALING_URL` | the API container only | The public base URL of the signaling service, used to build the `join_url` handed to each participant (e.g. `wss://ws.kaleem.academy`). |
| `DJANGO_VIDEO_PROVIDER` | the API container only | Must be `kaleem.scheduling.providers.signaling_provider.SignalingProvider`. It **defaults to `FakeVideoProvider`**, whose join URLs point at nothing — so leaving it unset deploys a healthy, routable signaling service that no lesson can reach. This failure is silent: every gate stays green. |

All four (these three plus `WS_DOMAIN`) live in the hand-managed
`.env.production` on the VPS and are listed in
`infra/.env.production.example`. **`.env.production.example` is a template on
disk, not a deployment mechanism** — adding a variable there does not put it on
the server. `docs/runbook/deploy.md` has the diff command to run before
deploying.

`WS_DOMAIN` is a separate variable used only by `docker-compose.production.yml`
to build the Traefik `Host()` rule for the signaling routers
(`signaling-blue`/`signaling-green`) — it is not read by the application
itself. It lives in the hand-managed `.env.production` on the VPS, the same
file that holds `API_DOMAIN`, `DASHBOARD_DOMAIN`, etc. There is no
`.env.production` in git; it is created by hand on first VPS setup (see
`docs/runbook/deploy.md`) and edited by hand thereafter.

## Rotating the shared secret

The secret is not per-environment-variable-only — it is a **pair**, and both
halves of the pair must change together:

1. Generate a new value.
2. Update `DJANGO_SIGNALING_SECRET` in `.env.production` on the VPS (the one
   file both the `django-*` and `signaling-*` services read via `env_file`).
3. Redeploy (`bash scripts/ship.sh <sha>`), which recreates both the new
   colour's Django containers and its signaling container with the updated
   value, then drains the old colour.

Because a join token is signed with the secret at the moment a student or
teacher opens the lesson page, **every outstanding, unused token becomes
invalid the instant the secret changes** — there is no overlap window where
old and new secrets are both honoured. A participant who has an open lesson
page but has not yet joined the socket will get `CLOSE_UNAUTHORIZED` (4401) if
they try to join after a mid-lesson rotation. Rotate the secret **between
lessons** (e.g. during the nightly deploy window), never while lessons using
the current secret might still be starting.

## Close codes

The signaling service closes a WebSocket with one of these application close
codes (4000–4999 range, distinct per reason so a client can tell "fetch a new
token" apart from "this lesson is already full"):

| Code | Meaning |
| --- | --- |
| `4401` (`CLOSE_UNAUTHORIZED`) | The token is missing, malformed, expired, has a bad signature (secret mismatch), or is signed for a different room than the one being joined. |
| `4409` (`CLOSE_ROOM_FULL`) | A third connection tried to join a room that already has its two participants (1-on-1 only; `MAX_PEERS = 2`). |
| `4400` (`CLOSE_BAD_MESSAGE`) | A connected peer sent a frame that was not valid JSON, whose `type` was not one of `offer` / `answer` / `ice`, or that was a **binary** frame (this service speaks JSON text only). |
| `4410` (`CLOSE_REPLACED`) | **Not an error.** This participant opened a newer socket — a reconnect, or a second tab — and it took over their seat in the room. The *older* socket receives this code. |

A peer simply disconnecting (going away, closing the tab) is not an error —
it is the ordinary way a call ends, and it is not reported through these
codes.

### One participant, one seat

A room slot belongs to a **participant** (`user_id` from the token), not to a
socket. A second socket authenticated for a `user_id` already in the room
**replaces** the first: the older socket is closed with `4410`, the newer one
takes the seat, and the room's occupancy does not change. The other
participant sees a fresh `peer-joined` (renegotiation has to restart against
the new socket) and **no** `peer-left` — nobody left.

This is deliberate. Counting sockets instead of people meant one student
opening a second tab filled the 1-on-1 room and locked their teacher out with
`4409`, recoverable only by finding and closing a tab they had no reason to
connect with the failure. Three *distinct* participants are still refused with
`4409`; the cap is unchanged.

A client receiving `4410` should tell the user they are connected in another
tab or window, and must **not** retry — a retry loop between two tabs would
displace each other forever.

### Why five refusal reasons share one close code

The C3b spec's test plan says "each with its own close code", and the
implementation deliberately does not do that. Five distinct refusals —
missing token, malformed token, bad signature (secret mismatch), expired
token, and a token signed for a different room — all close with `4401`.

That is the better security choice, not an oversight. A distinct code per
reason is an oracle: it tells an unauthenticated caller whether a signature
was valid but stale, whether a room exists, or whether they guessed a real
room id with a wrong key — exactly the feedback needed to work a token
forgery attempt incrementally. The client has nothing to do differently in
any of the five cases: the action is always "fetch a new join grant".

**The distinction is not lost, it is moved server-side.** Every refusal is
logged at WARNING by `signaling.app` with its reason
(`signaling.tokens.TokenError` keeps four separate messages precisely for
this), so an operator can still tell a shared-secret mismatch (*every* join
logs "bad signature") from clock skew (*every* join logs "expired"). See
"Reading the logs" below.

## Deployment: single replica per colour

`signaling-blue` and `signaling-green` each run **exactly one replica**. Room
membership (`RoomRegistry`) is an in-process, in-memory `dict` — there is no
shared store between processes. Two peers in the same lesson must land on the
same process, or neither can see the other join. If the signaling service is
ever scaled beyond one replica per colour, `RoomRegistry` needs a fan-out
layer (e.g. Redis pub/sub) first; until that lands, do not raise its replica
count.

## Health check and its limit

Both `signaling-blue` and `signaling-green` expose `GET /health/live/` on
port 9000. The check mints a token and immediately verifies it using the
container's own `DJANGO_SIGNALING_SECRET`, returning `503` if the secret is
missing or the round trip fails. This is what `scripts/ship.sh` polls before
promoting a new colour.

**What this proves:** the signaling container has *a* usable secret — it is
present, non-empty, and internally self-consistent.

**What this cannot prove:** that the secret is the *same* one the API
container holds. The check only ever mints and verifies against itself; it
has no way to reach into the `django-${NEW}` container and compare. A
deployment where `DJANGO_SIGNALING_SECRET` differs between the two containers
passes this health check on both sides and still fails every real join with
`CLOSE_UNAUTHORIZED`, because the API mints tokens with its own secret and
the signaling service verifies with a different one. Nothing in this
deploy process can catch that mismatch automatically — after changing the
secret, manually confirm both containers were updated from the same
`.env.production` and, ideally, do one real join test end-to-end before
calling a deploy done.

## Reading the logs

`docker logs kaleem-signaling-<colour>-1`.

**The join token must never appear in a log line, and two things had to be
done to keep it out.**

uvicorn logs every WebSocket handshake at INFO with the path *and* its query
string, and that query string is the capability token — a replayable grant to
one child's lesson, valid for its full life, sitting in `docker logs` for
anyone with shell access. `--no-access-log` does **not** suppress it (that
switch only touches the `uvicorn.access` logger; the handshake line is on
`uvicorn.error`), and `--log-level warning` would only trade the leak for
blindness. The fix is `backend/signaling/logconf.py`, a `logging.Filter` that
rewrites the record before emit, installed via `--log-config
signaling/logconf.json` in **all three** places the service is started:
`docker-compose.local.yml`, `signaling-blue`, and `signaling-green`.

A correct log line looks like this — note `?REDACTED`:

```
INFO:     172.19.0.3:45532 - "WebSocket /ws/rooms/session-42?REDACTED" [accepted]
```

**If you ever see a `?t=` followed by anything in these logs, that is an
incident**: the `--log-config` flag has been dropped from a start command, and
every token logged since then should be treated as disclosed. There is no
revocation list — the only mitigation is rotating
`DJANGO_SIGNALING_SECRET` (see above), which invalidates every outstanding
token at once.

The gateway in front of the service logged the same thing separately: Traefik's
`RequestPath` access-log field is the full request URI, query string included.
`RequestPath: drop` in `infra/traefik/traefik.yml` removes it. Traefik has no
per-router access-log configuration and silently ignores `redact` for core
field names (both verified empirically against v3.6), so this is global and
**no route's path appears in the Traefik access log any more**; gunicorn's own
`--access-logfile -` carries per-request paths for the API instead.

Refusals are logged at WARNING with their reason and never with the token:

```
WARNING:  refused join to room session-42: bad signature
WARNING:  refused join to room session-42: expired
WARNING:  refused join to room session-42: token is for room session-999
WARNING:  refused join to room session-42: room is full
```

Read them in aggregate, not one at a time:

| Pattern | Almost certainly |
| --- | --- |
| *Every* join logs "bad signature" | `DJANGO_SIGNALING_SECRET` differs between the API and signaling containers. The health check cannot catch this — see above. |
| *Every* join logs "expired" | Clock skew between the API host and the signaling host, or a `GRANT_TTL` shorter than the time it takes a participant to click through. |
| Scattered "malformed token" | Usually crawlers and scanners hitting the endpoint. Only interesting in volume. |
| "token is for room X" | A real capability being replayed against a different room. Investigate. |

## Deploys drop live calls, and can split a room

**Known, unfixed, and dangerous precisely because it is silent.** Two separate
problems, both from `scripts/ship.sh`:

**1. A deploy kills every call in progress.** Step 8 stops the old colour with
`stop --timeout 30`. Room membership is an in-process dict, so a stopped
container takes its rooms with it: both participants' sockets close, and
neither browser is told why in a way it can recover from. Thirty seconds of
"graceful drain" is not a drain — nothing waits for rooms to empty, it is just
a SIGTERM grace period.

**2. During the colour overlap, one room can split across two processes.**
Both `signaling-blue` and `signaling-green` claim `Host(${WS_DOMAIN})`, so
between step 5 (new colour starts) and step 8 (old colour stops) Traefik
load-balances the *same* hostname across both. A teacher can land on one
colour and their student on the other. Each then sits in a room of one:
**no `peer-joined`, no error, no close code** — just two people looking at a
"waiting for the other participant" screen that will never resolve. This is
the worst kind of failure, because every health check is green and nothing is
logged.

**Operational rule until this is fixed: deploy between lessons.** Check the
schedule before shipping. If you must ship during a lesson, expect to tell
those participants to reload.

The fix is C3c/C3d work and is tracked in `ISSUES.md` under *Blocks launch*.
The options are a colour-pinned WS host (each colour gets its own hostname and
the client is handed the pinned one in its `join_url`, so a room can never
straddle), or a real drain (stop routing new joins to the old colour, wait for
its rooms to empty, then stop it). Do not attempt either as a side change
during another phase.

## Related

- `docs/runbook/deploy.md` — general blue-green deploy flow (`scripts/ship.sh`)
- ADR-0035 — signaling as its own Django-free deployable
