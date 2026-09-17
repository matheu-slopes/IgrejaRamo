"""Processador local do Louvor Studio.

Consulta a fila do site por conexão de saída, baixa áudio autorizado, detecta
tom/BPM, separa quatro faixas e envia apenas os MP3 por URLs temporárias.
"""

from __future__ import annotations

from datetime import datetime
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import imageio_ffmpeg
import librosa
import numpy as np
import requests
import yt_dlp
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env.worker")

SITE_URL = os.environ.get("LOUVOR_STUDIO_SITE_URL", "").rstrip("/")
WORKER_SECRET = os.environ.get("LOUVOR_STUDIO_WORKER_SECRET", "")
WORKER_ID = os.environ.get("LOUVOR_STUDIO_WORKER_ID", socket.gethostname())
DEMUCS_MODEL = os.environ.get("DEMUCS_MODEL", "htdemucs")
POLL_SECONDS = max(10, int(os.environ.get("POLL_SECONDS", "25")))
TIMEOUT_SECONDS = int(os.environ.get("DEMUCS_TIMEOUT_SECONDS", "7200"))

if not SITE_URL or not WORKER_SECRET:
    raise RuntimeError("Preencha LOUVOR_STUDIO_SITE_URL e LOUVOR_STUDIO_WORKER_SECRET em .env.worker")

FFMPEG_EXE = Path(imageio_ffmpeg.get_ffmpeg_exe())
os.environ["PATH"] = f"{FFMPEG_EXE.parent}{os.pathsep}{os.environ.get('PATH', '')}"
session = requests.Session()
session.headers.update({
    "X-Worker-Secret": WORKER_SECRET,
    "X-Worker-Id": WORKER_ID,
    "User-Agent": "RamoDaVida-LouvorStudio/1.0",
})

def api(method: str, path: str, **kwargs: Any) -> dict[str, Any]:
    response = session.request(method, f"{SITE_URL}{path}", timeout=90, **kwargs)
    try:
        payload = response.json()
    except ValueError:
        payload = {"error": response.text[:500] or f"HTTP {response.status_code}"}
    if not response.ok:
        raise RuntimeError(str(payload.get("error") or f"HTTP {response.status_code}"))
    return payload

def atualizar(projeto_id: str, status: str, progresso: int, **campos: Any) -> None:
    api("PATCH", f"/api/louvor-studio/worker/jobs/{projeto_id}", json={
        "status": status, "progresso": progresso, **campos,
    })

def youtube_url_valida(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower().removeprefix("www.")
    return host in {"youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}

def detectar_tom_e_bpm(audio_path: Path) -> tuple[str, float]:
    y, sr = librosa.load(str(audio_path), sr=22050, mono=True, duration=600)
    harmonic = librosa.effects.harmonic(y)
    chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr)
    chroma_mean = np.nan_to_num(chroma.mean(axis=1))
    major = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    notas = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    candidatos: list[tuple[float, str]] = []
    for root, nota in enumerate(notas):
        candidatos.append((float(np.corrcoef(chroma_mean, np.roll(major, root))[0, 1]), nota))
        candidatos.append((float(np.corrcoef(chroma_mean, np.roll(minor, root))[0, 1]), f"{nota}m"))
    tom = max(candidatos, key=lambda item: item[0])[1]
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.asarray(tempo).reshape(-1)[0])
    return tom, round(bpm, 1)

def upload_assinado(url: str, path: Path) -> None:
    with path.open("rb") as arquivo:
        response = requests.put(
            url, data=arquivo,
            headers={"Content-Type": "audio/mpeg", "Cache-Control": "max-age=3600", "x-upsert": "true"},
            timeout=1800,
        )
    if not response.ok:
        raise RuntimeError(f"Falha ao enviar {path.name}: HTTP {response.status_code} {response.text[:300]}")

def processar(job: dict[str, Any]) -> None:
    projeto_id = str(job["id"])
    youtube_url = str(job["youtube_url"])
    if not youtube_url_valida(youtube_url):
        raise RuntimeError("A tarefa não contém um link válido do YouTube.")
    pasta = Path(tempfile.mkdtemp(prefix=f"louvor-{projeto_id[:8]}-"))
    try:
        print(f"[{datetime.now():%H:%M:%S}] Baixando: {job.get('titulo') or projeto_id}")
        atualizar(projeto_id, "baixando", 8, erro=None)
        options = {
            "format": "bestaudio/best", "outtmpl": str(pasta / "source.%(ext)s"),
            "noplaylist": True, "quiet": True, "no_warnings": True,
            "ffmpeg_location": str(FFMPEG_EXE),
            "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "128"}],
        }
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
        source = pasta / "source.mp3"
        if not source.exists():
            raise RuntimeError("O áudio baixado não foi encontrado.")
        atualizar(
            projeto_id, "analisando", 28,
            titulo=info.get("title") or job.get("titulo") or "Música",
            artista=info.get("channel") or info.get("uploader"),
            thumbnail_url=info.get("thumbnail"), duracao_segundos=info.get("duration"),
        )
        print(f"[{datetime.now():%H:%M:%S}] Detectando tom e BPM...")
        tom, bpm = detectar_tom_e_bpm(source)
        atualizar(projeto_id, "separando", 42, tom_original=tom, bpm=bpm)
        pasta_separada = pasta / "separated"
        print(f"[{datetime.now():%H:%M:%S}] Separando voz e instrumentos (pode demorar)...")
        subprocess.run([
            sys.executable, "-m", "demucs", "-n", DEMUCS_MODEL,
            "--mp3", "--mp3-bitrate", "128", "-o", str(pasta_separada), str(source),
        ], check=True, timeout=TIMEOUT_SECONDS)
        stem_dir = pasta_separada / DEMUCS_MODEL / source.stem
        uploads = api("POST", f"/api/louvor-studio/worker/jobs/{projeto_id}", json={"action": "upload_urls"})["uploads"]
        stems: dict[str, str] = {}
        for index, nome in enumerate(("vocals", "drums", "bass", "other")):
            arquivo = stem_dir / f"{nome}.mp3"
            if not arquivo.exists():
                raise RuntimeError(f"A faixa {nome} não foi gerada.")
            atualizar(projeto_id, "separando", 62 + index * 8)
            upload_assinado(str(uploads[nome]["signedUrl"]), arquivo)
            stems[nome] = str(uploads[nome]["path"])
        atualizar(projeto_id, "concluido", 100, stems=stems, erro=None)
        print(f"[{datetime.now():%H:%M:%S}] Pronto: {info.get('title') or projeto_id}")
    finally:
        shutil.rmtree(pasta, ignore_errors=True)

def executar() -> None:
    print("Louvor Studio — processador local")
    print(f"Site: {SITE_URL}")
    print(f"Worker: {WORKER_ID}")
    print("Aguardando músicas. Pressione Ctrl+C para encerrar.")
    while True:
        try:
            job = api("GET", "/api/louvor-studio/worker/jobs").get("job")
            if job:
                try:
                    processar(job)
                except Exception as exc:
                    mensagem = str(exc)[:1000]
                    print(f"Erro: {mensagem}")
                    try:
                        atualizar(str(job["id"]), "erro", 0, erro=mensagem)
                    except Exception as report_error:
                        print(f"Não foi possível informar o erro ao site: {report_error}")
            else:
                time.sleep(POLL_SECONDS)
        except KeyboardInterrupt:
            print("\nProcessador encerrado.")
            return
        except Exception as exc:
            print(f"Conexão indisponível: {exc}. Nova tentativa em {POLL_SECONDS}s.")
            time.sleep(POLL_SECONDS)

if __name__ == "__main__":
    executar()
