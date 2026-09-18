"""Run with .venv/Scripts/python.exe -m unittest discover -s services/louvor-studio -p test_*.py."""
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

import imageio_ffmpeg
import numpy as np
import soundfile as sf

from analysis import estimate, estimate_beat_offset, sample_windows, SAMPLE_RATE
from separate import decode_audio


def chord_progression(chords):
    seconds = 2
    t = np.arange(SAMPLE_RATE * seconds) / SAMPLE_RATE
    envelope = np.minimum(1, t * 20) * np.minimum(1, (seconds - t) * 20)
    return np.concatenate([
        sum(np.sin(2 * np.pi * (440 * 2 ** ((note - 69) / 12)) * t) for note in notes) * .08 * envelope
        for notes in chords
    ]).astype(np.float32)


class AnalysisTests(unittest.TestCase):
    def test_samples_are_bounded_and_inside_track(self):
        for duration in (4, 20, 60, 61, 500, 3600):
            windows = sample_windows(duration)
            self.assertLessEqual(sum(length for _, length in windows), 60)
            for start, length in windows:
                self.assertGreaterEqual(start, 0)
                self.assertLessEqual(start + length, duration)
        self.assertEqual(len(sample_windows(None)), 3)

    def test_silence_and_short_audio_do_not_invent_key_or_bpm(self):
        self.assertEqual(estimate([np.zeros(SAMPLE_RATE * 5)]), (None, None))
        self.assertEqual(estimate([np.ones(SAMPLE_RATE)]), (None, None))
        self.assertEqual(estimate([]), (None, None))

    def test_major_key_and_transposition(self):
        chords = [[60, 64, 67], [60, 64, 67], [65, 69, 72], [67, 71, 74]] * 2
        self.assertEqual(estimate([chord_progression(chords)])[0], 'C')
        self.assertEqual(estimate([chord_progression([[n + 2 for n in chord] for chord in chords])])[0], 'D')

    def test_minor_key(self):
        chords = [[57, 60, 64], [57, 60, 64], [62, 65, 69], [64, 68, 71]] * 2
        self.assertEqual(estimate([chord_progression(chords)])[0], 'Am')

    def test_regular_clicks_recover_known_tempo(self):
        for bpm in (90, 120):
            samples = np.zeros(SAMPLE_RATE * 20, dtype=np.float32)
            click = np.random.default_rng(42).normal(0, .3, 600) * np.exp(-np.arange(600) / 100)
            for start in range(0, len(samples), round(SAMPLE_RATE * 60 / bpm)):
                length = min(len(click), len(samples) - start)
                samples[start:start + length] += click[:length]
            detected = estimate([samples])[1]
            self.assertIsNotNone(detected)
            self.assertAlmostEqual(detected, bpm, delta=2)

    def test_beat_phase_keeps_the_click_grid_aligned_to_the_recording(self):
        bpm = 120
        offset = .18
        samples = np.zeros(SAMPLE_RATE * 20, dtype=np.float32)
        click = np.random.default_rng(7).normal(0, .35, 800) * np.exp(-np.arange(800) / 120)
        for start in range(round(offset * SAMPLE_RATE), len(samples), round(SAMPLE_RATE * 60 / bpm)):
            samples[start:start + min(len(click), len(samples) - start)] += click[:len(samples) - start]
        phase = estimate_beat_offset([(0.0, samples)], bpm)
        self.assertIsNotNone(phase)
        self.assertLess(abs(((phase - offset + .25) % .5) - .25), .1)

    def test_ffmpeg_decoder_preserves_duration_and_supplies_stereo(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'audio.wav'
            sf.write(path, chord_progression([[60, 64, 67]]), SAMPLE_RATE)
            decoded = decode_audio(path, imageio_ffmpeg.get_ffmpeg_exe(), 2, 44100)
            self.assertEqual(tuple(decoded.shape), (2, 88200))
            np.testing.assert_allclose(decoded[0].numpy(), decoded[1].numpy())
            self.assertGreater(float(decoded.abs().max()), 0.1)

    def test_analysis_timeout_and_failure_do_not_stop_separation(self):
        with mock.patch.dict(os.environ, {'LOUVOR_STUDIO_SITE_URL': 'http://localhost:3000',
                                         'LOUVOR_STUDIO_WORKER_SECRET': 'test-secret'}):
            import app
        for error in (subprocess.TimeoutExpired('analysis', 45),
                      subprocess.CalledProcessError(1, 'analysis', stderr='Invalid audio')):
            with mock.patch.object(app.subprocess, 'run', side_effect=error), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(app.detectar_tom_e_bpm(Path('audio.mp3'), 500), (None, None, None))
        data = {'tom': 'G', 'bpm': 136.0, 'beat_offset_seg': .18, 'elapsed_seconds': 3, 'sampled_seconds': 60}
        with mock.patch.object(app.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, json.dumps(data))) as run:
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(app.detectar_tom_e_bpm(Path('audio.mp3'), 500), ('G', 136.0, .18))
            self.assertEqual(run.call_args.kwargs['timeout'], app.ANALYSIS_TIMEOUT_SECONDS)


    def test_worker_console_accepts_decomposed_accents(self):
        with mock.patch.dict(os.environ, {'LOUVOR_STUDIO_SITE_URL': 'http://localhost:3000',
                                         'LOUVOR_STUDIO_WORKER_SECRET': 'test-secret'}):
            import app
        raw = io.BytesIO()
        output = io.TextIOWrapper(raw, encoding='cp1252')
        with mock.patch.object(app.sys, 'stdout', output), mock.patch.object(app.sys, 'stderr', output):
            with mock.patch.object(app, 'api', side_effect=KeyboardInterrupt):
                app.executar()
            print('Santo Espi\u0301rito', flush=True)
            self.assertEqual(output.encoding, 'utf-8')
            self.assertIn('Santo Espi\u0301rito', raw.getvalue().decode('utf-8'))


if __name__ == '__main__':
    unittest.main()
