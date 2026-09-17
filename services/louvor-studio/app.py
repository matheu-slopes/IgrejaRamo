"""Worker privado do Louvor Studio.

Baixa somente links do YouTube, detecta tom/BPM, separa quatro stems com Demucs
e envia os arquivos a um bucket privado do Supabase.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import librosa
import numpy as np
import yt_dlp
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from supabase import Client, create_client


SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
WORKER_SECRET = os.environ.get("LOUVOR_STUDIO_WORKER_SECRET", "")
DEMUCS_MODEL = os.environ.get("DEMUCS_MODEL", "htdemucs")
MAX_SEARCH_RESULTS = 8
BUCKET = "louvor-studio"

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
app = FastAPI(title="Louvor Studio Worker", docs_url=None, redoc_url=None)
job_lock = asyncio.Lock()  # evita vários Demucs concorrentes em máquinas pequenas


class SearchBody(BaseModel):
    query: str = Field(min_length=2, max_length=120)


class JobBody(BaseModel):
    projeto_id: str
    youtube_url: str


def require_secret(x_worker_secret: str | None = Header(default=None)) -> None:
    if not WORKER_SECRET or not x_worker_secret or not secrets.compare_digest(x_worker_secret, WORKER_SECRET):
        raise HTTPException(status_code=401, detail="Não autorizado")


def youtube_url_valida(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower().removeprefix("www.")
    return host in {"youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}


def atualizar(projeto_id: str, **campos: Any) -> None:
    campos["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    supabase.table("louvor_studio_projetos").update(campos).eq("id", projeto_id).execute()


def buscar_sync(query: str) -> list[dict[str, Any]]:
    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": True,
        "playlistend": MAX_SEARCH_RESULTS,
    }
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(f"ytsearch{MAX_SEARCH_RESULTS}:{query}", download=False)

    results: list[dict[str, Any]] = []
    for item in (info or {}).get("entries", []) or []:
        if not item or not item.get("id"):
            continue
        results.append({
            "id": item["id"],
            "titulo": item.get("title") or "Sem título",
            "artista": item.get("channel") or item.get("uploader") or "YouTube",
            "duracao": item.get("duration"),
            "url": f"https://www.youtube.com/watch?v={item['id']}",
            "thumbnailUrl": item.get("thumbnail") or f"https://i.ytimg.com/vi/{item['id']}/mqdefault.jpg",
        })
    return results


def detectar_tom_e_bpm(audio_path: Path) -> tuple[str, float]:
    # Dez minutos são suficientes para uma estimativa estável sem exagerar memória/CPU.
    y, sr = librosa.load(str(audio_path), sr=22050, mono=True, duration=600)
    harmonic = librosa.effects.harmonic(y)
    chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr)
    chroma_mean = np.nan_to_num(chroma.mean(axis=1))

    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    notas = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    candidates: list[tuple[float, str]] = []
    for root, note in enumerate(notas):
        candidates.append((float(np.corrcoef(chroma_mean, np.roll(major_profile, root))[0, 1]), note))
        candidates.append((float(np.corrcoef(chroma_mean, np.roll(minor_profile, root))[0, 1]), f"{note}m"))
    key = max(candidates, key=lambda item: item[0])[1]

    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.asarray(tempo).reshape(-1)[0])
    return key, round(bpm, 1)


def upload_audio(path: Path, object_path: str) -> None:
    content_type = "audio/mpeg" if path.suffix.lower() == ".mp3" else "audio/wav"
    with path.open("rb") as file_handle:
        supabase.storage.from_(BUCKET).upload(
            object_path,
            file_handle.read(),
            {"content-type": content_type, "upsert": "true"},
        )


def processar_job_sync(projeto_id: str, youtube_url: str) -> None:
    work_dir = Path(tempfile.mkdtemp(prefix=f"louvor-{projeto_id[:8]}-"))
    try:
        atualizar(projeto_id, status="baixando", progresso=8, erro=None)
        template = str(work_dir / "source.%(ext)s")
        options = {
            "format": "bestaudio/best",
            "outtmpl": template,
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }],
        }
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(youtube_url, download=True)

        source = work_dir / "source.mp3"
        if not source.exists():
            candidates = list(work_dir.glob("source.*"))
            if not candidates:
                raise RuntimeError("O áudio baixado não foi encontrado.")
            source = candidates[0]

        atualizar(
            projeto_id,
            titulo=info.get("title") or "Música",
            artista=info.get("channel") or info.get("uploader"),
            thumbnail_url=info.get("thumbnail"),
            duracao_segundos=info.get("duration"),
            status="analisando",
            progresso=28,
        )

        key, bpm = detectar_tom_e_bpm(source)
        atualizar(projeto_id, tom_original=key, bpm=bpm, status="separando", progresso=42)

        separated_dir = work_dir / "separated"
        subprocess.run(
            [
                sys.executable, "-m", "demucs", "-n", DEMUCS_MODEL,
                "--mp3", "--mp3-bitrate", "192", "-o", str(separated_dir), str(source),
            ],
            check=True,
            timeout=int(os.environ.get("DEMUCS_TIMEOUT_SECONDS", "3600")),
        )

        stem_dir = separated_dir / DEMUCS_MODEL / source.stem
        stems: dict[str, str] = {}
        for name in ("vocals", "drums", "bass", "other"):
            path = stem_dir / f"{name}.mp3"
            if not path.exists():
                raise RuntimeError(f"A faixa {name} não foi gerada.")
            object_path = f"{projeto_id}/{name}.mp3"
            upload_audio(path, object_path)
            stems[name] = object_path

        source_object = f"{projeto_id}/original.mp3"
        upload_audio(source, source_object)
        atualizar(
            projeto_id,
            status="concluido",
            progresso=100,
            audio_path=source_object,
            stems=stems,
            erro=None,
        )
    except Exception as exc:
        atualizar(projeto_id, status="erro", erro=str(exc)[:1000])
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


async def processar_job(projeto_id: str, youtube_url: str) -> None:
    async with job_lock:
        await asyncio.to_thread(processar_job_sync, projeto_id, youtube_url)


@app.get("/health")
async def health(_: None = Depends(require_secret)) -> dict[str, bool]:
    return {"ok": True}


@app.post("/search")
async def search(body: SearchBody, _: None = Depends(require_secret)) -> dict[str, Any]:
    try:
        return {"resultados": await asyncio.to_thread(buscar_sync, body.query)}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Falha ao pesquisar no YouTube: {exc}") from exc


@app.post("/jobs", status_code=202)
async def create_job(body: JobBody, tasks: BackgroundTasks, _: None = Depends(require_secret)) -> dict[str, Any]:
    if not youtube_url_valida(body.youtube_url):
        raise HTTPException(status_code=400, detail="Somente links do YouTube são permitidos")
    tasks.add_task(processar_job, body.projeto_id, body.youtube_url)
    return {"ok": True, "projeto_id": body.projeto_id}
