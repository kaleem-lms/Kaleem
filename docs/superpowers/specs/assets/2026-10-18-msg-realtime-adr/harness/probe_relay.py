"""SPIKE (msg-realtime-adr): relay probe and load generator.

Subcommands, each a separate process so the probe's own event loop is never
the one carrying the load:

  probe    one room, two sockets, timestamped `ice` frames both ways. Reports
           sent/received, latency p50/p99/max and the longest gap between
           frames at a receiver. Timestamps are the INTENDED send time, so a
           late sender counts as latency (no coordinated omission).
  pairs    N background call rooms, two sockets each, light signaling traffic.
  inbox    M inbox sockets that count what they receive.
  publish  publishes chat-shaped messages to Redis at a fixed rate.
  trigger  one inbox socket that sends a single frame at T seconds (R2).

The secret comes from DJANGO_SIGNALING_SECRET in the environment and is never
written anywhere.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import sys
import time

from websockets.asyncio.client import connect

from signaling.tokens import InboxToken
from signaling.tokens import RoomToken
from signaling.tokens import mint

SUBPROTOCOL = "kaleem.signaling.v1"
SECRET = os.environ.get("DJANGO_SIGNALING_SECRET", "")
# A realistic-sized ICE candidate line, so frame size is not flattering.
PAD = "candidate:842163049 1 udp 1677729535 203.0.113.7 49203 typ srflx raddr 0.0.0.0 rport 0 generation 0 ufrag abcd network-cost 999"


def pct(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(q * len(ordered)))]


def room_token(room: str, user: int) -> str:
    claims = RoomToken(room_id=room, user_id=user, is_teacher=user % 2 == 0, expires_at=int(time.time()) + 3600)
    return mint(claims, SECRET)


def inbox_token(user: int) -> str:
    from signaling.tokens import mint_inbox

    return mint_inbox(InboxToken(user_id=user, expires_at=int(time.time()) + 3600), SECRET)


def open_ws(url: str, token: str):
    return connect(url, subprotocols=[SUBPROTOCOL, token], compression=None, max_size=2**16, open_timeout=30)


class Stats:
    def __init__(self) -> None:
        self.latencies: list[float] = []
        self.arrivals: list[float] = []
        self.per_second_max: dict[int, float] = {}
        self.received = 0

    def record(self, sent_ns: int, t0: float) -> None:
        now = time.time_ns()
        ms = (now - sent_ns) / 1e6
        self.latencies.append(ms)
        self.arrivals.append(time.perf_counter())
        sec = int(time.perf_counter() - t0)
        self.per_second_max[sec] = max(self.per_second_max.get(sec, 0.0), ms)
        self.received += 1


async def _sender(ws, rate: float, duration: float, label: str, counter: dict) -> None:
    period = 1.0 / rate
    start = time.perf_counter()
    start_ns = time.time_ns()
    n = 0
    while True:
        due = start + n * period
        if due - start >= duration:
            return
        delay = due - time.perf_counter()
        if delay > 0:
            await asyncio.sleep(delay)
        intended_ns = start_ns + int(n * period * 1e9)
        await ws.send(json.dumps({"type": "ice", "t": intended_ns, "seq": n, "from": label, "candidate": PAD}))
        counter["sent"] += 1
        n += 1


async def _receiver(ws, stats: Stats, t0: float) -> None:
    try:
        async for raw in ws:
            message = json.loads(raw)
            if message.get("type") == "ice":
                stats.record(message["t"], t0)
    except Exception:  # noqa: BLE001, S110
        return


async def cmd_probe(args) -> dict:
    room = args.room
    async with open_ws(f"{args.url}/ws/rooms/{room}", room_token(room, 901)) as a, open_ws(
        f"{args.url}/ws/rooms/{room}", room_token(room, 902)
    ) as b:
        await asyncio.sleep(0.5)
        sa, sb = Stats(), Stats()
        counter = {"sent": 0}
        t0 = time.perf_counter()
        rx = [asyncio.create_task(_receiver(a, sa, t0)), asyncio.create_task(_receiver(b, sb, t0))]
        await asyncio.gather(
            _sender(a, args.rate, args.duration, "a", counter),
            _sender(b, args.rate, args.duration, "b", counter),
        )
        await asyncio.sleep(2.0)  # let the tail arrive
        for task in rx:
            task.cancel()
    latencies = sa.latencies + sb.latencies
    gaps = []
    for stats in (sa, sb):
        gaps += [(y - x) * 1000 for x, y in zip(stats.arrivals, stats.arrivals[1:])]
    return {
        "sent": counter["sent"],
        "received": sa.received + sb.received,
        "p50_ms": round(pct(latencies, 0.5), 2),
        "p99_ms": round(pct(latencies, 0.99), 2),
        "max_ms": round(max(latencies, default=0.0), 2),
        "longest_gap_ms": round(max(gaps, default=0.0), 2),
        "per_second_max_ms": [round(sa.per_second_max.get(i, 0.0), 1) for i in range(int(args.duration))],
    }


async def _pair(i: int, url: str, rate: float, duration: float, ready: asyncio.Semaphore) -> int:
    room = f"bg-{i}"
    async with ready:
        a = await open_ws(f"{url}/ws/rooms/{room}", room_token(room, 2000 + 2 * i))
        b = await open_ws(f"{url}/ws/rooms/{room}", room_token(room, 2001 + 2 * i))
    sink = Stats()
    t0 = time.perf_counter()
    counter = {"sent": 0}
    rx = [asyncio.create_task(_receiver(a, sink, t0)), asyncio.create_task(_receiver(b, sink, t0))]
    await asyncio.sleep(random.random() / rate)  # de-synchronise the pairs
    await asyncio.gather(_sender(a, rate, duration, "a", counter), _sender(b, rate, duration, "b", counter))
    for task in rx:
        task.cancel()
    await a.close()
    await b.close()
    return counter["sent"]


async def cmd_pairs(args) -> dict:
    ready = asyncio.Semaphore(20)
    sent = await asyncio.gather(*[_pair(i, args.url, args.rate, args.duration, ready) for i in range(args.n)])
    return {"pairs": args.n, "sent": sum(sent)}


async def _inbox_one(uid: int, url: str, stats: Stats, t0: float, stop: asyncio.Event, ready: asyncio.Semaphore, up: list):
    async with ready:
        ws = await open_ws(f"{url}/ws/inbox", inbox_token(uid))
    up.append(1)
    try:
        while not stop.is_set():
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
            except TimeoutError:
                continue
            stats.record(json.loads(raw)["t"], t0)
    except Exception:  # noqa: BLE001, S110
        pass
    finally:
        await ws.close()


async def cmd_inbox(args) -> dict:
    stats, stop, up = Stats(), asyncio.Event(), []
    ready = asyncio.Semaphore(50)
    t0 = time.perf_counter()
    tasks = [
        asyncio.create_task(_inbox_one(1_000_000 + i, args.url, stats, t0, stop, ready, up)) for i in range(args.n)
    ]
    await asyncio.sleep(args.duration)
    stop.set()
    await asyncio.gather(*tasks, return_exceptions=True)
    return {
        "sockets_up": len(up),
        "received": stats.received,
        "p50_ms": round(pct(stats.latencies, 0.5), 2),
        "p99_ms": round(pct(stats.latencies, 0.99), 2),
        "max_ms": round(max(stats.latencies, default=0.0), 2),
    }


async def cmd_publish(args) -> dict:
    import redis.asyncio as aioredis

    client = aioredis.from_url(args.redis)
    users = max(args.users, 1)
    period = 1.0 / args.rate
    start = time.perf_counter()
    n = 0
    while n * period < args.duration:
        delay = start + n * period - time.perf_counter()
        if delay > 0:
            await asyncio.sleep(delay)
        uid = 1_000_000 + random.randrange(users)
        body = {"type": "message", "t": time.time_ns(), "seq": n, "chat": 1, "text": "x" * 200}
        await client.publish(f"inbox:{uid}", json.dumps(body))
        n += 1
    await client.aclose()
    return {"published": n, "to_users": users}


async def cmd_trigger(args) -> dict:
    """R2: one inbox socket sends a frame at T; report whether it survived."""
    uid = 1_000_000
    ws = await open_ws(f"{args.url}/ws/inbox", inbox_token(uid))
    await asyncio.sleep(args.at)
    await ws.send("fault")
    closed_at = None
    t = time.perf_counter()
    try:
        await asyncio.wait_for(ws.wait_closed(), timeout=args.duration - args.at)
        closed_at = round(time.perf_counter() - t, 3)
    except TimeoutError:
        pass
    return {"closed_after_s": closed_at, "close_code": getattr(ws, "close_code", None)}


async def cmd_reconnect(args) -> dict:
    """R4: two peers in a room, reconnecting exactly as the dashboard does
    (500 ms doubling, 5 attempts, counter reset on a successful open). Reports
    each outage: the close code, and the time from the close until BOTH peers
    have seen `peer-joined` again."""
    room = "reconnect-room"
    events: list[dict] = []
    paired = {1: asyncio.Event(), 2: asyncio.Event()}
    state = {"closed_at": None}

    async def peer(user: int) -> None:
        attempt = 0
        deadline = time.perf_counter() + args.duration
        while time.perf_counter() < deadline:
            try:
                ws = await open_ws(f"{args.url}/ws/rooms/{room}", room_token(room, 900 + user))
            except Exception:  # noqa: BLE001
                if attempt >= 5:
                    events.append({"peer": user, "gave_up": True})
                    return
                await asyncio.sleep(0.5 * 2**attempt)
                attempt += 1
                continue
            attempt = 0
            try:
                async for raw in ws:
                    if json.loads(raw).get("type") == "peer-joined":
                        paired[user].set()
                        if all(e.is_set() for e in paired.values()) and state["closed_at"] is not None:
                            events.append({"repaired_after_s": round(time.perf_counter() - state["closed_at"], 3)})
                            state["closed_at"] = None
            except Exception:  # noqa: BLE001, S110
                pass
            if state["closed_at"] is None:
                state["closed_at"] = time.perf_counter()
                events.append({"peer": user, "close_code": ws.close_code})
            for e in paired.values():
                e.clear()
            await asyncio.sleep(0.5)

    # A peer blocked in `async for` on a healthy socket never reaches its own
    # deadline check, so the window is enforced from outside.
    try:
        await asyncio.wait_for(asyncio.gather(peer(1), peer(2)), timeout=args.duration)
    except TimeoutError:
        pass
    return {"events": events}


COMMANDS = {"reconnect": cmd_reconnect, "probe": cmd_probe, "pairs": cmd_pairs, "inbox": cmd_inbox, "publish": cmd_publish, "trigger": cmd_trigger}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=COMMANDS)
    parser.add_argument("--url", default="ws://relay:9000")
    parser.add_argument("--redis", default="redis://spike-redis:6379/0")
    parser.add_argument("--room", default="probe-room")
    parser.add_argument("--n", type=int, default=0)
    parser.add_argument("--users", type=int, default=0)
    parser.add_argument("--rate", type=float, default=20.0)
    parser.add_argument("--duration", type=float, default=60.0)
    parser.add_argument("--at", type=float, default=10.0)
    args = parser.parse_args()
    if not SECRET and args.command != "publish":
        sys.exit("DJANGO_SIGNALING_SECRET is not set")
    print(json.dumps(asyncio.run(COMMANDS[args.command](args))))


if __name__ == "__main__":
    main()
