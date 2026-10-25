---
name: lb-signaling-deploy-continuity
phase: v1 programme (wave 1, ops stream)
modules: [signaling (backend), call client (dashboard `features/call`), deploy (infra)]
status: draft
created: 2026-10-25
closed: null
---

## Goal

Stop deploys from ending lessons in progress. ADR-0037 made signaling one shared replica and said
plainly that "a deploy still drops calls in progress". Reading the code at each submodule's
`origin/main` (backend 3cf6e75, dashboard a776875, infra f7a67fc) shows that two separate things
end a call, and both have to be fixed:

1. **The server: every deploy recreates signaling.** The `signaling` service runs
   `ghcr.io/kaleem-lms/backend:${DEPLOY_SHA}`, the same image as Django. Every deploy has a new
   SHA, so `ship.sh` step 4 (`up -d "${SHARED_SERVICES[@]}"`) recreates the container even when
   nothing in `signaling/` changed. Room membership is an in-process dict, so every socket closes.
2. **The client: one drop is treated as the end of the call.** `useSignaling`'s `handleDrop` sets
   `failure = "lost"` on the *first* retryable close, before it schedules the first reconnect, and
   no later open clears it. `useCallRoom` treats `lost` as terminal, so its cleanup effect calls
   `peer.close()` and stops the camera and microphone. Media is peer-to-peer and never passes
   through signaling, so the call would otherwise have carried on. The comment in `useCallRoom`
   already describes the intended rule ("`lost` -- the socket exhausting its own reconnect
   budget"). The code does not follow it. `ISSUES.md` records this as "`lost` shows at the first
   signaling drop".

Neither fix is enough without the other. Fix 1 alone still ends every call on any deploy that does
change signaling, and on any network blip. Fix 2 alone needs signaling routable again inside the
client's reconnect budget, which is 15.5 s of backoff (0.5 + 1 + 2 + 4 + 8). Traefik does not route
to a container whose health status is still `starting`. The signaling healthcheck's first probe
runs `interval: 15s` after start, so a recreate can use up the whole budget before Traefik routes
to the new container. That gap is what the staging measurement in the plan times.

**The fix, the cheapest of the three the programme names:**

- **Recreate signaling only when it changes.** `ship.sh` compares a *signaling fingerprint* of the
  running container with one of the new image. If they match, it keeps signaling on the image it
  is already running.
- **Clients ride out a restart.** A drop after the socket has opened is no longer a failure until
  the reconnect budget runs out. The peer connection and local media are kept. When both peers
  rejoin the fresh relay, the existing `peer-joined` rule makes the teacher re-offer on the same
  `RTCPeerConnection`. This is the "room resume" option, and it costs nothing on the server: a
  relay room is created by the first socket that joins it (ADR-0037).
- **Make a recreated relay routable quickly.** The signaling healthcheck gets
  `start_period`/`start_interval`, so Traefik sees the new container as healthy within about a
  second of it starting, not after 15 s.

**Drain is rejected.** It needs a join-routing switch that does not exist (ADR-0037, ISSUES). Once
clients survive a restart, a drain would only shorten an outage the client already rides out.

Decisions: hg-shipsh-review (pre-approved 2026-10-25; the PR body summarises every `ship.sh` and
compose change), dec-spec-approval, dec-floor-ownership, dec-d9-substitute,
rch-d-security-disclosure. No open decision.

## User flow

1. A teacher and a student are in a call. A deploy lands.
2. **Signaling unchanged (the usual case):** nothing happens to the call. The signaling container
   keeps its ID and start time. The deploy log prints
   `signaling unchanged (<fp12>); keeping <running-sha>`.
3. **Signaling changed, or the socket drops for another reason:** both sockets close (1012 or
   1006). The video keeps playing, because media is peer-to-peer. The pill keeps showing the
   peer-connection state, which stays `connected`. No terminal screen appears and the camera
   stays on. The hook reconnects on its backoff, the relay sends `peer-joined`, and the teacher
   re-offers on the existing connection. Neither person has to do anything.
4. **Error cases:**
   - The reconnect budget runs out (signaling stays down for more than about 15 s): `lost`, the
     existing terminal screen with "Try again". This is today's screen, now shown only when the
     budget is really spent.
   - A terminal close code (4401, 4409, 4410), or the first connect never opening (`unreachable`):
     unchanged.
   - Either fingerprint cannot be read (no running container, an image from before this change, a
     failed `docker run`, output that is not 64 hex characters): `ship.sh` recreates on the new
     SHA, which is today's behaviour, and logs why.
   - The new signaling fails its health gate: `restore_signaling` puts back the image that was
     running before step 4, as it does today, now through `SIGNALING_SHA`.

## Data model delta

None. No migration.

## API delta

None. No route and no wire change: `RELAYABLE`, the close codes and the subprotocol are unchanged.
A new CLI entry point, `python -m signaling.fingerprint`, prints one 64-character hex line. Only
`ship.sh` uses it.

**The fingerprint** is the SHA-256 of everything the signaling process runs that compose does not
already hash:

- every file under `signaling/`, except `tests/`, `__pycache__` and `*.pyc`, by relative path and
  content;
- every installed distribution, by name (lower-cased) and version (`importlib.metadata`);
- `sys.version` and `sys.implementation.name`;
- the bytes of `/var/lib/dpkg/status` when it exists, so OS package updates in the base image
  count as a change.

The command line, `env_file` values, labels and healthcheck are part of the compose service
definition. Compose already recreates the container when those change. The plan checks this for
`env_file` (secret rotation depends on it) before relying on it.

When the fingerprint wrongly reports a change, the result is today's behaviour (a recreate), so
that error is safe. The opposite error is not safe. That is why inputs that are only possibly
relevant, such as every installed distribution, are included.

## Frontend

No new route, component or copy, and no new API call. Only `src/features/call/useSignaling.ts`
changes:

- A retryable close (not 4400/4401/4409/4410) **after this hook has opened** leaves `failure` at
  `null` while reconnect attempts remain. `connected` goes `false`. Only when the budget is
  exhausted does the hook set `lost`.
- The never-opened path (`unreachable` at the first failure) stays exactly as
  lb-call-connection-failure-path built it.

`useCallRoom` keeps its terminal mapping. Its `lost` comment becomes true and is left alone.
Roles: teacher and student, on `/sessions/<id>/call`, which already exists. RTL, themes and 320 px
are unchanged because nothing is rendered differently. During an outage the person sees the
ordinary room, as they would on a stable call.

## Module boundaries

- **backend `signaling`:** `signaling/fingerprint.py` imports only the standard library. The
  "signaling imports neither kaleem nor django" contract stays as it is.
- **dashboard:** the change stays inside `features/call`.
- **infra:** `scripts/deploy-lib.sh` gains `choose_signaling_sha`. `scripts/ship.sh` calls it
  after the step-3 pull and **exports** `SIGNALING_SHA`. The export is load-bearing:
  step 5's `--profile "$NEW" up -d` names no services, so it re-applies every non-profile service,
  `signaling` included, and a prefix-only variable would recreate signaling there.
  `docker-compose.production.yml`'s signaling image becomes
  `ghcr.io/kaleem-lms/backend:${SIGNALING_SHA:-${DEPLOY_SHA:-latest}}`, and its healthcheck gains
  `start_period: 30s` and `start_interval: 1s`.
- No event, no cross-module call and no new service, so the `SHARED_SERVICES` list is unchanged.
- **Image retention needs no change.** `select_prunable` already keeps any image a container
  uses, so a signaling container left on an older SHA keeps its image even after that SHA leaves
  the five-deploy history.

**Expand/contract and the blue-green window.** Each piece is safe in either landing order. Without
the backend module, `ship.sh` cannot read a fingerprint and recreates, which is today's behaviour.
Without the new `ship.sh`, the module is never called. The dashboard change is client-only. Tabs
still on the old bundle keep the old behaviour until they reload, and they still benefit from the
skipped recreate. The first deploy after landing always recreates signaling once, because the
running image has no fingerprint module.

**Personal data (ADR-0023).** None is collected, stored or shown. The fingerprint is a hash of code
and package metadata. The new log lines carry a 12-character fingerprint prefix and a commit SHA.

## Out of scope

- A drain or join-routing switch (rejected above).
- More than one signaling replica (the in-process `RoomRegistry` constraint stands).
- Changing the reconnect backoff. The one exception is the plan's rule for raising
  `MAX_RECONNECT_ATTEMPTS` by one if staging measures a recreate-to-routable time above about
  10 s after the healthcheck fix.
- The `unreachable` path's timing, and a call diagnostic for a signaling drop or a connect timeout
  (the existing ISSUES spot).
- The ADR-0037 "pre-flip room still joinable" staging check, beyond what M3 shows incidentally.
- Safari/iOS (the C3e deviation stands).

## Test plan

- **backend `signaling/tests/test_fingerprint.py`:** the same tree gives the same value. Changing a
  file under `signaling/` changes it. A change only under `tests/`, `__pycache__` or outside
  `signaling/` does not. A distribution version change, a `sys.version` change or a dpkg-status
  change each changes it. The output is 64 lowercase hex characters. `main()` prints exactly one
  line.
- **infra `scripts/test-deploy-lib.sh`** (docker stub, no daemon), `choose_signaling_sha`:
  - equal fingerprints keep the running SHA;
  - different fingerprints give the deploy SHA;
  - each failure gives the deploy SHA and a reason: no running container, `exec` failing (an
    image from before this change), `run` failing, garbage output, a running image that is not a
    `ghcr.io/kaleem-lms/backend:<sha>` tag.
- **dashboard `useSignaling.test.ts`:**
  - a drop after an open leaves `failure` null and keeps reconnecting;
  - after an open, exhausting the budget gives `lost` and no further socket;
  - a reconnect that hangs past `CONNECT_TIMEOUT_MS` after an open is retried and never reported
    as `unreachable`;
  - the two existing tests that assert `lost` on the first drop are rewritten to the new rule;
  - terminal close codes after an open stay immediate.
- **e2e `call.spec.ts`, one new serial flow: "a call survives a signaling drop".** Both peers join
  through `page.routeWebSocket`, which forwards to the real relay. Once remote frames are flowing,
  both routes cut their server connections at the same moment, as a relay restart would, and the
  pages see a close. The test asserts:
  - no "connection lost" heading appears;
  - the Leave control is still present;
  - `getVideoPlaybackQuality().totalVideoFrames` on the remote tile keeps rising during and after
    the cut;
  - the route sees a second socket per page (the reconnect);
  - no page error is logged.

  Time budget: about +20 s, with `test.setTimeout(90_000)`. **What it does not prove:** a real
  process restart, Traefik's health-gated routing, or the relay (TURN) path. Staging M2 covers
  those.
- **Staging (conductor, staging window, dec-d9-substitute), from the plan:**
  - **M1, before any change:** time a forced recreate and confirm the baseline (the terminal
    screen and a stopped camera on both sides).
  - **M2, after the client fix is deployed:** a forced recreate during a live call. Frames keep
    flowing and no terminal screen appears.
  - **M3:** a deploy whose signaling fingerprint is unchanged leaves the container ID and
    `StartedAt` unchanged.

## Open questions

None blocking. Two facts are checked in the plan before they are relied on: that the staging
Docker Engine supports `start_interval` (Engine 25+), and that compose recreates a service when a
value in its `env_file` changes. Each has a stated fallback.
