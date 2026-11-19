# Shared by atelier_colab.sh and rendu_colab.sh (sourced, not run): how we talk to a Google machine without ever hanging.
# Lesson 2026-11-19 (Kev: « je lance et après rien n'a été lancé ») : a long job run through « colab exec » waits for its answer;
# when the connection froze, the PC waited forever (4 times, 15–60 min each), and the machine (one kernel) ran nothing else meanwhile.
# Now: short commands have a time limit and 3 tries (cx); long jobs are started DETACHED there (nohup, the exec returns at once)
# and followed by downloading their log (cjob): no waiting connection can freeze, several jobs can run side by side.
# Needs: C (colab binary), S (session), T (a temp folder).
cx() {   # cx "<!shell command>" : a SHORT command (≤ CX_T s, 180 by default), 3 tries; prints its output, fails if no answer
  local o k
  for k in 1 2 3; do
    o=$(printf '%s\n' "$1" | timeout "${CX_T:-180}" "$C" exec -s "$S" --timeout 0 2>&1) && { printf '%s\n' "$o" | sed 's/\x1b\[[0-9;]*m//g'; return 0; }
    echo "(machine Google sans réponse, essai $k/3)" >&2; sleep 5
  done
  echo "ERREUR : la machine Google « $S » ne répond plus ($(timeout 60 "$C" status -s "$S" 2>&1 | tail -1))" >&2; return 1
}
cjob() {   # cjob <name> "<shell command run there>" : launched detached there, followed through its log; prints the log's last 25 lines, returns its code
  local n=$1 L=/content/jobs/$1.log f="$T/job-$1.sh" last=-1 same=0 miss=0 t0; t0=$(date +%s)
  printf '%s\n' "$2" > "$f"
  cx "!mkdir -p /content/jobs && rm -f $L /content/jobs/$n.sh && echo pret" | grep -q pret || return 1
  timeout 300 "$C" upload -s "$S" "$f" /content/jobs/$n.sh >/dev/null 2>&1 || { echo "ERREUR : envoi du travail $n"; return 1; }
  cx "!nohup bash -c 'bash /content/jobs/$n.sh > $L 2>&1; echo \"code \$?\" >> $L' > /dev/null 2>&1 & sleep 2; test -e $L && echo demarre" | grep -q demarre \
    || { echo "ERREUR : le travail $n n'a pas démarré là-bas"; return 1; }
  echo "   ($n démarré là-bas, $(date +%H:%M) ; journal suivi toutes les ${CJ_P:-20} s)"
  while :; do
    sleep "${CJ_P:-20}"
    if ! timeout 180 "$C" download -s "$S" $L "$T/$n.log" >/dev/null 2>&1; then
      miss=$((miss + 1)); [ $miss -ge 6 ] || continue
      timeout 60 "$C" sessions 2>&1 | grep -q "\[$S\]" || { echo "ERREUR : machine Google « $S » perdue pendant $n"; return 1; }
      miss=0; continue
    fi
    miss=0
    if tail -1 "$T/$n.log" | grep -q '^code '; then tail -25 "$T/$n.log"; return "$(tail -1 "$T/$n.log" | cut -d' ' -f2)"; fi
    sz=$(stat -c %s "$T/$n.log"); if [ "$sz" = "$last" ]; then same=$((same + 1)); else same=0; last=$sz; fi
    if [ $same -ge 30 ]; then   # 10 min without a new line: is it still alive there?
      cx "!pgrep -f 'jobs/$n.sh' >/dev/null && echo vivant || echo mort" | grep -q vivant \
        || { echo "ERREUR : le travail $n est mort là-bas sans finir"; tail -25 "$T/$n.log"; return 1; }
      echo "   ($n toujours en cours, $(( ($(date +%s) - t0) / 60 )) min)"; same=0
    fi
  done
}
