#!/bin/bash
# BÊTA (2026-11-20, pas encore passée sur un épisode entier : la corriger à chaque défaut vu, puis retirer ce mot). La chaîne de production d'un épisode après le découpage (étapes 5 à 9), sur les machines Google, en 4 temps qui s'arrêtent là où Claude doit relire.
# Kev, 2026-11-20 : « je lance et après rien n'a été lancé » — une seule commande par temps, testée, au lieu de gestes faits à la main.
#   bash outils/chaine.sh <épisode> fixes      → images fixes au milieu de chaque plan (longue, extraits, LSO) : 07-revue-technique/planches-fixes/ — À RELIRE, corriger, refaire
#   bash outils/chaine.sh <épisode> rendu      → un seul rendu de tout (extraits et LSO d'abord, longue en dernier), sur la machine « atelier »
#   bash outils/chaine.sh <épisode> finition   → son, mux, miniature, .srt, copie téléphone de chaque vidéo, rangée dans ses dossiers (sur la même machine)
#   bash outils/chaine.sh <épisode> controles  → bandes à 0,2 s, sous-titres, physique, écoute Earshot, synchro de la longue : 07-revue-technique/ — À RELIRE, puis checklist
# Options : après le temps, la liste des vidéos (long E1 … LSO4 ; toutes par défaut). Machine : COLAB_SESSION (atelier par défaut, démarrée si absente, carte graphique T4).
# Garde-fous : refuse un ext.json plus vieux que 09-export/extraits.py ou que les voix des accroches ; tout chemin donné en absolu ; chaque travail suivi par son journal (colab_lib.sh).
case "$1" in ''|-h|--help) sed -n '2,/^[^#]/{/^#/s/^# \{0,1\}//p}' "$0"; exit 0;; esac
set -e
E=$(realpath "$1"); temps=$2; shift 2 || { echo "usage : bash outils/chaine.sh <épisode> fixes|rendu|finition|controles [vidéos…]"; exit 2; }
[ -f "$E/04-decoupage/decoupage.json" ] || { echo "ERREUR : $E n'est pas un épisode découpé (04-decoupage/decoupage.json manque)"; exit 2; }
G=$HOME/agence-video; O=$G/outils; export COLAB_SESSION=${COLAB_SESSION:-atelier}; A="bash $O/atelier_colab.sh"
N=$(basename "$E"); C=${N%%-*}
LSOS=$(cd "$E" && ls -d LSO[0-9] 2>/dev/null | tr '\n' ' '); EXTS=$(cd "$E" && python3 -c "import json;print(' '.join(json.load(open('05-rendu/film/ext.json'))))" 2>/dev/null || true)
V=${*:-long $EXTS $LSOS}
log() { echo "$(date +%H:%M) $*"; }

