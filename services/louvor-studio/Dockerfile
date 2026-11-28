FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    XDG_CACHE_HOME=/models-cache

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 rubberband-cli \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py analysis.py separate.py separation_progress.py audio_hq.py hq_task.py hq_worker.py .
RUN rubberband --help 2>&1 | grep -- --fine
VOLUME ["/app/.models", "/app/.audio-cache"]

CMD ["python", "hq_worker.py"]
