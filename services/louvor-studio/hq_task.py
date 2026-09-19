"""One isolated HQ job. Inputs come only from the authenticated worker API."""
from __future__ import annotations
import json
import shutil
import sys
from pathlib import Path
import requests
import yt_dlp
from audio_hq import (ROOT, RATE, MODELS, STEMS, VERSION, clean_cache, emit, ffmpeg_path, run,
    convert_wav, file_hash, cache_key, cached, separate, store_cache, export_mp3, export_flac,
    info, rubberband_path, transpose, mix)

def download(url,path,max_bytes=536870912):
    with requests.get(url,stream=True,timeout=(15,90)) as response:
        response.raise_for_status()
        size=0
        with path.open("wb") as output:
            for block in response.iter_content(1024*1024):
                size+=len(block)
                if size>max_bytes:raise ValueError("Arquivo excede o tamanho permitido.")
                output.write(block)

def download_youtube(url,work):
    options={"format":"bestaudio/best","outtmpl":str(work/"download.%(ext)s"),
        "noplaylist":True,"quiet":True,"no_warnings":True,"socket_timeout":15,"retries":2,
        "max_filesize":268435456,"ffmpeg_location":ffmpeg_path()}
    with yt_dlp.YoutubeDL(options) as ydl:
        metadata=ydl.extract_info(url,download=False)
        duration=metadata.get("duration")
        if metadata.get("is_live") or not duration or duration>1200:
            raise ValueError("Use uma gravação de até 20 minutos, sem transmissão ao vivo.")
        ydl.download([url])
    sources=[p for p in work.glob("download.*") if p.suffix not in (".part",".ytdl")]
    if len(sources)!=1:raise RuntimeError("Não foi possível obter o áudio.")
    return sources[0],metadata

def execute(job,work):
    project=job["project"];output=work/"output";output.mkdir()
    cache=ROOT/".audio-cache";clean_cache(cache)
    if job["kind"]=="separate":
        mode=project["separation_mode"]
        if mode not in MODELS:raise ValueError("Modelo inválido.")
        emit(5,"baixando")
        downloaded,download_metadata=download_youtube(project["youtube_url"],work)
        duration=download_metadata["duration"]
        source=work/"source.wav";metadata_wav=convert_wav(downloaded,source)
        emit(22,"analisando")
        try:
            analysis=json.loads(run([sys.executable,ROOT/"analysis.py",source,"--ffmpeg",ffmpeg_path(),"--duration",str(duration)],45).stdout)
        except Exception:
            analysis={"tom":None,"bpm":None,"beat_offset_seg":None}
        digest=file_hash(source);key=cache_key(VERSION,digest,mode,MODELS[mode])
        names=[n+".wav" for n in STEMS[mode]]
        hit=cached(cache,key,names)
        emit(30)
        if hit:
            for n in names:shutil.copy2(hit/n,output/n)
            emit(82)
        else:
            separate(source,output,mode,ROOT/".models")
            store_cache(cache,key,output,names)
        metadata={"key":analysis["tom"],"bpm":analysis["bpm"],"beat_offset_seg":analysis.get("beat_offset_seg"),"hash":digest,"model":MODELS[mode],
                  "duration":metadata_wav.frames/RATE,"title":download_metadata.get("title"),
                  "artist":download_metadata.get("channel") or download_metadata.get("uploader"),"thumbnail":download_metadata.get("thumbnail")}
        stems=STEMS[mode]
        for index,stem in enumerate(stems):
            export_mp3(output/(stem+".wav"),output/(stem+".mp3"))
            export_flac(output/(stem+".wav"),output/(stem+".flac"))
            emit(82+int(8*(index+1)/len(stems)))
        files={stem:stem+".mp3" for stem in stems}
        # Keep the legacy key so existing database columns and API clients work.
        files.update({stem+"_wav":stem+".flac" for stem in stems})
    else:
        version=job["version"];semitones=version["semitones"];speed=float(version["speed"])
        mode="bs_roformer" if project["separation_mode"]=="bs_roformer" else "htdemucs_ft"
        stems=STEMS[mode]
        source_dir=work/"sources";source_dir.mkdir()
        fingerprints=[]
        for index,stem in enumerate(stems):
            emit(5+int(15*index/len(stems)))
            path=source_dir/(stem+".wav");download(job["inputs"][stem],source_dir/(stem+".input"))
            convert_wav(source_dir/(stem+".input"),path);fingerprints.append(file_hash(path))
        if len({info(source_dir/(s+".wav")).frames for s in stems})!=1:raise ValueError("Faixas originais sem sincronização.")
        rubberband_path()
        key=cache_key(VERSION,fingerprints,mode,semitones,speed)
        names=[s+".mp3" for s in stems]+["mix.flac","mix.mp3"]
        hit=cached(cache,key,names)
        if hit:
            for name in names:shutil.copy2(hit/name,output/name)
            emit(90)
        else:
            for index,stem in enumerate(stems):
                emit(20+int(50*index/len(stems)))
                transpose(source_dir/(stem+".wav"),output/(stem+".wav"),semitones,speed,
                          vocal=stem=="vocals",drums=stem=="drums")
                export_mp3(output/(stem+".wav"),output/(stem+".mp3"))
            emit(75)
            mix([output/(s+".wav") for s in stems],output/"mix.wav")
            export_mp3(output/"mix.wav",output/"mix.mp3")
            export_flac(output/"mix.wav",output/"mix.flac")
            (output/"mix.wav").unlink()
            store_cache(cache,key,output,names)
            emit(90)
        files={stem:stem+".mp3" for stem in stems}
        files.update({"mix_wav":"mix.flac","mix_mp3":"mix.mp3"})
        metadata={}
    (work/"result.json").write_text(json.dumps({"files":files,"metadata":metadata}),encoding="utf-8")

if __name__=="__main__":
    for stream in (sys.stdout,sys.stderr):
        if hasattr(stream,"reconfigure"):stream.reconfigure(encoding="utf-8",errors="replace")
    manifest=Path(sys.argv[1]).resolve()
    execute(json.loads(manifest.read_text(encoding="utf-8")),manifest.parent)

