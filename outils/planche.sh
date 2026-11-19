#!/bin/sh
# Review sheet: one frame every N seconds (default 1.5, PRODUCTION.md step 7), 8 per row. Usage: sh outils/planche.sh <video.mp4> <sheet.jpg> [N] [width per frame]
case "$1" in -h|--help) sed -n '2,/^[^#]/{/^#/s/^# \{0,1\}//p}' "$0"; exit 0;; esac   # quick help: the header above, nothing run
[ $# -ge 2 ] || { echo "usage: sh outils/planche.sh <video.mp4> <planche.jpg> [pas=1.5] [largeur=240]"; exit 2; }
N=${3:-1.5}; W=${4:-240}; T=$(mktemp -d)
ffmpeg -nostdin -v error -i "$1" -vf "fps=1/$N,scale=$W:-1" "$T/%04d.jpg"
n=$(ls "$T" | wc -l); ffmpeg -nostdin -v error -y -pattern_type glob -i "$T/*.jpg" -vf "tile=8x$(( (n + 7) / 8 ))" -frames:v 1 "$2"
rm -rf "$T"; echo "$2 : $n images"
