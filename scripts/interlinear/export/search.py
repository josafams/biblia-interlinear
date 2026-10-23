"""dados/busca/<2 letters>.js: the search index of the Bíblia Livre."""

import json
import os
from collections import defaultdict
from pathlib import Path

from interlinear.export.common import WEB, b36, compact, search_norm, split_heading

# words of the Bíblia Livre for the search: the same rule as the alignment (interlinear/glosses)
from interlinear.text import TOKEN_PT


def write_search_index(texts, book_index):
    """A word of the Bíblia Livre (without accents, lowercase) → the verses it shows up in. Each verse is
    book*1,000,000 + chapter*1,000 + verse, in order, written as the difference to the one before in base 36."""
    postings = defaultdict(set)
    for (b, c), vs in texts.items():
        for v, (t, _ed, _note) in vs.items():
            _h, t, _cut = split_heading(t)
            vid = book_index[b] * 1_000_000 + c * 1000 + v
            for m in TOKEN_PT.finditer(t or ""):
                postings[search_norm(m.group(0))].add(vid)
    buckets = defaultdict(dict)
    for word, ids in postings.items():
        prev, out = 0, []
        for x in sorted(ids):
            out.append(b36(x - prev))
            prev = x
        buckets[word[:2]][word] = ",".join(out)
    os.makedirs(os.path.join(WEB, "busca"), exist_ok=True)
    for name, d in buckets.items():
        fname = "".join(ch if ch.isalnum() and ch.isascii() else f"_{ord(ch):x}" for ch in name)
        Path(os.path.join(WEB, "busca", f"{fname}.js")).write_text(f"__busca({json.dumps(name)},{compact(d)});", encoding="utf8")
    print(f"busca: {len(postings)} palavras em {len(buckets)} arquivos → {os.path.join(WEB, 'busca')}")
