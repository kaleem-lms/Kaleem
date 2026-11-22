---
name: lb-call-connection-failure-path
phase: v1 (wave 2, scheduling stream)
modules: [dashboard (call)]
status: draft
created: 2026-10-18
closed: null
---

## Goal

A signaling socket that never opens must not leave the room on "Connecting…" forever. Give each
connection attempt a deadline, and when it passes, put the person on a "couldn't connect" screen
with the existing **Try again**. Retrying must bring the person back with the choices they made:
the same camera and microphone, and a camera they turned off stays off.

Grounded at dashboard `origin/main` 60371ee:

- `useSignaling` (`src/features/call/useSignaling.ts`) reacts only to `onopen` and `onclose`. A
  socket that is held in `CONNECTING` fires neither, so no failure is ever set. The room shows
  `WaitingForPeer` ("Connecting…"), which looks the same as an ordinary wait for the other person.
  A firewall or proxy that accepts the connection and never answers the upgrade causes this.
- A close that comes before the first open is already classified as `lost`. Its copy says "We
  couldn't reconnect after several tries", which is untrue for someone who never connected.
- `RoomPage.handleRetryConnection` (`src/routes/_call/-pages/RoomPage.tsx`) calls
  `localMedia.start()` with no arguments, so it asks for both kinds. `useLocalMedia.start` already
  passes the chosen `deviceId`s, so the device choice survives a retry. The camera on/off choice
  does not: the remounted `CallRoom` is seeded from the Lobby's choice, but the camera was acquired
  anyway, and the room only disables the track.

## User flow

1. A student or teacher taps **Join** in the Lobby. The room opens on "Connecting…".
2. **Happy path:** the socket opens within the deadline. Nothing changes from today.
3. **Never opens:** 10 seconds after the attempt started, with no open, the attempt is abandoned.
   - The person sees **"Couldn't reach the session server"**. The detail reads: "Check your
     internet connection, then try again. A school or work network may be blocking calls."
   - The screen has **Try again** and the existing way back to the schedule.
   - As on every terminal screen, the camera and microphone are already released.
4. **Refused before ever opening** (a 1006 close with no open): the person sees the same
   "couldn't reach" screen instead of the "lost" screen.
5. **Opened once, then the reconnect hangs:** the person sees the existing "Connection to the
   session server was lost" screen. The deadline applies to reconnect attempts too.
6. **Try again** remounts the room as it does today. It acquires:
   - the camera and microphone the person chose, by `deviceId`;
   - the camera only if their latest choice had it on.

   "Latest choice" means the Lobby's choice, then any in-room toggle after it. A muted microphone
   is still acquired and held disabled, as today.
7. The terminal screens for 4401, 4409 and 4410 do not change.

## Data model delta

None. There is no model, field or migration.

**Personal data (ADR-0023):** none. Nothing new is read, stored, sent or shown. No diagnostic row
is written (see Out of scope).

## API delta

None. The relay protocol and the close codes do not change. The client only stops waiting.

## Frontend

- **`useSignaling`:**
  - Add `CONNECT_TIMEOUT_MS = 10_000`, exported for tests. Each `connect()` arms a timer, and
    `onopen` clears it.
  - When the timer fires and the socket has not opened, the hook:
    - detaches that socket's `onopen`, `onmessage` and `onclose`;
    - calls `close()`;
    - runs the same path as an unexpected close: it sets the failure and schedules a backoff
      reconnect while the budget remains.
  - `close()` and the unmount cleanup clear the timer.
  - The timer callback checks the socket's identity, so a late timer cannot act on a newer socket.
- **New `SocketFailure` value, `unreachable`.** It is the failure for any retryable close or
  timeout while this hook instance has never opened. After the first open, the failure is `lost`,
  as today. 4401, 4409 and 4410 keep their own failures.
- **`useCallRoom`:**
  - `unreachable` maps to a terminal screen with `call.unreachableTitle`,
    `call.unreachableHelp` and `onRetry: onRetryConnection`. The existing terminal-cleanup effect
    covers it unchanged.
  - A new optional prop, `onMediaChoiceChange({ micOn, cameraOn })`, is called from `toggleMic`
    and `toggleCamera` with the new value.
- **`RoomPage`:**
  - `onMediaChoiceChange` updates `initialMedia` (the remount `key` does not change, so this does
    not remount).
  - `handleRetryConnection` calls `localMedia.start({ audio: true, video: initialMedia.cameraOn })`.
    The visibility recovery reuses this function, so it gets the same rule.
