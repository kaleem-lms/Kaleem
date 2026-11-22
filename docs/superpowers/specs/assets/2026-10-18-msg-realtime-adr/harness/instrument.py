"""SPIKE: in-process measurement shared by every server variant.

An event-loop lag ticker (100 ms), plus RSS. Started by the first request to
/spike/lag; later requests report and reset the window. The ticker is what
tells a stall inside the server apart from a stall in the probe.
"""

from __future__ import annotations

import asyncio
import time

from starlette.responses import JSONResponse
from starlette.routing import Route

INTERVAL = 0.1
_samples: list[float] = []
_task: asyncio.Task | None = None


async def _ticker() -> None:
    while True:
        start = time.perf_counter()
        await asyncio.sleep(INTERVAL)
        _samples.append(max(0.0, time.perf_counter() - start - INTERVAL))


def _rss_kb() -> int:
    with open("/proc/self/status") as handle:
        for line in handle:
            if line.startswith("VmRSS:"):
                return int(line.split()[1])
    return -1


def _pct(sorted_values: list[float], q: float) -> float:
    if not sorted_values:
        return 0.0
    return sorted_values[min(len(sorted_values) - 1, int(q * len(sorted_values)))]


async def lag(request) -> JSONResponse:
    global _task  # noqa: PLW0603
    if _task is None:
        _task = asyncio.get_running_loop().create_task(_ticker())
        return JSONResponse({"started": True, "rss_kb": _rss_kb()})
    values = sorted(_samples)
    _samples.clear()
    return JSONResponse(
        {
            "n": len(values),
            "p50_ms": round(_pct(values, 0.5) * 1000, 2),
            "p99_ms": round(_pct(values, 0.99) * 1000, 2),
            "max_ms": round((values[-1] if values else 0.0) * 1000, 2),
            "over_50ms": sum(1 for v in values if v > 0.05),
            "rss_kb": _rss_kb(),
        }
    )


def install(app) -> None:
    app.router.routes.append(Route("/spike/lag", lag))
