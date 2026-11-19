#!/bin/bash
# Switch the Colab CLI to the other Google account when the free GPU quota is used up (PRODUCTION.md, « Un compte Google de secours »).
# Claude runs it in a Terminal tab; Kev signs in and pastes the code himself (Claude never touches passwords).
case "$1" in -h|--help) sed -n '2,/^[^#]/{/^#/s/^# \{0,1\}//p}' "$0"; exit 0;; esac   # quick help: the header above, nothing run
P=$HOME/.local/share/uv/tools/google-colab-cli/bin/python
cp -f ~/.config/colab-cli/sessions.json ~/.config/colab-cli/sessions-avant-changement.json 2>/dev/null
"$P" -c "import keyring; keyring.delete_password('google-colab-cli','oauth_token')" 2>/dev/null && echo "ancien jeton retiré"
echo "Connecte-toi avec l'AUTRE compte Google, puis colle le code ici :"
$HOME/.local/bin/colab sessions
