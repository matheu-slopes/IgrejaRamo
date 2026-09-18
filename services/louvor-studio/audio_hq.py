"""Lossless stereo processing. Rubber Band CLI explicitly uses the R3 engine."""
from __future__ import annotations
import hashlib
import json
import logging
import os
import shutil
import subprocess
import time
from pathlib import Path
from types import SimpleNamespace
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent
RATE = 44100
MODELS = {"bs_roformer": "model_bs_roformer_ep_317_sdr_12.9755.ckpt", "htdemucs_ft": "htdemucs_ft.yaml"}
STEMS = {"bs_roformer": ("vocals", "instrumental"), "htdemucs_ft": ("vocals", "drums", "bass", "other")}
VERSION = "separator-0.47.0-r3-stereo-v1"

def emit(progress, stage="separando"):
    print("HQ_PROGRESS=" + json.dumps({"progress": progress, "stage": stage}), flush=True)

def run(command, timeout=1800):
    result = subprocess.run([str(x) for x in command], capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace")[-1800:])
    return result

def ffmpeg_path():
    import imageio_ffmpeg
    return os.environ.get("FFMPEG_PATH") or imageio_ffmpeg.get_ffmpeg_exe()

def rubberband_path():
    path = os.environ.get("RUBBERBAND_PATH") or str(ROOT / ".tools" / "rubberband.exe" if os.name=="nt" else "rubberband")
    try:
        help_text = subprocess.run([path, "--help"], capture_output=True, timeout=10)
    except (OSError, RuntimeError) as exc:
        raise RuntimeError("Instale Rubber Band 3+ e configure RUBBERBAND_PATH.") from exc
    text = (help_text.stdout + help_text.stderr).decode("utf-8", errors="replace")
    if "--fine" not in text or "--formant" not in text:
        raise RuntimeError("O executável Rubber Band não oferece R3/Finer e preservação de formantes.")
    return path

def info(path):
    metadata = sf.info(str(path))
    if metadata.channels != 2 or metadata.samplerate != RATE or metadata.frames < 1:
        raise ValueError(f"Áudio deve ter dois canais a {RATE} Hz: {path.name}")
    return metadata

def convert_wav(source, target):
    run([ffmpeg_path(), "-nostdin", "-v", "error", "-y", "-i", source, "-vn",
         "-ac", "2", "-ar", str(RATE), "-c:a", "pcm_f32le", target], 180)
    return info(target)

def file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024*1024), b""):
            digest.update(block)
    return digest.hexdigest()

def align(path, expected_frames):
    audio, sr = sf.read(path, dtype="float32", always_2d=True)
    if sr != RATE or audio.shape[1] != 2 or not np.isfinite(audio).all():
        raise ValueError("Saída inválida: canais, taxa ou amostras não finitas.")
    delta = len(audio) - expected_frames
    if abs(delta) > 2048:
        raise ValueError(f"Duração inesperada: diferença de {delta} amostras.")
    if delta:
        audio = audio[:expected_frames] if delta > 0 else np.pad(audio, ((0,-delta),(0,0)))
        sf.write(path,audio,RATE,subtype="FLOAT")
    return expected_frames

def pitch_command(executable, source, target, semitones, speed=1, vocal=False):
    if type(semitones) is not int or not -11 <= semitones <= 11 or not isinstance(speed, (int, float)) or not .5 <= speed <= 1.5:
        raise ValueError("Transposição ou velocidade inválida.")
    command=[executable, "-3", "--centre-focus", "--tempo", str(speed),
             "--frequency", format(2 ** (semitones/12), ".15g")]
    if vocal:
        command.append("--formant")
    return command+[str(source),str(target)]

def transpose(source, target, semitones, speed=1, vocal=False, drums=False):
    metadata=info(source)
    if (semitones==0 or drums) and speed==1:
        shutil.copyfile(source,target)
        return
    command=pitch_command(rubberband_path(),source,target,0 if drums else semitones,speed,vocal)
    run(command,1800)
    align(target,round(metadata.frames/speed))

def export_mp3(source, target):
    # Do not add lossy intermediate files. Limit gain only if this stem exceeds full scale.
    peak=0.0
    with sf.SoundFile(source) as audio:
        for block in audio.blocks(blocksize=65536,dtype="float32",always_2d=True):
            peak=max(peak,float(np.max(np.abs(block))))
    gain=min(1.0,.98/peak) if peak else 1.0
    run([ffmpeg_path(),"-nostdin","-v","error","-y","-i",source,
         "-af",f"volume={gain:.12g}","-c:a","libmp3lame","-b:a","320k","-ar",str(RATE),"-ac","2",target],180)

