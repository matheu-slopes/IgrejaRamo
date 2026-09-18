"""Processador local do Louvor Studio.

Consulta a fila do site por conexão de saída, baixa áudio autorizado, detecta
tom/BPM, separa quatro faixas e envia apenas os MP3 por URLs temporárias.
"""

from __future__ import annotations

from datetime import datetime
import os
import json
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
import requests
import yt_dlp
from dotenv import load_dotenv
from separation_progress import run_separation

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env.worker")

SITE_URL = os.environ.get("LOUVOR_STUDIO_SITE_URL", "").rstrip("/")
WORKER_SECRET = os.environ.get("LOUVOR_STUDIO_WORKER_SECRET", "")
WORKER_ID = os.environ.get("LOUVOR_STUDIO_WORKER_ID", socket.gethostname())
DEMUCS_MODEL = os.environ.get("DEMUCS_MODEL", "htdemucs")
POLL_SECONDS = max(10, int(os.environ.get("POLL_SECONDS", "25")))
TIMEOUT_SECONDS = int(os.environ.get("DEMUCS_TIMEOUT_SECONDS", "7200"))
ANALYSIS_TIMEOUT_SECONDS = max(5, min(120, int(os.environ.get("ANALYSIS_TIMEOUT_SECONDS", "45"))))

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
    response = session.request(method, f"{SITE_URL}{path}", timeout=kwargs.pop("timeout", 90), **kwargs)
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

def detectar_tom_e_bpm(audio_path: Path, duration: float | None = None) -> tuple[str | None, float | None, float | None]:
    command = [sys.executable, str(ROOT / "analysis.py"), str(audio_path), "--ffmpeg", str(FFMPEG_EXE)]
    if duration is not None:
        command.extend(["--duration", str(duration)])
    try:
        result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8",
                                check=True, timeout=ANALYSIS_TIMEOUT_SECONDS)
        data = json.loads(result.stdout)
        print(f"Análise: {data['elapsed_seconds']}s, {data['sampled_seconds']}s de áudio; "
              f"tom {data['tom'] or 'não identificado'}, BPM {data['bpm'] or 'não identificado'}", flush=True)
        beat_offset = data.get("beat_offset_seg")
        return data["tom"], data["bpm"], beat_offset if isinstance(beat_offset, (int, float)) and beat_offset >= 0 else None
    except subprocess.TimeoutExpired:
        print(f"A análise atingiu {ANALYSIS_TIMEOUT_SECONDS}s. Continuando a separação sem tom/BPM.", flush=True)
    except (subprocess.CalledProcessError, ValueError, KeyError, OSError) as exc:
        detail = exc.stderr[-1200:] if isinstance(exc, subprocess.CalledProcessError) and exc.stderr else str(exc)
        print(f"Não foi possível identificar tom/BPM: {detail}. Continuando a separação.", flush=True)
    return None, None, None


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
        tom, bpm, beat_offset = detectar_tom_e_bpm(source, info.get("duration"))
        atualizar(projeto_id, "separando", 42, tom_original=tom, bpm=bpm, beat_offset_seg=beat_offset)
        pasta_separada = pasta / "separated"
        print(f"[{datetime.now():%H:%M:%S}] Separando voz e instrumentos (pode demorar)...")
        log_path = pasta / "separacao.log"
        def report_progress(value: int) -> None:
            api("PATCH", f"/api/louvor-studio/worker/jobs/{projeto_id}", timeout=10, json={
                "status": "separando", "progresso": value,
            })

        try:
            run_separation([
                sys.executable, "-u", str(ROOT / "separate.py"), str(source),
                "--model", DEMUCS_MODEL, "--output", str(pasta_separada), "--ffmpeg", str(FFMPEG_EXE),
            ], log_path, TIMEOUT_SECONDS, report_progress)
        except subprocess.CalledProcessError as exc:
            detail = log_path.read_text(encoding="utf-8", errors="replace")[-2000:]
            print(detail, flush=True)
            raise RuntimeError("Falha na separação dos instrumentos: " + detail[-800:]) from exc
        stem_dir = pasta_separada / DEMUCS_MODEL / source.stem
        uploads = api("POST", f"/api/louvor-studio/worker/jobs/{projeto_id}", json={"action": "upload_urls"})["uploads"]
        stems: dict[str, str] = {}
        for index, nome in enumerate(("vocals", "drums", "bass", "other")):
            arquivo = stem_dir / f"{nome}.mp3"
            if not arquivo.exists():
                raise RuntimeError(f"A faixa {nome} não foi gerada.")
            atualizar(projeto_id, "separando", 90 + index * 2)
            upload_assinado(str(uploads[nome]["signedUrl"]), arquivo)
            stems[nome] = str(uploads[nome]["path"])
        atualizar(projeto_id, "concluido", 100, stems=stems, erro=None)
        print(f"[{datetime.now():%H:%M:%S}] Pronto: {info.get('title') or projeto_id}")
    finally:
        shutil.rmtree(pasta, ignore_errors=True)

def executar() -> None:
    # Redirected Windows consoles otherwise use a legacy encoding and can fail
    # on decomposed accents in titles after a successful upload.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
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
