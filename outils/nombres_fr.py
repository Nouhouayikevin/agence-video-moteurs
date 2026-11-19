"""French number words and spoken form of a script line (voice step 3): 12 262 → douze-mille-deux-cent-soixante-deux, 0,2 % → zéro virgule deux pour cent."""
if __import__('sys').argv[1:2] in (['-h'], ['--help']): print(__doc__); raise SystemExit   # quick help: the docstring, nothing run
import re
U = 'zéro un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize'.split()
T = {2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante', 8: 'quatre-vingt'}
def fr(n):   # French number words (0–999 999)
    if n < 17: return U[n]
    if n < 20: return 'dix-' + U[n - 10]
    if n < 100:
        d, u = divmod(n, 10)
        if d in (7, 9): return T[d - 1] + ('-et-' if n == 71 else '-') + fr(10 + u)
        if d == 8: return 'quatre-vingts' if u == 0 else 'quatre-vingt-' + U[u]
        return T[d] + ('' if u == 0 else '-et-un' if u == 1 else '-' + U[u])
    if n < 1000:
        c, r = divmod(n, 100); h = 'cent' if c == 1 else U[c] + '-cent' + ('s' if r == 0 else '')
        return h if r == 0 else h + '-' + fr(r)
    m, r = divmod(n, 1000); h = 'mille' if m == 1 else fr(m) + '-mille'
    return h if r == 0 else h + '-' + fr(r)
assert [fr(x) for x in (80, 183, 1957, 1984, 5700, 12262, 15000)] == ['quatre-vingts', 'cent-quatre-vingt-trois', 'mille-neuf-cent-cinquante-sept',
    'mille-neuf-cent-quatre-vingt-quatre', 'cinq-mille-sept-cents', 'douze-mille-deux-cent-soixante-deux', 'quinze-mille']

def spoken(s):
    s = re.sub(r'(\d) (\d{3})\b', r'\1\2', s)                       # 12 262 → 12262
    s = s.replace('années 70', 'années soixante-dix').replace('années 80', 'années quatre-vingt').replace('années 90', 'années quatre-vingt-dix')
    s = s.replace(' %', ' pour cent').replace('Ouralmach-15000', 'Ouralmach quinze-mille')
    s = re.sub(r'(\d+),(\d+)', lambda m: fr(int(m.group(1))) + ' virgule ' + fr(int(m.group(2))), s)
    return re.sub(r'\d+', lambda m: fr(int(m.group())), s)
assert spoken('12 262 mètres, 0,2 % et 14,4 km') == 'douze-mille-deux-cent-soixante-deux mètres, zéro virgule deux pour cent et quatorze virgule quatre km'

