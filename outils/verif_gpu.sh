#!/bin/bash
# Is there a Google GPU (T4) for us right now? One command instead of typing colab tests by hand (Kev, 2026-11-20).
#   bash outils/verif_gpu.sh            → verdict: GPU OK / GPU refusée (quota ou plus de T4 libre) / compte non connecté
#   bash outils/verif_gpu.sh --changer  → first switch Google account (outils/changer_compte_colab.sh: Kev signs in and pastes the code), then the test
# The test opens a GPU machine for a few seconds and closes it. If a GPU machine of ours is already running (a render), it does not open
# a second one (Google gives one at a time): it says so and stops.
case "$1" in -h|--help) sed -n '2,/^[^#]/{/^#/s/^# \{0,1\}//p}' "$0"; exit 0;; esac
C=$HOME/.local/bin/colab; S=verifgpu$$
[ "$1" = --changer ] && { bash "$(dirname "$0")/changer_compte_colab.sh" || exit 1; }
en_cours=$(timeout 60 "$C" sessions 2>&1 | grep -i "T4\|GPU")
[ -n "$en_cours" ] && { echo "GPU OK : une machine à carte graphique tourne déjà pour nous :"; echo "$en_cours"; exit 0; }
o=$(timeout 180 "$C" new -s $S --gpu T4 2>&1); timeout 60 "$C" stop -s $S >/dev/null 2>&1
if echo "$o" | grep -q READY; then echo "GPU OK : Google donne une carte graphique T4 sur ce compte."; exit 0; fi
if echo "$o" | grep -qi "auth\|token\|credential\|login"; then echo "COMPTE NON CONNECTÉ : bash outils/verif_gpu.sh --changer"; exit 2; fi
o2=$(timeout 180 "$C" new -s ${S}c 2>&1); timeout 60 "$C" stop -s ${S}c >/dev/null 2>&1
if echo "$o2" | grep -q READY; then
  echo "GPU REFUSÉE ($(echo "$o" | grep -o 'Service Unavailable\|quota[^.]*' | head -1)) : le compte marche (machine sans carte OK), mais pas de carte graphique."
  echo "  → quota du compte épuisé ou plus de T4 libre chez Google : autre compte (bash outils/verif_gpu.sh --changer) ou réessayer plus tard."
  echo "  → ce qui n'a pas besoin de carte (son, mix, export) peut tourner sans : CPU=1."
else echo "GOOGLE INJOIGNABLE : ni carte graphique ni machine simple ($(echo "$o2" | tail -1)). Réseau du PC ? compte ?"; fi
exit 1
