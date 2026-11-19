#!/bin/sh
# Checks finished videos: duration, loudness (target −14 LUFS), frozen frames over 2.5 s, black or white screens, size of the phone copy.
# Usage: sh outils/controle.sh <video.mp4>…   (PRODUCTION.md steps 7 and 9)
case "$1" in -h|--help) sed -n '2,/^[^#]/{/^#/s/^# \{0,1\}//p}' "$0"; exit 0;; esac   # quick help: the header above, nothing run
[ $# -gt 0 ] || { echo "usage: sh outils/controle.sh <video.mp4>…"; exit 2; }
for f in "$@"; do
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  i=$(ffmpeg -nostdin -hide_banner -i "$f" -af ebur128 -f null - 2>&1 | awk '/^ *I:/{v=$2} END{print v}')
  z=$(ffmpeg -nostdin -hide_banner -i "$f" -an -vf "freezedetect=n=0.001:d=2.5,blackdetect=d=0.5" -f null - 2>&1 | grep -oE "freeze_start: [0-9.]+|black_start:[0-9.]+" | tr '\n' ' ')
  # white screens (a lost WebGL context renders blank white, subtitles still on top: L003): the negated picture is black
  b=$(ffmpeg -nostdin -hide_banner -i "$f" -an -vf "negate,blackdetect=d=0.2:pic_th=0.9" -f null - 2>&1 | grep -oE "black_start:[0-9.]+" | sed 's/black/blanc/' | tr '\n' ' ')
  z="$z$b"
  printf '%s  %.1f s  %s LUFS  %s Mo  %s\n' "$f" "$d" "$i" "$(( $(stat -c %s "$f") / 1048576 ))" "${z:-aucune image figée, aucun écran noir ou blanc}"
done
