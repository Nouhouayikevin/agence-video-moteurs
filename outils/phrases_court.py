"""Step 3 for a short (S, LSO): splits the « ## Texte » section of <episode>/02-script/script.md into one file per sentence
(<episode>/03-voix/phrases/NNN.txt) for gen.sh, numbers spelled out in French (same rules as the long videos), voice acting read from the
script's « **Jeu de la voix** » line (`[tag]` sur « début de phrase… »). Writes texte-envoye.txt. Usage: python3 outils/phrases_court.py <episode dir>"""
if __import__('sys').argv[1:2] in (['-h'], ['--help']): print(__doc__); raise SystemExit   # quick help: the docstring, nothing run
import re, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from nombres_fr import spoken
ep = sys.argv[1]
src = open(f'{ep}/02-script/script.md', encoding='utf-8').read()
body = src.split('## Texte')[1].split('\n## ')[0]
jeu = {m[1].rstrip('…. '): m[0] + ' ' for m in re.findall(r'`(\[[^\]]+\])` sur « ([^»]+) »', src)}
sent = []
for line in body.splitlines()[1:]:
    line = line.strip()
    if line and not line.startswith(('#', '(')):
        sent += [x for x in re.split(r'(?<=[.?!…»])\s+(?=[A-ZÀÂÉÈÊÎÔÙÅ0-9«])', line) if x]
os.makedirs(f'{ep}/03-voix/phrases', exist_ok=True)
open(f'{ep}/03-voix/texte-envoye.txt', 'w', encoding='utf-8').write('\n'.join(sent) + '\n')
used = set()
for i, x in enumerate(sent, 1):
    k = next((k for k in jeu if x.startswith(k)), None)
    if k: used.add(k)
    open(f'{ep}/03-voix/phrases/{i:03d}.txt', 'w', encoding='utf-8').write((jeu[k] if k else '') + spoken(x) + '\n')
assert used == set(jeu), set(jeu) - used
print(ep, len(sent), 'phrases,', len(used), 'avec jeu')
