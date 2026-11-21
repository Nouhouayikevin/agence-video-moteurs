#!/bin/bash
# A copy of a finished video small enough for Kev's phone (< 30 MB: the app refuses bigger files), made on a Google machine without GPU
# (the PC computes nothing). 480p, ~160 kb/s video, 48 kb/s mono sound.
#   bash outils/copie_telephone.sh <video.mp4> [sortie.mp4]     (sortie: <video>-leger.mp4 by default)
case "$1" in ''|-h|--help) sed -n '2,/^[^#]/{/^#/s/^# \{0,1\}//p}' "$0"; exit 0;; esac
set -u
in=$(realpath "$1"); out=$(realpath -m "${2:-${1%.mp4}-leger.mp4}"); C=$HOME/.local/bin/colab; S=leger$$; T=$(mktemp -d)
. "$HOME/agence-video/outils/colab_lib.sh"
timeout 180 "$C" new -s $S 2>&1 | grep -q READY || { echo "ERREUR : pas de machine Google"; exit 1; }
trap 'timeout 60 "$C" stop -s $S >/dev/null 2>&1; rm -rf "$T"' EXIT
split -b 40M "$in" $T/p.   # uploads over ~40 MB are refused (400)
for p in $T/p.*; do timeout 600 "$C" upload -s $S $p /content/$(basename $p) >/dev/null || { echo "ERREUR envoi"; exit 1; }; done
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")   # filename never put inside code
vb=$(python3 -c "print(max(60, min(160, int(28e6*8/$d/1000) - 52)))")   # bitrate so the file stays under ~28 MB whatever the length
cjob leger "cd /content && cat p.* > in.mp4 && ffmpeg -nostdin -v error -y -i in.mp4 -vf scale=-2:480:flags=neighbor -c:v libx264 -preset veryfast -b:v ${vb}k -maxrate $((vb * 3 / 2))k -bufsize $((vb * 3))k -c:a aac -b:a 48k -ac 1 out.mp4 && echo LEGER-OK" | grep -q LEGER-OK || { echo "ERREUR : encodage"; exit 1; }
timeout 600 "$C" download -s $S /content/out.mp4 "$out" >/dev/null || { echo "ERREUR retour"; exit 1; }
echo "copie téléphone : $out ($(du -h "$out" | cut -f1))"
