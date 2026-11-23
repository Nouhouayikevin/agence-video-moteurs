#!/bin/bash
# Finit un ou plusieurs LSO déjà rendus (son, mux −14 LUFS, miniature, .srt, copie téléphone, contrôle, rangement) sur une machine Google sans carte.
case "${1:-}" in ""|-h|--help) cat <<'AIDE'
finir_lso.sh : la finition de plusieurs LSO en une commande (machine, envoi de l'épisode, finir_atelier.sh de chacun, livrer.py).
usage : bash outils/finir_lso.sh <dossier de l'épisode> LSO1 [LSO2 …]
  ex.   bash outils/finir_lso.sh nan_serieux/fr/episodes/F001-jensen-huang LSO1 LSO2
Avant : LSOn/05-rendu/LSOn-rendu-muet.mp4 rendu (outils/rendu_colab.sh).
La machine est vérifiée sur la machine elle-même (« a-t-elle cet épisode ? »), jamais sur un fichier-marqueur (MEMOIRE règle 40) ; sinon elle est refaite
et l'épisode envoyé (~10 min). Une ligne par étape : « HH:MM LSO1 », « rangé dans … », « fin ». Stoppe à la première erreur (« ERREUR : … »).
Lancer en arrière-plan avec outils/enchaine.sh ou nohup, et surveiller le journal avec Monitor (tail -n 0 -f).
AIDE
exit 0;; esac
set -u
O=$(cd "$(dirname "$0")" && pwd); A="bash $O/atelier_colab.sh"; export COLAB_SESSION=${COLAB_SESSION:-atelier}
E=$(realpath "$1"); shift; log() { echo "$(date +%H:%M) $*"; }
[ $# -gt 0 ] || { echo "ERREUR : donner au moins un LSO (LSO1, LSO2…)"; exit 2; }
for x in "$@"; do [[ $x =~ ^LSO[0-9]+$ ]] || { echo "ERREUR : « $x » n'est pas un nom de LSO (LSO1, LSO2…)"; exit 2; }; done   # before any Google machine is started
if ! $A lance "$E" "true" >/dev/null 2>&1; then
  timeout 60 "$HOME/.local/bin/colab" stop -s "$COLAB_SESSION" >/dev/null 2>&1; log "machine sans carte"; CPU=1 $A start | tail -1
  log "envoi de l'épisode"; $A envoie "$E" | tail -1
fi
for x in "$@"; do log "$x"; bash "$O/finir_atelier.sh" "$E" "$x" 2>&1 | tail -6 || exit 1; done
python3 "$O/livrer.py" "$E" | tail -4
timeout 60 "$HOME/.local/bin/colab" stop -s "$COLAB_SESSION" >/dev/null 2>&1
log "fin"
