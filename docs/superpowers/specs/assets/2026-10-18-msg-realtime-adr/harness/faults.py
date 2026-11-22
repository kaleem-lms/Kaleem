"""SPIKE: fault injection for R2, selected by SPIKE_FAULT. Never merged.

block    a 500 ms blocking call in the inbox frame handler
raise    an unhandled exception in the inbox frame handler
subraise an unhandled exception in the redis-to-socket delivery path
"""

from __future__ import annotations

import os
import time

try:
    from signaling import inbox
except ImportError:  # the pristine baseline has no inbox module
    inbox = None


def install() -> None:
    kind = os.environ.get("SPIKE_FAULT", "")
    if inbox is None or not kind:
        return
    if kind == "block":

        async def on_frame(websocket, user_id, raw):
            time.sleep(0.5)

        inbox.on_frame = on_frame
    elif kind == "raise":

        async def on_frame(websocket, user_id, raw):
            message = "injected inbox handler fault"
            raise RuntimeError(message)

        inbox.on_frame = on_frame
    elif kind == "subraise":
        original = inbox.deliver
        state = {"armed": True}

        async def deliver(socket, data):
            if state["armed"]:
                state["armed"] = False
                message = "injected delivery fault"
                raise RuntimeError(message)
            await original(socket, data)

        inbox.deliver = deliver