- **Locales:** add `call.unreachableTitle` and `call.unreachableHelp` to `en` and `ar`
  `common.json`. The Arabic is a draft for `hg-arabic-review`:
  - title: "تعذّر الوصول إلى خادم الجلسة"
  - help: "تحقق من اتصالك بالإنترنت، ثم حاول مرة أخرى. قد تكون شبكة المدرسة أو العمل تحجب
    المكالمات."

  The copy uses "session" (`dec-cur-terminology`).
- **Expand/contract:** client-only. A tab on the previous bundle keeps today's behaviour until it
  reloads. The relay never sees a frame from an abandoned socket, because none opened.
- **"Done":** on staging, in both themes, Arabic RTL and 320px, an agent Playwright run with
  `routeWebSocket` holding the socket shows the new screen, and **Try again** returns to the room
  (`dec-d9-substitute`).

## Module boundaries

The change stays inside the dashboard: `features/call` and the `_call` route. There is no new
import across modules, no contract change and no event.

## Out of scope

- **A diagnostic row for a connect timeout.** It needs a new `CallDiagnostic.Code` on the backend
  and the contract test. Close-out adds an `ISSUES.md` spot.
- **`lost` showing at the first drop.** It appears even though the hook keeps reconnecting behind
  the screen, and a later open does not clear it. This is the existing behaviour, and the timeout
  follows the same path on purpose. Close-out adds an `ISSUES.md` spot.
- **Tuning the backoff** (500 ms doubling, 5 attempts).
- **Safari/iOS.** CI cannot run Safari/iOS, and this project has no Apple device (the C3e
  deviation stands).

## Test plan

- **`useSignaling.test.ts`** (fake timers, `FakeSocket`):
  - a never-opened socket becomes `unreachable` at `CONNECT_TIMEOUT_MS`, is closed, and its
    handlers are detached;
  - a reconnect follows on the backoff;
  - an opened socket never times out;
  - opened, dropped, then a hung reconnect gives `lost`;
  - a 1006 before any open gives `unreachable`;
  - neither `close()` nor unmount leaves a timer that creates a socket;
  - a socket that opens after it was abandoned changes nothing.
- **`useCallRoom.test.tsx`:**
  - `unreachable` yields the unreachable terminal with `onRetryConnection`, and the cleanup runs;
  - each toggle reports `onMediaChoiceChange` with the new value.
- **`CallRoom.test.tsx`:** `socketFailure: "unreachable"` renders the title, and **Try again**
  calls `onRetryConnection`.
- **Room route test:**
  - join without camera, then retry: `start` gets `{ audio: true, video: false }`, and the remount
    is seeded with `initialCameraOn: false`;
  - an in-room camera-off before the retry gives the same result.
- **`useLocalMedia.test.ts`:** `start()` after `stop()` asks again for the chosen `deviceId`s. This
  pins existing behaviour; its mutation check removes the `deviceId` branch.
- **Mutation checks:** for each regression test, revert its fix and see red (the timer, the
  `unreachable` classification, the `video` argument, the toggle callback).
- **e2e, new flow `e2e/call-connect-timeout.spec.ts`:**
  - Setup: as `booked`, `page.routeWebSocket` matches the signaling URL with a handler that never
    settles. In playwright-core 1.62.1, `WebSocketRouteHandler.handle` awaits the handler before
    `_afterHandle()` → `ensureOpened`, so the page socket stays `CONNECTING`.
  - Join through the Lobby. Expect the unreachable heading and **Try again** within 20 s. Tap it,
    and expect the handler to be called a second time (a fresh attempt).
  - Proof: red on `origin/main`, because no terminal screen ever appears.
  - The flow never reaches the relay, so it holds no room seat and does not race the serial call
    flows.
  - Time budget: about +20 s (a 10 s deadline plus the join), with `test.setTimeout(60_000)`.
- **Gates:** the full dashboard gate (tsc, lint, `test:coverage` at the existing floors, build,
  built-CSS check). CI's e2e is the authority.

## Open questions

None. `dec-cur-terminology` is resolved. The Arabic wording goes to `hg-arabic-review`, which
holds spec closure, not the merge. Build starts after `cur-session-wording` merges (`depends_on`).
