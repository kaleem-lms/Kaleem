---
number: 0063
title: A deploy no longer ends a call on the signaling relay
status: proposed
date: 2026-10-25
amends: 0037
---

<!-- The number is provisional: the conductor allocates ADR numbers. Renumber on land. -->

## Context

ADR-0037 made signaling one shared replica and said, in its consequences, that "a deploy still
drops calls in progress". Reading the code shows that two separate things end a call, and both
had to be fixed.

**The server recreated the relay on every deploy.** The `signaling` service runs the backend
image, and every deploy has a new image tag, so `ship.sh` step 4 recreated the container even
when nothing in `signaling/` had changed. Room membership is an in-process dict, so every socket
closed.

**The client treated one drop as the end of the call.** `useSignaling` set `failure = "lost"` on
the first retryable close after an open, before it scheduled the first reconnect, and `useCallRoom`
treats `lost` as terminal: it closes the peer connection and stops the camera and microphone. Media
is peer to peer and never passes through the relay, so the call would otherwise have carried on.
The comment in `useCallRoom` already described the intended rule ("the socket exhausting its own
reconnect budget"). The code did not follow it.

Fixing only the server leaves every call ending on a deploy that does change the relay, and on any
network blip. Fixing only the client needs the relay routable again inside the client's 15.5 s of
backoff (0.5 + 1 + 2 + 4 + 8), and Traefik does not route to a container whose health status is
still `starting`. The healthcheck's first probe ran 15 s after start.

## Decision

1. **Recreate signaling only when it changes.** `ship.sh` compares a fingerprint of the running
   container with one of the incoming image (`python -m signaling.fingerprint`). The fingerprint
   is a SHA-256 over every file under `signaling/` except tests and bytecode, every installed
   distribution by name and version, the interpreter version, and the base image's dpkg status.
   When the two match, `ship.sh` keeps the running SHA by exporting `SIGNALING_SHA`, which the
   compose file prefers over `DEPLOY_SHA` for the signaling image. When they differ, or when
   either cannot be read for any reason, signaling is recreated on the new SHA, which is the
   behaviour before this ADR. A false "changed" costs a recreate. A false "unchanged" would leave
   stale code serving live calls, so the inputs are deliberately broad.
2. **Clients ride out a restart.** A close the server gave no reason for, after the hook has
   opened, is not a failure while reconnect attempts remain. `connected` goes `false`, the peer
   connection and local media are kept, and `lost` is set only when the budget is spent. A drop
   before the first open, and the codes the server names (4400, 4401, 4409, 4410), behave as
   before. When both peers rejoin, the existing `peer-joined` rule makes the teacher re-offer on
   the same `RTCPeerConnection`. No server state is needed: a relay room is created by the first
   socket that joins it (ADR-0037).
3. **A recreated relay becomes routable in about a second.** The healthcheck gains
   `start_period: 30s` and `start_interval: 1s`, so Traefik sees the new container as healthy
   within about a second of it starting instead of after one 15 s interval.

`SIGNALING_SHA` is exported, not used as a prefix: step 5's `--profile "$NEW" up -d` names no
services, so it re-applies every non-profile service, signaling included, and would recreate it
there. `restore_signaling` compares against and restores through `SIGNALING_SHA`.

## Consequences

- On a deploy that leaves the relay's inputs alone, nothing happens to a call. The container keeps
  its ID and start time, and the deploy log prints `signaling unchanged (<fp12>); keeping <sha>`.
- On a deploy that changes the relay, or on a dropped socket, both sockets close, the video keeps
  playing, the hook reconnects, and the teacher re-offers. If signaling stays down for more than
  about 15 s, the existing "connection lost" screen appears, now only when the budget is really
  spent.
- The first deploy after this lands always recreates signaling once: the running image has no
  fingerprint module.
- The fingerprint is a conservative proxy. Any change to a pinned dependency or the base image
  recreates the relay even if signaling does not import it. That is the safe direction.
- Image retention needs no change: `select_prunable` keeps any image a container uses, so a relay
  left on an older SHA keeps its image after that SHA leaves the five-deploy history.
- Secret rotation still works because the command line and `env_file` belong to the compose
  service definition, which compose already hashes. This was checked: editing a value in an
  `env_file` and running `up -d` again recreated the container, and a second `up -d` with no edit
  did not (compose 5.6.1).
- Expand/contract: each piece is safe in either landing order. Without the backend module,
  `ship.sh` cannot read a fingerprint and recreates. Without the new `ship.sh`, the module is never
  called. The dashboard change is client-only, and a tab still on the old bundle keeps the old
  behaviour until it reloads.

## Alternatives considered

**Drain** (stop routing new joins, wait for rooms to empty, then recreate). Needs a join-routing
switch that does not exist (ADR-0037). Once clients survive a restart, a drain would only shorten
an outage the client already rides out. Rejected.

**Room resume on the server** (persisting room membership across a restart). Costs a shared store
and a second correctness-critical mechanism for no gain: a room is rebuilt by the first socket that
joins, and the peers already rebuild the negotiation. Rejected.

**Hash only `signaling/`.** Cheaper to reason about, but it would keep serving a stale interpreter
or library after a dependency or base-image update. Rejected: a wrong "unchanged" is the unsafe
error.

**A separate image for signaling.** The honest long-term shape, and it would make the tag the
fingerprint. Out of scope: it adds a build, a registry path and a second pull to every deploy.

## Not proven here

- A real process restart behind Traefik's health-gated routing, and the TURN relay path, are not
  reachable from CI. The e2e flow drops the relay connections through `page.routeWebSocket` and
  proves the pages carry on and reconnect to a relay that is still running. The staging
  measurements below cover the rest.
- Safari and iOS: unchanged (the C3e deviation stands).

## Staging measurements

To be recorded by the conductor during the staging window, then filled in here. None of these
values is sensitive.

| | Measured | Expected from the code |
| --- | --- | --- |
| Docker Engine and compose versions (`start_interval` needs Engine 25+) | | |
| M1 (before): forced recreate to healthy | | about 15 s |
| M1: first page close to "lost", and whether frames stopped | | about 1 s, frames stop |
| M2 (after): forced recreate to healthy | | about 2 s |
| M2: terminal screen, frames | | none, frames keep rising |
| M3: container ID, `StartedAt` and image across an unrelated deploy | | all unchanged |

If M2 shows a recreate-to-healthy time above about 10 s, `MAX_RECONNECT_ATTEMPTS` goes up by one in
a follow-up commit.