machine() {   # the GPU workshop on, with the episode there (sent once per session)
  colab sessions 2>&1 | grep -q "\[$COLAB_SESSION\]" || { log "machine $COLAB_SESSION : démarrage (~10 min)"; $A start | tail -2; rm -f "$E/.atelier-$COLAB_SESSION"; }
  colab sessions 2>&1 | grep -q "\[$COLAB_SESSION\]" || { echo "ERREUR : pas de machine Google (quota ? bash outils/changer_compte_colab.sh)"; exit 1; }
  [ -f "$E/.atelier-$COLAB_SESSION" ] || { log "envoi de l'épisode"; $A envoie "$E" | tail -1; touch "$E/.atelier-$COLAB_SESSION"; }
}
prepare() {   # light file work on the PC: syntax, comments, subtitles, the LSO films (no rendering)
  for f in "$E"/05-rendu/film/*.js "$E"/LSO*/05-rendu/film/*.js; do [ -f "$f" ] || continue; t=$(mktemp --suffix=.mjs); cp "$f" "$t"; node --check "$t" >/dev/null || { echo "ERREUR : syntaxe de $f"; rm "$t"; exit 1; }; rm "$t"; done
  python3 -I "$G/nan_serieux/style-pixel/code/commentaires.py" "$E"/05-rendu/film/*.js "$E"/LSO*/05-rendu/film/*.js | tail -2
  cp "$E/04-decoupage/decoupage.json" "$E/05-rendu/film/"; (cd "$E" && python3 -I 05-rendu/subs.py >/dev/null)
  for l in $LSOS; do sh "$E/$l/05-rendu/build.sh" prepa >/dev/null; done
}
extraits() {   # ext.json made THERE (it mixes the hook sounds), brought back and checked before any render
  [ -f "$E/09-export/extraits.py" ] || return 0
  log "extraits.py là-bas"; $A lance "$E" "~/lemo-opuscar/.venv/bin/python 09-export/extraits.py 2>&1 | tail -8" | tail -9
  $A rapatrie "$E/05-rendu/film/ext.json" | tail -1
  [ "$E/05-rendu/film/ext.json" -nt "$E/09-export/extraits.py" ] || { echo "ERREUR : 05-rendu/film/ext.json plus vieux que 09-export/extraits.py (pas rapatrié ?)"; exit 1; }
  for x in "$E"/03-voix/phrases/x[0-9].txt; do [ -f "$x" ] && [ "$x" -nt "$E/05-rendu/film/ext.json" ] && { echo "ERREUR : $x plus récent que ext.json"; exit 1; }; done; true
}

case $temps in
fixes)
  prepare; machine; extraits; $A envoie "$E/05-rendu/film" $(for l in $LSOS; do echo "$E/$l/05-rendu/film"; done) | grep -i erreur || true
  log "images fixes de chaque plan : $V"; $A lance "$E" "python3 ~/agence-video/outils/fixes.py $V 2>&1 | tail -15" | tail -16
  $A rapatrie "$E/07-revue-technique/planches-fixes" | tail -1
  log "À RELIRE : $E/07-revue-technique/planches-fixes/ (une planche par 6 plans). Corriger, puis refaire « fixes » sur les vidéos touchées." ;;
rendu)
  prepare; machine
  [ -z "$EXTS" ] || { [ "$E/05-rendu/film/ext.json" -nt "$E/09-export/extraits.py" ] || { echo "ERREUR : ext.json pas à jour : lancer d'abord « fixes »"; exit 1; }; }
  a=("$E/05-rendu/film"); for x in $V; do case $x in E*) a+=("$E/09-export/$x-muet.mp4@1080x1920@v=1&ext=$x");; esac; done   # short videos first
  for x in $V; do case $x in LSO*) a+=("$E/$x/05-rendu/film" "$E/$x/05-rendu/$x-rendu-muet.mp4@1080x1920@v=1&ext=$x");; esac; done
  for x in $V; do [ $x = long ] && a+=("$E/05-rendu/film" "$E/05-rendu/$C-rendu-muet.mp4"); done
  log "rendu de : $V"; sh "$O/rendu_colab.sh" "${a[@]}" | tee -a "$E/09-export/colab.log" | grep -v '^\s*$' ;;
finition)
  machine
  for x in $V; do case $x in
    E*|LSO*) log "finition $x"; bash "$O/finir_atelier.sh" "$E" $x 2>&1 | grep -E "rangé|ERREUR|MANQUE" | tail -3 ;;
    long) log "finition longue"; out=$($A lance "$E" "set -o pipefail; sh 06-son/mux.sh 2>&1 | tail -3 && sh 09-export/export.sh 2>&1 | tail -3 && mkdir -p $C && cp $N.mp4 $N.srt $C-miniature.jpg 09-export/$C-textes.md $C/ && t=06-son/$C-v1-telephone.mp4 && { [ \$(stat -c %s \$t) -lt 30000000 ] || ffmpeg -nostdin -v error -y -i \$t -c:v libx264 -preset veryfast -b:v 250k -maxrate 330k -bufsize 660k -c:a aac -b:a 80k 06-son/$C-telephone-leger.mp4; } && echo LONGUE-OK")
      echo "$out" | tail -6; echo "$out" | grep -q LONGUE-OK || { echo "ERREUR : longue pas finie là-bas"; continue; }
      $A rapatrie "$E/$C" | tail -1; $A rapatrie "$E/06-son/$C-v1-telephone.mp4" | tail -1; $A rapatrie "$E/06-son/$C-telephone-leger.mp4" 2>/dev/null | tail -1 || true ;;
  esac; done
  python3 "$O/livrer.py" "$E" | tail -3 ;;
controles)
  machine; R=07-revue-technique
  for x in $V; do case $x in
    long) m=$C/$N.mp4; d=04-decoupage/decoupage.json ;;
    E*) m=$C-Extraits/$x/$C-$x.mp4; d=- ;;
    LSO*) m=$C-LSO/$x/$C-$x.mp4; d=$x/04-decoupage/decoupage.json ;;
  esac; [ -f "$E/$m" ] || { echo "ERREUR : $m manque (finition pas faite ?)"; continue; }
  $A envoie --mp4 "$E/$m" | grep -i erreur || true
  case $x in long) f=05-rendu/film; q='';; E*) f=05-rendu/film; q="--q 'v=1&ext=$x'";; LSO*) f=$x/05-rendu/film; q="--q 'v=1&ext=$x' --size 1080x1920";; esac
  log "contrôles $x"; $A lance "$E" "mkdir -p $R/son $R/bandes; python3 ~/agence-video/outils/bandes.py $m $d $R/bandes/$x >/dev/null; cd ~/lemo-opuscar; F=~/agence-video/${E#$HOME/agence-video/}; \
    { echo '== sous-titres'; node ~/agence-video/outils/soustitres.mjs \$F/$f --croise ${q/--size 1080x1920/} 2>&1 | grep -v 'waiting\|console errors\|debug:\|note\]'; echo '== physique'; [ $x = ${x#E} ] && node ~/agence-video/outils/physique.mjs \$F/$f --step 1 $q 2>&1 | grep -v 'waiting\|console errors\|debug:\|note\]'; \
      echo '== écoute'; ffmpeg -nostdin -v error -y -i \$F/$m -vn -c:a copy /tmp/$x.m4a; ~/earshot/.venv/bin/python -m earshot timeline /tmp/$x.m4a --detail low 2>&1 | grep -E 'Loudness|NO HIT|CHECK' | head -20; } > \$F/$R/controles-$x.txt 2>&1; tail -4 \$F/$R/controles-$x.txt" | tail -5
  $A rapatrie "$E/$R/bandes/$x" "$E/$R/controles-$x.txt" | tail -1
  done
  [[ " $V " == *" long "* ]] && { log "synchro de la longue"; SANS= $A envoie "$E/04-decoupage/voix-montage.wav" | grep -i erreur || true; $A lance "$E" "~/lemo-opuscar/.venv/bin/python ~/agence-video/outils/synchro.py $C/$N.mp4 2>&1 | tail -3" | tail -4; }
  log "À RELIRE : $E/$R/bandes/ (plan par plan) et $E/$R/controles-*.txt ; puis cocher la checklist" ;;
*) echo "temps inconnu : $temps (fixes|rendu|finition|controles)"; exit 2 ;;
esac
