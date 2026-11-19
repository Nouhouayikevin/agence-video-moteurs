#!/bin/sh
# Long render, safe: blocks sleep, logs temperature and battery every minute (written to disk, survives a power cut),
# runs the command with 1 render worker by default, and PAUSES the render when the battery runs low.
# Usage: sh outils/rendu.sh <command…>   e.g.  sh outils/rendu.sh sh 05-rendu/build.sh
# Log: ~/.cache/rendu-temp/<date-time>.log  — after a cut, read it before relaunching (INSTALLATION.md §7, « Long rendu »).
# Battery guard (2026-11-10): the 45 W charger cannot feed the PC while the graphics card renders, so the battery drains even
# when plugged in (PC cut 5 times). Under BAS % and discharging, the whole render is frozen (SIGSTOP); at HAUT % (or when
# the battery charges again) it resumes (SIGCONT). Frozen, the PC draws little and the charger refills the battery.
case "$1" in -h|--help) sed -n '2,/^[^#]/{/^#/s/^# \{0,1\}//p}' "$0"; exit 0;; esac   # quick help: the header above, nothing run
[ $# -gt 0 ] || { echo "usage: sh outils/rendu.sh <command…>"; exit 2; }
BAT=${BAT:-/sys/class/power_supply/BAT0}; BAS=${BAS:-25}; HAUT=${HAUT:-40}; PAS=${PAS:-30}
mkdir -p ~/.cache/rendu-temp; L=${LOG:-~/.cache/rendu-temp/$(date +%Y%m%d-%H%M).log}
( while :; do
    { date +%T; sensors 2>/dev/null | awk '/Package id/{print "cpu=" $4}'; printf 'bat=%s %s load=%s' "$(cat $BAT/capacity)" "$(cat $BAT/status)" "$(cut -d' ' -f1 /proc/loadavg)"; } | tr '\n' ' ' >> "$L"
    echo >> "$L"; sync "$L"; sleep 60
  done ) & TL=$!
echo "journal : $L"
WORKERS=${WORKERS:-1} setsid systemd-inhibit --what=idle:sleep --who=agence-video --why="rendu" --mode=block "$@" & P=$!   # own process group: one signal freezes every render worker
trap 'kill $TL 2>/dev/null; /bin/kill -CONT -- -$P 2>/dev/null' EXIT INT TERM
gele=0
while kill -0 $P 2>/dev/null; do
  c=$(cat $BAT/capacity); s=$(cat $BAT/status)
  if [ $gele = 0 ] && [ "$s" = Discharging ] && [ "$c" -lt "$BAS" ]; then /bin/kill -STOP -- -$P; gele=1; echo "$(date +%T) PAUSE : batterie $c % en décharge" | tee -a "$L"
  elif [ $gele = 1 ] && { [ "$c" -ge "$HAUT" ] || [ "$s" = Full ]; }; then /bin/kill -CONT -- -$P; gele=0; echo "$(date +%T) REPRISE : batterie $c % ($s)" | tee -a "$L"; fi   # not on « Charging » alone: at 24 % it would restart, drain and stop every 30 s
  sleep $PAS
done
wait $P
