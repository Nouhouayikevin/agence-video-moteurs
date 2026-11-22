#!/usr/bin/env python3
"""Puts an episode's deliverables in their folders (PRODUCTION.md, « Le dossier d'un épisode » and step 9 « Les livrables »),
then refuses to finish if anything is missing: every video (long, extracts, LSO) needs its thumbnail, its .srt and its texts file; every carousel (paused since 2026-11-09)
needs its platform folders and a texts file with the « Textes ALT Instagram » section (one block per slide).

    python3 outils/livrer.py <episode folder>            # arrange, then check
    python3 outils/livrer.py <episode folder> --verifier # check only

Sources: the episode root (what export.sh / extraits.sh write) and 09-export/ (texts files are edited there and win).
Files at the root are moved, files in 09-export/ are copied. Never on a finished episode (ETAT.md « terminé »):
episodes finished before 2026-11-08 keep their old layout (Kev's rule).
"""
if __import__('sys').argv[1:2] in (['-h'], ['--help']): print(__doc__); raise SystemExit   # quick help: the docstring, nothing run
import re, shutil, sys
from pathlib import Path

PLATFORMS = ('tiktok', 'instagram', 'youtube')


def place(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    (shutil.copy2 if src.parent.name == '09-export' or '09-export' in src.parts else shutil.move)(str(src), str(dst))


def find(ep, name):
    """The texts file edited in 09-export/ wins over a copy elsewhere."""
    for d in (ep / '09-export', ep / '09-export' / 'carrousel', ep):
        if (d / name).exists():
            return d / name
    return None


def arrange(ep, code):
    long_dir, ext_dir, lso_dir = ep / code, ep / f'{code}-Extraits', ep / f'{code}-LSO'
    for f in list(ep.glob(f'{code}-*')):
        if f.is_dir() or re.match(rf'{code}-C\d+-textes\.md$', f.name):
            continue
        m = re.match(rf'{code}-(E\d+|LSO\d+)(-miniature\.jpg|\.mp4|\.srt|-textes\.md)$', f.name)
        place(f, (lso_dir if m.group(1).startswith('LSO') else ext_dir) / m.group(1) / f.name) if m else place(f, long_dir / f.name)
    for name in [p.name for p in (ep / '09-export').glob(f'{code}*-textes.md')] if (ep / '09-export').exists() else []:
        if re.match(rf'{code}-C\d+-textes\.md$', name):
            continue
        m = re.match(rf'{code}-(E\d+|LSO\d+)-textes\.md$', name)
        place(find(ep, name), (((lso_dir if m.group(1).startswith('LSO') else ext_dir) / m.group(1)) if m else long_dir) / name)
    old = ep / f'{code}-carrousel'   # carrousel.sh output: <code>-C1-tiktok-01.jpg, <code>-C1-instagram-01.jpg
    if old.is_dir():
        for f in sorted(old.glob('*.jpg')):
            m = re.match(rf'{code}-(C\d+)-(tiktok|instagram)-(\d+)\.jpg$', f.name)
            if not m:
                continue
            c, plat, n = m.groups()
            dest = carousel_dir(ep, code, c)
            if plat == 'instagram':   # YouTube posts reuse the Instagram images (PRODUCTION.md, carrousels)
                (dest / 'youtube').mkdir(parents=True, exist_ok=True); shutil.copy2(f, dest / 'youtube' / f'{int(n):02d}.jpg')
            place(f, dest / plat / f'{int(n):02d}.jpg')
        if not any(old.iterdir()):
            old.rmdir()
    for c in carousels(ep, code):
        t = find(ep, f'{code}-{c}-textes.md') or find(ep, f'{c}-textes.md')
        if t:
            place(t, carousel_dir(ep, code, c) / f'{c}-textes.md')


def carousel_dir(ep, code, c):
    return ep / f'{code}-Carrousel' if code.startswith('S') else ep / f'{code}-Carrousels' / c


def carousels(ep, code):
    if code.startswith('S'):
        return ['C1'] if (ep / f'{code}-Carrousel').exists() else []
    root = ep / f'{code}-Carrousels'
    return sorted(p.name for p in root.iterdir() if p.is_dir()) if root.exists() else []


def check(ep, code):
    missing = []
    def need(p, what):
        if not p.exists():
            missing.append(f'{what} : {p.relative_to(ep)}')
    ext = sorted((ep / f'{code}-Extraits').glob('E*')) if code[0] in 'LF' else []
    lso = sorted((ep / f'{code}-LSO').glob('LSO*')) if code[0] in 'LF' else []
    videos = [ep / code] + ext + lso
    for d in videos:
        stem = code if d.name == code else f'{code}-{d.name}'
        mp4 = [p for p in d.glob('*.mp4')] if d.exists() else []
        if not mp4:
            missing.append(f'vidéo .mp4 : {d.relative_to(ep)}/')
        else:
            need(mp4[0].with_suffix('.srt'), 'sous-titres .srt')
        need(d / f'{stem}-miniature.jpg', 'miniature')
        need(d / f'{stem}-textes.md', 'fichier de textes')
    n_ext, n_lso = (8, 2) if code.startswith('F') else (6, 4) if code.startswith('L') and int(code[1:]) >= 4 else (2, 0)   # film: plan 8-2-2 (Kev, 2026-11-20)   # plan 6-4-4 from L004 (Kev, 2026-11-10); L001-L003 keep their 2 extracts, no LSO
    if code[0] in 'LF' and len(ext) < n_ext:
        missing.append(f'extraits : {len(ext)} trouvés, {n_ext} attendus')
    if code[0] in 'LF' and len(lso) < n_lso:
        missing.append(f'LSO (shorts originaux de la longue) : {len(lso)} trouvés, {n_lso} attendus')
    for c in carousels(ep, code):
        d = carousel_dir(ep, code, c)
        counts = {p: len(list((d / p).glob('*.jpg'))) for p in PLATFORMS}
        for p, n in counts.items():
            if not n:
                missing.append(f'slides {p} : {(d / p).relative_to(ep)}')
        t = d / f'{c}-textes.md'
        need(t, 'textes du carrousel')
        if t.exists():
            s = t.read_text(encoding='utf-8')
            i = s.find('Textes ALT Instagram')
            blocks = s[i:].count('```') // 2 if i >= 0 else 0
            if blocks < counts['instagram']:
                missing.append(f'{c} : section « Textes ALT Instagram » avec {blocks} blocs pour {counts["instagram"]} slides')
    return missing


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1:
        sys.exit(__doc__)
    ep = Path(args[0]).resolve()
    code = ep.name.split('-')[0]
    if not re.match(r'^[LFS]\d{3}$', code):
        sys.exit(f'{ep.name} : le dossier doit commencer par L001, F001 ou S001')
    etat = ep / 'ETAT.md'
    if '--verifier' not in sys.argv:
        if etat.exists() and re.search(r'Étape en cours\s*:\s*terminé', etat.read_text(encoding='utf-8')):
            sys.exit(f'{ep.name} est terminé : on ne le range pas (règle de Kev du 2026-11-08).')
        arrange(ep, code)
    missing = check(ep, code)
    if missing:
        print('MANQUE :'); [print('  -', m) for m in missing]; sys.exit(1)
    print(f'{ep.name} : tous les livrables sont là.')


if __name__ == '__main__':
    main()
