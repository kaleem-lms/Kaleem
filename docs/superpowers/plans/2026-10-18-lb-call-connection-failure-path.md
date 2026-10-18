---
spec: docs/superpowers/specs/2026-10-18-lb-call-connection-failure-path-design.md
status: draft
---

Repo: `dashboard` only. Worktree:
`/home/abdulkhalek/Projects/kaleem-worktrees/dashboard-lb-call-connection-failure-path` on
`feat/lb-call-connection-failure-path`, created from `origin/main` **after `cur-session-wording`
has merged** (runbook section 1), then `pnpm install --frozen-lockfile`.

- No migration, no backend change and no dependency change.
- Focused runs: `_tools/dashboard-gate.sh <wt> <test file>`.

## Steps

1. [ ] **Connect deadline in `useSignaling`.**
   - Red first, in `src/features/call/useSignaling.test.ts`, with `vi.useFakeTimers()` in a
     `try/finally`, as in the existing backoff test:
     - `it("abandons a socket that never opens and reports it unreachable")`: advance
       `CONNECT_TIMEOUT_MS`. Expect `failure === "unreachable"`, the hung socket's `close` called,
       and its `onopen`/`onmessage`/`onclose` set to `null`.
     - `it("retries a socket that never opened on the drop path's backoff")`: advance
       `CONNECT_TIMEOUT_MS + 500`. Expect `created === 2`.
     - `it("never times out a socket that opened")`: `open()`, then advance 60 s. Expect
       `failure === null` and `created === 1`.
     - `it("ignores a socket that opens after it was abandoned")`: after the timeout, call the
       saved `onopen`. Expect `connected === false`.
     - `it("leaves no pending deadline after close() or unmount")`: advance 60 s. Expect no new
       socket.
   - Green: export `CONNECT_TIMEOUT_MS = 10_000`. In `connect()`, keep a per-socket timer.
     `onopen` and `onclose` clear it. The timer callback returns early unless
     `socketRef.current === socket && !openRef.current`. Otherwise it nulls the three handlers,
     calls `socket.close()`, and calls the shared drop handler that `onclose` now also uses.
     `close()` and the unmount cleanup clear the timer.
   - Mutation: delete the `setTimeout` and see the first two tests red. Drop the identity guard and
     see the late-open test red.
2. [ ] **`unreachable` versus `lost`.**
   - Red first:
     - `it("reports a close before any open as unreachable")` (1006 without `open()`);
     - `it("reports a hung reconnect after an open as lost")` (`open()`, `close(1006)`, advance
       past the backoff, then `CONNECT_TIMEOUT_MS`).
   - Green: add `"unreachable"` to `SocketFailure`. Keep an `everOpenedRef` that `onopen` sets.
     The drop handler classifies a retryable failure as `unreachable` until it is set. 4400 keeps
     `bad-message`. 4401, 4409 and 4410 are untouched.
   - Mutation: always use `lost`, and see the first test red.
3. [ ] **The unreachable screen.**
   - Red first:
     - `useCallRoom.test.tsx`, `it("shows the couldn't-reach screen with a retry when the socket is unreachable")`:
       `mockSignaling("unreachable")`. Expect `terminal` to have
       `titleKey: "call.unreachableTitle"`, `detailKey: "call.unreachableHelp"` and
       `onRetry === onRetryConnection`, and the peer close and media stop to be called.
     - `CallRoom.test.tsx`, `it("an unreachable signaling server is announced with a retry")`:
       `socketFailure: "unreachable"`. Find the heading by text, click **Try again**, and expect
       `onRetryConnection` once.
   - Green: add a branch in `useCallRoom`'s terminal chain next to `lost`. Add
     `call.unreachableTitle` and `call.unreachableHelp` to `src/locales/en/common.json` and
     `src/locales/ar/common.json` (wording in the spec; the Arabic is flagged for
     `hg-arabic-review`). `parity.test.ts` and `terminology.test.ts` must stay green.
   - Mutation: remove the branch, and see both tests red.
