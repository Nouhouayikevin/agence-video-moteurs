#!/bin/bash
# La miniature 16:9 d'un film (scène thumb de hd2d.js + thumb() de main.js), rendue sur une machine Google sans carte.
case "${1:-}" in ""|-h|--help) cat <<'AIDE'
miniature_film.sh : refait la miniature du film.
usage : bash outils/miniature_film.sh <dossier de l'épisode>        ex. nan_serieux/fr/episodes/F001-jensen-huang
Envoie seulement 05-rendu/film (petit), rend `?thumb=1` en 1920×1080 avec image.mjs (~1 min de logiciel), ramène 09-export/<CODE>-miniature.jpg
et le copie dans <CODE>/ si ce dossier existe. Regarder le résultat à l'œil avant tout (MEMOIRE règle 39, GUIDE-MAISON §1 « Le test de l'inconnu »).
AIDE
exit 0;; esac
set -u
O=$(cd "$(dirname "$0")" && pwd); A="bash $O/atelier_colab.sh"; export COLAB_SESSION=${COLAB_SESSION:-atelier}
E=$(realpath "$1"); C=$(basename "$E" | sed -E 's/^([LFS][0-9]{3})-.*/\1/'); OUT=$E/09-export/$C-miniature.jpg; log() { echo "$(date +%H:%M) $*"; }
timeout 60 "$HOME/.local/bin/colab" stop -s "$COLAB_SESSION" >/dev/null 2>&1; log "machine sans carte"; CPU=1 $A start | tail -1
$A envoie "$E/05-rendu/film" | tail -1; log "image"
$A lance "$E" "node ~/agence-video/outils/image.mjs 05-rendu/film 0 09-export/$C-miniature.jpg --q 'thumb=1' --size 1920x1080 2>&1 | tail -3"
touch "$OUT"; $A rapatrie "$OUT" | tail -1; [ -d "$E/$C" ] && cp "$OUT" "$E/$C/$C-miniature.jpg"
timeout 60 "$HOME/.local/bin/colab" stop -s "$COLAB_SESSION" >/dev/null 2>&1; log "fin : $OUT"
