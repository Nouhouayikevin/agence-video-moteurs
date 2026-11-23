#!/bin/bash
# Recolle l'image d'une vidéo récente sur le son d'une vidéo finie, sans réencoder (copie de flux : quelques secondes, pas de calcul lourd).
case "${1:-}" in ""|-h|--help) cat <<'AIDE'
recoller_son.sh : image de <A> + son de <B> → <sortie>, en `ffmpeg -c copy`.
usage : bash outils/recoller_son.sh <image.mp4> <avec-son.mp4> <sortie.mp4>
  ex.   bash outils/recoller_son.sh 05-rendu/F001-rendu-muet.mp4 F001/F001-jensen-huang.mp4 /tmp/F001-nouveau.mp4
Sert quand l'image change (rendu refait) mais que le son et la durée sont les mêmes : évite d'envoyer un muet de plus de 300 Mo à Google (la machine est
perdue au-delà, MEMOIRE règle 40). Refuse si les durées diffèrent de plus de 0,5 s (le son ne serait plus calé). Affiche la durée et le niveau (−14 LUFS attendu).
Ne remplace rien : copier ensuite le résultat à sa place et garder l'ancien fichier jusqu'à vérification de 3 images (début, milieu, fin).
AIDE
exit 0;; esac
set -eu
d() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
a=$(d "$1"); b=$(d "$2"); python3 -c "import sys; sys.exit(0 if abs($a-$b) <= .5 else 1)" || { echo "ERREUR : durées différentes : image $a s, son $b s"; exit 1; }
ffmpeg -v error -y -i "$1" -i "$2" -map 0:v -map 1:a -c copy -shortest "$3"
echo "durée : $(d "$3") s"; ffmpeg -hide_banner -vn -i "$3" -af ebur128=peak=true -f null - 2>&1 | grep -A12 Summary | grep -E "I:|Peak:"
