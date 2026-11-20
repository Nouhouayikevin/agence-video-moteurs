#!/bin/bash
# Render a long film in pieces on Google (2026-11-20: the free machines are taken back after ~12 min, a 22-min film needs more than an hour).
#   bash outils/rendu_morceaux.sh <film> <sortie.mp4> [LxH] [requête]     (STEP=90 : secondes de film par morceau)
# Each piece = video.mjs --from/--to on the machine « morceaux » (made again when Google takes it back); a piece already on the PC is kept,
# so running it again resumes where it stopped. At the end the pieces are joined without re-encoding (ffmpeg concat, light).
set -u
film=$(realpath "$1"); out=$(realpath -m "$2"); sz=${3:-1920x1080}; q=${4:-}; STEP=${STEP:-90}
C=$HOME/.local/bin/colab; O=$HOME/agence-video/outils; export COLAB_SESSION=morceaux
DUR=$(python3 -c "import json,sys;d=json.load(open('$film/decoupage.json'));print(d['duree_finale'])")
[ -z "$q" ] || DUR=$(python3 -c "import json,urllib.parse as u;q=dict(u.parse_qsl('$q'));print(json.load(open('$film/ext.json'))[q['ext']]['dur'] if 'ext' in q else $DUR)")
P=$(dirname "$out")/.morceaux-$(basename "$out" .mp4); mkdir -p "$P"
machine() { "$C" sessions 2>&1 | grep -q "\[$COLAB_SESSION\]" && return 0
  o=$("$C" new -s $COLAB_SESSION --gpu T4 2>&1); echo "$o" | grep -q READY || { echo "ERREUR : Google refuse la machine : $(echo "$o" | tail -1)"; return 1; }; }
n=$(python3 -c "import math;print(math.ceil($DUR/$STEP))"); echo "$(date +%H:%M) $(basename "$out") : $DUR s en $n morceaux de $STEP s"
for i in $(seq 0 $((n - 1))); do
  p=$P/$(printf %03d $i).mp4; [ -s "$p" ] && continue
  a=$((i * STEP)); b=$(python3 -c "print(min($DUR, $(( (i + 1) * STEP ))))")
  for essai in 1 2 3 4 5; do
    machine || { sleep 60; continue; }
    if EXTRA="--from $a --to $b" sh "$O/rendu_colab.sh" "$film" "$p@$sz${q:+@$q}" > "$P/journal-$i.txt" 2>&1 && [ -s "$p" ]; then echo "$(date +%H:%M) morceau $((i + 1))/$n ok"; break; fi
    echo "$(date +%H:%M) morceau $((i + 1))/$n raté (essai $essai) : $(grep -m1 ERREUR "$P/journal-$i.txt" | cut -c1-120)"; rm -f "$p"
    "$C" stop -s $COLAB_SESSION >/dev/null 2>&1   # a lost machine: start a new one
  done
  [ -s "$p" ] || { echo "ERREUR : morceau $((i + 1)) impossible après 5 essais"; exit 1; }
done
"$C" stop -s $COLAB_SESSION >/dev/null 2>&1
(cd "$P" && ls [0-9][0-9][0-9].mp4 | sed "s/.*/file '&'/" > liste.txt && ffmpeg -v error -y -f concat -safe 0 -i liste.txt -c copy "$out") || { echo "ERREUR : collage"; exit 1; }
echo "$(date +%H:%M) fini : $out ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out") s)"
