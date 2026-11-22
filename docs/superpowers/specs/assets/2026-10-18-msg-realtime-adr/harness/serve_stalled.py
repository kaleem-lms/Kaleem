"""SPIKE R0: the positive control. A known 200 ms blocking sleep injected into
the relay path, once per 2 s window, to prove the probe can see a stall."""

import time

import signaling.app as relay

import instrument

_original = relay._send_quietly  # noqa: SLF001
_state = {"window": -1}


async def _stalled(peer, message):
    window = int(time.monotonic() // 2)
    if window != _state["window"] and message.get("type") == "ice":
        _state["window"] = window
        time.sleep(0.2)
    await _original(peer, message)


relay._send_quietly = _stalled  # noqa: SLF001
app = relay.app
instrument.install(app)
