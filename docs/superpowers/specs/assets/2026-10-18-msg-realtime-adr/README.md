# Evidence for ADR-0050 (chat transport)

Spike `msg-realtime-adr`. Everything the ADR quotes is in this folder. The prototype was
never merged; the backend branch was deleted at close-out.

## Contents

| Path | What it is |
| --- | --- |
| `inbox_prototype.patch` | `git apply` against backend `18888b2`. Adds `signaling/inbox.py` (inbox route, registry, Redis subscriber), `signaling/handshake.py` (the subprotocol handshake moved out of `app.py`), a second token purpose in `signaling/tokens.py`, 7 tests, and the P1 poll test. |
| `harness/probe_relay.py` | Probe and load generator: `probe`, `pairs`, `inbox`, `publish`, `trigger`, `reconnect`. |
| `harness/run_grid.py` | Host-side orchestrator: `r0`, `grid`, `grid2000`, `r2`, `r3`, `r4`. |
| `harness/instrument.py`, `faults.py`, `serve_*.py` | In-server event-loop lag ticker and RSS, the R2 fault injection, and the entry modules for each variant. |
| `harness/asgi_floor.sh` | R3, option 3's memory floor. |
| `results/results-r0.*` | R0, the positive control (clean, stalled, clean). |
| `results/results-relay-nofile1024.*` | The first R1 grid, at the container default descriptor limit. Its 2000-socket rows are the descriptor finding. |
| `results/results-relay-2000.*` | The 2000-socket cells re-run with `nofile=65536`. |
| `results/results-r2.json` | R2, fault coupling. |
| `results/results-r3-memory.json`, `results-r3-asgi-floor.txt` | R3. |
| `results/results-r4-restart.json` | R4, three local signaling restarts under a reconnecting pair. |
| `results/results-p1.txt` | P1 and its positive control. |
| `results/host-load.txt` | `uptime` before and after the runs. |

## Reproducing

From a backend worktree with the patch applied and the harness copied to `spike/`:

```sh
export SPIKE_WT=<backend worktree>          # the patched tree
export SPIKE_PRISTINE=<dir>                 # `git archive origin/main signaling | tar -x -C <dir>`
export SPIKE_OUT=<scratch dir for raw output>
export SPIKE_IMAGE=<the kaleem-gate image for that worktree>
cd spike && python3 run_grid.py r0 --duration 30
python3 run_grid.py grid --duration 60       # SPIKE_NOFILE=1024 reproduces the descriptor finding
python3 run_grid.py grid2000 --duration 60
python3 run_grid.py r2 --duration 40; python3 run_grid.py r3; python3 run_grid.py r4
```

P1 is `kaleem/messaging/tests/test_spike_poll.py` run through the gate with `-s`.

## What to know before trusting a number

- The relay is pinned to two physical cores (`--cpuset-cpus`), not `--cpus=2`, because option 2
  puts two containers on one shared cpuset. Option 2's containers get 1 GiB each.
- The host is a desktop with a normal session running (load average 1 to 4). Numbers are
  relative to a baseline run on the same cores, never a capacity.
- The secret is generated per run and passed by environment inheritance. It is in no file.
- Probe timestamps are the intended send time, so a late sender is counted, not hidden.
- The first R1 grid's 2000-socket cells did not apply the load they name (910 and 1010 sockets
  connected). That is the finding, and `results-relay-2000.*` is the grid that did apply it.
- `results-r2.json` is the second R2 run. The first run counted log lines from stdout only and
  is superseded.
- The ASGI floor excludes Channels itself (no dependency change in a spike).
- Option 2's prototype imports the inbox route from the `signaling` package. It measures
  runtime isolation, not the code-package separation the ADR recommends.
