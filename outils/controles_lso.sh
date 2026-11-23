#!/bin/bash
# Contrôles d'un LSO sans carte graphique : textes cachés par les sous-titres ou l'un sur l'autre, puis logique physique (personnes dans un meuble…).
case "${1:-}" in ""|-h|--help) cat <<'AIDE'
controles_lso.sh : soustitres.mjs --croise --sans3d puis physique.mjs --sans-image --step 1, sur la machine Google sans carte.
usage : bash outils/controles_lso.sh <dossier de l'épisode> LSO1 [LSO2 …]
Le film du LSO doit venir de lso_main.js / lso_film.py de F001 (qui gèrent window.NO3D, window.NODRAW et window.__HD) : sinon le contrôle dure plus de 20 minutes en
logiciel (leçon du 2026-11-22). Durée normale : 1 min pour les sous-titres, 10 à 12 min pour la physique d'un LSO.
Lire : « aucun texte sous les sous-titres », « aucun texte sur un autre », et la liste « plan ? … DANS / SOUS / DEUX » (à regarder sur les images : un personnage assis
sur sa chaise est normal).
AIDE
exit 0;; esac
set -u
O=$(cd "$(dirname "$0")" && pwd); A="bash $O/atelier_colab.sh"; export COLAB_SESSION=${COLAB_SESSION:-atelier}
E=$(realpath "$1"); shift; log() { echo "$(date +%H:%M) $*"; }
if ! $A lance "$E" "true" >/dev/null 2>&1; then
  timeout 60 "$HOME/.local/bin/colab" stop -s "$COLAB_SESSION" >/dev/null 2>&1; log "machine sans carte"; CPU=1 $A start | tail -1; log "envoi de l'épisode"; $A envoie "$E" | tail -1
fi
for x in "$@"; do
  log "$x sous-titres"; $A lance "$E" "node ~/agence-video/outils/soustitres.mjs $x/05-rendu/film --croise --sans3d --q 'v=1&ext=$x' 2>&1 | tail -12"
  log "$x physique";    $A lance "$E" "node ~/agence-video/outils/physique.mjs $x/05-rendu/film --sans-image --step 1 --q 'v=1&ext=$x' --size 1080x1920 2>&1 | tail -25"
done
timeout 60 "$HOME/.local/bin/colab" stop -s "$COLAB_SESSION" >/dev/null 2>&1; log "fin"
