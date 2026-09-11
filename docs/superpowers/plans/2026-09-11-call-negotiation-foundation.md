# Call Negotiation Foundation (C4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the peer connection negotiate audio, camera and screen lines before the first offer, so joining with no permission, enabling a device mid-call, and sharing a screen alongside the camera all become `replaceTrack` on an already-negotiated line.

**Architecture:** ADR-0039. Three `addTransceiver` calls at connection setup in a fixed order (audio, camera, screen), all `sendrecv`, regardless of whether local media exists. Every later media change is `sender.replaceTrack(track | null)`. The single-offerer rule (teacher offers, student never does) is untouched, and `onnegotiationneeded` stays absent. The deferral machinery that exists only because SDP could go stale waiting for media — `tracksAddedRef`, `pendingActionsRef`, `runOrDefer` — is deleted, because that race no longer exists.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react, Playwright. Django 5 / DRF for the one backend task.

**Spec:** `docs/superpowers/specs/2026-09-11-call-experience-redesign-design.md`

**Scope:** This is the **first of two plans** for that spec. It delivers the capability and the minimum UI to exercise it. The lobby/control-bar/layout redesign is plan C4b, written after this lands — the UI is designed against a capability that exists, not one that is planned.

## Global Constraints

- **The single-offerer rule is load-bearing.** The teacher offers on `peer-joined`; the student never offers. No `onnegotiationneeded` handler is added in any task.
- **Transceiver order is the contract:** index 0 audio, 1 camera, 2 screen. Both peers create the same three in the same order. A future line is appended, never inserted.
- **Mute stays `track.enabled = false`.** `replaceTrack(null)` means "this line has no device", which is a different state. Never conflate them.
- **No renegotiation after the first offer/answer.** If a change seems to need one, it is wrong.
- **Coverage floors are ratchets (ADR-0026):** dashboard 95.2 lines / 91.5 branches / 87.0 functions in `vitest.config.ts`, backend 97.7 in `pyproject.toml`. They may only go up. Raise them in the PR that lifts them.
- **Commit style:** `feat:` / `test:` / `refactor:`, and never `--no-verify` (D5). Pre-commit needs `PIP_CONFIG_FILE=/dev/null` on this machine.
- **Branch:** `feat/c4a-negotiation-foundation` off `main` in the `dashboard` submodule (and off `main` in `backend` for Task 6). Never commit to a trunk.
- **Run dashboard tests with** `pnpm vitest run <path>` from `dashboard/`.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `dashboard/src/features/call/usePeerConnection.ts` | Owns the connection, the three lines, and all `replaceTrack` | 1, 2, 3, 4 |
| `dashboard/src/features/call/usePeerConnection.test.ts` | Its tests | 1, 2, 3, 4 |
| `dashboard/src/features/call/useScreenShare.ts` | `getDisplayMedia`, the `ended` listener, share state | 5 |
| `dashboard/src/features/call/useScreenShare.test.ts` | Its tests | 5 |
| `dashboard/src/features/call/useLocalMedia.ts` | Gains per-kind acquisition | 6 |
| `dashboard/src/features/call/useCallRoom.ts` | Threads the new shapes through | 2, 5 |
| `dashboard/src/features/call/CallRoom.tsx` | Renders the screen tile; minimal, redesigned in C4b | 2, 5 |
| `dashboard/src/features/call/diagnosticsApi.ts` | Two new codes | 7 |
| `backend/kaleem/scheduling/models.py` | `CallDiagnostic` code choices | 7 |

---

### Task 1: Pre-negotiate three transceivers

**Files:**
- Modify: `dashboard/src/features/call/usePeerConnection.ts` (`PeerConnectionLike`, the mount effect, `handleSignal`)
- Test: `dashboard/src/features/call/usePeerConnection.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `export type MediaLine = "audio" | "camera" | "screen"`. A module-level `const MEDIA_LINES: readonly MediaLine[]`. `sendersRef` becomes `useRef(new Map<MediaLine, RTCRtpSender>())`, keyed by line rather than by track kind — Tasks 2–5 all read it.

- [ ] **Step 1: Write the failing test**

Add to `usePeerConnection.test.ts`. First extend `FakePeerConnection` with the transceiver surface, just above `addTrack`:

```typescript
	// Records every addTransceiver call in order. Order is the contract
	// (ADR-0039) -- transceivers match m= sections positionally -- so the
	// test asserts the sequence, not just the set.
	transceivers: { kind: string; direction: string; sender: RTCRtpSender }[] =
		[];
	addTransceiver = vi.fn((kind: string, init?: { direction?: string }) => {
		const transceiver = {
			kind,
			direction: init?.direction ?? "sendrecv",
			sender: { replaceTrack: vi.fn(async () => {}) } as unknown as RTCRtpSender,
		};
		this.transceivers.push(transceiver);
		return transceiver;
	});
