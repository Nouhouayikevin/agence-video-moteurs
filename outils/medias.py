#!/usr/bin/env python3
"""medias.py : télécharge les vrais médias d'un épisode (MEMOIRE règle 42) à partir de son annuaire 01-recherche/MEDIAS.md.

usage : python3 outils/medias.py <dossier de l'épisode> [id …]      (sans id : tout ce qui manque)
        python3 outils/medias.py <épisode> --liste                    (ce qui est là, ce qui manque)

L'annuaire est un tableau Markdown dont les lignes commencent par un identifiant entre accents graves :
| `speed-fin` | https://www.youtube.com/watch?v=… | 5:09:30 | 5:17:00 | vidéo | ce qu'on voit | à quoi il sert | source/licence |
  - début/fin : le passage utile (h:mm:ss ou m:ss) ; « — » = tout le fichier (images, petites vidéos) ;
  - type : vidéo (yt-dlp, passage seul, 1080p au plus) ou image (téléchargée telle quelle).
Les fichiers vont dans ~/agence-medias/<chaîne>/<CODE>/<id>.<ext> : hors de Git, mais pas dans /tmp (effacé au redémarrage).
Un fichier déjà là n'est jamais retéléchargé. Le passage est coupé sur une image clé : la coupe exacte se fait au montage.
"""
import os, re, sys, subprocess, urllib.request

def table(ep):
    rows = []
    for line in open(os.path.join(ep, '01-recherche', 'MEDIAS.md'), encoding='utf-8'):
        m = re.match(r'^\|\s*`([a-z0-9-]+)`\s*\|(.*)$', line.strip())
        if not m: continue
        cells = [c.strip() for c in m.group(2).split('|')]
        rows.append(dict(id=m.group(1), url=cells[0], debut=cells[1], fin=cells[2], type=cells[3].lower()))
    return rows

def dest(ep):
    ep = os.path.abspath(ep).rstrip('/')
    parts = ep.split(os.sep)
    chaine = parts[parts.index('episodes') - 2] if 'episodes' in parts else 'divers'
    d = os.path.expanduser(f'~/agence-medias/{chaine}/{os.path.basename(ep)}')
    os.makedirs(d, exist_ok=True)
    return d

def existing(d, i):
    return [f for f in os.listdir(d) if f.rsplit('.', 1)[0] == i and not f.endswith(('.part', '.ytdl'))]

def get(r, d):
    if r['type'].startswith('image'):
        ext = os.path.splitext(r['url'].split('?')[0])[1] or '.jpg'
        req = urllib.request.Request(r['url'], headers={'User-Agent': 'Mozilla/5.0'})
        open(os.path.join(d, r['id'] + ext), 'wb').write(urllib.request.urlopen(req, timeout=60).read())
        return 0
    cmd = [os.path.expanduser('~/.local/bin/yt-dlp'), '--no-cookies', '-q', '--no-warnings', '--no-playlist',
           '-f', 'bv*[height<=1080]+ba/b[height<=1080]/b', '--merge-output-format', 'mp4',
           '-o', os.path.join(d, r['id'] + '.%(ext)s')]
    if r['debut'] not in ('—', '-', ''):
        cmd += ['--download-sections', f"*{r['debut']}-{r['fin']}"]
    return subprocess.call(cmd + [r['url']])

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    ep, rest = a[0], a[1:]
    d, rows = dest(ep), table(ep)
    assert rows, 'annuaire vide ou introuvable : 01-recherche/MEDIAS.md'
    if rest == ['--liste']:
        for r in rows: print(('LÀ    ' if existing(d, r['id']) else 'MANQUE'), r['id'], r['debut'], r['fin'])
        print(d); sys.exit(0)
    bad = 0
    for r in rows:
        if rest and r['id'] not in rest: continue
        if existing(d, r['id']): continue
        print('télécharge', r['id'], r['debut'], r['fin'], flush=True)
        if get(r, d) != 0 or not existing(d, r['id']): print('ÉCHEC', r['id'], flush=True); bad += 1
    print('fini :', d, '—', bad, 'échec(s)'); sys.exit(1 if bad else 0)
