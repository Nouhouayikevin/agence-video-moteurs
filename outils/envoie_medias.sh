#!/bin/bash
# envoie_medias.sh : envoie les vrais médias d'un épisode depuis le PC vers une machine Google (2026-11-23, F002).
# YouTube refuse yt-dlp sur les machines Google (« Sign in to confirm you're not a bot ») : on télécharge sur le PC
# (outils/medias.py, sans compte ni cookies), puis on envoie. colab upload répond « 400 Bad Request » au-delà de ~90 Mo :
# chaque fichier part en morceaux de 40 Mo, recollés là-bas, taille vérifiée. Un fichier déjà là (même taille) est sauté.
case "$1" in ''|-h|--help) cat <<'AIDE'
usage : bash outils/envoie_medias.sh <dossier de l'épisode> [session]      (session : atelier par défaut, ou COLAB_SESSION)
  envoie les médias que le montage utilise (05-rendu/reels.json, champ « src »), de ~/agence-medias/<chaîne>/<CODE>/
  vers le même chemin sur la machine (/root/agence-medias/...). Exemple, sur une machine sans carte :
  bash outils/envoie_medias.sh nan_serieux/fr/episodes/F002-gta6 atelier2
AIDE
exit 0;; esac
E=$(realpath "$1"); S=${2:-${COLAB_SESSION:-atelier}}; C=$HOME/.local/bin/colab
M=$(python3 -c "import json,os;print(os.path.expanduser(json.load(open('$E/05-rendu/reels.json'))['medias']))") || { echo "ERREUR : $E/05-rendu/reels.json illisible"; exit 1; }
D=/root/${M#$HOME/}; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
ex() { printf '%s\n' "$1" | timeout 300 "$C" exec -s "$S" --timeout 0 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g'; }
ex "!mkdir -p $D /content/m && echo pret" | grep -q pret || { echo "ERREUR : la machine Google « $S » ne répond pas"; exit 1; }
for f in $(python3 -c "import json;print(' '.join(sorted({c['src'] for c in json.load(open('$E/05-rendu/reels.json'))['couches']})))"); do
  [ -f "$M/$f" ] || { echo "ERREUR : $M/$f absent du PC (python3 outils/medias.py <épisode>)"; exit 1; }
  n=$(stat -c %s "$M/$f")
  [ "$(ex "!stat -c %s $D/$f 2>/dev/null || echo 0" | grep -oE '^[0-9]+' | tail -1)" = "$n" ] && { echo "déjà là : $f"; continue; }
  rm -f "$T"/*; split -b 40M "$M/$f" "$T/x."
  for p in "$T"/x.*; do
    for k in 1 2 3; do timeout 900 "$C" upload -s "$S" "$p" "/content/m/$(basename "$p")" >/dev/null 2>&1 && break; [ $k = 3 ] && { echo "ERREUR : morceau $(basename "$p") de $f"; exit 1; }; done
  done
  ex "!cat /content/m/x.* > $D/$f && rm -f /content/m/x.* && stat -c %s $D/$f" | grep -q "^$n$" && echo "envoyé : $f ($((n / 1048576)) Mo)" || { echo "ERREUR : $f mal recollé"; exit 1; }
done
echo "médias ok"
