#!/usr/bin/env python3
"""incruste.py : pose les vrais extraits (vidéos, images) SOUS le film rendu, par écran vert (MEMOIRE règles 41-42, RENDU.md §2 bis).

usage : python3 outils/incruste.py <film-muet.mp4> <reels.json> <sortie.mp4> [--son <reels-son.wav>] [--medias <dossier>]
        (sur la machine Google : l'encodage d'un film entier est un calcul lourd)

Le film peint en vert pur (#00FF00) la zone où va le vrai (plein écran, ou un cadre dessiné en pixel autour) ; nos sous-titres,
mots-clés et cadres restent par-dessus. reels.json (écrit par le découpage) :
  {"medias": "~/agence-medias/nan_serieux/F002-gta6", "w": 1920, "h": 1080,
   "couches": [{"src": "speed-fin.mp4", "t": 12.4, "in": 81.2, "d": 3.5, "rect": [0, 0, 1920, 1080],
                "crop": [x, y, w, h] (facultatif, dans la source), "vol": 1.0 (son de l'extrait, 0 = muet), "fade": 0.08}]}
  t = début dans le film ; in = début dans la source ; d = durée ; rect = où, dans l'image du film. Une image (jpg/png) tient d secondes.
Sortie : la vidéo incrustée (H.264, même cadence, sans son) et, avec --son, un .wav 48 kHz de la durée du film avec le son des extraits
(chacun à son volume, fondu court), que le mixage pose à côté de la voix.
"""
import json, os, subprocess, sys

def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).strip())

def main(a):
    if not a or a[0] in ('-h', '--help') or len(a) < 3: print(__doc__); return 0
    film, spec, out = a[0], json.load(open(a[1], encoding='utf-8')), a[2]
    son = a[a.index('--son') + 1] if '--son' in a else None
    med = os.path.expanduser(a[a.index('--medias') + 1] if '--medias' in a else spec['medias'])
    W, H, L, D = spec.get('w', 1920), spec.get('h', 1080), spec['couches'], dur(film)
    for c in L:
        assert os.path.exists(os.path.join(med, c['src'])), 'média absent : ' + c['src'] + ' (python3 outils/medias.py <épisode>)'
    inp = ['-i', film]; fl = [f'color=c=black:s={W}x{H}:d={D:.3f}:r=24[b0]']; aud = []
    for i, c in enumerate(L, 1):
        src = os.path.join(med, c['src']); img = src.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))
        inp += (['-loop', '1', '-t', f"{c['d']:.3f}"] if img else ['-ss', f"{c.get('in', 0):.3f}", '-t', f"{c['d']:.3f}"]) + ['-i', src]
        x, y, w, h = c['rect']; cr = f"crop={c['crop'][2]}:{c['crop'][3]}:{c['crop'][0]}:{c['crop'][1]}," if c.get('crop') else ''
        fl.append(f"[{i}:v]{cr}scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps=24,setpts=PTS-STARTPTS+{c['t']:.3f}/TB[v{i}]")
        fl.append(f"[b{i-1}][v{i}]overlay={x}:{y}:eof_action=pass:enable='between(t,{c['t']:.3f},{c['t'] + c['d']:.3f})'[b{i}]")
        if son and not img and c.get('vol', 0) > 0:
            fd = c.get('fade', .08); ms = int(c['t'] * 1000)
            fl.append(f"[{i}:a]aresample=48000,volume={c['vol']},afade=t=in:d={fd},afade=t=out:st={max(0, c['d'] - fd):.3f}:d={fd},adelay={ms}|{ms}[a{i}]"); aud.append(f'[a{i}]')
    fl.append(f"[0:v]chromakey=0x00ff00:0.18:0.04[k];[b{len(L)}][k]overlay=0:0:shortest=1[v]")
    cmd = ['ffmpeg', '-nostdin', '-y', '-v', 'error'] + inp
    if son and aud:
        fl.append(f"{''.join(aud)}amix=inputs={len(aud)}:normalize=0,apad=whole_dur={D:.3f}[a]")
        cmd += ['-filter_complex', ';'.join(fl), '-map', '[v]', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-an', out,
                '-map', '[a]', '-ar', '48000', '-ac', '2', son]
    else:
        cmd += ['-filter_complex', ';'.join(fl), '-map', '[v]', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-an', out]
    r = subprocess.call(cmd)
    if r == 0: print('incrusté :', out, f'({len(L)} extraits)', ('+ son : ' + son) if son and aud else '')
    return r

if __name__ == '__main__': sys.exit(main(sys.argv[1:]))
