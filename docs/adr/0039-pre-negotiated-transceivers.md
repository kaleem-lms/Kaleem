---
number: 0039
title: Pre-negotiate every media line before the first offer
status: accepted
date: 2026-09-11
---

**Related:** ADR-0034 (custom WebRTC in v1), ADR-0035/ADR-0037 (signaling as a shared
service), `docs/superpowers/specs/2026-09-11-call-experience-redesign-design.md`

## Context

C3d's peer connection negotiates **once**, and only once. The rule is stated in
`dashboard/src/features/call/usePeerConnection.ts` and enforced in exactly one place: the
teacher sends an offer on every `peer-joined`, the student never does. There is no
`onnegotiationneeded` handler. W3C perfect negotiation (polite/impolite peers) was
considered when that code was written and deliberately rejected, because glare requires
both sides to be able to offer and a fixed offerer makes that state unreachable.

That decision is sound and this ADR does not reopen it. What it did not anticipate is that
**the set of media lines is fixed at first-track-attach**, by `addTrack`:

```
for (const track of localStream.getTracks()) {
    sendersRef.current.set(track.kind, pc.addTrack(track, localStream));
}
```

Three consequences follow, and all three are load-bearing for the next phase:

1. **No local media means no media lines at all.** `tracksAddedRef` never flips, so both the
   offer and the answer sit in `pendingActionsRef` forever. A participant who declines the
   camera prompt does not join a degraded call — they join a call that can never negotiate,
   with no error, because the deferral mechanism is indistinguishable from "media is still
   arriving". The current UI hides this by refusing to show the Join button until
   `getUserMedia` resolves, which is a workaround for the defect, not an absence of it.

2. **A track that arrives later cannot be added.** The file says so directly: adding on a
   later stream change "would create a SECOND sender per kind: duplicate `m=` sections that
   this design's single fixed offerer never renegotiates, and a call that degrades with
   nothing thrown." So `replaceTrack` on an existing sender is the only safe mid-call move,
   and "a kind with no sender is silently skipped."

3. **Screen share is a second video track, so it is the same wall.** It can only replace the
   camera on the one negotiated video line, which is not what a participant expects when
   they share.

The next phase needs all three: join without granting permission, enable a device mid-call,
and share a screen while the camera stays live.

The obvious fix — allow renegotiation — costs the invariant. Renegotiation from the student
side means the student offers, which is precisely the glare the single-offerer rule exists
to make unreachable, and it would drag in the perfect-negotiation machinery that was
rejected on purpose.

## Decision

**Create every media line with `addTransceiver` at connection setup, before the first offer
is generated, whether or not any local media exists yet.** Three transceivers, in a fixed
order, both sides identical:

| Index | Kind | Direction | Carries |
| --- | --- | --- | --- |
| 0 | audio | `sendrecv` | microphone |
| 1 | video | `sendrecv` | camera |
| 2 | video | `sendrecv` | screen share |

Every later media change becomes `sender.replaceTrack(track)` on a line that is **already
negotiated** — including `replaceTrack(null)`, which is how a line with nothing to send is
expressed. Attaching the microphone twenty minutes into a lesson, turning the camera on
after joining with it off, starting and stopping a screen share: all of them reuse an
existing `m=` line and its codec.

This removes the reason to renegotiate rather than adding a mechanism to do it safely. The
single-offerer rule is untouched, `onnegotiationneeded` is still absent, and `tracksAddedRef`
and `pendingActionsRef` — the deferral machinery that exists only because SDP could go stale
waiting for media — become unnecessary, because no SDP is ever generated before the media
lines exist.

**The fixed order is part of the contract, not an implementation detail.** Transceivers are
matched to `m=` sections positionally, so both peers must create the same three in the same
order. A future fourth line is appended, never inserted. This is the kind of invariant that
is obvious while writing it and invisible six months later, so it is tested directly rather
than left to review.

## Alternatives considered

**Perfect negotiation (polite/impolite peers).** The textbook answer, and it solves more
than we need. It re-admits glare as a state that must be handled correctly instead of one
that cannot occur, on a code path — a live lesson with a child — where the failure mode is
silent and the debugging signal is a parent saying "it didn't work". Rejected for the same
reason C3d rejected it.

**A `request-offer` signal**, letting the student ask the teacher to re-offer when the
student needs a new line. Keeps one offerer, but adds a round trip to the moment a
participant unmutes, makes every media change depend on the other side being responsive, and
introduces a queue of pending requests. Strictly more moving parts than negotiating the
lines up front, for strictly less capability.