4. [ ] **Retry keeps the person's choices.**
   - Red first:
     - `useCallRoom.test.tsx`, `it("reports each mic and camera toggle to onMediaChoiceChange")`.
     - `sessions.$sessionId.room.test.tsx`: extend the mocked `CallRoom` to capture
       `onRetryConnection` and `onMediaChoiceChange`. Then:
       - `it("a connection retry does not re-acquire a camera left off in the lobby")`: tap
         **join without camera**, invoke the captured retry. Expect
         `start` toHaveBeenCalledWith `{ audio: true, video: false }` and
         `latestInitialCameraOn === false` after the remount.
       - `it("a connection retry keeps a camera turned off inside the room")`: join with the
         camera, then report `{ micOn: true, cameraOn: false }`, then retry. Same expectations.
     - `useLocalMedia.test.ts`, `it("start() after stop() asks for the chosen devices again")`:
       `selectCamera("cam-2")`, `stop()`, `start()`. Expect the last `getUserMedia` call to have
       `video.deviceId.exact === "cam-2"`. This pins existing behaviour; its mutation removes the
       `deviceId` branch in `start`.
   - Green:
     - add the optional `onMediaChoiceChange` to `CallRoomProps`;
     - call it from `toggleMic` and `toggleCamera` in `useCallRoom`, with `next`;
     - `RoomPage` passes a `useCallback` that calls `setInitialMedia`;
     - `handleRetryConnection` calls `localMedia.start({ audio: true, video: initialMedia.cameraOn })`
       and adds `initialMedia.cameraOn` to its dependencies.
   - Check that the visibility-recovery tests still pass: they assert `start` was called, not
     what it was called with.
   - Mutation: revert to `start()`, and see both route tests red.
5. [ ] **e2e flow** in `e2e/call-connect-timeout.spec.ts`. It is one test and does not need
   `test.describe.configure({ mode: "serial" })`, because it never reaches the relay.
   - Setup: `login(page, "booked")`. Before `goto`, call `page.routeWebSocket(url => url.protocol.startsWith("ws"), () => { attempts += 1; return new Promise(() => {}); })`.
   - Steps:
     - `/schedule`, then **Join**, `enableLobbyCamera`, **Join now**;
     - expect `getByRole("heading", { name: /couldn't reach/i })` (the CallEnded title role, as
       today's lost screen renders it) within 20 s;
     - expect `attempts >= 1`;
     - click **Try again**, then `expect.poll(() => attempts)` to grow.
   - Positive control: before the deadline (say at 2 s), the heading is absent and the room is
     visible.
   - `test.setTimeout(60_000)`.
   - Proof: run it against an `origin/main` build and see it red (it times out with no heading).
     Record the result in the PR.
6. [ ] **Gates and hand-back.**
   - Run the full `_tools/dashboard-gate.sh <wt>`: tsc, lint, `test:coverage --maxWorkers=6` at
     the existing floors (never edit them), build and `check-colors --built`.
   - The e2e slot is optional (runbook section 2), and CI is the authority.
   - Commit with explicit paths, e.g. `fix(call): time out a signaling socket that never opens`.

Close-out (conductor, meta):
- add a D3 table row: `scheduling` — connect timeout, 1 flow, with "Chromium only; proves the
  client deadline, not a real blocked network";
- add the two `ISSUES.md` spots named in the spec's Out of scope;
- record `hg-arabic-review` for the two Arabic strings.

## Risks

- **A false timeout on a slow but healthy network.** 10 s is many times a normal handshake, and a
  timeout still lands on a retryable screen while the backoff keeps trying behind it. Fallback:
  raise the constant. It is one number, so no ADR.
- **The Playwright mock semantics change.** The e2e relies on a never-settling handler keeping the
  page socket in `CONNECTING`, which was read from the playwright-core 1.62.1 source. If a
  Playwright bump changes it, the positive control and the red-on-main proof show it. Fallback: a
  handler that calls `connectToServer()` against a black-holed URL.
- **The timer races the open.** The identity and `openRef` guard, plus handler detachment, cover
  it. Step 1's late-open test pins it.
- **The toggle callback churns `RoomPage`.** `setInitialMedia` changes state but not the `key`, so
  nothing remounts. Step 4's route tests would catch a remount (seed values).
- **The dependency on `cur-session-wording`.** Building first would conflict in
  `common.json`. Do not create the worktree until it has merged.

## Verification

- Each step: its named tests go red before the change and green after. Each mutation check is
  recorded in the PR body.
- Whole: a green full dashboard gate locally, then green CI including the new e2e flow (read the
  e2e log for `call-connect-timeout`).
- On staging, per `dec-d9-substitute`: an agent Playwright click-through with a routed socket in
  both themes, Arabic RTL and 320px. **Try again** returns to the room, and with the camera left
  off in the Lobby, no camera track is live after the retry.