```

Then the two tests:

```typescript
	it("negotiates three lines in the fixed order before any media exists", () => {
		const pc = new FakePeerConnection();
		renderHook(() =>
			usePeerConnection({
				...base,
				localStream: null,
				createPeerConnection: () => pc as unknown as RTCPeerConnection,
			}),
		);
		expect(pc.transceivers.map((t) => t.kind)).toEqual([
			"audio",
			"video",
			"video",
		]);
		expect(pc.transceivers.every((t) => t.direction === "sendrecv")).toBe(true);
	});

	it("the teacher offers with NO local media at all", async () => {
		const send = vi.fn();
		const pc = new FakePeerConnection();
		const { result } = renderHook(() =>
			usePeerConnection({
				...base,
				isTeacher: true,
				send,
				localStream: null,
				createPeerConnection: () => pc as unknown as RTCPeerConnection,
			}),
		);
		await act(async () => {
			await result.current.handleSignal({ type: "peer-joined" });
		});
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({ type: "offer" }),
		);
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/call/usePeerConnection.test.ts -t "negotiates three lines"`
Expected: FAIL — `pc.transceivers` is `[]` because nothing calls `addTransceiver`. The second test FAILS too: with no `localStream`, `runOrDefer` parks the offer in `pendingActionsRef` and `send` is never called.

- [ ] **Step 3: Write minimal implementation**

In `usePeerConnection.ts`, add `"addTransceiver"` to the `Pick` list in `PeerConnectionLike`, then above the hook:

```typescript
// The three media lines every call negotiates, in the order they are
// created. Transceivers match m= sections positionally, so this order is a
// wire contract between the two peers, not an implementation detail: both
// sides create the same three, and a fourth line is APPENDED, never
// inserted. See ADR-0039.
export type MediaLine = "audio" | "camera" | "screen";

const MEDIA_LINES: readonly { line: MediaLine; kind: "audio" | "video" }[] = [
	{ line: "audio", kind: "audio" },
	{ line: "camera", kind: "video" },
	{ line: "screen", kind: "video" },
];
```

Change the senders ref to be keyed by line:

```typescript
	const sendersRef = useRef(new Map<MediaLine, RTCRtpSender>());
```

Inside the mount effect, immediately after `pcRef.current = pc;`:

```typescript
		// Every line is created here, BEFORE any offer or answer can be
		// generated, whether or not local media exists yet. This is the whole
		// of ADR-0039: it makes the SDP's shape independent of what media
		// happened to have arrived, which is what lets someone join with
		// nothing and turn a device on later without renegotiating.
		for (const { line, kind } of MEDIA_LINES) {
			sendersRef.current.set(
				line,
				pc.addTransceiver(kind, { direction: "sendrecv" }).sender,
			);
		}
```

Now delete the deferral machinery, which has nothing left to defer: remove `tracksAddedRef`, `pendingActionsRef`, the `runOrDefer` callback and its long comment block, and the `addTrack` branch of the `localStream` effect. In `handleSignal`, the two call sites become direct:

```typescript
					if (isTeacherRef.current) {
						sendOffer();
					}
```

```typescript
						await pc.setRemoteDescription(message.sdp);
						sendAnswer();
						return;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/call/usePeerConnection.test.ts`
Expected: the two new tests PASS. **Several existing tests will now fail, and that is correct** — every test built around `fakeLocalStream` existing "so the offer is not deferred" is asserting machinery this task deletes. Update each: drop the `rerender({ localStream: fakeLocalStream })` line and the `initialProps` stream where the test's subject is the offer/answer itself. Delete the `fakeLocalStream` comment block at the top of the file (it documents `runOrDefer`) and keep the constant only where a test genuinely needs a stream. Do not delete a test to make it pass — if one asserts a real behaviour that changed, rewrite the assertion and say so in the commit.

- [ ] **Step 5: Commit**

```bash
cd dashboard
git add src/features/call/usePeerConnection.ts src/features/call/usePeerConnection.test.ts
git commit -m "feat(call): pre-negotiate audio/camera/screen lines before the first offer

ADR-0039. The SDP's shape no longer depends on what media happened to
arrive first, so tracksAddedRef/pendingActionsRef/runOrDefer are deleted
rather than left implying a race that can no longer occur."
```

---

### Task 2: Route remote tracks by transceiver identity

**Files:**
- Modify: `dashboard/src/features/call/usePeerConnection.ts` (mount effect `ontrack`, `UsePeerConnectionResult`)
- Modify: `dashboard/src/features/call/useCallRoom.ts:73` (`remoteStream` in `UseCallRoomResult`), `dashboard/src/features/call/CallRoom.tsx`
- Test: `dashboard/src/features/call/usePeerConnection.test.ts`

**Interfaces:**
- Consumes: `MediaLine`, `MEDIA_LINES`, `sendersRef` from Task 1.
- Produces: `UsePeerConnectionResult.remoteCamera: MediaStream | null` and `.remoteScreen: MediaStream | null`, **replacing** `remoteStream`. `useCallRoom` re-exports both under the same names. A new `transceiversRef: useRef(new Map<MediaLine, RTCRtpTransceiver>())`.

Two remote video tracks now arrive and they are not interchangeable — one is a face, one is a screen. `event.streams[0]` cannot tell them apart. Transceiver identity can: both peers created the lines in the same order, so the transceiver a track arrives on names its line.

- [ ] **Step 1: Write the failing test**

```typescript
	it("routes a remote track to camera or screen by its transceiver", () => {
		const pc = new FakePeerConnection();
		const { result } = renderHook(() =>
			usePeerConnection({
				...base,
				localStream: null,
				createPeerConnection: () => pc as unknown as RTCPeerConnection,
			}),
		);
		const cameraTrack = { kind: "video", id: "cam" } as MediaStreamTrack;
		const screenTrack = { kind: "video", id: "scr" } as MediaStreamTrack;

		act(() => {
			pc.ontrack?.({
				track: cameraTrack,
				transceiver: pc.transceivers[1],
				streams: [],
			} as never);
			pc.ontrack?.({
				track: screenTrack,
				transceiver: pc.transceivers[2],
				streams: [],
			} as never);
		});

		expect(result.current.remoteCamera?.getTracks()[0]).toBe(cameraTrack);
		expect(result.current.remoteScreen?.getTracks()[0]).toBe(screenTrack);
	});
```

`MediaStream` is not implemented in jsdom. Add this to the test file's top-level setup, above `describe`:

```typescript
// jsdom has no MediaStream. The hook only ever constructs one from a
// single track and reads it back, so a two-line stand-in is enough and is
// honest about what is being tested: the ROUTING, not the browser's stream.
class FakeMediaStream {
	constructor(private readonly tracks: MediaStreamTrack[]) {}
	getTracks() {
		return this.tracks;
	}
}
vi.stubGlobal("MediaStream", FakeMediaStream);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/call/usePeerConnection.test.ts -t "routes a remote track"`
Expected: FAIL — `result.current.remoteCamera` is undefined; the hook still returns `remoteStream`.

- [ ] **Step 3: Write minimal implementation**

Keep the transceivers, not just their senders. In the mount effect's loop from Task 1:

```typescript
		for (const { line, kind } of MEDIA_LINES) {
			const transceiver = pc.addTransceiver(kind, { direction: "sendrecv" });
			transceiversRef.current.set(line, transceiver);
			sendersRef.current.set(line, transceiver.sender);
		}
```

with `const transceiversRef = useRef(new Map<MediaLine, RTCRtpTransceiver>());` beside `sendersRef`. Replace `ontrack`:

```typescript
		// `event.transceiver`, not `event.streams[0]`: two remote video
		// tracks now arrive and they are not interchangeable -- one is a
		// face, one is a screen. Stream ids cannot tell them apart (a peer
		// sending from a transceiver need not attach a stream at all), but
		// the transceiver can, because both peers created the same three
		// lines in the same order. A stream is constructed here rather than
		// taken from the event for exactly that reason.
		pc.ontrack = (event) => {
			const stream = new MediaStream([event.track]);
			if (event.transceiver === transceiversRef.current.get("screen")) {
				setRemoteScreen(stream);
				return;
			}
			if (event.transceiver === transceiversRef.current.get("camera")) {
				setRemoteCamera(stream);
			}
		};
```

Replace the `remoteStream` state with two, add `"addTransceiver"`'s `RTCRtpTransceiver` type import needs nothing extra, and set **both** to `null` in the `disconnected`/`failed` branch where `setRemoteStream(null)` is today — the comment there about a stale frame reading as "their camera is off" applies to each line.

Return `{ remoteCamera, remoteScreen, ... }`. In `useCallRoom.ts`, replace `remoteStream: peer.remoteStream` with both fields and update `UseCallRoomResult`. In `CallRoom.tsx`, rename the prop passed to the remote `VideoTile` to `remoteCamera`; **do not** add a screen tile yet — Task 5 does that once there is something to put in it.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/call/ && pnpm tsc --noEmit`
Expected: PASS, and the type check clean. `CallRoom.test.tsx` will need its `remoteStream` references renamed.

- [ ] **Step 5: Commit**

```bash
git add src/features/call/
git commit -m "feat(call): route remote tracks by transceiver, not stream id

Two remote video tracks now arrive; only the transceiver they land on
distinguishes a face from a screen."
```

---

### Task 3: Attach local media by line with replaceTrack

**Files:**
- Modify: `dashboard/src/features/call/usePeerConnection.ts` (the `localStream` effect)
- Test: `dashboard/src/features/call/usePeerConnection.test.ts`

**Interfaces:**
- Consumes: `sendersRef` (Task 1).
- Produces: no new exports. The `localStream` effect now calls `replaceTrack` on the `audio` and `camera` lines only, and `replaceTrack(null)` when the stream has no track of that kind.

- [ ] **Step 1: Write the failing test**

```typescript
	it("attaches audio and camera by line, and nulls a line with no track", async () => {
		const pc = new FakePeerConnection();
		const audioTrack = { kind: "audio" } as MediaStreamTrack;
		const audioOnly = {
			getAudioTracks: () => [audioTrack],
			getVideoTracks: () => [],
		} as unknown as MediaStream;

		const { rerender } = renderHook(
			(props: { localStream: MediaStream | null }) =>
				usePeerConnection({
					...base,
					createPeerConnection: () => pc as unknown as RTCPeerConnection,
					...props,
				}),
			{ initialProps: { localStream: null as MediaStream | null } },
		);
		rerender({ localStream: audioOnly });

		await waitFor(() => {
			expect(pc.transceivers[0].sender.replaceTrack).toHaveBeenCalledWith(
				audioTrack,
			);
		});
		expect(pc.transceivers[1].sender.replaceTrack).toHaveBeenCalledWith(null);
		// The screen line is never touched by local MEDIA -- only by an
		// explicit share (Task 4). Attaching a camera here would put a face
		// on the screen line for the other side to lay out as a shared screen.
		expect(pc.transceivers[2].sender.replaceTrack).not.toHaveBeenCalled();
	});

	it("swapping a device replaces the track and never re-offers", async () => {
		const pc = new FakePeerConnection();
		const send = vi.fn();
		const streamOf = (id: string) =>
			({
				getAudioTracks: () => [],
				getVideoTracks: () => [{ kind: "video", id } as MediaStreamTrack],
			}) as unknown as MediaStream;

		const { rerender } = renderHook(
			(props: { localStream: MediaStream | null }) =>
				usePeerConnection({
					...base,
					send,
					createPeerConnection: () => pc as unknown as RTCPeerConnection,
					...props,
				}),
			{ initialProps: { localStream: streamOf("first") } },
		);
		send.mockClear();
		rerender({ localStream: streamOf("second") });

		await waitFor(() => {
			expect(pc.transceivers[1].sender.replaceTrack).toHaveBeenCalledTimes(2);
		});
		// The mutation check for ADR-0039: a device swap that renegotiates
		// would send an offer here. Nothing may be sent.
		expect(send).not.toHaveBeenCalled();
		expect(pc.createOffer).not.toHaveBeenCalled();
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/call/usePeerConnection.test.ts -t "attaches audio and camera by line"`
Expected: FAIL — the effect still iterates `getTracks()` and keys by `track.kind`, so nothing is ever called with `null` and the camera/screen lines are indistinguishable to it.

- [ ] **Step 3: Write minimal implementation**

Replace the whole `localStream` effect body with:

```typescript
	// One `replaceTrack` per line, every time the stream identity changes.
	// `null` is a real value here, not a skip: it is how "this participant
	// has no camera" is expressed on a line that is nonetheless negotiated,
	// which is what lets them turn one on later without renegotiating.
	//
	// The SCREEN line is deliberately absent. It carries a share and only a
	// share (Task 4); attaching the camera here would send a face down the
	// line the other side lays out as a shared screen.
	//
	// Failures are swallowed: a rejected swap leaves the previously
	// negotiated track in place, which is a degraded call rather than a
	// broken one. The `.catch` is really for the unhandled rejection --
	// fire-and-forget, so a rejection surfaces as a `pageerror` that fails
	// the Playwright call spec on a lesson that is still running.
	useEffect(() => {
		const attach = (line: MediaLine, track: MediaStreamTrack | null) => {
			void sendersRef.current
				.get(line)
				?.replaceTrack(track)
				.catch(() => {});
		};
		attach("audio", localStream?.getAudioTracks()[0] ?? null);
		attach("camera", localStream?.getVideoTracks()[0] ?? null);
	}, [localStream]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/call/usePeerConnection.test.ts`
Expected: PASS, all of them.

- [ ] **Step 5: Commit**

```bash
git add src/features/call/usePeerConnection.ts src/features/call/usePeerConnection.test.ts
git commit -m "feat(call): attach local media per line, null for an absent device"
```

---

### Task 4: Expose the screen line

**Files:**
- Modify: `dashboard/src/features/call/usePeerConnection.ts`
- Test: `dashboard/src/features/call/usePeerConnection.test.ts`

**Interfaces:**
- Consumes: `sendersRef` (Task 1).
- Produces: `UsePeerConnectionResult.setScreenTrack: (track: MediaStreamTrack | null) => void`. Stable identity (`useCallback` with no deps), so Task 5's effects can depend on it.

- [ ] **Step 1: Write the failing test**

```typescript
	it("puts a screen track on the screen line and leaves the camera alone", async () => {
		const pc = new FakePeerConnection();
		const camera = {
			getAudioTracks: () => [],
			getVideoTracks: () => [{ kind: "video", id: "cam" } as MediaStreamTrack],
		} as unknown as MediaStream;
		const { result } = renderHook(() =>
			usePeerConnection({
				...base,
				localStream: camera,
				createPeerConnection: () => pc as unknown as RTCPeerConnection,
			}),
		);
		const screenTrack = { kind: "video", id: "scr" } as MediaStreamTrack;

		await waitFor(() => {
			expect(pc.transceivers[1].sender.replaceTrack).toHaveBeenCalled();
		});
		(pc.transceivers[1].sender.replaceTrack as ReturnType<typeof vi.fn>).mockClear();
		act(() => {
			result.current.setScreenTrack(screenTrack);
		});

		expect(pc.transceivers[2].sender.replaceTrack).toHaveBeenCalledWith(
			screenTrack,
		);
		// The camera keeps sending throughout a share -- the whole point of
		// the third line.
		expect(pc.transceivers[1].sender.replaceTrack).not.toHaveBeenCalled();
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/call/usePeerConnection.test.ts -t "puts a screen track"`
Expected: FAIL — `result.current.setScreenTrack is not a function`.

- [ ] **Step 3: Write minimal implementation**

```typescript
	// The screen line's only writer. `null` stops sharing -- it does not
	// renegotiate the line away, so the next share reuses it.
	const setScreenTrack = useCallback((track: MediaStreamTrack | null) => {
		void sendersRef.current
			.get("screen")
			?.replaceTrack(track)
			.catch(() => {});
	}, []);
```

Add `setScreenTrack` to `UsePeerConnectionResult` and to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/call/usePeerConnection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/call/usePeerConnection.ts src/features/call/usePeerConnection.test.ts
git commit -m "feat(call): expose setScreenTrack as the screen line's only writer"
```

---

### Task 5: `useScreenShare`

**Files:**
- Create: `dashboard/src/features/call/useScreenShare.ts`
- Create: `dashboard/src/features/call/useScreenShare.test.ts`
- Modify: `dashboard/src/features/call/useCallRoom.ts`, `dashboard/src/features/call/CallRoom.tsx`

**Interfaces:**
- Consumes: `setScreenTrack` (Task 4), `remoteScreen` (Task 2), `DiagnosticCode` (Task 7 adds two values; this task may be implemented first and its `onFailure` calls typed against the existing union, then widened).
- Produces:

```typescript
export interface UseScreenShareResult {
	sharing: boolean;
	supported: boolean;
	start: () => Promise<void>;
	stop: () => void;
}
export interface UseScreenShareDeps {
	getDisplayMedia?: (c: DisplayMediaStreamOptions) => Promise<MediaStream>;
	onFailure?: (code: "screenshare-denied" | "screenshare-failed") => void;
}
```

- [ ] **Step 1: Write the failing test**

```typescript
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useScreenShare } from "./useScreenShare";

