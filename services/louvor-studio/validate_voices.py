"""Usage: python validate_voices.py --fixtures DIR --output DIR.
Fixtures male.wav, female.wav, choir.wav must be authorized audio excerpts.
This measures technical invariants; it does not claim a subjective listening verdict.
"""
import argparse,json,time,html
from pathlib import Path
import numpy as np
import soundfile as sf
from audio_hq import transpose,info,export_mp3

def main():
    args=argparse.ArgumentParser();args.add_argument("--fixtures",type=Path,required=True);args.add_argument("--output",type=Path,required=True);a=args.parse_args()
    a.output.mkdir(parents=True,exist_ok=True);rows=[];sections=[]
    for voice in ("male","female","choir"):
        source=a.fixtures/(voice+".wav");metadata=info(source)
        original=a.output/(voice+"_original.mp3");export_mp3(source,original)
        sections.append(f"<h2>{voice}</h2><p>Original</p><audio controls src='{original.name}'></audio>")
        for semitones in (-3,-2,-1,1,2,3):
            target=a.output/f"{voice}_{semitones:+d}.wav";started=time.perf_counter()
            transpose(source,target,semitones,vocal=True)
            out=info(target);audio,_=sf.read(target)
            assert out.frames==metadata.frames and out.channels==2 and out.samplerate==44100
            assert np.isfinite(audio).all()
            mp3=target.with_suffix(".mp3");export_mp3(target,mp3)
            row={"voice":voice,"semitones":semitones,"channels":out.channels,"rate":out.samplerate,"frames":out.frames,"duration_difference_samples":out.frames-metadata.frames,"seconds":round(time.perf_counter()-started,3),"peak":round(float(np.max(np.abs(audio))),5),"stereo_difference_rms":round(float(np.sqrt(np.mean((audio[:,0]-audio[:,1])**2))),6)}
            rows.append(row);print(json.dumps(row),flush=True)
            sections.append(f"<p>{semitones:+d} semitons</p><audio controls src='{mp3.name}'></audio>")
    (a.output/"results.json").write_text(json.dumps(rows,indent=2),encoding="utf-8")
    (a.output/"comparison.html").write_text("<!doctype html><meta charset='utf-8'><title>R3: comparações de voz</title><style>body{font:16px system-ui;max-width:900px;margin:30px auto;background:#15151b;color:#eee}audio{width:100%}</style><h1>R3 com preservação de formantes</h1><p>Trechos de 12 segundos. Testes técnicos passaram; avalie o timbre ouvindo original e versões.</p><p>Coral: Training Choirs — The Silence and the Song, Childrenschorussa, <a href='https://commons.wikimedia.org/wiki/File:Training_Choirs_-_%22The_Silence_and_the_Song%22_(May_2012).ogg'>fonte</a>, <a href='https://creativecommons.org/licenses/by-sa/3.0/'>CC BY-SA 3.0</a>. Trecho recortado e transposto; derivados de coral sob a mesma licença.</p>"+"".join(sections),encoding="utf-8")
if __name__=="__main__":main()
