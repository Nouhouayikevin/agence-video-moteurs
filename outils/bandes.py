#!/usr/bin/env python3
"""Bandes à 0,2 s (PRODUCTION étape 7, checklist « IMAGE ») : une image par plan, 5 images par seconde côte à côte.

Usage :  python3 ~/agence-video/outils/bandes.py <vidéo.mp4> <decoupage.json | -> <dossier de sortie>
  avec un découpage : une image par plan (16:9 : 6 colonnes de 320 px ; 9:16 : 8 colonnes de 200 px) ;
  avec « - » (extraits, sans découpage à eux) : une image par tranche de 10 s (10 colonnes de 160 px).
"""
if __import__('sys').argv[1:2] in (['-h'], ['--help']): print(__doc__); raise SystemExit   # quick help: the docstring, nothing run
import json, os, subprocess, sys

mp4, dec, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
w, h = map(int, subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', mp4],
                               capture_output=True, text=True, check=True).stdout.split(',')[:2])
ff = lambda a, b, vf, name: subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', f'{a:.2f}', '-t', f'{b - a:.2f}', '-i', mp4, '-vf', vf,
                                             '-frames:v', '1', name], check=True)
if dec == '-':
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', mp4, '-vf', 'fps=5,scale=160:-1,tile=10x5', f'{out}/%02d.jpg'], check=True)
    print(len(os.listdir(out)), 'bandes')
else:
    D = json.load(open(dec)); P = D['plans'] if isinstance(D, dict) else D
    cols, cw = (6, 320) if w > h else (8, 200)
    for i, p in enumerate(P):
        a, b = p['debut'], p['fin']; rows = (int((b - a) / .2) + cols) // cols
        ff(a, b, f'fps=5,scale={cw}:-1,tile={cols}x{rows}', f"{out}/{i:03d}_{p['plan']}.jpg")
    print(len(P), 'bandes')
