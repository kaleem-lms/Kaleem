"""SPIKE: option 2, the same inbox route as a second app in its own process."""

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.routing import WebSocketRoute

import faults
import instrument
from signaling.inbox import inbox_endpoint
from signaling.inbox import lifespan


async def health(request):
    return JSONResponse({"status": "healthy"})


app = Starlette(
    routes=[Route("/health/live/", health), WebSocketRoute("/ws/inbox", inbox_endpoint)],
    lifespan=lifespan,
)
faults.install()
instrument.install(app)
