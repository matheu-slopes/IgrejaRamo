"""Lightweight Cifra Club queue worker, intended to run on the local Lenovo host."""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import threading
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parent

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,119}$", re.IGNORECASE)
KEY_RE = re.compile(r"(?:^|\s)([A-G](?:#|b)?m?)(?=(?:\s|\||$))")
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
}


def _text(node: Any) -> str:
    return node.get_text(" ", strip=True) if node else ""


def _infer_key(chord: str) -> str:
    match = KEY_RE.search(" ".join(chord.splitlines()[:16]))
    return match.group(1) if match else ""


def parse_cifra_html(
    html: str,
    artista_slug: str,
    musica_slug: str,
    versao: str = "principal",
) -> dict[str, Any]:
    """Convert a Cifra Club HTML page to the same contract used by the web API."""
    soup = BeautifulSoup(html, "html.parser")
    pre = (
        soup.select_one("#cifra_cnt pre")
        or soup.select_one("div.cifra_cnt pre")
        or soup.select_one("pre.js-tab-content")
    )
    if pre is None:
        pre = next((item for item in soup.select("pre") if len(item.get_text(strip=True)) > 100), None)
    cifra_texto = pre.get_text().replace("\r\n", "\n").replace("\r", "\n").strip() if pre else ""
    if len(cifra_texto) < 20:
        raise ValueError("A cifra nao foi encontrada na pagina retornada pelo Cifra Club.")

    titulo = _text(soup.select_one("h1.t1") or soup.select_one("h1"))
    artista = _text(soup.select_one("h2.t3 a") or soup.select_one(".bread a:last-child"))
    titulo = titulo or musica_slug.replace("-", " ").title()
    artista = artista or artista_slug.replace("-", " ").title()

    scripts = "\n".join(item.get_text() for item in soup.select("script:not([src])"))
    pagina = " ".join(soup.get_text(" ", strip=True).split())
    youtube_match = re.search(
        r"(?:youtube_id|youtubeId|youtubeID)\\?[\"']?\s*:\s*\\?[\"']([A-Za-z0-9_-]{10,12})",
        scripts,
        re.IGNORECASE,
    )
    if youtube_match is None:
        youtube_match = re.search(r"(?:youtube\.com/embed/|i\.ytimg\.com/vi/)([A-Za-z0-9_-]{10,12})", html)
    youtube_url = f"https://www.youtube.com/watch?v={youtube_match.group(1)}" if youtube_match else None

    tom_match = re.search(
        r"Tom\s*:\s*([A-G][#b]?m?)(?:\s*\(com forma de\s*([A-G][#b]?m?)\))?",
        pagina,
        re.IGNORECASE,
    )
    capo_match = re.search(r"Capotraste\s*:\s*(\d+)\D*?casa", pagina, re.IGNORECASE)
    tom = tom_match.group(1) if tom_match else ""
    forma = tom_match.group(2) if tom_match and tom_match.group(2) else ""
    origem = "cifraclub" if tom else None
    if not tom:
        tom = _infer_key(cifra_texto)
        origem = "inferido" if tom else None

    tem_simplificada = versao == "simplificada" or bool(soup.select_one("a[href*='/simplificada']"))
    suffix = "simplificada/" if versao == "simplificada" else ""
    url = f"https://www.cifraclub.com.br/{quote(artista_slug)}/{quote(musica_slug)}/{suffix}"
    return {
        "artist": artista,
        "name": titulo,
        "tom_original": tom or None,
        "forma_da_cifra": forma or None,
        "capotraste": f"{capo_match.group(1)}\u00aa casa" if capo_match else None,
        "youtube_url": youtube_url,
        "cifraclub_url": url,
        "cifra": cifra_texto.split("\n"),
        "versao": versao,
        "versoes": ([
            {"id": "principal", "label": "Principal"},
            {"id": "simplificada", "label": "Simplificada"},
        ] if tem_simplificada else [{"id": "principal", "label": "Principal"}]),
        "tom_origem": origem,
    }


