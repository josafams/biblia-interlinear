"""dados/conc/<group>.js: every place each lemma shows up, for the concordance of the app."""

import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path

from interlinear.export.common import WEB, compact


def conc_bucket(key):
    """The concordance file of a Strong key: H1234 → H12, G25 → G0; particles and lemmas without Strong → Hx/Gx."""
    m = re.match(r"^([HG])(\d+)$", key or "")
    return f"{m.group(1)}{int(m.group(2)) // 100}" if m else f"{(key or 'G')[0]}x"


def write_concordance(concordance):
    """Each Strong key with the glosses used ("g") and the occurrences ("o"), five numbers per occurrence: book
    (position 0–65), chapter, verse, word in the verse and index of the gloss in "g"."""
    buckets = defaultdict(dict)
    for key, occ in concordance.items():
        glosses = [g for g, _ in Counter(o[4] for o in occ).most_common()]
        gi = {g: i for i, g in enumerate(glosses)}
        flat = [x for b, c, v, i, g in occ for x in (b, c, v, i, gi[g])]
        buckets[conc_bucket(key)][key] = {"g": glosses, "o": flat}
    os.makedirs(os.path.join(WEB, "conc"), exist_ok=True)
    for name, d in buckets.items():
        Path(os.path.join(WEB, "conc", f"{name}.js")).write_text(f"__conc({json.dumps(name)},{compact(d)});", encoding="utf8")
    print(f"concordância: {len(concordance)} chaves em {len(buckets)} arquivos → {os.path.join(WEB, 'conc')}")