def mix(stems, target):
    metas=[info(path) for path in stems]
    if len({m.frames for m in metas}) != 1:
        raise ValueError("As faixas não estão alinhadas.")
    frames=metas[0].frames
    # One common gain for the mix; preserve stereo and dynamics.
    peak=0.0
    for offset in range(0,frames,65536):
        total=np.zeros((min(65536,frames-offset),2),dtype=np.float32)
        for path in stems:
            with sf.SoundFile(path) as audio:
                audio.seek(offset);total+=audio.read(len(total),dtype="float32",always_2d=True)
        peak=max(peak,float(np.max(np.abs(total))))
    gain=min(1.0,.98/peak) if peak else 1.0
    command=[ffmpeg_path(),"-nostdin","-v","error","-y"]
    for path in stems:command.extend(["-i",path])
    command.extend(["-filter_complex",f"amix=inputs={len(stems)}:duration=longest:normalize=0,volume={gain:.12g}",
                    "-ar",str(RATE),"-ac","2","-c:a","pcm_f32le",target])
    run(command,180)
    align(target,frames)

class Progress:
    def __init__(self, passes=1):
        self.passes=passes;self.done=0
    def __call__(self, items, **kwargs):
        count=len(items)
        for index,item in enumerate(items,1):
            yield item
            emit(min(80,35+int(45*(self.done+index/count)/self.passes)))
        self.done+=1

def separate(source:Path, output:Path, mode:str, models_dir:Path):
    if mode not in MODELS:
        raise ValueError("Modo de separação inválido.")
    import torch
    from audio_separator.separator import Separator
    torch.set_num_threads(min(4,os.cpu_count() or 1))
    # audio-separator checks ffmpeg by name; provide the bundled binary without a global installation.
    executable=Path(ffmpeg_path())
    bindir=ROOT/".tools";bindir.mkdir(exist_ok=True)
    alias=bindir/("ffmpeg.exe" if os.name=="nt" else "ffmpeg")
    if not alias.exists():
        shutil.copy2(executable,alias)
    os.environ["PATH"]=str(bindir)+os.pathsep+os.environ.get("PATH","")
    output.mkdir(parents=True,exist_ok=True)
    separator=Separator(model_file_dir=str(models_dir),output_dir=str(output),output_format="WAV",
        sample_rate=RATE,use_soundfile=True,normalization_threshold=1.0,amplification_threshold=0.0,
        log_level=logging.WARNING,demucs_params={"segment_size":"Default","shifts":1,"overlap":.25,"segments_enabled":True})
    emit(30)
    separator.load_model(MODELS[mode])
    if mode=="bs_roformer":
        import audio_separator.separator.architectures.mdxc_separator as module
        old=module.tqdm;module.tqdm=Progress()
    else:
        import audio_separator.separator.uvr_lib_v5.demucs.apply as module
        old=module.tqdm;module.tqdm=SimpleNamespace(tqdm=Progress(4))
    try:
        separator.separate(str(source),custom_output_names={n.capitalize():n for n in STEMS[mode]})
    finally:
        module.tqdm=old
    for stem in STEMS[mode]:
        path=output/(stem+".wav")
        if not path.is_file():
            raise RuntimeError(f"O separador não gerou {stem}.wav.")
        info(path);align(path,info(source).frames)
    emit(82)
    return {stem:output/(stem+".wav") for stem in STEMS[mode]}

def cache_key(*parts):
    return hashlib.sha256(json.dumps(parts,sort_keys=True).encode()).hexdigest()

def clean_cache(root:Path,days=7):
    root.mkdir(parents=True,exist_ok=True)
    for path in root.iterdir():
        # Only delete owned, direct cache entries. Never follow directory symlinks.
        if path.is_symlink() or not path.is_dir() or len(path.name)!=64 or any(c not in "0123456789abcdef" for c in path.name):
            continue
        if time.time()-path.stat().st_mtime > days*86400:
            shutil.rmtree(path)

def cached(root:Path,key:str,names):
    entry=root/key
    if (entry/"complete.json").is_file() and all((entry/name).is_file() for name in names):
        os.utime(entry,None);return entry
    return None

def store_cache(root:Path,key:str,source:Path,names):
    import tempfile
    root.mkdir(parents=True,exist_ok=True)
    staging=Path(tempfile.mkdtemp(prefix="writing-",dir=root))
    try:
        for name in names:shutil.copy2(source/name,staging/name)
        (staging/"complete.json").write_text(json.dumps({"version":VERSION}),encoding="utf-8")
        destination=root/key
        if destination.exists():shutil.rmtree(destination)
        staging.rename(destination)
    finally:
        if staging.exists():shutil.rmtree(staging)

