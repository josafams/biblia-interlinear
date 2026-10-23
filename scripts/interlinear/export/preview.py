"""The preview: a few chapters and the lexicon entries they use, in one JSON (build/preview.html, one file)."""

import os
import re
from pathlib import Path

from interlinear.export.common import compact


def write_preview(fname, selected, books, chapters, lex):
    caps = {}
    used_keys = set()
    for ref in sorted(selected):
        b, c = ref.split(".")
        cap = chapters.chapter(b, int(c))
        caps[ref] = cap
        for v in cap["v"]:
            used_keys.update(w[1] for w in v["w"] if w[1])
    # entries cited in the origin of the entries used (to follow the chain of derivation)
    more = set()
    for k in used_keys:
        e = lex["H"].get(k) or lex["G"].get(k) or {}
        more.update(re.findall(r"[HG]\d+", (e.get("o") or "") + (e.get("oe") or "")))
    all_keys = used_keys | more
    sub = {k: e for L in lex.values() for k, e in L.items() if k in all_keys}
    Path(fname).write_text(compact({"books": books, "chapters": caps, "lex": sub, "complete": False}), encoding="utf8")
    print(f"prévia: {len(caps)} capítulos, {len(sub)} verbetes → {fname} ({os.path.getsize(fname) // 1024} KB)")
