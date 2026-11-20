#!/bin/sh
# Render on Google Colab (Google's graphics card, a Tesla T4): the PC computes nothing. Same Lemo, same images as on the PC
# (tested 2026-11-18 on L006: identical stills, full 8:24 film in 34 min).
case "$1" in ''|-h|--help) cat <<'AIDE'
usage : sh ~/agence-video/outils/rendu_colab.sh <film> <sortie.mp4>[@LxH][@q] [<sortie2.mp4>@…] [<autre film> <sortie>…]

  <film>       un dossier de film (…/05-rendu/film, le film d'une LSO…) : les vidéos qui le suivent sont rendues avec lui
  <sortie.mp4> où la vidéo arrive sur le PC ; @LxH = taille (1920x1080 sinon) ; @q = la requête du film (comme --q)
  Plusieurs films et vidéos dans UN seul appel = une seule machine Google, préparée une fois (~3 min) : tout mettre dans le même appel.

exemples (depuis le dossier de l'épisode) :
  longue :    sh ~/agence-video/outils/rendu_colab.sh 05-rendu/film 05-rendu/L006-rendu-muet.mp4
  extraits :  sh ~/agence-video/outils/rendu_colab.sh 05-rendu/film 09-export/E1-muet.mp4@1080x1920@'v=1&ext=E1' 09-export/E2-muet.mp4@1080x1920@'v=1&ext=E2'
              puis RENDER=0 sh 09-export/extraits.sh (son, miniature, copie téléphone, sans rendre)
  LSO :       sh LSO1/05-rendu/build.sh prepa  (prépare le film), puis
              sh ~/agence-video/outils/rendu_colab.sh LSO1/05-rendu/film LSO1/05-rendu/LSO1-rendu-muet.mp4@1080x1920@'v=1&ext=LSO1'

Il faut le Colab CLI connecté (INSTALLATION.md §3 ter). Google gratuit = une machine à la fois : jamais deux outils Colab en même temps.
Avant : le film prêt comme pour un rendu sur le PC (build.sh fait les contrôles et copie decoupage.json, subs.json dans film/).
S'arrête en erreur si Chrome passe en rendu logiciel (pas de carte graphique) ou si un rendu rate ; la machine est toujours libérée.
AIDE
exit 0;; esac
set -e
LIB=${LIB:-$HOME/lemo-opuscar}; S=${COLAB_SESSION:-rendu$$}; T=$(mktemp -d)
# COLAB_SESSION=atelier: render on the workshop machine (outils/atelier_colab.sh start), keep it on, and leave each video there too (same path as on the PC)
if [ -n "$COLAB_SESSION" ]; then trap 'rm -rf "$T"' EXIT; else trap 'colab stop -s $S >/dev/null 2>&1; rm -rf "$T"' EXIT; fi
C=$HOME/.local/bin/colab; . "$HOME/agence-video/outils/colab_lib.sh"   # cx / cjob: no command can hang any more (2026-11-19)
x() { CX_T=${CX_T:-600} cx "$1"; }
(cd "$LIB" && tar czf "$T/lemo.tgz" package.json core/render core/fonts core/assets core/image node_modules)
cat > "$T/prepa.sh" <<'PREPA'
set -e; cd /content; mkdir -p lemo; tar xzf lemo.tgz -C lemo
mkdir -p /usr/share/vulkan/icd.d   # Colab has the NVIDIA driver but no Vulkan entry for it: without it Chrome renders in software
echo '{"file_format_version":"1.0.0","ICD":{"library_path":"/usr/lib64-nvidia/libGLX_nvidia.so.0","api_version":"1.3.0"}}' > /usr/share/vulkan/icd.d/nvidia_icd.json
mkdir -p /usr/share/glvnd/egl_vendor.d   # and no EGL entry: both are needed, plus mesa-vulkan-drivers (2026-11-19: without them « WebGL context lost before the first frame »)
echo '{"file_format_version":"1.0.0","ICD":{"library_path":"/usr/lib64-nvidia/libEGL_nvidia.so.0"}}' > /usr/share/glvnd/egl_vendor.d/10_nvidia.json
apt-get -qq update >/dev/null 2>&1; apt-get -qq install -y libvulkan1 mesa-vulkan-drivers >/dev/null 2>&1 || { echo 'apt raté'; exit 1; }; cd lemo && npx playwright-core install --with-deps chromium >/dev/null 2>&1; echo prepa ok
PREPA
if [ -n "$COLAB_SESSION" ] && x '!test -f /content/lemo/.prepa && echo deja' | grep -q deja; then :; else
[ -n "$COLAB_SESSION" ] || { o=$(colab new -s $S --gpu T4 2>&1); echo "$o" | tail -1; echo "$o" | grep -q READY || { echo "ERREUR : pas de machine Google à carte graphique (quota gratuit épuisé ? réessayer plus tard) : $(echo "$o" | grep -o "Service Unavailable\|Error.*" | head -1)"; exit 1; }; }
colab upload -s $S "$T/lemo.tgz" /content/lemo.tgz >/dev/null; colab upload -s $S "$T/prepa.sh" /content/prepa.sh >/dev/null
p=$(cjob prepa$$ 'bash /content/prepa.sh 2>&1 | tail -5') || true; echo "$p" | grep -q 'prepa ok' || { echo "ERREUR : préparation de la machine Google : $p"; exit 1; }; x '!touch /content/lemo/.prepa' >/dev/null; fi
n=0; F=
for a in "$@"; do
  if [ -d "$a" ]; then n=$((n + 1)); F=/content/f$n/film; tar czf "$T/f.tgz" -C "$a/.." "$(basename "$a")"
    colab upload -s $S "$T/f.tgz" /content/f$n.tgz >/dev/null; x "!mkdir -p /content/f$n && tar xzf /content/f$n.tgz -C /content/f$n && mv /content/f$n/$(basename "$a") $F" >/dev/null; continue; fi
  [ -n "$F" ] || { echo "ERREUR : donner le dossier du film avant « $a »"; exit 2; }
  o=${a%%@*}; r=${a#"$o"}; r=${r#@}; sz=${r%%@*}; q=${r#"$sz"}; q=${q#@}; sz=${sz:-1920x1080}
  echo "== $o ($sz${q:+, $q}) : rendu sur Google…"; t=$(date +%s)
  rend() { cjob "rendu$$-$n-$1-$(basename "$o" .mp4)" "cd /content/lemo && LD_LIBRARY_PATH=/usr/lib64-nvidia LEMO_ANGLE=vulkan node core/render/video.mjs $F --fps 24 --workers $1 --size $sz ${q:+--q '$q'} $EXTRA --out /content/out.mp4 2>&1 | tr '\\r' '\\n' | grep -E 'note|done|rror|lost|stopped|Timeout' | tail -4"; }   # detached there, followed through its log
  w=${WORKERS:-4}; out=$(rend $w) || true
  echo "$out" | grep -q "READY never" && [ $w -gt 2 ] && { echo "   (page trop lente à $w rendus parallèles : relancé à 2)"; out=$(rend 2) || true; }   # 2026-11-19: a heavy LSO film timed out at 4 workers
  echo "$out" | grep -q -i 'software' && { echo "ERREUR : rendu logiciel (pas de carte graphique) : $out"; exit 1; }
  echo "$out" | grep -q '^done' || { echo "ERREUR : rendu raté : ${out:-aucun message (voir la commande à la main sur la machine)}"; exit 1; }
  if [ -n "$COLAB_SESSION" ]; then a=$(realpath -m "$o"); case "$a" in "$HOME"/agence-video/*) x "!mkdir -p '/root/${a#$HOME/}' && rmdir '/root/${a#$HOME/}' && cp /content/out.mp4 '/root/${a#$HOME/}'" >/dev/null;; esac; fi
  mkdir -p "$(dirname "$o")"; colab download -s $S /content/out.mp4 "$o" >/dev/null
  echo "   $(echo "$out" | grep '^done' | cut -d' ' -f3-4) en $(( $(date +%s) - t )) s → $o"
done
echo "rendu_colab : fini"