**Screen share via `replaceTrack` on the camera line.** No architecture change at all, and
genuinely tempting. Rejected on product grounds: the participant's camera goes dark for the
other side while they share, which is not what any mainstream product does, and it makes the
per-viewer layout control the spec calls for meaningless — there is only ever one video to
lay out.

**Renegotiating only for screen share**, keeping one line for camera. Splits the rule into
"we never renegotiate, except sometimes", which is the shape of invariant that survives
exactly as long as the person who wrote it.

## Consequences

**Every call now negotiates three `m=` lines, including ones carrying nothing.** An audio-only
participant negotiates two video lines that send no media. The cost is a slightly larger SDP
and two extra ICE-less `m=` sections; there is no media, no encoder, and no bandwidth for a
line whose sender has a `null` track. This is the standard trade and it is cheap.

**`recvonly` is no longer a failure mode to guard against.** The old code's second stale-SDP
hazard — an answer generated before tracks attach negotiates `recvonly` and nothing ever
renegotiates it — cannot occur, because `sendrecv` is declared at setup rather than inferred
from what happened to be attached.

**`tracksAddedRef`, `pendingActionsRef` and `runOrDefer` can go.** They exist solely to keep
SDP from being generated before media arrived. That race no longer exists. Removing them is
part of this change, not a later cleanup — leaving dead deferral machinery next to a design
that no longer defers is how the next reader concludes the race is still real.

**The mute path stays exactly as it is.** `track.enabled = false` remains the mechanism for
muting; `replaceTrack(null)` is for a line that has *no device*, which is a different state.
Conflating them would either make mute renegotiate (slow, and it drops the encoder) or make
"no camera" indistinguishable from "camera muted" to the other side.

**Both peers must ship this together.** A peer that pre-negotiates three lines and one that
adds two on first attach do not produce matching SDP. There is no version negotiation in the
signaling protocol and this ADR does not add one: the dashboard is a single deployed bundle
and both participants load it from the same origin, so a mismatch can only exist in the
window where one participant has an old bundle cached. That window is real — a lesson in
progress across a deploy — and it is the same window in which ADR-0037's deploy already drops
calls (`ISSUES.md`, "deploy between lessons"). It does not need a second mechanism, but it
does need the runbook line, and the spec's test plan covers a mismatched pair explicitly so
the failure is a known shape rather than a surprise.

**C3d's e2e call spec must keep passing unchanged.** The two-peer fake-media test asserts a
remote track producing frames; if pre-negotiation is right, that test does not know anything
changed. A change to that spec's expectations would be evidence the negotiation shape moved,
so it is the regression signal for this ADR.

---

## Amendment — 2026-09-11: the answerer cannot create its own lines

**The design held. The implementation had a defect, and it was in this ADR's own text.**

This ADR's regression signal worked exactly as intended. `dashboard/e2e/call.spec.ts` went red
on the first end-to-end run of the implementation, on both peers, and that is what surfaced
everything below. It is now green again, unchanged.

### What was measured

Two real browser contexts, a real signaling service and a real `RTCPeerConnection` pair, with
`RTCPeerConnection` instrumented through CDP. On the answering side:

| # | mid | direction | sender.track | created by |
| --- | --- | --- | --- | --- |
| 0–2 | `null` | `sendrecv` | audio / camera / — | our `addTransceiver` calls |
| 3–5 | `"0"`, `"1"`, `"2"` | **`recvonly`** | — | the browser, applying the offer |

**Six transceivers, not three.** The three this side created were never associated with the
offer's `m=` sections; the browser built its own. Two consequences, both silent:

1. `ontrack` fired with transceivers 3–5 — objects no map in `usePeerConnection` had ever
   seen — so the handler, which matched on object identity, discarded **every remote track**.
2. The answer was generated from 3–5, so it went out `recvonly` on all three lines. The
   answerer's actual media sat on 0–2, which appeared in no SDP at all.

Neither peer received anything, in either direction, while both reported
`connectionState: "connected"`. `call-hardening.spec.ts`'s autoplay flow was collateral: it
needs a remote tile that never appeared.

### Why — the two cheap explanations, ruled out by measurement

- **Not a timing bug.** Logging immediately before `setRemoteDescription` shows
  `transceiverCount: 3`, all three `addTransceiver` calls already applied. The removal of
  `runOrDefer` is not implicated.
- **Not a stale or re-created connection.** One construction (`constructions: 1`), one object
  across every logged operation. No remount, no `pcRef` churn.

