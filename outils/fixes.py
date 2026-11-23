"""Une image fixe au milieu de CHAQUE plan (longue, extraits, LSO), avant le rendu unique (PRODUCTION.md, « Une vidéo = un seul rendu final »).
À lancer SUR LA MACHINE GOOGLE depuis le dossier de l'épisode (outils/chaine.sh le fait) :
    python3 ~/agence-video/outils/fixes.py [long E1 … LSO4]      → 07-revue-technique/planches-fixes/<vidéo>-NN.jpg (planches de 6 images légendées) ; avec `long` : aussi `miniature-comparaison.jpg` (notre miniature + celles de 00-sujet/miniatures-ref/) ; accroches des extraits et LSO à 0 / 0,5 / 1,2 / 3 s
Les extraits ont besoin de 05-rendu/film/ext.json à jour (09-export/extraits.py), les LSO de LSOn/05-rendu/build.sh prepa.
"""
if __import__('sys').argv[1:2] in (['-h'], ['--help']): print(__doc__); raise SystemExit   # quick help: the docstring, nothing run
import json, os, subprocess, sys
from PIL import Image, ImageDraw
E = os.getcwd(); LIB = os.path.expanduser('~/lemo-opuscar'); OUT = f'{E}/07-revue-technique/fixes'; SHEETS = f'{E}/07-revue-technique/planches-fixes'
os.makedirs(OUT, exist_ok=True); os.makedirs(SHEETS, exist_ok=True)

def stills(film, pts, size, q, tag):   # pts = [(time, label)]
    d = f'{OUT}/raw-{tag}'; os.makedirs(d, exist_ok=True)
    ts = [f'{t:.2f}' for t, _ in pts]
    env = dict(os.environ, LEMO_ANGLE=os.environ.get('LEMO_ANGLE', 'vulkan'))
    subprocess.run(['node', 'core/render/still.mjs', film, *ts, '--size', size, '--out', d] + (['--q', q] if q else []), cwd=LIB, env=env, check=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
    files = [(f'{d}/t_{t}.jpg', lab) for t, (_, lab) in zip(ts, pts)]
    vert = size.startswith('1080')
    cols, w = (3, 480) if vert else (2, 960)
    for k in range(0, len(files), 6):
        ch = files[k:k + 6]; im0 = Image.open(ch[0][0]); h = w * im0.height // im0.width; rows = (len(ch) + cols - 1) // cols
        S = Image.new('RGB', (cols * w, rows * (h + 26)), (20, 20, 24)); dr = ImageDraw.Draw(S)
        for i, (f, lab) in enumerate(ch):
            x, y = i % cols * w, i // cols * (h + 26)
            S.paste(Image.open(f).convert('RGB').resize((w, h)), (x, y + 26)); dr.text((x + 6, y + 6), lab, fill=(255, 230, 120))
        S.save(f'{SHEETS}/{tag}-{k // 6 + 1:02d}.jpg', quality=88)
    print(tag, len(files), 'images')

HOOK_T = [0.0, 0.5, 1.2, 3.0]   # PRODUCTION.md étape 2 : les 3 premières secondes à 0 / 0,5 / 1,2 / 3 s (2026-11-23 : les accroches faibles de F001 n'ont été vues qu'après les rendus)

def thumb_board():   # the thumbnail + the reference thumbnails of 00-sujet/miniatures-ref/ side by side: the stranger test BEFORE any long render (MEMOIRE 39)
    stills(film, [(0, 'miniature')], '1920x1080', 'thumb=1', 'miniature')
    refs = sorted(f for f in (os.listdir(f'{E}/00-sujet/miniatures-ref') if os.path.isdir(f'{E}/00-sujet/miniatures-ref') else []) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')))
    ims = [Image.open(f'{OUT}/raw-miniature/t_0.00.jpg').convert('RGB')] + [Image.open(f'{E}/00-sujet/miniatures-ref/{f}').convert('RGB') for f in refs]
    w = 640; h = 360; cols = 3; rows = (len(ims) + cols - 1) // cols
    S = Image.new('RGB', (cols * w, rows * (h + 26)), (20, 20, 24)); dr = ImageDraw.Draw(S)
    for i, im in enumerate(ims):
        x, y = i % cols * w, i // cols * (h + 26); dr.text((x + 6, y + 6), 'NOTRE MINIATURE' if i == 0 else 'référence : ' + refs[i - 1], fill=(255, 230, 120)); S.paste(im.resize((w, h)), (x, y + 26))
    S.save(f'{SHEETS}/miniature-comparaison.jpg', quality=88); print('miniature', len(refs), 'références' if refs else 'références : aucune (00-sujet/miniatures-ref/ vide : télécharger 5 à 6 miniatures à succès)')

D = json.load(open('04-decoupage/decoupage.json')); P = D['plans']
want = sys.argv[1:] or ['long', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'LSO1', 'LSO2', 'LSO3', 'LSO4']
film = f'{E}/05-rendu/film'
if 'long' in want:
    stills(film, [((p['debut'] + p['fin']) / 2, f"plan {p['plan']}  t={(p['debut'] + p['fin']) / 2:.1f}") for p in P], '1920x1080', '', 'long')
if 'long' in want: thumb_board()
X = json.load(open(f'{film}/ext.json')) if os.path.exists(f'{film}/ext.json') else {}
for n in [w for w in want if w.startswith('E') and w in X]:
    x = X[n]; hd = x['hook']['d']; pts = [(t, f'{n} accroche t={t}') for t in HOOK_T + [round(hd - .3, 2)] if t < hd]; off = hd
    for a, b in x['segs']:
        for p in P:
            s, e = max(a, p['debut']), min(b, p['fin'])
            if e - s > .3: pts.append((off + (s + e) / 2 - a, f"{n} plan {p['plan']}  t={off + (s + e) / 2 - a:.1f}"))
        off += b - a
    stills(film, pts, '1080x1920', f'v=1&ext={n}', n)
for n in [w for w in want if w.startswith('LSO') and os.path.isdir(w)]:
    L = json.load(open(f'{n}/04-decoupage/decoupage.json'))
    pts = [(t, f'{n} accroche t={t}') for t in HOOK_T] + [((p['debut'] + p['fin']) / 2, f"{n} plan {p['plan']}  t={(p['debut'] + p['fin']) / 2:.1f}") for p in L['plans']]
    stills(f'{E}/{n}/05-rendu/film', pts, '1080x1920', f'v=1&ext={n}', n)
