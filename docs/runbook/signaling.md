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
| `4400` (`CLOSE_BAD_MESSAGE`) | A connected peer sent a frame that was not valid JSON, or whose `type` was not one of `offer` / `answer` / `ice`. |

A peer simply disconnecting (going away, closing the tab) is not an error —
it is the ordinary way a call ends, and it is not reported through these
codes.

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

## Related

- `docs/runbook/deploy.md` — general blue-green deploy flow (`scripts/ship.sh`)
- ADR-0035 — signaling as its own Django-free deployable
