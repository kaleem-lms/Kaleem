---
spec: docs/superpowers/specs/2026-10-18-msg-realtime-adr-design.md
status: done except step 8
---

# Plan: msg-realtime-adr

Size S, about one day plus one staging window. Repos: meta (the ADR and its evidence) and
backend (a throwaway prototype that is **never committed or merged**).

- Meta worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/meta-msg-realtime-adr`, branch
  `feat/msg-realtime-adr`.
- Backend worktree: `/home/abdulkhalek/Projects/kaleem-worktrees/backend-msg-realtime-adr`,
  created per conductor-runbook section 1. It is a workspace only. Its diff is exported as a
  patch, and the branch is deleted at close-out.
- Dashboard worktree (staging run only): `.../dashboard-msg-realtime-adr`, created to borrow its
  `node_modules` Playwright. Nothing is committed in it.
- Evidence folder: `docs/superpowers/specs/assets/2026-10-18-msg-realtime-adr/`. The
  `2026-09-12-palette-v2-bench.mjs` bench script is the precedent for keeping one there.

No migrations, no dependency change, no floor edit, no env var, no ship.sh change. The ADR
number comes from the conductor (step 0). Under zsh, brace every variable that a colon
follows.

## Steps

1. [x] **Instrument first: relay probe and its positive control (R0).** In the backend
   worktree, write `spike/probe_relay.py`. It is an asyncio client using `websockets` (it
   ships with `uvicorn[standard]`). It mints room tokens with `signaling.tokens.mint` and a
   secret generated at run time (never written to a file), opens a probe pair in one room,
   and exchanges timestamped `ice` frames at 20/s for 60 s. It reports sent/received counts,
   latency p50/p99/max and the longest gap. It can also run N background pairs and M inbox
   sockets.
   Then run it against unmodified signaling (`uvicorn signaling.app:app`, `--cpus=2
   --memory=2g`, the gate image, worktree mounted read-only, private network, load generator
   in a second container). Then add a temporary `time.sleep(0.2)` in `_relay_loop`. Done
   when the clean run shows received = sent and the sleep run shows max ≥ 200 ms. Revert the
   sleep.
2. [x] **Option 1 prototype.** Add `WS /ws/inbox` to `signaling/app.py`, plus a Redis
   pub/sub subscriber task in the same process. Use a new token purpose: a distinct claim
   set, and an HMAC key derived per purpose from the shared secret. Write two pytest cases
   first in `signaling/tests/test_spike_inbox.py`, then the route:
   `test_room_token_is_refused_on_inbox` and `test_inbox_token_is_refused_on_room` (both
   4401). Run them with `backend-gate.sh <wt> signaling/tests/test_spike_inbox.py`.
3. [x] **Option 2 prototype.** Move the same route into `spike/inbox_app.py`, a separate
   Starlette app. It runs as a second container on the same `--cpuset-cpus` as signaling.
4. [x] **R1 and R2.** Run the grid: {baseline, opt 1, opt 2} × inbox sockets {0, 500, 2000} ×
   publish {0, 50 msg/s}, each with 50 background pairs, 60 s per cell. Then R2: a 500 ms
   blocking call, then a raised exception, in the inbox handler under opt 1 and opt 2.
   Sample event-loop lag from inside each server with a 100 ms ticker. Write
   `results-relay.csv`.
5. [x] **R3, memory.** `docker stats --no-stream` RSS for idle signaling, for opt 1 at 2000
   inbox sockets, and for `uvicorn config.asgi:application`. The last needs the gate compose
   Postgres and Redis on a private network and is never published to the host. Append the
   numbers to the results.
6. [x] **P1, polling cost.** A throwaway test, `kaleem/messaging/tests/test_spike_poll.py`,
   never committed. It logs a user in with the Django test client and times 2,000
   `GET /api/v1/identity/me/`. Positive control first: patch a 50 ms sleep into the view's
   path and assert the mean rises by ≥ 50 ms. Then measure clean with `backend-gate.sh <wt>
   kaleem/messaging/tests/test_spike_poll.py -s`. Compute the worker share for 500 and 2000
   users at 15 s and 30 s. State that the test client omits gunicorn and network overhead,
   so this is a lower bound.
7. [x] **Export evidence.** Run `git -C <backend wt> diff > inbox_prototype.patch`. Copy
   `probe_relay.py`, the patch and the CSVs into the evidence folder. Check that no secret,
   hostname or credential is in any of them.
8. [ ] (not done: no staging access or pool pair for the agent; see ADR-0050 "Not measured") **Staging window (S1, S2).** Under the staging lock, with the pool pair from the
   conductor. Write `staging_call_probe.mjs`: Playwright Chromium with
   `--use-fake-device-for-media-stream`, the URL from an env var, credentials typed from
   env vars and never written to disk. Each side joins the lesson and logs once a second:
   inbound `framesDecoded`/`bytesReceived`, `connectionState`, and the signaling socket's
   frames and close code (`page.on("websocket")`).
   - S1: 2 minutes steady.
   - S2: hold the call while the conductor's scheduled deploy runs. Record the close code,
     the reconnect delay to the next `peer-joined`, and whether `framesDecoded` keeps rising
     through the gap.
   Skip S2 if lb-signaling-deploy-continuity has already published this measurement, and
   cite it.
9. [x] **ADR.** `docs/adr/NNNN-chat-transport.md`, status `proposed`. Sections:
   - Context: today's facts from the spec.
   - Options 1–4, with option 2 named as **E5**.
   - The evidence table (R0–R3, P1, S1/S2), with each threshold marked held or not.
   - Deploy coupling: option 1 under today's `ship.sh`, and under a recreate-only-on-change
     ship.sh.
   - Boundaries and new moving parts for each option: container, Traefik route, ship.sh
     step-4 list, ci.yml deploy file list, env vars, dependencies.
   - A recommendation.
   - What was not measured: Safari/iOS, absolute capacity, real staging host size.
   Link it from the spec, and note it in `dec-msg-realtime` for the conductor.
10. [x] **Close out.** Delete the backend and dashboard worktrees and branches, and the
    scratch raw output. Commit the ADR and the evidence folder to meta.

## Risks

- **The probe measures its own load generator.** It runs in a separate container with its
  own CPUs, and R0 proves that a stall is visible.
- **The CPU budget is not staging's.** The 2 CPUs come from the roadmap minimum. Results are
  stated as with/without deltas, never as capacity.
- **A green R1 hides the real coupling.** R2 exists because one event loop shares faults by
  construction. The ADR reports R2 even when R1 is clean.
- **No staging window, or no scheduled deploy, or no pool lesson in its join window.** The
  ADR ships with local evidence and marks S1/S2 as not measured. The conductor decides
  whether `dec-msg-realtime` waits. This is not an escalation unless the owner wants it to
  be.
- **Prototype code leaks into a trunk.** Nothing in the backend worktree is committed, and
  only the exported patch reaches meta.
- **gitleaks flags evidence.** Secrets are generated at run time and never written. Run
  `gitleaks-range.sh` before hand-back.

## Verification

- R0 and P1's positive controls go red with the injected fault and green without it. Both
  results are recorded in the ADR.
- Every number in the ADR traces to a row in the evidence folder.
- Meta gates: `"${R}/_tools/gitleaks-range.sh" "${R}/meta-msg-realtime-adr"
  origin/master..HEAD` must end `CLEAN`, and `git status --porcelain` must be empty. Meta CI
  is docs-only.
- No backend gate is needed, because no backend commit lands. The step 2 tests run through
  `backend-gate.sh` only while the prototype is being built.
- D3 e2e: none. The unit is an ADR with no user-facing behaviour.
- Hand-back: `needs: owner decision dec-msg-realtime, asked with this ADR`.
