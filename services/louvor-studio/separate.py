"""Demucs separation using the bundled FFmpeg decoder (no TorchCodec/ffprobe)."""
from __future__ import annotations

import argparse
import os
import subprocess
from pathlib import Path
from types import SimpleNamespace

from separation_progress import ChunkProgress, MARKER


def cpu_thread_count() -> int:
    """Return a safe, configurable CPU limit for legacy separation."""
    available = os.cpu_count() or 1
    try:
        requested = int(os.environ.get('LOUVOR_STUDIO_CPU_THREADS', '8'))
    except ValueError:
        requested = 8
    return max(1, min(requested, available))


def decode_audio(path: Path, ffmpeg: str, channels: int, sample_rate: int):
    import numpy as np
    import torch
    result = subprocess.run([
        ffmpeg, '-nostdin', '-hide_banner', '-loglevel', 'error', '-i', str(path),
        '-vn', '-ac', str(channels), '-ar', str(sample_rate), '-f', 'f32le', 'pipe:1',
    ], capture_output=True, check=True, timeout=120)
    samples = np.frombuffer(result.stdout, dtype='<f4')
    if not samples.size or samples.size % channels:
        raise ValueError('FFmpeg returned empty or invalid audio.')
    return torch.from_numpy(samples.reshape(-1, channels).T.copy())


def separate(path: Path, output: Path, name: str, ffmpeg: str) -> None:
    import torch
    import demucs.apply as demucs_apply
    from demucs.audio import save_audio
    from demucs.pretrained import get_model

    torch.set_num_threads(cpu_thread_count())
    model = get_model(name)
    model.eval()
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    wav = decode_audio(path, ffmpeg, model.audio_channels, model.samplerate)
    ref = wav.mean(0)
    mean, std = ref.mean(), ref.std()
    if not torch.isfinite(std) or std < 1e-8:
        raise ValueError('Audio is silent or invalid; cannot separate instruments.')
    # Demucs 4.0.1 exposes progress through its tqdm iterable, not a callback.
    # Replace only this child process's progress adapter and restore it afterwards.
    original_progress = demucs_apply.tqdm
    demucs_apply.tqdm = SimpleNamespace(tqdm=ChunkProgress(len(getattr(model, 'models', [model]))))
    try:
        with torch.no_grad():
            sources = demucs_apply.apply_model(model, ((wav - mean) / std)[None], device=device,
                                              shifts=1, split=True, overlap=0.25, progress=True)[0]
            sources = sources * std + mean
    finally:
        demucs_apply.tqdm = original_progress
    folder = output / name / path.stem
    folder.mkdir(parents=True, exist_ok=True)
    for index, (source, audio) in enumerate(zip(model.sources, sources)):
        save_audio(audio.cpu(), folder / f'{source}.mp3', model.samplerate, bitrate=128)
        print(f'{MARKER}{88 + int(2 * (index + 1) / len(model.sources))}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('audio', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--model', default='htdemucs')
    parser.add_argument('--ffmpeg', required=True)
    args = parser.parse_args()
    separate(args.audio, args.output, args.model, args.ffmpeg)
