"""Real R3 regression tests, plus stereo/cache invariants. No model download required."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
import soundfile as sf
from audio_hq import RATE, pitch_command, transpose, info, align, mix, export_mp3, convert_wav, cache_key, store_cache, cached

class AudioHQTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.source=self.root/"source.wav"
        t=np.arange(3*RATE)/RATE
        sf.write(self.source,np.column_stack((.2*np.sin(2*np.pi*440*t),.2*np.sin(2*np.pi*660*t))),RATE,subtype="FLOAT")
    def tearDown(self):self.temp.cleanup()
    def test_r3_all_six_intervals_stereo_duration_and_pitch(self):
        for semitones in (-3,-2,-1,1,2,3):
            with self.subTest(semitones=semitones):
                target=self.root/f"{semitones}.wav"
                transpose(self.source,target,semitones)
                metadata=info(target)
                self.assertEqual(metadata.frames,3*RATE)
                y,_=sf.read(target);segment=y[RATE:2*RATE]
                for channel,hz in enumerate((440,660)):
                    spectrum=np.abs(np.fft.rfft(segment[:,channel]*np.hanning(RATE)))
                    measured=np.argmax(spectrum)
                    self.assertAlmostEqual(measured,hz*2**(semitones/12),delta=2)
                self.assertGreater(float(np.std(y[:,0]-y[:,1])),.01)
    def test_drums_are_bit_identical_for_every_interval(self):
        for semitones in (-3,-2,-1,1,2,3):
            target=self.root/"drums.wav";transpose(self.source,target,semitones,drums=True)
            self.assertEqual(target.read_bytes(),self.source.read_bytes())
    def test_formants_only_on_voice_and_explicit_r3(self):
        voice=pitch_command("rubberband",self.source,self.root/"out.wav",2,vocal=True)
        self.assertIn("-3",voice);self.assertIn("--formant",voice);self.assertIn("--centre-focus",voice)
        self.assertNotIn("--formant",pitch_command("rubberband",self.source,self.root/"out.wav",2))
        for n in (-12,12,1.5):
            with self.assertRaises(ValueError):pitch_command("rb",self.source,self.root/"o",n)
    def test_tempo_matches_all_stems_and_preserves_drum_pitch(self):
        for speed in (.75,.9,1.1):
            target=self.root/"tempo.wav";transpose(self.source,target,3,speed,drums=True)
            self.assertEqual(info(target).frames,round(3*RATE/speed))
            y,_=sf.read(target);spectrum=np.abs(np.fft.rfft(y[RATE:2*RATE,0]*np.hanning(RATE)))
            self.assertAlmostEqual(np.argmax(spectrum),440,delta=2)
    def test_mono_rejected_and_large_drift_rejected(self):
        mono=self.root/"mono.wav";sf.write(mono,np.zeros(RATE),RATE)
        with self.assertRaises(ValueError):info(mono)
        with self.assertRaises(ValueError):align(self.source,100)
    def test_mix_mp3_and_cache(self):
        target=self.root/"mix.wav";mix([self.source,self.source],target)
        mp3=self.root/"mix.mp3";export_mp3(target,mp3)
        decoded=self.root/"decoded.wav";convert_wav(mp3,decoded)
        self.assertEqual(info(decoded).frames,3*RATE)
        self.assertLessEqual(np.max(np.abs(sf.read(target)[0])),.981)
        cache=self.root/"cache";key=cache_key("song",2,1)
        self.assertNotEqual(key,cache_key("song",3,1))
        store_cache(cache,key,self.root,["mix.wav","mix.mp3"])
        self.assertIsNotNone(cached(cache,key,["mix.wav","mix.mp3"]))
        (cache/key/"mix.mp3").unlink();self.assertIsNone(cached(cache,key,["mix.wav","mix.mp3"]))
if __name__=="__main__":unittest.main()
