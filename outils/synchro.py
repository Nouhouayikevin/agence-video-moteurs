"""Synchro voix ↔ image d'une vidéo finie (Kev, 2026-11-09 : un mixage avec une vieille voix décalait le son de plus en plus).
Mesure exacte sur le signal (corrélation), en deux temps, toutes les 30 s :
  1. la voix (03-voix/L003-voix.wav) tombe-t-elle dans la voix de montage (04-decoupage/voix-montage.wav) là où le découpage l'attend ?
     (une voix de montage pas refaite après un changement de voix échoue ici) ;
  2. la voix de montage tombe-t-elle au même endroit dans le son du .mp4 final ?
Échec si un écart dépasse 0,04 s (une image). La transcription whisper ne sert pas à ça : ses horodatages dérivent de 0,2 à 0,3 s sur 10 min.
Usage, depuis le dossier de l'épisode :  ~/lemo-opuscar/.venv/bin/python ~/agence-video/outils/synchro.py 06-son/L003-v1.mp4
"""
if __import__('sys').argv[1:2] in (['-h'], ['--help']): print(__doc__); raise SystemExit   # quick help: the docstring, nothing run
import os, json, subprocess, sys, numpy as np, soundfile as sf
from scipy.signal import correlate
SR = 48000
def mono(x): return x.mean(1) if x.ndim > 1 else x
def at(big, small_t, big_t, small):   # where the 2 s of `small` from small_t land in `big`, searched ±1 s around big_t
    seg = small[int(small_t * SR):int(small_t * SR) + 2 * SR]; b = max(0, int((big_t - 1) * SR)); win = big[b:b + 4 * SR]
    if len(win) < len(seg) or not np.any(seg): return None
    return (b + int(np.argmax(np.abs(correlate(win, seg, 'valid', method='fft'))))) / SR
CODE = os.path.basename(sys.argv[1]).split('-')[0]   # L003, L004…: taken from the video name (it was written for L003 only)
voice = mono(sf.read(f'03-voix/{CODE}-voix.wav')[0]); mont = mono(sf.read('04-decoupage/voix-montage.wav')[0])
final = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout, np.float32)
D = json.load(open('04-decoupage/decoupage.json'))
fin = lambda t: t + sum(p['duree'] for p in D['pauses'] if p['a_voix'] <= t + 1e-6)
bad = 0
for t in np.arange(15, len(voice) / SR - 3, 30):
    while any(t - .1 < p['a_voix'] < t + 2.1 for p in D['pauses']): t += 2.5   # a 2 s window across an edit pause cannot match in one piece
    e = fin(t); m = at(mont, t, e, voice)
    f = at(final, e, e, mont) if m is not None else None
    d1 = None if m is None else m - e; d2 = None if f is None else f - e
    ok = d1 is not None and d2 is not None and abs(d1) <= .04 and abs(d2) <= .04; bad += not ok
    print(f'{int(e // 60)}:{e % 60:04.1f}  voix→montage {d1:+.3f} s  montage→vidéo {d2:+.3f} s  {"ok" if ok else "DÉCALÉ"}' if d1 is not None and d2 is not None else f'{e:.1f}  silence, non mesuré')
print('synchro bonne' if not bad else f'SON DÉCALÉ ({bad} point(s))'); sys.exit(1 if bad else 0)