def _browser_executable() -> str | None:
    configured = os.environ.get("CIFRA_BROWSER_PATH", "").strip()
    candidates = [
        configured,
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        shutil.which("google-chrome") or "",
        shutil.which("chromium") or "",
        shutil.which("chromium-browser") or "",
    ]
    return next((path for path in candidates if path and Path(path).is_file()), None)


def _fetch_with_browser(url: str) -> str:
    browser = _browser_executable()
    if not browser:
        raise RuntimeError("Nenhum Edge ou Chrome foi encontrado no computador do worker.")
    profile = ROOT / ".tools" / "cifra-browser-profile"
    profile.mkdir(parents=True, exist_ok=True)
    command = [
        browser,
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-background-networking",
        "--disk-cache-size=1",
        f"--user-data-dir={profile}",
        "--virtual-time-budget=15000",
        "--dump-dom",
        url,
    ]
    child = subprocess.Popen(
        command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        encoding="utf-8", errors="replace", start_new_session=os.name != "nt",
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    try:
        stdout, _ = child.communicate(timeout=45)
    except subprocess.TimeoutExpired as exc:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(child.pid), "/T", "/F"],
                capture_output=True, timeout=15, check=False,
            )
        else:
            os.killpg(child.pid, 9)
        child.wait(timeout=15)
        raise RuntimeError("O navegador local demorou demais para abrir a cifra.") from exc
    html = stdout.strip()
    blocked = re.search(
        r"Access Denied|Just a moment|Cloudflare|cf-chl|captcha", html, re.IGNORECASE,
    )
    if child.returncode != 0 or len(html) < 500 or blocked:
        raise RuntimeError("O Cifra Club bloqueou temporariamente ate o navegador do Lenovo.")
    return html


def fetch_cifra(job: dict[str, Any]) -> dict[str, Any]:
    artista_slug = str(job.get("artista_slug", ""))
    musica_slug = str(job.get("musica_slug", ""))
    versao = "simplificada" if job.get("versao") == "simplificada" else "principal"
    if not SLUG_RE.fullmatch(artista_slug) or not SLUG_RE.fullmatch(musica_slug):
        raise ValueError("A fonte da cifra recebida e invalida.")
    suffix = "simplificada/" if versao == "simplificada" else ""
    url = f"https://www.cifraclub.com.br/{artista_slug}/{musica_slug}/{suffix}"
    try:
        response = requests.get(url, headers=BROWSER_HEADERS, timeout=(10, 30), allow_redirects=True)
        if response.status_code in (403, 429, 503):
            html = _fetch_with_browser(url)
        else:
            response.raise_for_status()
            html = response.text
    except requests.RequestException:
        html = _fetch_with_browser(url)
    return parse_cifra_html(html, artista_slug, musica_slug, versao)


def _api(site: str, headers: dict[str, str], method: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    response = requests.request(
        method,
        site + "/api/buscar-cifra/worker",
        headers=headers,
        json=payload,
        timeout=(10, 30),
    )
    if not response.ok:
        raise RuntimeError(f"API de cifras HTTP {response.status_code}: {response.text[:180]}")
    return response.json()


def process_job(site: str, headers: dict[str, str], job: dict[str, Any]) -> None:
    identity = {"id": job["id"], "claimToken": job["claim_token"]}
    try:
        result = fetch_cifra(job)
        _api(site, headers, "POST", {**identity, "action": "complete", "result": result})
        print(f"Cifra concluida: {job['artista_slug']}/{job['musica_slug']}", flush=True)
    except Exception as exc:
        detail = str(exc)[:300] or "O processador local nao conseguiu obter a cifra."
        print(f"Falha na cifra {job.get('id')}: {detail}", flush=True)
        _api(site, headers, "POST", {**identity, "action": "fail", "detail": detail})


def run(site: str, headers: dict[str, str], stop: threading.Event) -> None:
    """Poll independently from the audio worker without starting a second process."""
    print("Coletor local de cifras ativo.", flush=True)
    while not stop.is_set():
        try:
            job = _api(site, headers, "GET").get("job")
            if job:
                process_job(site, headers, job)
            else:
                stop.wait(3)
        except Exception as exc:
            print(f"Fila de cifras indisponivel: {exc}", flush=True)
            stop.wait(10)
