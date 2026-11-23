#!/bin/bash
# Enchaîne des commandes l'une après l'autre dans un journal : une ligne par étape, arrêt à la première erreur.
case "${1:-}" in ""|-h|--help) cat <<'AIDE'
enchaine.sh : évite d'écrire un script jetable à chaque fois (et de lancer deux travaux Google en même temps).
usage : nohup bash outils/enchaine.sh <journal> "titre::commande" ["titre::commande" …] &
  ex.   nohup bash outils/enchaine.sh /tmp/suite.log "LSO1 FR::bash outils/finir_lso.sh nan_serieux/fr/episodes/F001-jensen-huang LSO1" \
                                              "LSO1 EN::bash outils/finir_lso.sh nan_serieux/en/episodes/F001-jensen-huang LSO1" &
Le journal contient « HH:MM titre », puis le résultat de la commande, puis « HH:MM fin » ou « ERREUR : titre (code N) ».
Surveiller avec Monitor : tail -n 0 -f <journal> | grep --line-buffered -E "ERREUR|fin|rangé"   (-n 0 : sans rejouer les anciennes erreurs).
Une commande à la fois, dans le dossier où on lance ; ne pas tuer avec pkill -f (le motif est dans la ligne de commande : tuer par numéro de processus).
AIDE
exit 0;; esac
j=$1; shift; : > "$j"
for e in "$@"; do t=${e%%::*}; c=${e#*::}; echo "$(date +%H:%M) $t" >> "$j"; bash -c "$c" >> "$j" 2>&1; r=$?; [ $r = 0 ] || { echo "ERREUR : $t (code $r)" >> "$j"; exit $r; }; done
echo "$(date +%H:%M) fin" >> "$j"
