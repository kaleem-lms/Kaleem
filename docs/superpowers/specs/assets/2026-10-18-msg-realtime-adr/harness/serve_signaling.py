"""SPIKE: signaling.app (pristine for baseline, patched for option 1) with the
shared instrumentation, and R2 faults when SPIKE_FAULT is set."""

from signaling.app import app

import faults
import instrument

faults.install()
instrument.install(app)
