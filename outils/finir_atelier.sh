#!/bin/bash
# Finish ONE video already rendered (silent) on the Google workshop, then bring it back and file it: the PC computes nothing.
# usage: bash outils/finir_atelier.sh <episode folder> <LSOn|En>     e.g. bash outils/finir_atelier.sh nan_serieux/en/episodes/L006-black-friday LSO2
# LSOn: lso_son.py (score, foley, mix, mux -14 LUFS, .srt, 9:16 thumbnail, phone copy); En: extraits.sh with RENDER=0.
# The workshop must already hold the episode once (bash outils/atelier_colab.sh envoie <episode folder>): sons/, 06-son/son.py, the mix, the hook voices.
# Lessons (2026-11-19): an LSO folder that only had 05-rendu there (sent by « envoie --mp4 ») failed with no visible error: the LSO folder is now
# always sent first, its inputs are checked there, and a failure prints the end of the real trace. Paths that must expand THERE are written '~/…'
# in single quotes ($HOME expands here). An incomplete package stops everything (stale root files were once filed as finals).
case "$1" in -h|--help) sed -n '2,/^[^#]/{/^#/s/^# \{0,1\}//p}' "$0"; exit 0;; esac   # quick help: the header above, nothing run
set -e
[ -d "$1" ] && [ -n "$2" ] || { echo "usage: bash outils/finir_atelier.sh <episode folder> <LSOn|En>"; exit 2; }
set -- "$(realpath "$1")" "$2"; cd "$HOME/agence-video"
R=$(realpath --relative-to=. "$1"); x=$2; A="bash $HOME/agence-video/outils/atelier_colab.sh"
C=$(basename "$R"); C=${C%%-*}   # episode code: L006-black-friday -> L006
l=$(echo "$R" | sed -n 's#.*nan_serieux/\([a-z]*\)/episodes/.*#\1#p')
case $x in
  LSO*) muet=$R/$x/05-rendu/$x-rendu-muet.mp4; run='~/lemo-opuscar/.venv/bin/python lso_son.py '$x; tel=$x/06-son/$C-$x-telephone.mp4; dest=$C-LSO/$x
        need="lso_son.py $x/04-decoupage/decoupage.json $x/03-voix/$x-voix.wav 06-son/son.py"
        $A envoie "$R/$x" "$R"/lso_*.py | grep -i erreur && exit 1 ;;
  E*)   muet=$R/09-export/$x-muet.mp4; run='RENDER=0 sh 09-export/extraits.sh '$x; tel=09-export/$C-$x-telephone.mp4; dest=$C-Extraits/$x
        need="09-export/extraits.sh 05-rendu/film/ext.json 09-export/$x-son.wav" ;;
  *) echo "usage: bash outils/finir_atelier.sh <episode folder> <LSOn|En>"; exit 2 ;;
esac
[ -f "$muet" ] || { echo "ERREUR : $muet manque ici (rendu pas fait ?)"; exit 1; }
$A envoie --mp4 "$muet" | grep -i erreur && exit 1
f="$C-$x.mp4 $C-$x.srt $C-$x-miniature.jpg"
out=$($A lance "$R" "for n in $need; do [ -e \$n ] || echo \"MANQUE là-bas : \$n\"; done; rm -f $f; $run 2>&1 | tail -25; sh ~/agence-video/outils/controle.sh $C-$x.mp4 | tail -1; tar cf ~/agence-video/fin-$l-$x.tar $f $tel && echo PAQUET-OK")
echo "$out" | grep -q '^PAQUET-OK' || { echo "$out" | tail -30; echo "ERREUR : $l $x pas fini là-bas, rien n'est rangé"; exit 1; }
echo "$out" | tail -3
$A rapatrie fin-$l-$x.tar | tail -1
cd "$R" && rm -f $f && tar xf ~/agence-video/fin-$l-$x.tar $f $tel && rm ~/agence-video/fin-$l-$x.tar && mkdir -p $dest && mv $f $dest/
echo "$l $x : $(ffprobe -v error -show_entries format=duration -of csv=p=0 $dest/$C-$x.mp4) s, rangé dans $dest ($(date -r $dest/$C-$x.mp4 +%d-%H:%M))"
