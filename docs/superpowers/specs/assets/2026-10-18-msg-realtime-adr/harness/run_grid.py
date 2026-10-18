"""SPIKE (msg-realtime-adr): orchestrates the local, staging-shaped runs.

Runs on the host and drives `docker`. The relay under test is pinned to two
physical cores (--cpuset-cpus) and 2 GiB; the load generator, Redis and the
probe live in other containers on other cores. A secret is generated per run
and passed by environment inheritance, so it appears in no file and no argv.

  run_grid.py r0|grid|r2|r3|r4|all  [--duration 60]
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import secrets
import subprocess
import sys
import time

WT = os.environ["SPIKE_WT"]  # backend worktree with the prototype
PRISTINE = os.environ["SPIKE_PRISTINE"]  # `git archive origin/main signaling`
OUT = os.environ["SPIKE_OUT"]  # scratch directory for raw output
IMAGE = os.environ["SPIKE_IMAGE"]
NET = "spike-msg"
RELAY_CPUS = "4,6"  # two physical cores (their hyperthread siblings 5,7 stay idle)
LOAD_CPUS = "8,10,12,14"
REDIS_CPUS = "2"
# The container default on the measuring host is a soft nofile limit of 1024. The
# first grid ran under it and found that ~1000 sockets exhaust the relay (see the
# ADR); `SPIKE_NOFILE=1024` reproduces that. Every other run raises it.
NOFILE = os.environ.get("SPIKE_NOFILE", "65536")
os.environ["DJANGO_SIGNALING_SECRET"] = secrets.token_hex(16)


def sh(*cmd: str, check: bool = True, capture: bool = True) -> str:
    result = subprocess.run(cmd, capture_output=capture, text=True, check=False)
    if check and result.returncode:
        sys.exit(f"FAILED {cmd[:4]}: {result.stderr[-500:]}")
    return (result.stdout or "").strip()


def setup() -> None:
    if not sh("docker", "network", "ls", "--filter", f"name=^{NET}$", "-q"):
        sh("docker", "network", "create", "--internal", NET)
    cleanup()
    sh("docker", "run", "-d", "--name", "spike-redis", "--network", NET, "--cpuset-cpus", REDIS_CPUS,
       "--memory", "512m", "redis:8-alpine")
    sh("docker", "run", "-d", "--name", "spike-loadgen", "--network", NET, "--cpuset-cpus", LOAD_CPUS,
       "--memory", "4g", "--ulimit", f"nofile={NOFILE}:{NOFILE}", "-v", f"{WT}:/app:ro", "-v", f"{WT}/spike:/spike:ro",
       "-e", "DJANGO_SIGNALING_SECRET", "-e", "PYTHONPATH=/spike:/app", "-e", "PYTHONDONTWRITEBYTECODE=1",
       "-w", "/app", IMAGE, "sleep", "infinity")


def cleanup() -> None:
    for name in ("spike-relay", "spike-inbox", "spike-loadgen", "spike-redis"):
        sh("docker", "rm", "-f", name, check=False)


def relay(name: str, tree: str, module: str, port: int, fault: str = "", memory: str = "2g") -> None:
    sh("docker", "rm", "-f", name, check=False)
    env = ["-e", "DJANGO_SIGNALING_SECRET", "-e", "PYTHONPATH=/spike:/app", "-e", "PYTHONDONTWRITEBYTECODE=1",
           "-e", "SIGNALING_INBOX_REDIS_URL=redis://spike-redis:6379/0", "-e", f"SPIKE_FAULT={fault}"]
    sh("docker", "run", "-d", "--name", name, "--network", NET, "--cpuset-cpus", RELAY_CPUS, "--memory", memory,
       "--ulimit", f"nofile={NOFILE}:{NOFILE}", "-v", f"{tree}:/app:ro", "-v", f"{WT}/spike:/spike:ro", "-w", "/app", *env, IMAGE,
       "uvicorn", f"{module}:app", "--host", "0.0.0.0", "--port", str(port),
       "--log-config", "signaling/logconf.json")
    for _ in range(60):
        time.sleep(0.5)
        if '"healthy"' in lg_get(name, port, "/health/live/"):
            lg_get(name, port, "/spike/lag")  # starts the ticker
            return
    sys.exit(f"{name} never became healthy: {sh('docker', 'logs', '--tail', '20', name, check=False)}")


def lg_get(host: str, port: int, path: str) -> str:
    code = f"import urllib.request;print(urllib.request.urlopen('http://{host}:{port}{path}',timeout=5).read().decode())"
    out = subprocess.run(["docker", "exec", "spike-loadgen", "python", "-c", code], capture_output=True, text=True)
    return out.stdout.strip()


def lag(host: str, port: int) -> dict:
    return json.loads(lg_get(host, port, "/spike/lag") or "{}")


def launch(*args: str) -> subprocess.Popen:
    return subprocess.Popen(["docker", "exec", "spike-loadgen", "python", "spike/probe_relay.py", *args],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def finish(proc: subprocess.Popen) -> dict:
    out, err = proc.communicate()
    try:
        return json.loads(out.strip().splitlines()[-1])
    except (IndexError, ValueError):
        return {"error": (err or out)[-300:]}


def variant_servers(variant: str, fault: str = "") -> tuple[str, str]:
    """Start the servers for a variant; return (relay_url, inbox_url)."""
    sh("docker", "rm", "-f", "spike-inbox", check=False)
    if variant == "baseline":
        relay("spike-relay", PRISTINE, "serve_signaling", 9000)
        return "ws://spike-relay:9000", ""
    if variant == "opt1":
        relay("spike-relay", WT, "serve_signaling", 9000, fault)
        return "ws://spike-relay:9000", "ws://spike-relay:9000"
    if variant == "opt2":
        relay("spike-relay", PRISTINE, "serve_signaling", 9000, memory="1g")
        relay("spike-inbox", WT, "serve_inbox", 9100, fault, memory="1g")
        return "ws://spike-relay:9000", "ws://spike-inbox:9100"
    if variant == "stalled":
        relay("spike-relay", PRISTINE, "serve_stalled", 9000)
        return "ws://spike-relay:9000", ""
    raise SystemExit(variant)


def cell(variant: str, sockets: int, publish: int, duration: int, pairs: int = 50, run: int = 1) -> dict:
    relay_url, inbox_url = variant_servers(variant)
    ramp = 15
    bg = launch("pairs", "--url", relay_url, "--n", str(pairs), "--rate", "2", "--duration", str(duration + ramp + 8))
    ib = launch("inbox", "--url", inbox_url, "--n", str(sockets), "--duration", str(duration + ramp + 4)) if sockets else None
    time.sleep(ramp)
    inbox_host = ("spike-relay", 9000) if variant != "opt2" else ("spike-inbox", 9100)
    lag("spike-relay", 9000)
    if variant == "opt2":
        lag("spike-inbox", 9100)
    pub = launch("publish", "--rate", str(publish), "--users", str(sockets), "--duration", str(duration)) if publish else None
    probe = launch("probe", "--url", relay_url, "--rate", "20", "--duration", str(duration))
    probe_res = finish(probe)
    relay_lag = lag("spike-relay", 9000)
    inbox_lag = lag(*inbox_host) if variant == "opt2" else {}
    rss_loaded = {"relay_rss_mb": round(relay_lag.get("rss_kb", 0) / 1024, 1),
                  "inbox_rss_mb": round(inbox_lag.get("rss_kb", 0) / 1024, 1) if inbox_lag else ""}
    pub_res = finish(pub) if pub else {}
    ib_res = finish(ib) if ib else {}
    bg_res = finish(bg)
    return {"variant": variant, "inbox_sockets": sockets, "pub_per_s": publish, "run": run,
            "probe": probe_res, "relay_lag": relay_lag, "inbox_lag": inbox_lag, **rss_loaded,
            "inbox": ib_res, "publish": pub_res, "pairs": bg_res}


def flat(row: dict) -> dict:
    p, lg, il, ib = row["probe"], row["relay_lag"], row["inbox_lag"], row["inbox"]
    return {
        "variant": row["variant"], "run": row["run"], "inbox_sockets": row["inbox_sockets"], "pub_per_s": row["pub_per_s"],
        "probe_sent": p.get("sent"), "probe_received": p.get("received"), "p50_ms": p.get("p50_ms"),
        "p99_ms": p.get("p99_ms"), "max_ms": p.get("max_ms"), "longest_gap_ms": p.get("longest_gap_ms"),
        "relay_lag_p99_ms": lg.get("p99_ms"), "relay_lag_max_ms": lg.get("max_ms"), "relay_lag_over50": lg.get("over_50ms"),
        "inbox_proc_lag_max_ms": il.get("max_ms", ""), "relay_rss_mb": row["relay_rss_mb"], "inbox_rss_mb": row["inbox_rss_mb"],
        "inbox_up": ib.get("sockets_up", ""), "inbox_received": ib.get("received", ""),
        "inbox_p50_ms": ib.get("p50_ms", ""), "inbox_p99_ms": ib.get("p99_ms", ""), "inbox_max_ms": ib.get("max_ms", ""),
    }


def save(rows: list[dict], name: str) -> None:
    with open(f"{OUT}/{name}.json", "w") as handle:
        json.dump(rows, handle, indent=1)
    flats = [flat(r) for r in rows]
    with open(f"{OUT}/{name}.csv", "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(flats[0]))
        writer.writeheader()
        writer.writerows(flats)


def r0(duration: int) -> None:
    rows = []
    for variant in ("baseline", "stalled", "baseline"):
        rows.append(cell(variant, 0, 0, duration, pairs=0, run=len(rows) + 1))
        print(json.dumps(flat(rows[-1])), flush=True)
    save(rows, "results-r0")


def grid(duration: int) -> None:
    rows = []
    plan = [("baseline", 0, 0)] + [("opt1", s, p) for s in (0, 500, 2000) for p in (0, 50)]
    plan += [("baseline", 0, 0)] + [("opt2", s, p) for s in (0, 500, 2000) for p in (0, 50)] + [("baseline", 0, 0)]
    for index, (variant, sockets, publish) in enumerate(plan, 1):
        rows.append(cell(variant, sockets, publish, duration, run=index))
        print(json.dumps(flat(rows[-1])), flush=True)
        save(rows, "results-relay")


def grid2000(duration: int) -> None:
    """The 2000-socket cells again, with a raised descriptor limit."""
    rows = []
    plan = [("baseline", 0, 0)] + [("opt1", 2000, p) for p in (0, 50)]
    plan += [("baseline", 0, 0)] + [("opt2", 2000, p) for p in (0, 50)] + [("baseline", 0, 0)]
    for index, (variant, sockets, publish) in enumerate(plan, 1):
        rows.append(cell(variant, sockets, publish, duration, run=index))
        print(json.dumps(flat(rows[-1])), flush=True)
        save(rows, "results-relay-2000")


def r2(duration: int) -> None:
    results = []
    for variant in ("opt1", "opt2"):
        for fault in ("block", "raise", "subraise"):
            sh("docker", "rm", "-f", "spike-inbox", check=False)
            relay_url, inbox_url = variant_servers(variant, fault)
            bg = launch("pairs", "--url", relay_url, "--n", "50", "--rate", "2", "--duration", str(duration + 20))
            time.sleep(12)
            probe = launch("probe", "--url", relay_url, "--rate", "20", "--duration", str(duration))
            if fault == "subraise":
                recv = launch("inbox", "--url", inbox_url, "--n", "1", "--duration", str(duration + 2))
                pub = launch("publish", "--rate", "2", "--users", "1", "--duration", str(duration - 2))
                extra = {"delivery": finish(recv), "publish": finish(pub)}
            else:
                extra = {"trigger": finish(launch("trigger", "--url", inbox_url, "--at", "10", "--duration", str(duration)))}
            probe_res = finish(probe)
            health = lg_get("spike-relay", 9000, "/health/live/")
            target = "spike-inbox" if variant == "opt2" else "spike-relay"
            logs = subprocess.run(["docker", "logs", target], capture_output=True, text=True, check=False)
            tb = sum(1 for line in (logs.stdout + logs.stderr).splitlines() if "RuntimeError: injected" in line)
            finish(bg)
            row = {"variant": variant, "fault": fault, "probe": {k: v for k, v in probe_res.items() if k != "per_second_max_ms"},
                   "stall_seconds": [i for i, v in enumerate(probe_res.get("per_second_max_ms", [])) if v > 100],
                   "relay_health_after": health, "runtimeerror_log_lines": tb, **extra}
            results.append(row)
            print(json.dumps(row), flush=True)
            with open(f"{OUT}/results-r2.json", "w") as handle:
                json.dump(results, handle, indent=1)


def r3() -> None:
    rows = []
    relay("spike-relay", PRISTINE, "serve_signaling", 9000)
    time.sleep(3)
    rows.append({"what": "signaling idle (pristine, no connections)", "rss_mb": round(lag("spike-relay", 9000)["rss_kb"] / 1024, 1)})
    for variant, host in (("opt1", ("spike-relay", 9000)), ("opt2", ("spike-inbox", 9100))):
        relay_url, inbox_url = variant_servers(variant)
        time.sleep(3)
        rows.append({"what": f"{variant} inbox process idle", "rss_mb": round(lag(*host)["rss_kb"] / 1024, 1)})
        ib = launch("inbox", "--url", inbox_url, "--n", "2000", "--duration", "40")
        time.sleep(30)
        rows.append({"what": f"{variant} inbox process, 2000 inbox sockets held", "rss_mb": round(lag(*host)["rss_kb"] / 1024, 1)})
        rows[-1]["sockets_up"] = finish(ib).get("sockets_up")
    save_json = f"{OUT}/results-r3-memory.json"
    with open(save_json, "w") as handle:
        json.dump(rows, handle, indent=1)
    print(json.dumps(rows), flush=True)


def r4() -> None:
    """Restart a relay container three times under a reconnecting pair."""
    relay_url, _ = variant_servers("baseline")
    watcher = launch("reconnect", "--url", relay_url, "--duration", "75")
    time.sleep(8)
    timings = []
    for _ in range(3):
        start = time.perf_counter()
        sh("docker", "restart", "-t", "10", "spike-relay")
        for _ in range(120):
            if '"healthy"' in lg_get("spike-relay", 9000, "/health/live/"):
                break
            time.sleep(0.25)
        timings.append(round(time.perf_counter() - start, 2))
        time.sleep(14)
    out = {"restart_to_healthy_s": timings, "reconnect": finish(watcher)}
    with open(f"{OUT}/results-r4-restart.json", "w") as handle:
        json.dump(out, handle, indent=1)
    print(json.dumps(out), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("what", choices=["r0", "grid", "grid2000", "r2", "r3", "r4"])
    parser.add_argument("--duration", type=int, default=60)
    parsed = parser.parse_args()
    setup()
    try:
        {"r0": lambda: r0(parsed.duration), "grid": lambda: grid(parsed.duration), "grid2000": lambda: grid2000(parsed.duration),
         "r2": lambda: r2(parsed.duration), "r3": r3, "r4": r4}[parsed.what]()
    finally:
        cleanup()
