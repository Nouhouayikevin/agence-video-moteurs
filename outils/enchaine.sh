#!/bin/bash
# Enchaîne des commandes l'une après l'autre dans un journal : une ligne par étape, arrêt à la première erreur.
case "${1:-}" in ""|-h|--help) cat <<'AIDE'
enchaine.sh : évite d'écrire un script jetable à chaque fois (et de lancer deux travaux Google en même temps).
usage : nohup bash outils/enchaine.sh <journal> "titre::commande" ["titre::commande" …] &
  ex.   nohup bash outils/enchaine.sh /tmp/suite.log "LSO1 FR::bash outils/finir_lso.sh nan_serieux/fr/episodes/F001-jensen-huang LSO1" \
                                              "LSO1 EN::bash outils/finir_lso.sh nan_serieux/en/episodes/F001-jensen-huang LSO1" &
Le journal contient « HH:MM titre », puis le résultat de la commande, puis « HH:MM fin » ou « ERREUR : titre (code N) ».
Surveiller avec Monitor : tail -n 0 -f <journal> | grep --line-buffered -E "ERREUR|fin|rangé"   (-n 0 : sans rejouer les anciennes erreurs).
État : `<journal>.etat` contient une seule ligne (EN COURS (2/3) titre, BLOQUÉ … ou FINI) : `cat <journal>.etat` répond à « ça avance ? » sans lire le journal ; une notification de bureau (`notify-send`) part à la fin et à l'erreur. Une commande à la fois, dans le dossier où on lance. Pour l'arrêter : `kill $(cat <journal>.pid)` (ou TaskStop pour une tâche lancée par Claude Code). Ni `pkill -f` ni `ps | grep <nom>` : le nom est dans la ligne de commande de celui qui tue (mon `kill` s'est tué lui-même deux fois, 2026-11-22 et 23).
AIDE
exit 0;; esac
j=$1; shift; : > "$j"; echo $$ > "$j.pid"   # pour l'arrêter : kill $(cat <journal>.pid)
et() { echo "$(date +%H:%M) $1" > "$j.etat"; if [ "${2:-}" ] && command -v notify-send >/dev/null; then notify-send "enchaine.sh" "$1" 2>/dev/null; fi; true; }   # <journal>.etat : UNE ligne, l'état courant ; notification de bureau seulement à la fin ou à l'erreur
n=$#; i=0
for e in "$@"; do i=$((i+1)); t=${e%%::*}; c=${e#*::}; echo "$(date +%H:%M) $t" >> "$j"; et "EN COURS ($i/$n) $t"; bash -c "$c" >> "$j" 2>&1; r=$?; [ $r = 0 ] || { echo "ERREUR : $t (code $r)" >> "$j"; et "BLOQUÉ ($i/$n) $t : code $r, voir $j" 1; exit $r; }; done
echo "$(date +%H:%M) fin" >> "$j"; et "FINI ($n/$n)" 1
