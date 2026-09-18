"""Report completed Demucs chunks and supervise the child without blocking its work."""
from __future__ import annotations

import re
import subprocess
import time
from pathlib import Path

MARKER = 'STUDIO_PROGRESS='


class ChunkProgress:
    def __init__(self, model_count=1, emit=None):
        self.model_count = max(1, model_count)
        self.models_done = 0
        self.emit = emit or (lambda value: print(f'{MARKER}{value}', flush=True))

    def __call__(self, iterable, **kwargs):
        total = len(iterable)
        for completed, item in enumerate(iterable, 1):
            yield item
            # The consumer has now resolved and mixed this chunk.
            fraction = (self.models_done + completed / total) / self.model_count
            self.emit(min(88, 42 + int(46 * fraction)))
        self.models_done += 1


def latest_progress(log_path: Path) -> int:
    with log_path.open('rb') as log:
        log.seek(0, 2)
        log.seek(max(0, log.tell() - 8192))
        text = log.read().decode('utf-8', errors='replace')
    values = [int(value) for value in re.findall(r'STUDIO_PROGRESS=(\d+)', text)]
    return min(90, max([42, *values]))


def run_separation(command, log_path: Path, timeout: float, report, interval: float = 5):
    started = time.monotonic()
    reported = 42
    next_report = 0.0
    with log_path.open('w', encoding='utf-8') as log:
        with subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT) as process:
            try:
                while process.poll() is None:
                    elapsed = time.monotonic() - started
                    if elapsed >= timeout:
                        raise subprocess.TimeoutExpired(command, timeout)
                    value = latest_progress(log_path)
                    if value > reported and elapsed >= next_report:
                        try:
                            report(value)
                            reported = value
                        except Exception as exc:
                            # A transient status update failure must not discard separated audio.
                            print(f'Progress update failed: {exc}', flush=True)
                        next_report = time.monotonic() - started + interval
                    try:
                        process.wait(timeout=min(interval, max(.01, timeout - (time.monotonic() - started))))
                    except subprocess.TimeoutExpired:
                        pass
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()
            if process.returncode:
                raise subprocess.CalledProcessError(process.returncode, command)
    report(90)
