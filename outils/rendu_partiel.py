"""Rendu partiel : refaire seulement les plans touchés d'une vidéo déjà rendue, puis les recoller (Kev, 2026-11-14 : « ne pas attendre une heure
pour corriger un morceau »). Quelques minutes au lieu d'une heure.

Usage, depuis le dossier de l'épisode :  python3 ~/agence-video/outils/rendu_partiel.py 45 '41 ✦' 21
  (les noms de plans de 04-decoupage/decoupage.json ; ensuite, comme d'habitude : son.py, mux.sh, contrôles)

Comment : la vidéo muette (05-rendu/*-rendu-muet.mp4) est coupée sur ses images clés autour de chaque plan ; seuls ces morceaux sont
rendus de nouveau (still.mjs, image par image), encodés avec les réglages de video.mjs, puis recollés au reste copié tel quel (sans
réencodage). Contrôle à la fin : même nombre d'images qu'avant et décodage complet sans erreur, sinon l'ancienne vidéo reste en place.

PAS de rendu partiel (rendu complet, sh 05-rendu/build.sh) quand : la voix ou le découpage change (tous les plans d'après bougent) ;
la version finale avant publication. Un fichier commun modifié (décor, caméra, objet partagé) : lister TOUS les plans qui l'utilisent
et les passer tous ici, ou faire le rendu complet. Après un rendu partiel, la planche (05-rendu/stills) n'est pas refaite.
"""
if __import__('sys').argv[1:2] in (['-h'], ['--help']): print(__doc__); raise SystemExit   # quick help: the docstring, nothing run
import glob, json, os, shutil, subprocess, sys, tempfile
LIB = os.path.expanduser(os.environ.get('LIB', '~/lemo-opuscar'))
FPS = 24
plans = sys.argv[1:]
if not plans: sys.exit(__doc__)
D = json.load(open('04-decoupage/decoupage.json')); PL = {str(p['plan']): p for p in D['plans']}   # plan names can be numbers in decoupage.json
miss = [n for n in plans if n not in PL]
if miss: sys.exit(f'plans inconnus : {miss} ; connus : {list(PL)}')
muet = glob.glob('05-rendu/*-rendu-muet.mp4'); assert len(muet) == 1, muet; muet = os.path.abspath(muet[0])
film = os.path.abspath('05-rendu/film')
run = lambda *a, **k: subprocess.run(a, check=True, **k)
# the same checks as build.sh before any render: a broken film file must not get spliced in
for f in glob.glob(film + '/*.js'):
    t = tempfile.mktemp(suffix='.mjs'); shutil.copy(f, t); run('node', '--check', t); os.remove(t)
shutil.copy('04-decoupage/decoupage.json', film)
cnt = lambda v: int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-count_packets', '-show_entries', 'stream=nb_read_packets',
                                    '-of', 'csv=p=0', v], capture_output=True, text=True, check=True).stdout)
N = cnt(muet)
keys = [round(float(x.strip(','))  * FPS) for x in subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-skip_frame', 'nokey', '-show_entries',
        'frame=pts_time', '-of', 'csv=p=0', muet], capture_output=True, text=True, check=True).stdout.split() if x.strip(',')]
keys = sorted(set(keys + [N]))
# each shot widened to the keyframes around it, overlapping ranges merged: [a, b) in frames
R = []
for n in plans:
    a = max(k for k in keys if k <= round(PL[n]['debut'] * FPS)); b = min(k for k in keys if k >= min(N, round(PL[n]['fin'] * FPS)))
    R.append([a, b])
R.sort(); M = [R[0]]
for a, b in R[1:]:
    if a <= M[-1][1]: M[-1][1] = max(M[-1][1], b)
    else: M.append([a, b])
W = tempfile.mkdtemp(prefix='rendu-partiel-', dir=os.path.dirname(muet))
try:
    parts, prev = [], 0
    for i, (a, b) in enumerate(M):
        print(f'plans à refaire : images {a}–{b} ({a / FPS:.2f}–{b / FPS:.2f} s), {b - a} images')
        if a > prev: parts.append(('old', prev, a))
        d = f'{W}/r{i}'; T = [f'{f / FPS:.6f}' for f in range(a, b)]
        for j in range(0, len(T), 400):   # still.mjs by chunks: a command line stays short
            run('node', 'core/render/still.mjs', film, *T[j:j + 400], '--size', '1920x1080', '--out', d, cwd=LIB, env={**os.environ, 'LEMO_ANGLE': 'vulkan'}, stdout=subprocess.DEVNULL)
        for k, t in enumerate(T): os.symlink(f'{d}/t_{t}.jpg', f'{d}/f_{k:05d}.jpg')
        run('ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{d}/f_%05d.jpg', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14',
            '-pix_fmt', 'yuv420p', f'{W}/new{i}.mp4')   # same encoder settings as video.mjs, so the pieces join without re-encoding
        parts.append(('new', i, None)); prev = b
    if prev < N: parts.append(('old', prev, N))
    L = []
    for k, (kind, x, y) in enumerate(parts):
        if kind == 'new': L.append(f'{W}/new{x}.mp4'); continue
        p = f'{W}/old{k}.mp4'; run('ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{x / FPS:.6f}', '-i', muet, '-frames:v', str(y - x), '-c', 'copy', '-an', p); L.append(p)
    open(f'{W}/list.txt', 'w').write(''.join(f"file '{p}'\n" for p in L))
    out = f'{W}/out.mp4'
    run('ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{W}/list.txt', '-c', 'copy', out)
    n2 = cnt(out); err = subprocess.run(['ffmpeg', '-v', 'error', '-i', out, '-f', 'null', '-'], capture_output=True, text=True).stderr.strip()
    assert n2 == N and not err, f'recollage raté ({n2} images au lieu de {N}) {err[:300]} : ancienne vidéo gardée'
    os.replace(out, muet); print(f'ok : {muet} ({N} images), {sum(b - a for a, b in M)} images refaites')
finally:
    shutil.rmtree(W, ignore_errors=True)
