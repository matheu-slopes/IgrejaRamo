import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from separation_progress import ChunkProgress, latest_progress, run_separation


class ProgressTests(unittest.TestCase):
    def test_only_completed_chunks_advance_progress(self):
        values = []
        tracker = ChunkProgress(2, values.append)
        iterator = tracker([1, 2])
        self.assertEqual(next(iterator), 1)
        self.assertEqual(values, [])
        self.assertEqual(next(iterator), 2)
        self.assertEqual(values, [53])
        self.assertEqual(list(iterator), [])
        self.assertEqual(values[-1], 65)
        list(tracker([3, 4]))
        self.assertEqual(values[-1], 88)
        self.assertEqual(values, sorted(values))

    def test_log_reader_ignores_other_output_and_clamps_range(self):
        with tempfile.TemporaryDirectory() as folder:
            log = Path(folder) / 'test.log'
            log.write_text('Other 100%\nSTUDIO_PROGRESS=60\nSTUDIO_PROGRESS=58\n', encoding='utf-8')
            self.assertEqual(latest_progress(log), 60)
            log.write_text('STUDIO_PROGRESS=999\n', encoding='utf-8')
            self.assertEqual(latest_progress(log), 90)

    def test_running_child_updates_before_completion_and_survives_network_error(self):
        values = []
        attempts = []
        def report(value):
            attempts.append(value)
            if len(attempts) == 1:
                raise ConnectionError('temporary test failure')
            values.append(value)
        code = 'import time; print("STUDIO_PROGRESS=60",flush=True); time.sleep(.4); print("STUDIO_PROGRESS=80",flush=True); time.sleep(.4)'
        with tempfile.TemporaryDirectory() as folder:
            run_separation([sys.executable, '-u', '-c', code], Path(folder) / 'test.log', 5, report, .02)
        self.assertIn(60, values)
        self.assertIn(80, values)
        self.assertEqual(values[-1], 90)

    def test_timeout_kills_child_and_failure_does_not_report_completion(self):
        with tempfile.TemporaryDirectory() as folder:
            log = Path(folder) / 'test.log'
            values = []
            with self.assertRaises(subprocess.TimeoutExpired):
                run_separation([sys.executable, '-c', 'import time; time.sleep(30)'], log, .1, values.append, .02)
            self.assertNotIn(90, values)
            with self.assertRaises(subprocess.CalledProcessError):
                run_separation([sys.executable, '-c', 'raise RuntimeError("test")'], log, 5, values.append, .02)
            self.assertNotIn(90, values)


if __name__ == '__main__':
    unittest.main()
