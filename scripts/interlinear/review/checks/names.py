"""H. Proper names."""

import re
from collections import Counter, defaultdict

from interlinear.review.morph import gloss_names, is_proper_name
from interlinear.review.words import stem
from interlinear.text import strip_marks


# ================================================================== H. nomes próprios
def dominant_name(g_ws):
    c = Counter()
    for w in g_ws:
        ns = gloss_names(w.gloss)
        if ns:
            c[ns[0]] += 1
    return c


def check_names(d, M, ws, scope_books):
    # FAT-01: nome da glosa aparece no versículo da BLIVRE
    for w in ws:
        if not w.gloss or not is_proper_name(w):
            continue
        ns = gloss_names(w.gloss)
        bl = d.tokset_blivre((w.book, w.chapter, w.verse))
        if not ns:
            if not any(t[:1].isupper() for t in w.gloss.split("-")):
                M.w(w, "FAT-01", "info", "FAT-01_2", gloss=w.gloss)
            continue
        missing = [x for x in ns if strip_marks(x.lower()) not in bl]
        if missing:
            M.w(w, "FAT-01", "aviso", "FAT-01_1", missing=missing[0])
    # FAT-02: mesmo Strong de nome próprio → mesmo nome
    by_strong = defaultdict(list)
    for w in d.words:
        if w.gloss and w.strong and is_proper_name(w):
            by_strong[w.strong].append(w)
    dominant_by_key = {}
    for s, g_ws in by_strong.items():
        c = dominant_name(g_ws)
        if not c:
            continue
        top, ntop = c.most_common(1)[0]
        dominant_by_key[s] = (top, ntop, len(g_ws))
        n = sum(c.values())
        if n < 5 or ntop / n < 0.7:
            continue
        for w in g_ws:
            if w.book not in scope_books:
                continue
            ns = gloss_names(w.gloss)
            if ns and top not in ns and c[ns[0]] / n <= 0.1 and stem(ns[0])[:3] != stem(top)[:3]:
                M.w(w, "FAT-02", "aviso", "FAT-02", s=s, name=ns[0], top=top, ntop=ntop, n=n)
    # GRG-15 / CRG-05: nome grego de origem hebraica × nome no AT
    seen = set()
    for w in d.words:
        if w.language != "G" or not w.strong or w.strong in seen or w.strong not in dominant_by_key or w.book not in scope_books:
            continue
        seen.add(w.strong)
        derivation = (d.lexicon.get(w.strong) or [None] * 10)[5] or ""
        m = re.search(r"of Hebrew origin \(H0*(\d+)\)", derivation)
        if not m:
            continue
        h = "H" + m.group(1)
        if h not in dominant_by_key:
            continue
        gn, hn = dominant_by_key[w.strong][0], dominant_by_key[h][0]
        if strip_marks(gn.lower()) == strip_marks(hn.lower()):
            continue
        indecl = not re.search(r"[ςνυ]$", strip_marks(w.lemma or ""))  # Ἀβραάμ, Δαυίδ
        cod = "GRG-15" if indecl else "CRG-05"
        if w.strong in ("G2424",):  # Ἰησοῦς ← Josué: diferença esperada
            continue
        M.w(w, cod, "aviso" if stem(gn)[:3] != stem(hn)[:3] else "info", "CRG-05", lemma=w.lemma, gn=gn, h=h, hn=hn)
