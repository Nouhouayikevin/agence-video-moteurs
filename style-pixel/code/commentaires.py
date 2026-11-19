# Finds code swallowed by a comment placed in the middle of a line (« // » in .js, « # » in .py / .sh): node --check or python do not see it (the line stays valid),
# but the end of the line never runs (seen: an emu missing from a thumbnail, a phone missing from an office, a title missing from a report,
# half of 34 LSO subtitles never shown because « t += … » sat after a « # »).
# Usage: python3 -I commentaires.py film/*.js ../*.py   → lists the suspect lines and exits 1 if there are any.
import re, sys
bad = 0
for f in sys.argv[1:]:
    mark = '#' if f.endswith(('.py', '.sh')) else '//'
    for i, l in enumerate(open(f), 1):
        s = re.sub(r"'(?:\\.|[^'])*'|\"(?:\\.|[^\"])*\"|`[^`]*`", "''", l)   # strings out of the way
        j = s.find(mark)
        if s.lstrip().startswith(mark): continue                                   # a whole-line comment (doc, example code): nothing is swallowed
        if j < 0 or s[max(0, j - 6):j].endswith(':'): continue                  # no comment, or a URL
        c = s[j + len(mark):].strip()
        if re.search(r"\w\([^()]*\)\s*;", c) or re.search(r"\b\w+(\.\w+)+\s*=[^=]", c) or re.search(r";\s*\w+(\[[^\]]*\])?\s*[+\-*/]=", c):   # a call, an assignment, or « ; x += … » after the comment
            print(f'{f}:{i}: {c[:120]}'); bad += 1
sys.exit(1 if bad else 0)
