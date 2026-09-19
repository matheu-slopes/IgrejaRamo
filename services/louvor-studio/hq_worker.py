"""HQ queue worker: short HTTP requests, persistent model cache, isolated jobs and leases."""
from __future__ import annotations
import json
import os
import re
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import requests
from dotenv import load_dotenv
from filelock import FileLock, Timeout
ROOT=Path(__file__).resolve().parent
load_dotenv(ROOT/".env.worker")
SITE=os.environ.get("LOUVOR_STUDIO_SITE_URL","").rstrip("/")
SECRET=os.environ.get("LOUVOR_STUDIO_WORKER_SECRET","")
WORKER=os.environ.get("LOUVOR_STUDIO_WORKER_ID",socket.gethostname())+"-hq"
HEADERS={"X-Worker-Secret":SECRET,"X-Worker-Id":WORKER}
TIMEOUT=int(os.environ.get("HQ_TIMEOUT_SECONDS","7200"))

def api(method,payload=None):
    response=requests.request(method,SITE+"/api/louvor-studio/worker/hq",headers=HEADERS,json=payload,timeout=20)
    if not response.ok:raise RuntimeError(f"API HQ HTTP {response.status_code}: {response.text[:180]}")
    return response.json()

def public_failure(exc):
    response=getattr(exc,"response",None)
    if getattr(response,"status_code",None)==400:
        return "O Storage recusou uma faixa por tamanho. Tente uma música menor; no plano grátis cada arquivo pode ter até 50 MB."
    return "O processamento falhou. Tente novamente; detalhes no registro do processador."

def process(job):
    kind=job["kind"];row=job["version"] if kind=="pitch" else job["project"]
    identity={"kind":kind,"id":row["id"],"claimToken":row["claim_token"]}
    with tempfile.TemporaryDirectory(prefix="louvor-hq-") as folder:
        work=Path(folder);manifest=work/"job.json";log=work/"job.log"
        manifest.write_text(json.dumps(job),encoding="utf-8")
        stopped=threading.Event()
        progress={"progress":2,"stage":"baixando" if kind=="separate" else "separando"}
        def heartbeat():
            while not stopped.wait(5):
                try:
                    if log.exists():
                        with log.open("rb") as stream:
                            stream.seek(0,2);stream.seek(max(0,stream.tell()-16384))
                            lines=re.findall(r'HQ_PROGRESS=(\{[^\r\n]+\})',stream.read().decode("utf-8",errors="replace"))
                        if lines:
                            latest=json.loads(lines[-1]);progress["progress"]=max(progress["progress"],latest["progress"]);progress["stage"]=latest["stage"]
                    api("POST",{**identity,"action":"heartbeat",**progress})
                except Exception as exc:print(f"Atualização de progresso: {exc}",flush=True)
        monitor=threading.Thread(target=heartbeat,daemon=True);monitor.start()
        try:
            with log.open("w",encoding="utf-8") as output:
                child=subprocess.Popen([sys.executable,"-u",str(ROOT/"hq_task.py"),str(manifest)],
                    stdout=output,stderr=subprocess.STDOUT,start_new_session=os.name!="nt",
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name=="nt" else 0)
                try:
                    if child.wait(timeout=TIMEOUT):raise RuntimeError("O processamento de áudio falhou.")
                except BaseException:
                    # Terminate only this job's descendants, including FFmpeg and R3.
                    if child.poll() is None:
                        if os.name=="nt":
                            subprocess.run(["taskkill","/PID",str(child.pid),"/T","/F"],capture_output=True,timeout=15)
                        else:os.killpg(child.pid,signal.SIGKILL)
                        child.wait(timeout=15)
                    raise
            result=json.loads((work/"result.json").read_text(encoding="utf-8"))
            uploads=api("POST",{**identity,"action":"uploads"})["uploads"]
            if set(uploads)!=set(result["files"]):raise ValueError("Arquivos de saída inesperados.")
            def upload_file(index,name,upload):
                path=work/"output"/result["files"][name]
                if path.resolve().parent!=(work/"output").resolve():raise ValueError("Caminho inválido.")
                with path.open("rb") as audio:
                    response=requests.put(upload["signedUrl"],data=audio,
                        headers={"Content-Type":"audio/flac" if path.suffix==".flac" else "audio/mpeg","x-upsert":"true"},timeout=(20,1800))
                    response.raise_for_status()
                return index
            # Lossless stems can still be large. Upload a small, bounded group concurrently so
            # network latency does not make the final 90–99% stage serial.
            with ThreadPoolExecutor(max_workers=min(3,len(uploads))) as pool:
                futures=[pool.submit(upload_file,index,name,upload) for index,(name,upload) in enumerate(uploads.items())]
                for future in as_completed(futures):
                    index=future.result()
                    progress["progress"]=max(progress["progress"],90+int(9*(index+1)/len(uploads)))
            stopped.set();monitor.join(25)
            api("POST",{**identity,"action":"complete",**result["metadata"]})
            print(f"Concluído: {row['id']}",flush=True)
        except Exception as exc:
            stopped.set();monitor.join(25)
            detail=log.read_text(encoding="utf-8",errors="replace")[-5000:] if log.exists() else ""
            message=public_failure(exc)
            print(f"Falha {row['id']}: {message}\n{detail}",flush=True)
            api("POST",{**identity,"action":"fail","configuration":"RUBBERBAND_PATH" in detail,"detail":message})
        finally:
            stopped.set();monitor.join(25)

def main():
    for stream in (sys.stdout,sys.stderr):
        if hasattr(stream,"reconfigure"):stream.reconfigure(encoding="utf-8",errors="replace")
    if not SITE or not SECRET:raise RuntimeError("Configure .env.worker.")
    try:
        with FileLock(str(ROOT/".hq-worker.lock"),timeout=0):
            print("Louvor Studio HQ — aguardando músicas e tonalidades.",flush=True)
            while True:
                try:
                    job=api("GET").get("job")
                    if job:process(job)
                    else:time.sleep(5)
                except KeyboardInterrupt:return
                except Exception as exc:
                    print(f"Fila indisponível: {exc}",flush=True);time.sleep(10)
    except Timeout:raise RuntimeError("Já existe um worker HQ neste computador.")

if __name__=="__main__":main()

