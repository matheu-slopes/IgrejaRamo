"""Bounded analysis of short excerpts; executed separately from the queue worker."""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import time
from pathlib import Path

SAMPLE_RATE = 22050
HOP_LENGTH = 256
EXCERPT_SECONDS = 20


def sample_windows(duration: float | None) -> list[tuple[float, float]]:
    if duration is None or not math.isfinite(duration) or duration <= 0:
        return [(15.0, EXCERPT_SECONDS), (60.0, EXCERPT_SECONDS), (120.0, EXCERPT_SECONDS)]
    if duration <= 60:
        return [(0.0, duration)]
    return [(max(0.0, min(duration - EXCERPT_SECONDS, duration * fraction - 10)), EXCERPT_SECONDS)
            for fraction in (0.2, 0.5, 0.75)]


def estimate(excerpts: list, sr: int = SAMPLE_RATE, include_key: bool = True) -> tuple[str | None, float | None]:
    import librosa
    import numpy as np

    chromas = []
    tempos = []
    for y in excerpts:
        y = np.nan_to_num(np.asarray(y, dtype=np.float32))
        if len(y) < sr * 3 or float(np.sqrt(np.mean(y * y))) < 1e-5:
            continue
        # Reuse the same spectrum for key and tempo; analysis remains bounded.
        spectrum = np.abs(librosa.stft(y, n_fft=4096, hop_length=HOP_LENGTH)) ** 2
        chroma = librosa.feature.chroma_stft(S=spectrum, sr=sr, n_fft=4096, hop_length=HOP_LENGTH) if include_key else None
        energy = spectrum.sum(axis=0)
        active = energy > energy.max() * 0.01
        if chroma is not None and active.any():
            chromas.append(chroma[:, active].mean(axis=1))
        mel = librosa.feature.melspectrogram(S=spectrum, sr=sr, n_fft=4096, n_mels=64)
        onset = librosa.onset.onset_strength(S=librosa.power_to_db(mel), sr=sr, hop_length=HOP_LENGTH)
        if onset.size and float(onset.max()) > 1e-3:
            tempo = float(librosa.feature.tempo(onset_envelope=onset, sr=sr, hop_length=HOP_LENGTH)[0])
            if math.isfinite(tempo) and 30 <= tempo <= 300:
                tempos.append(tempo)

    key = None
    if chromas:
        profile = np.mean(chromas, axis=0)
        if float(np.std(profile)) > 1e-3:
            major = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
            minor = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
            notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            candidates = [(float(np.corrcoef(profile, np.roll(template, root))[0, 1]), note + suffix)
                          for root, note in enumerate(notes)
                          for template, suffix in ((major, ''), (minor, 'm'))]
            score, candidate = max(candidates)
            if math.isfinite(score) and score >= 0.5:
                key = candidate
    # Keep an observed tempo rather than averaging half/double-time estimates.
    bpm = sorted(tempos)[len(tempos) // 2] if tempos else None
    return key, round(bpm, 1) if bpm is not None else None


def estimate_beat_offset(
    excerpts: list[tuple[float, object]], bpm: float | None, sr: int = SAMPLE_RATE
) -> float | None:
    """Return the recording time of a beat, reduced to one beat period.

    Each excerpt has a real timeline offset. Circular averaging lets us use
    several short excerpts without treating their local time zero as the song
    start. A missing or weak beat grid is left unset for manual calibration.
    """
    if bpm is None or not math.isfinite(bpm) or not 30 <= bpm <= 300:
        return None
    import librosa
    import numpy as np

    period = 60 / bpm
    phases: list[float] = []
    for start, y in excerpts:
        y = np.nan_to_num(np.asarray(y, dtype=np.float32))
        if len(y) < sr * 3:
            continue
        onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP_LENGTH)
        if not onset.size or float(onset.max()) <= 1e-3:
            continue
        _, frames = librosa.beat.beat_track(
            onset_envelope=onset, sr=sr, hop_length=HOP_LENGTH, bpm=bpm
        )
        phases.extend(
            (start + float(frame) * HOP_LENGTH / sr) % period for frame in frames
        )
    if not phases:
        return None
    angles = np.asarray(phases) * (2 * np.pi / period)
    mean = np.mean(np.exp(1j * angles))
    # Do not claim a phase if excerpts disagree about the pulse.
    if abs(mean) < 0.35:
        return None
    return round((math.atan2(mean.imag, mean.real) % (2 * np.pi)) * period / (2 * np.pi), 3)


def analyze(path: Path, ffmpeg: str, duration: float | None = None, include_key: bool = True) -> dict:
    import numpy as np
    started = time.perf_counter()
    if not path.is_file():
        raise FileNotFoundError(path)
    if duration is None:
        import soundfile as sf
        try:
            duration = sf.info(str(path)).duration
        except (OSError, RuntimeError):
            pass
    excerpts: list[tuple[float, object]] = []
    for start, length in sample_windows(duration):
        decoded = subprocess.run([
            ffmpeg, '-nostdin', '-hide_banner', '-loglevel', 'error',
            '-ss', str(start), '-i', str(path), '-t', str(length),
            '-vn', '-ac', '1', '-ar', str(SAMPLE_RATE), '-f', 'f32le', 'pipe:1',
        ], capture_output=True, check=True, timeout=10)
        samples = np.frombuffer(decoded.stdout, dtype='<f4')
        if samples.size:
            excerpts.append((start, samples))
    key, bpm = estimate([samples for _, samples in excerpts], include_key=include_key)
    beat_offset = estimate_beat_offset(excerpts, bpm)
    return {'tom': key, 'bpm': bpm, 'beat_offset_seg': beat_offset,
            'sampled_seconds': round(sum(len(y) for _, y in excerpts) / SAMPLE_RATE, 2),
            'elapsed_seconds': round(time.perf_counter() - started, 2)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('audio', type=Path)
    parser.add_argument('--ffmpeg', required=True)
    parser.add_argument('--duration', type=float)
    parser.add_argument('--skip-key', action='store_true')
    args = parser.parse_args()
    print(json.dumps(analyze(args.audio, args.ffmpeg, args.duration, include_key=not args.skip_key), ensure_ascii=True, allow_nan=False))