Reproduced outside the application entirely — two `RTCPeerConnection`s in a blank page, no
React, no signaling — which isolates the rule:

| Answerer builds its lines with | transceivers before → after `setRemoteDescription(offer)` | associated? |
| --- | --- | --- |
| `addTransceiver` × 3, no tracks | 3 → **6** | no |
| `addTransceiver` × 3 + `replaceTrack` (our exact shape) | 3 → **6** | no |
| `addTrack` × 2 | 2 → **3** | **yes**, `mid` 0 and 1, `sendrecv` |
| nothing | 0 → 3 | n/a — the browser's own |

So this is **specified behaviour, not a Chromium quirk**: a remote offer's `m=` section may
only be matched to a transceiver created by `addTrack()`. One created by `addTransceiver()` is
reserved for *this* side's own next offer and is deliberately left alone. The sentence in the
Decision above — "Three transceivers, in a fixed order, **both sides identical**" — asks for
something a conforming browser will not do, and no browser was consulted before it was
written.

### What changes

**The wire contract is unchanged.** Three lines, fixed order (audio, camera, screen), all
`sendrecv`, no renegotiation, single offerer. Everything this ADR actually decided still
stands, including the part that matters most: the fourth row of the table above was extended
to confirm that an answerer which creates nothing, then sets its adopted transceivers to
`sendrecv` and `replaceTrack`s onto them, produces an answer with `a=sendrecv` on **all three
lines including one carrying no track at all**. Joining with nothing and enabling a device
later works exactly as decided.

What changes is only **who calls what**:

- **The offerer creates the three lines** with `addTransceiver`, before the first offer,
  as decided. Unchanged.
- **The answerer creates nothing.** It adopts the three the offer brings, sets each to
  `sendrecv`, and attaches whatever local media it has — all of it *before* `createAnswer`,
  because the answer is built from those directions.
- **Remote tracks are routed by position, not by object identity.** A line is identified by
  its index among the connection's *associated* transceivers (those carrying a `mid`), which
  is what the fixed order actually means on the wire. Identity was never a safe key; it only
  looked like one from the offerer's side.

"Both sides identical" is therefore **withdrawn** as an implementation rule. The fixed order
remains the contract, and it remains the thing a future fourth line must append to.

### Why the tests did not catch it

`usePeerConnection.test.ts`'s double returned, from `getTransceivers()`, exactly the objects
its own `addTransceiver` had handed out. The one behaviour that breaks in a real browser — the
browser declining to take up your transceiver and building its own — was **unrepresentable**,
so 804 unit tests passed against a call that delivered no media at all.

The double now models it: a separate list for transceivers it builds while applying a remote
offer, `mid`s that are null until a line is on the wire, and `getTransceivers()` as the only
view the hook is allowed to read. Two tests pin the behaviour and were **verified to fail
against the previous implementation** before being kept.

This is the same shape as the deviations recorded for C3e: a verifier that cannot express the
failure it exists to catch is not a verifier. Any future change to how lines are established
needs the double changed with it, or it proves nothing.

### One consequence this ADR under-stated

"An audio-only participant negotiates two video lines that send no media" is written above as
a cost in bandwidth. It is also a **UI** consequence, and it was missed: a negotiated screen
line delivers a receiver track on every call whether or not anyone is sharing, so the room
renders a blank screen tile for the whole lesson.

Gating on `track.muted` was tried and removed: measured against two real peers with nobody
sharing, the idle screen track reports `muted: false` at 3 s, 8 s and 13 s while `videoWidth`
stays 0. `event.streams` cannot substitute either — a sender with no track at negotiation time
carries no msid, and `replaceTrack` never renegotiates one in. Knowing whether a peer is
actually sharing needs an explicit signal (a signaling message or receiver stats), which is
C4b's to add along with the surface that consumes it. Recorded in `ISSUES.md` rather than
guessed at, and called out here because the cost paragraph above should have predicted it.

### And the lobby gate

The Context above says the current UI "hides this by refusing to show the Join button until
`getUserMedia` resolves, which is a workaround for the defect, not an absence of it", and
scheduled its removal for the next phase. That was wrong, for a reason worth recording: it
would have shipped a capability no user could reach and no test could drive — the end-to-end
proof for this ADR could not be written at all while the door was shut. The gate is removed
in the same change as the fix. The lobby's layout, its device pickers and its preview remain
C4b's; the C3e-b gesture gate is untouched, and requesting media is still a real tap.