const trackWithEnded = () => {
	const listeners: (() => void)[] = [];
	return {
		kind: "video",
		stop: vi.fn(),
		addEventListener: (event: string, handler: () => void) => {
			if (event === "ended") listeners.push(handler);
		},
		removeEventListener: vi.fn(),
		fireEnded: () => listeners.forEach((h) => h()),
	};
};

describe("useScreenShare", () => {
	it("puts the captured track on the screen line", async () => {
		const track = trackWithEnded();
		const setScreenTrack = vi.fn();
		const { result } = renderHook(() =>
			useScreenShare({
				setScreenTrack,
				getDisplayMedia: async () =>
					({ getVideoTracks: () => [track] }) as unknown as MediaStream,
			}),
		);
		await act(async () => {
			await result.current.start();
		});
		expect(setScreenTrack).toHaveBeenCalledWith(track);
		expect(result.current.sharing).toBe(true);
	});

	it("the browser's own stop control ends the share", async () => {
		const track = trackWithEnded();
		const setScreenTrack = vi.fn();
		const { result } = renderHook(() =>
			useScreenShare({
				setScreenTrack,
				getDisplayMedia: async () =>
					({ getVideoTracks: () => [track] }) as unknown as MediaStream,
			}),
		);
		await act(async () => {
			await result.current.start();
		});
		act(() => {
			track.fireEnded();
		});
		await waitFor(() => expect(result.current.sharing).toBe(false));
		expect(setScreenTrack).toHaveBeenLastCalledWith(null);
	});

	it("a cancelled picker reports NOTHING", async () => {
		const onFailure = vi.fn();
		const { result } = renderHook(() =>
			useScreenShare({
				setScreenTrack: vi.fn(),
				onFailure,
				getDisplayMedia: async () => {
					const error = new Error("cancelled");
					error.name = "NotAllowedError";
					throw error;
				},
			}),
		);
		await act(async () => {
			await result.current.start();
		});
		// A person changing their mind at the picker is not a failure. The
		// browser reports it with the SAME DOMException name as a policy
		// refusal, so this is the one case where the name alone is not
		// enough -- see the implementation comment.
		expect(onFailure).not.toHaveBeenCalled();
		expect(result.current.sharing).toBe(false);
	});

	it("is unsupported when the browser has no getDisplayMedia", () => {
		const { result } = renderHook(() =>
			useScreenShare({ setScreenTrack: vi.fn(), getDisplayMedia: undefined }),
		);
		expect(result.current.supported).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/call/useScreenShare.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseScreenShareDeps {
	setScreenTrack: (track: MediaStreamTrack | null) => void;
	getDisplayMedia?: (
		constraints: DisplayMediaStreamOptions,
	) => Promise<MediaStream>;
	onFailure?: (code: "screenshare-denied" | "screenshare-failed") => void;
}

export interface UseScreenShareResult {
	sharing: boolean;
	supported: boolean;
	start: () => Promise<void>;
	stop: () => void;
}

const defaultGetDisplayMedia =
	typeof navigator !== "undefined" &&
	typeof navigator.mediaDevices?.getDisplayMedia === "function"
		? (constraints: DisplayMediaStreamOptions) =>
				navigator.mediaDevices.getDisplayMedia(constraints)
		: undefined;

export function useScreenShare({
	setScreenTrack,
	getDisplayMedia = defaultGetDisplayMedia,
	onFailure,
}: UseScreenShareDeps): UseScreenShareResult {
	const [sharing, setSharing] = useState(false);
	const trackRef = useRef<MediaStreamTrack | null>(null);

	const stop = useCallback(() => {
		const track = trackRef.current;
		trackRef.current = null;
		track?.stop();
		setScreenTrack(null);
		setSharing(false);
	}, [setScreenTrack]);

	const start = useCallback(async () => {
		if (!getDisplayMedia) {
			return;
		}
		try {
			const stream = await getDisplayMedia({ video: true });
			const track = stream.getVideoTracks()[0] ?? null;
			if (!track) {
				return;
			}
			// The browser's own "Stop sharing" bar is not a button this app
			// renders, and people use it. Listening for `ended` -- rather
			// than only handling our own control -- is what makes both paths
			// land in the same state instead of leaving the UI claiming a
			// share that stopped a minute ago.
			track.addEventListener("ended", () => {
				stop();
			});
			trackRef.current = track;
			setScreenTrack(track);
			setSharing(true);
		} catch (error) {
			// `NotAllowedError` covers BOTH a policy refusal and a person
			// simply closing the picker, and the spec is explicit that the
			// second is not a failure and must not be reported. The two are
			// not distinguishable from the exception, so neither is
			// reported: a false `screenshare-denied` in the diagnostics table
			// would poison the one signal C3e-a gave this project. Anything
			// else IS a real failure and is reported.
			if ((error as DOMException)?.name !== "NotAllowedError") {
				onFailure?.("screenshare-failed");
			}
			setSharing(false);
		}
	}, [getDisplayMedia, onFailure, setScreenTrack, stop]);

	// A share must not outlive the call. Leaving without this keeps the
	// browser's sharing indicator up after the lesson ends -- on a platform
	// for children, that is not an acceptable state to leave a machine in.
	useEffect(() => {
		return () => {
			trackRef.current?.stop();
		};
	}, []);

	return { sharing, supported: getDisplayMedia !== undefined, start, stop };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/call/useScreenShare.test.ts`
Expected: PASS, 4/4.

Then wire it: in `useCallRoom.ts` call `useScreenShare({ setScreenTrack: peer.setScreenTrack, onFailure })` and return `screenShare` on `UseCallRoomResult`. In `CallRoom.tsx`, add a plain button (`data-testid="share-screen"`) rendered only when `screenShare.supported`, and a second `VideoTile` for `remoteScreen` rendered only when it is non-null. **Deliberately unstyled beyond the existing tile classes** — C4b designs this surface; a half-designed control bar here would be thrown away and might not be.

- [ ] **Step 5: Commit**

```bash
git add src/features/call/
git commit -m "feat(call): screen share on its own negotiated line

Both the app's control and the browser's own stop bar end a share via the
track's `ended` event, so they cannot disagree. A cancelled picker is not
reported -- it shares a DOMException name with a real refusal, and a false
screenshare-denied would poison the diagnostics signal."
```

---

### Task 6: Per-kind acquisition in `useLocalMedia`

**Files:**
- Modify: `dashboard/src/features/call/useLocalMedia.ts`
- Test: `dashboard/src/features/call/useLocalMedia.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `UseLocalMediaResult.start` widens to `start(kinds?: { audio?: boolean; video?: boolean }) => Promise<void>`, defaulting to `{ audio: true, video: true }` so every existing call site is unchanged. Acquiring one kind must not drop the other's live track.

This is what makes "enable just the microphone, mid-call" possible: today `start()` asks for both, and a participant who was refused the camera would be re-prompted for it every time they tried to turn on a mic.

- [ ] **Step 1: Write the failing test**

```typescript
	it("acquires one kind without dropping the other's live track", async () => {
		const audioTrack = { kind: "audio", stop: vi.fn() } as unknown as MediaStreamTrack;
		const videoTrack = { kind: "video", stop: vi.fn() } as unknown as MediaStreamTrack;
		const getUserMedia = vi
			.fn()
			.mockResolvedValueOnce({
				getTracks: () => [videoTrack],
				getAudioTracks: () => [],
				getVideoTracks: () => [videoTrack],
			})
			.mockResolvedValueOnce({
				getTracks: () => [audioTrack],
				getAudioTracks: () => [audioTrack],
				getVideoTracks: () => [],
			});

		const { result } = renderHook(() =>
			useLocalMedia({ getUserMedia, enumerateDevices: async () => [] }),
		);
		await act(async () => {
			await result.current.start({ video: true, audio: false });
		});
		await act(async () => {
			await result.current.start({ audio: true, video: false });
		});

		expect(getUserMedia).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ audio: expect.anything(), video: false }),
		);
		// The camera acquired first is still in the stream. Replacing the
		// stream wholesale on the second call is the bug this guards: a
		// participant enabling their microphone would lose their picture.
		expect(result.current.stream?.getVideoTracks()).toContain(videoTrack);
		expect(result.current.stream?.getAudioTracks()).toContain(audioTrack);
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/call/useLocalMedia.test.ts -t "acquires one kind"`
Expected: FAIL — `start` takes no argument, so the second call re-requests both and the returned stream replaces the first.

- [ ] **Step 3: Write minimal implementation**

Give `start` a `kinds` parameter defaulting to both. Build the constraint object from it (`video: kinds.video ? {deviceId...} : false`, same for audio). On success, **merge** rather than replace: build the next stream from the surviving tracks of the other kind plus the newly acquired tracks, and stop only the tracks of the kind just re-acquired. Add a comment saying why merging is the requirement, in the same voice as the file's existing comments.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/call/useLocalMedia.test.ts`
Expected: PASS, existing tests included — the default argument keeps every current call site behaving identically.

- [ ] **Step 5: Commit**

```bash
git add src/features/call/useLocalMedia.ts src/features/call/useLocalMedia.test.ts
git commit -m "feat(call): acquire microphone and camera independently"
```

---

### Task 7: The two screen-share diagnostic codes

**Files:**
- Modify: `backend/kaleem/scheduling/models.py` (`CallDiagnostic` code choices)
- Create: `backend/kaleem/scheduling/migrations/00XX_screenshare_diagnostic_codes.py` (generated)
- Modify: `backend/kaleem/scheduling/tests/test_diagnostics.py`
- Modify: `dashboard/src/features/call/diagnosticsApi.ts` (`DiagnosticCode`)
- Modify: `dashboard/e2e/diagnostics.spec.ts` (the contract test's code list)

**Interfaces:**
- Consumes: the failure codes emitted by `useScreenShare` (Task 5).
- Produces: `screenshare-denied` and `screenshare-failed` accepted by `POST /api/v1/sessions/<id>/diagnostics/`.

- [ ] **Step 1: Write the failing test**

In `backend/kaleem/scheduling/tests/test_diagnostics.py`:

```python
@pytest.mark.parametrize("code", ["screenshare-denied", "screenshare-failed"])
def test_screenshare_codes_are_accepted(authed_client, session, code):
    response = authed_client.post(
        f"/api/v1/sessions/{session.id}/diagnostics/",
        {"code": code},
        format="json",
    )
    assert response.status_code == 201
    assert CallDiagnostic.objects.filter(session=session, code=code).exists()


def test_an_unknown_screenshare_code_writes_no_row(authed_client, session):
    response = authed_client.post(
        f"/api/v1/sessions/{session.id}/diagnostics/",
        {"code": "screenshare-exploded"},
        format="json",
    )
    assert response.status_code == 400
    assert not CallDiagnostic.objects.filter(session=session).exists()
```

Match the fixture names already used in that file; if they differ, use the file's own.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest kaleem/scheduling/tests/test_diagnostics.py -k screenshare -v`
Expected: FAIL with 400 on the two valid codes — they are not in the choices.

- [ ] **Step 3: Write minimal implementation**

Add both to `CallDiagnostic`'s code choices with the same comment style the existing entries use, then:

```bash
python manage.py makemigrations scheduling -n screenshare_diagnostic_codes
```

Add the same two strings to the `DiagnosticCode` union in `dashboard/src/features/call/diagnosticsApi.ts`, and to the array the C3e-a contract spec iterates.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest kaleem/scheduling/tests/test_diagnostics.py -v` then `cd dashboard && pnpm vitest run && pnpm tsc --noEmit`
Expected: PASS. The contract spec runs in e2e, not here — Task 8 runs it.

- [ ] **Step 5: Commit**

Two commits, one per repo (they are separate submodules):

```bash
cd backend && git add kaleem/scheduling/ && git commit -m "feat(scheduling): accept the two screen-share diagnostic codes"
cd ../dashboard && git add src/features/call/diagnosticsApi.ts e2e/ && git commit -m "feat(call): report screen-share failures"
```

---

### Task 8: Prove it end to end

**Files:**
- Modify: `dashboard/e2e/call.spec.ts`
- Create: `dashboard/e2e/call-no-permission.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: the evidence this plan is finished. Nothing else depends on it.

The C3d two-peer spec is the regression signal named in ADR-0039: **it must pass unchanged.** If it needs editing, the negotiation shape moved and something above is wrong — stop and re-read the ADR rather than adjusting the test.

- [ ] **Step 1: Write the failing test**

`call-no-permission.spec.ts`, following the existing two-peer spec's fixture pattern (two contexts, fake media on one, `--use-fake-device-for-media-capture`). Grant media to the teacher's context and **deny** it to the student's:

```typescript
const student = await browser.newContext({ permissions: [] });
```

Assert: both peers reach `connected`; the student's page shows a remote video element producing frames (`videoWidth > 0`); and the teacher's page shows the student's tile with **no** video track — proving a call negotiated with one side sending nothing still carries media the other way, which is the entire claim of ADR-0039.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && pnpm e2e call-no-permission`
Expected: before this plan, FAIL — the student could not join at all. Run it against the current `main` once to see that, then against the branch.

- [ ] **Step 3: Write minimal implementation**

No production code. If this test fails on the branch, the defect is in Tasks 1–6 — fix it there, not here.

- [ ] **Step 4: Run the whole suite**

Run:
```bash
cd dashboard && pnpm vitest run --coverage && pnpm e2e && pnpm lint && pnpm tsc --noEmit
cd ../backend && pytest --cov=kaleem --cov=signaling && ruff check . && mypy .
```
Expected: all green. **Raise both coverage floors** to the new measured numbers in `vitest.config.ts` and `pyproject.toml` — a ratchet only goes up, and this lands a lot of new code. Never run a bare `pytest --cov`; it omits unimported files and reads high.

- [ ] **Step 5: Commit and open the PRs**

Submodules first, then the meta pointer bump — the meta CI builds from pinned SHAs, so an unpushed submodule commit produces a deploy of the wrong tree.

```bash
cd backend && git push -u origin feat/c4a-negotiation-foundation
cd ../dashboard && git push -u origin feat/c4a-negotiation-foundation
```

Open a PR per submodule into `main`. Once both are merged, bump the pointers in the meta repo on a branch and PR that into `master`.

⚠ **`SUBMODULE_TOKEN` must be rotated before this PR can go green** — every gate job checks out submodules with it and it has been failing auth since 2026-09-10 (`STATE.md`). This is the first code PR since, so it is the first one that will hit it.

---

## Self-Review

**Spec coverage.** In-call device pickers: the capability is Task 6, the UI is C4b. Join without permission: Tasks 1–3, proven in Task 8. Pre-join toggles: capability in Task 6 (`start` with kinds), UI in C4b. Screen share: Tasks 4, 5, 7. Per-viewer layout: **entirely C4b** — it needs no negotiation change, only `remoteScreen` from Task 2. `ParticipantTile` initials, the control bar, popovers, RTL, keyboard shortcuts, a11y: all C4b. The spec's mismatched-bundle staging check is not a task here because it needs two deployed bundles; it belongs in the C4a PR's staging verification, and is listed there.

**Placeholders.** None — every step names a file and carries its code. Task 6 Step 3 describes a merge rather than quoting it in full, because the surrounding constraint-building code is long and untouched; the test in Step 1 pins the required behaviour exactly.

**Type consistency.** `MediaLine` (Task 1) is used in Tasks 2–4. `setScreenTrack` has the same signature in Task 4 and Task 5. `remoteCamera` / `remoteScreen` are named identically in Tasks 2 and 5. `start(kinds?)` in Task 6 keeps the zero-argument form every existing caller uses.
