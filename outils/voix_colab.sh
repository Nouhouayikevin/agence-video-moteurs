#!/bin/sh
# Voix + contrôle whisper sur Google Colab (carte graphique de Google : le PC ne calcule pas). Depuis 03-voix/ d'un épisode :
#   sh ~/agence-video/outils/voix_colab.sh [fr|en] [premier dernier]
# Envoie l'échantillon de voix (nan_serieux/voix/), les phrases sans .wav, seeds.txt ; génère (voix_colab.py), contrôle (whisper_colab.py),
# rapatrie phrases/NNN.wav et controle-colab.txt, puis libère la machine. Il faut le Colab CLI connecté (INSTALLATION.md).
case "$1" in -h|--help) cat <<'AIDE'
usage : sh ~/agence-video/outils/voix_colab.sh [fr|en] [premier dernier]      (depuis le dossier 03-voix/ d'un épisode, d'un extrait ou d'une LSO)

  Génère sur Google chaque phrases/NNN.txt qui n'a pas encore son phrases/NNN.wav (voix maison, VoxCPM2, mêmes réglages que VoiceStudio :
  graine de seeds.txt, 42 sinon ; guidance 2.8), puis contrôle chaque .wav avec whisper large-v3-turbo.
  Résultat : phrases/NNN.wav + controle-colab.txt (« NNN | langue (p = …) | entendu | attendu »), à lire comme controle.txt (VOIX.md).
  Refaire une phrase : effacer son .wav, mettre une autre graine dans seeds.txt (« 001 43 »), relancer.
  premier dernier : seulement ces numéros (ex. 1 5). Environ 4 min de préparation, puis quelques secondes par phrase.
  Google gratuit = une machine à la fois : jamais deux outils Colab en même temps.
AIDE
exit 0;; esac
set -e
L=${1:-fr}; A=${2:-1}; B=${3:-999}; O=$HOME/agence-video/outils; V=$HOME/agence-video/nan_serieux/voix; S=voix$$
REF=$V/voix-maison-reference.wav; [ "$L" = en ] && REF=$V/voix-maison-reference-en.wav
T=$(mktemp -d); python3 - "$V/VOIX.md" "$L" > "$T/ref.txt" <<'PY'
import sys, re
s = open(sys.argv[1]).read()
i = s.index('\n> ', s.index('Il dit exactement', s.index('Il dit exactement') + 1 if sys.argv[2] == 'en' else 0)) + 3   # the sample's own words (FR 1st, EN 2nd)
print(s[i:s.index('\n', i)].strip())
PY
colab new -s $S --gpu T4
trap 'colab stop -s $S >/dev/null 2>&1; rm -rf "$T"' EXIT
C=$HOME/.local/bin/colab; . $O/colab_lib.sh   # cx / cjob: no command can hang any more (2026-11-19)
cx '!mkdir -p /content/voix/phrases /content/voix/out' > /dev/null
colab upload -s $S "$REF" /content/voix/ref.wav; colab upload -s $S "$T/ref.txt" /content/voix/ref.txt
[ -f seeds.txt ] && colab upload -s $S seeds.txt /content/voix/seeds.txt
# all the sentences to make in ONE archive (2026-11-20: 400 uploads one by one took 10 min, then the folder vanished there, « Upload failed »)
for f in phrases/*.txt; do n=$(basename "$f" .txt); k=$(expr "$n" + 0 2>/dev/null || echo 0)
  { [ -s "phrases/$n.wav" ] || [ "$k" -lt "$A" ] || [ "$k" -gt "$B" ]; } && continue; echo "$f"; done > "$T/liste"
tar -czf "$T/ph.tgz" -T "$T/liste"; colab upload -s $S "$T/ph.tgz" /content/voix/ph.tgz; cx '!cd /content/voix && tar -xzf ph.tgz' > /dev/null
colab install -s $S voxcpm faster-whisper nvidia-cublas-cu12 'nvidia-cudnn-cu12==9.*' > /dev/null   # whisper needs the CUDA 12 libraries
colab upload -s $S $O/voix_colab.py /content/voix_colab.py; colab upload -s $S $O/whisper_colab.py /content/whisper_colab.py
cjob voix 'cd /content && python3 voix_colab.py'   # detached there, followed through its log (hours for a long voice: no connection to freeze)
cjob whisper 'cd /content && python3 whisper_colab.py'
cx '!cd /content/voix/out && tar -czf /content/voix/out.tgz *.wav' > /dev/null; colab download -s $S /content/voix/out.tgz "$T/out.tgz"; tar -xzf "$T/out.tgz" -C phrases   # one archive back too
colab download -s $S /content/voix/controle.txt controle-colab.txt
echo "voix_colab : fini"
