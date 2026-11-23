#!/bin/bash
# The agency's workshop on Google Colab: the PC is only a remote control (Kev, 2026-11-19). One machine (T4) holds Lemo, its instruments,
# Earshot, whisper and the agency files at the same paths as on the PC (/root = ~), so the episode scripts run there unchanged.
case "$1" in ''|-h|--help) cat <<'AIDE'
usage : bash ~/agence-video/outils/atelier_colab.sh <commande> …     (le PC ne calcule rien : tout tourne sur la machine Google « atelier »)

  start                       (CPU=1 : machine sans carte graphique, à côté d'un rendu) allume la machine et installe tout (Lemo + instruments, Earshot + modèles, whisper, ffmpeg) : ~10 min, une fois par séance
  envoie <chemin>…            envoie des dossiers ou fichiers de ~/agence-video (même chemin là-bas) ; sans les .mp4, sauf avec --mp4 en premier ;
                              SANS='bruitages*.wav musique.wav' : sans ces fichiers (ceux que l'atelier refait)
  lance <dossier> "<cmd>"     lance une commande là-bas, depuis ce dossier de l'agence (chemins ~/… identiques au PC) ; journal affiché à la fin
  whisper <dossier 03-voix>…  contrôle whisper de chaque phrase (→ <dossier>/controle-colab.txt là-bas ; le rapatrier ensuite)
  moteurs                     met à jour là-bas les outils, bruitages et styles (dépôt public, après un commit poussé)
  rapatrie <chemin>…          ramène des dossiers ou fichiers sur le PC (même chemin)
  etat                        la machine est-elle allumée ? que contient-elle ?
  stop                        éteint la machine (à la fin de la séance)

exemple (son, miniatures et copies téléphone des extraits L006, sans rien calculer sur le PC) :
  A=bash ~/agence-video/outils/atelier_colab.sh ; E=nan_serieux/fr/episodes/L006-black-friday
  $A start ; $A envoie $E      (les outils, bruitages et styles sont déjà là-bas : start les télécharge de GitHub)
  $A envoie --mp4 $E/09-export/E1-muet.mp4      (inutile si rendu_colab.sh a rendu sur l'atelier : COLAB_SESSION=atelier)
  $A lance $E "RENDER=0 sh 09-export/extraits.sh" ; $A rapatrie $E/L006-Extraits

Rendre sur l'atelier : COLAB_SESSION=atelier sh outils/rendu_colab.sh … (la vidéo reste aussi là-bas, prête pour le son).
Google gratuit = une seule machine à carte graphique : l'atelier sert à tout, plusieurs travaux peuvent y tourner en même temps.
Toujours lire le journal affiché avant de dire « fini » (PRODUCTION.md, « Le calcul lourd »).
AIDE
exit 0;; esac
S=${COLAB_SESSION:-atelier}; C=$HOME/.local/bin/colab; R=$HOME/agence-video; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
. "$R/outils/colab_lib.sh"   # cx (short command, time limit + 3 tries) and cjob (long job detached there, followed through its log): nothing can hang any more
x() { CX_T=${CX_T:-900} cx "$1"; }   # tar / untar of a whole episode can take minutes: 15 min limit
rel() { local p; [ -e "$1" ] || { echo "ERREUR : $1 n'existe pas ici (chemin relatif depuis le mauvais dossier ? donner un chemin absolu)" >&2; exit 2; }; p=$(realpath -m "$1"); case "$p" in "$R"|"$R"/*) echo "${p#$HOME/}";; *) echo "ERREUR : $1 n'est pas dans ~/agence-video" >&2; exit 2;; esac; }
cmd=$1; shift
case "$cmd" in
start)
  # CPU=1: a machine without graphics card (sound, whisper is slower, NO 3D: a 3D frame there takes over 30 s, the render stops, F002 2026-11-23) — it can run beside the GPU machine that renders
  # T4 : LEMO_ANGLE=vulkan by default in « lance » (Chrome's default ANGLE loses the WebGL context there : black stills, F002 2026-11-23)
  "$C" sessions 2>&1 | grep -q "\[$S\]" || { if [ "$CPU" = 1 ]; then o=$("$C" new -s $S 2>&1); else o=$("$C" new -s $S --gpu T4 2>&1); fi; echo "$o" | tail -1
    echo "$o" | grep -q READY || { echo "ERREUR : Google refuse la machine ($(echo "$o" | grep -o 'Service Unavailable' | head -1)) : quota épuisé ? → bash outils/changer_compte_colab.sh, ou CPU=1 pour une machine sans carte"; exit 1; }; }   # stop at once (2026-11-20: it went on into 3 useless tries)
  SETUP=$(ls -d ~/.claude/plugins/cache/*/lemo-opuscar/*/skills/lemo-opuscar/scripts/setup.sh | head -1)
  "$C" upload -s $S "$SETUP" /content/setup.sh >/dev/null
  cat > "$T/prepa.sh" <<'PREPA'
set -e; cd /root
apt-get -qq update >/dev/null 2>&1; apt-get -qq install -y ffmpeg sox libvulkan1 mesa-vulkan-drivers >/dev/null 2>&1 || { echo 'apt raté'; exit 1; }
mkdir -p /usr/share/vulkan/icd.d /usr/share/glvnd/egl_vendor.d   # NVIDIA driver is there, its Vulkan and EGL entries are not (INSTALLATION §3 ter)
echo '{"file_format_version":"1.0.0","ICD":{"library_path":"/usr/lib64-nvidia/libGLX_nvidia.so.0","api_version":"1.3.0"}}' > /usr/share/vulkan/icd.d/nvidia_icd.json
echo '{"file_format_version":"1.0.0","ICD":{"library_path":"/usr/lib64-nvidia/libEGL_nvidia.so.0"}}' > /usr/share/glvnd/egl_vendor.d/10_nvidia.json
echo "== Lemo"; LEMO_OPUSCAR_HOME=/root/lemo-opuscar sh /content/setup.sh | tail -1; LEMO_OPUSCAR_HOME=/root/lemo-opuscar sh /content/setup.sh deps 2>&1 | tail -2
(cd /root/lemo-opuscar && sh tools/fetch.sh instruments all 2>&1 | tail -1)
(cd /root/lemo-opuscar && npx playwright-core install-deps chromium >/dev/null 2>&1) || { echo 'Chrome : bibliothèques système ratées'; exit 1; }   # setup.sh deps does not add them (libatk missing: no still, no thumbnail)
pip -q install -U yt-dlp 2>&1 | tail -1; mkdir -p /root/.local/bin && ln -sf "$(command -v yt-dlp)" /root/.local/bin/yt-dlp   # medias.py calls ~/.local/bin/yt-dlp (F002, 2026-11-23 : « No such file or directory: '/root/.local/bin/yt-dlp' »)
echo "== whisper"; pip -q install faster-whisper nvidia-cublas-cu12 'nvidia-cudnn-cu12==9.*' 2>&1 | tail -1
echo "== Earshot"; [ -d /root/earshot ] || git clone -q https://github.com/Leonxlnx/earshot /root/earshot
cd /root/earshot && python3 -m pip install -q -e ".[mcp,llm,dev]" 2>&1 | tail -1   # Colab's python (no venv module there): ~/earshot/.venv/bin/python points to it
rm -rf .venv; mkdir -p .venv/bin && ln -sf "$(command -v python3)" .venv/bin/python   # no pyvenv.cfg: a half-made venv hides the system packages
.venv/bin/python -m earshot doctor --fetch 2>&1 | tail -1; .venv/bin/python -c 'import earshot' || { echo 'Earshot raté'; exit 1; }
/root/lemo-opuscar/.venv/bin/python -c 'import numpy, scipy, soundfile' || { echo 'Lemo Python raté'; exit 1; }
mkdir -p /root/.claude/skills; ln -sfn /root/earshot/skills/real-sound /root/.claude/skills/real-sound; ln -sfn /root/earshot/skills/earshot /root/.claude/skills/earshot
mkdir -p /root/agence-video/nan_serieux; cd /root/agence-video   # the public engines straight from GitHub (seconds), at the same paths as on the PC (2026-11-20)
rm -rf moteurs outils nan_serieux/sons nan_serieux/style-pixel nan_serieux/style-hd2d; git clone -q --depth 1 https://github.com/Nouhouayikevin/agence-video-moteurs moteurs || { echo 'moteurs : clone raté'; exit 1; }
ln -s moteurs/outils outils; for d in sons style-pixel style-hd2d; do ln -s ../moteurs/$d nan_serieux/$d; done
echo "atelier ok"
PREPA
  "$C" upload -s $S "$T/prepa.sh" /content/prepa.sh >/dev/null
  p=$(cjob prepa 'bash /content/prepa.sh 2>&1 | tail -15'); echo "$p"; echo "$p" | grep -q 'atelier ok' || { echo "ERREUR : préparation de l'atelier"; exit 1; } ;;
envoie)
  ex=(--exclude='*.mp4' --exclude='.*_segs-*' --exclude='__pycache__'); [ "$1" = --mp4 ] && { ex=(--exclude='__pycache__'); shift; }
  for g in ${SANS-bruitages*.wav musique.wav voix-montage.wav *.mp3 [0-9][0-9][0-9].wav}; do ex+=(--exclude="$g"); done   # by default: what the workshop rebuilds (stems, the editing voice, phone copies, the voice sentences); SANS= sends everything   # SANS='motif …' : files the workshop rebuilds itself (mixes, stems), not worth the upload
  for a in "$@"; do r=$(rel "$a") || exit 2
    tar czf "$T/e.tgz" "${ex[@]}" -C "$HOME" "$r"; echo "→ $r ($(du -h "$T/e.tgz" | cut -f1))"
    [ "$(stat -c %s "$T/e.tgz")" -lt 314572800 ] || [ "$GROS" = 1 ] || { echo "ERREUR : paquet de plus de 300 Mo (une session a été perdue sur 515 Mo) : exclure avec SANS=…, ou GROS=1 si c'est voulu"; exit 1; }
    rm -f "$T"/p$$.*; split -b 40M "$T/e.tgz" "$T/p$$."   # one upload of 650 MB failed (2026-11-19): pieces of 40 MB (90 MB: « 400 Bad Request »), glued back there
        for f in "$T"/p$$.*; do o=$("$C" upload -s $S "$f" /content/$(basename "$f") 2>&1) || { echo "ERREUR : envoi de $r : $o"; exit 1; }; done
    o=$(x "!cat /content/p$$.* | tar xz -C /root && rm /content/p$$.* && echo envoi-ok"); echo "$o" | grep -q envoi-ok || { echo "ERREUR : déballage de $r : $o"; exit 1; }   # p$$: one name per call, two uploads at once must not mix pieces
  done ;;
lance)
  d=$(rel "$1") || exit 2; shift; c=${1//$HOME\//\/root\/};   # a PC path ($HOME/…) becomes the same path there (/root/…) L=/root/$d/atelier.log   # LD_LIBRARY_PATH: the T4 driver's Vulkan, for the stills (thumbnails) of the episode scripts
  echo "== là-bas, dans ~/$d : $c"
  cjob "lance$$" "export LD_LIBRARY_PATH=/usr/lib64-nvidia:\$LD_LIBRARY_PATH; if [ -e /dev/nvidia0 ]; then export LEMO_ANGLE=\${LEMO_ANGLE:-vulkan}; else export LEMO_ANGLE=swiftshader LEMO_SANS_CARTE=1; fi; cd /root/$d && ( $c )" ;;   # detached there: the PC never waits on a connection (2026-11-19)
whisper)
  a=(); for d in "$@"; do a+=("/root/$(rel "$d")"); done
  "$C" upload -s $S "$R/outils/whisper_colab.py" /content/whisper_colab.py >/dev/null
  cjob "whisper$$" "python3 /content/whisper_colab.py ${a[*]} 2>&1 | tail -8" ;;
rapatrie)
  for a in "$@"; do r=$(rel "$a") || exit 2
    o=$(x "!tar czf - -C /root $r | split -b 40M - /content/q$$. && ls /content | grep '^q$$\\.'") ; echo "$o" | grep -q "^q$$\." || { echo "ERREUR : préparation de $r : $o"; exit 1; }
    for q in $(echo "$o" | grep "^q$$\."); do ok=0; for k in 1 2 3; do "$C" download -s $S /content/$q "$T/$q" >/dev/null && { ok=1; break; }; sleep 5; done; [ $ok = 1 ] || { echo "ERREUR : rapatriement de $r ($q), 3 essais"; exit 1; }; done   # a 40 MB piece can fail once (2026-11-19): 3 tries
    bad=$(cat "$T"/q$$.* | tar tz | grep -v "^$r\(/\|$\)" | head -1); [ -z "$bad" ] || { echo "ERREUR : le paquet de $r contient « $bad » (hors du dossier demandé), rien n'est déballé"; exit 1; }
    cat "$T"/q$$.* | tar xz -C "$HOME" && x "!rm -f /content/q$$.*" >/dev/null && echo "← $r" || { echo "ERREUR : déballage de $r"; exit 1; }
  done ;;
moteurs) x "!cd /root/agence-video/moteurs && git pull -q --ff-only && git log --oneline -1" ;;   # after a change to the tools pushed to GitHub: the machine takes it in seconds
etat) "$C" sessions 2>&1 | tail -3; x '!ls /root /root/agence-video 2>&1 | head; nvidia-smi --query-gpu=name,utilization.gpu,memory.used --format=csv' ;;
stop) "$C" stop -s $S ;;
*) echo "commande inconnue : $cmd (voir --help)"; exit 2 ;;
esac
