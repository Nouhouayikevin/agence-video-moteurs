#!/bin/bash
# Attend que Google donne une carte graphique (verif_gpu.sh toutes les N minutes), puis rend la main (code 0).
# Abandonne après H heures (code 1), ou si le compte n'est plus connecté (code 2). À mettre en tête d'une chaîne enchaine.sh.
case "$1" in -h|--help)
  echo "usage : bash outils/attendre_gpu.sh [heures=6] [minutes=10]"
  echo "  Vérifie toutes les <minutes> si Google donne une carte graphique (outils/verif_gpu.sh) ; rend la main dès que c'est le cas."
  echo "  Code 0 = carte donnée ; 1 = abandon après <heures> ; 2 = compte non connecté (Kev : outils/changer_compte_colab.sh)."
  echo "  ex. nohup bash outils/enchaine.sh /tmp/v.log \"carte::bash outils/attendre_gpu.sh 6 10\" \"voix::sh outils/voix_colab.sh fr 1 100\" &"
  exit 0;; esac
H=${1:-6}; M=${2:-10}; D=$(dirname "$0"); fin=$(( $(date +%s) + H*3600 ))
while :; do
  r=$(bash "$D/verif_gpu.sh" 2>&1); c=$?
  echo "$(date +%H:%M) $(echo "$r" | head -1)"
  [ $c -eq 0 ] && echo "$r" | grep -q "GPU OK" && exit 0
  echo "$r" | grep -q "COMPTE NON CONNECTÉ" && exit 2
  [ "$(date +%s)" -ge "$fin" ] && { echo "abandon : pas de carte graphique en ${H} h"; exit 1; }
  sleep $(( M*60 ))
done
