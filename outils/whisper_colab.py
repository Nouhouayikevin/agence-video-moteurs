"""Contrôle de la voix sur Google Colab (étape 3, VOIX.md) : exécuté SUR la machine Colab par outils/voix_colab.sh.

Transcrit chaque /content/voix/out/NNN.wav (faster-whisper large-v3-turbo, carte graphique) et écrit /content/voix/controle.txt
au même format que 03-voix/controle.sh : « NNN | langue (p = …) | entendu | attendu ».
Avec un ou plusieurs dossiers 03-voix/ en argument (atelier_colab.sh) : transcrit leurs phrases/NNN.wav, écrit <dossier>/controle-colab.txt.
"""
import ctypes, glob, os, sys
from math import gcd
import nvidia.cublas, nvidia.cudnn   # faster-whisper (ctranslate2) wants CUDA 12 libs; Colab ships newer: pip nvidia-cublas-cu12 nvidia-cudnn-cu12, loaded by hand
for m, libs in ((nvidia.cublas, ['libcublasLt.so.12', 'libcublas.so.12']), (nvidia.cudnn, sorted(os.listdir(nvidia.cudnn.__path__[0] + '/lib')))):
    for l in libs:
        if '.so' in l: ctypes.CDLL(f'{m.__path__[0]}/lib/{l}', mode=ctypes.RTLD_GLOBAL)
import soundfile as sf
from scipy.signal import resample_poly
from faster_whisper import WhisperModel

model = WhisperModel('large-v3-turbo', device='cuda', compute_type='float16')
jobs = [(f'{d}/phrases', f'{d}/phrases', f'{d}/controle-colab.txt') for d in sys.argv[1:]] or [('/content/voix/out', '/content/voix/phrases', '/content/voix/controle.txt')]
for wavs, txts, res in jobs:
    with open(res, 'w') as out:
        for f in sorted(glob.glob(f'{wavs}/*.wav')):
            n = os.path.basename(f)[:-4]
            a, sr = sf.read(f, dtype='float32'); a = a.mean(1) if a.ndim > 1 else a; g = gcd(sr, 16000)
            segs, info = model.transcribe(resample_poly(a, 16000 // g, sr // g).astype('float32'), language=None, beam_size=5)   # numpy in: avoids PyAV (its version on Colab breaks decode_audio)
            heard = ' '.join(s.text.strip() for s in segs)
            expected = open(f'{txts}/{n}.txt').read().strip() if os.path.exists(f'{txts}/{n}.txt') else '?'
            out.write(f'{n} | {info.language} (p = {info.language_probability:.6f}) | {heard} | {expected}\n')
    print(res, sum(1 for _ in open(res)), 'phrases')
