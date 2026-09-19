"""Run the actual task subprocess and signed HTTP downloads/uploads against a local test server."""
import json,tempfile,threading,unittest,uuid
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
from unittest.mock import patch
import numpy as np
import soundfile as sf
import hq_worker
from audio_hq import RATE,info

class PipelineTests(unittest.TestCase):
    def test_both_modes_complete_upload_cache_and_synchronized_mix(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);received={};events=[]
            t=np.arange(3*RATE)/RATE
            stems=("vocals","instrumental","drums","bass","other")
            for index,stem in enumerate(stems):
                y=np.column_stack((.03*np.sin(2*np.pi*(220+110*index)*t),.03*np.sin(2*np.pi*(330+110*index)*t)))
                sf.write(root/(stem+".wav"),y,RATE,subtype="FLOAT")
            class Handler(BaseHTTPRequestHandler):
                def log_message(self,*args):pass
                def do_GET(self):
                    name=self.path.rsplit("/",1)[-1]
                    if name not in [s+".wav" for s in stems]:self.send_error(404);return
                    self.send_response(200);self.end_headers();self.wfile.write((root/name).read_bytes())
                def do_PUT(self):
                    received[self.path]=self.rfile.read(int(self.headers['Content-Length']))
                    self.send_response(200);self.end_headers();self.wfile.write(b'{}')
            server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            base=f"http://127.0.0.1:{server.server_port}"
            try:
                for mode in ("bs_roformer","htdemucs_ft"):
                    names=("vocals","instrumental") if mode=="bs_roformer" else ("vocals","drums","bass","other")
                    job={"kind":"pitch","project":{"id":str(uuid.uuid4()),"separation_mode":mode},"version":{"id":str(uuid.uuid4()),"claim_token":str(uuid.uuid4()),"semitones":2,"speed":1},"inputs":{s:base+'/'+s+'.wav' for s in names}}
                    expected={s:s+'.mp3' for s in names};expected.update(mix_wav='mix.flac',mix_mp3='mix.mp3')
                    def api(method,payload):
                        events.append(payload['action'])
                        if payload['action']=='uploads':return {'uploads':{s:{'signedUrl':base+'/'+name} for s,name in expected.items()}}
                        return {'ok':True}
                    with patch.object(hq_worker,'api',side_effect=api):
                        for attempt in range(2):
                            hq_worker.process(job)
                            self.assertEqual(events[-1],'complete');self.assertNotIn('fail',events)
                            self.assertEqual(set(received),{'/'+n for n in expected.values()})
                            out=root/'mix.flac';out.write_bytes(received['/mix.flac'])
                            self.assertEqual(info(out).frames,3*RATE)
                            if attempt==0:original=received['/mix.flac']
                            else:self.assertEqual(original,received['/mix.flac'])
                            received.clear()
            finally:server.shutdown();server.server_close();thread.join()
if __name__=='__main__':unittest.main()
