"""G. Style and consistency."""

import re
from collections import Counter, defaultdict

from interlinear.review.morph import grk, heb_segs, is_proper_name, norm_form
from interlinear.review.words import content_stems, toks

# ================================================================== G. consistência
GL_OK = re.compile(
    r"^-?[^\W\d_]+(?:[’']?[^\W\d_]+)*(?:-(?:[^\W\d_]+(?:[’'][^\W\d_]+)*|\[obj\]))*$|^\[obj\]$|"
    r"^[^\W\d_]+(?:-[^\W\d_]+)*-\[obj\](?:-[^\W\d_]+)*$",
    re.U,
)


def check_style(d, M, ws):
    for w in ws:
        g = w.gloss
        if not g:
            continue
        if " " in g or "--" in g or g.endswith("-") or not GL_OK.match(g):
            M.w(w, "CON-04", "erro", "CON-04_1", gloss=g)
            continue
        pieces = g.split("-")
        for t in pieces:
            if t and not t.isupper() and not t.islower() and not (t[0].isupper() and t[1:].islower()):
                M.w(w, "CON-04", "aviso", "CON-04_4", gloss=g)
                break
        ts = toks(g)
        if any(a == b for a, b in zip(ts, ts[1:], strict=False)):
            M.w(w, "CON-04", "aviso", "CON-04_2", gloss=g)
        if len(g) > 40 or len(ts) > 6:
            M.w(w, "CON-04", "aviso", "CON-04_3", count=len(ts), gloss=g)


def check_consistency(d, M, ws, scope_books):
    """CON-01 (mesma forma + morfologia no livro) e CON-02 (mesmo Strong na Bíblia)."""
    marked = set()
    groups = defaultdict(list)
    for w in d.words:
        if w.book in scope_books and w.gloss and w.gloss_source != "manual" and not is_proper_name(w):
            p = grk(w.morph)[0] if w.language == "G" else heb_segs(w.morph)[2][:1]
            if p in ("N", "V", "A"):
                groups[(w.book, norm_form(w), w.morph)].append(w)
    for _k, g_ws in groups.items():
        n = len(g_ws)
        if n < 4:
            continue
        tally = Counter(w.gloss.lower() for w in g_ws)
        majority, n_majority = tally.most_common(1)[0]
        if n_majority / n < 0.5:
            continue
        st_maj = content_stems(majority)
        freq_st = Counter(s for w in g_ws for s in sorted(content_stems(w.gloss)))
        for w in g_ws:
            gl = w.gloss.lower()
            if gl == majority or tally[gl] / n > 0.2:
                continue
            st = content_stems(gl)
            if not st or not st_maj:
                continue
            if st & st_maj or any(freq_st[s] / n >= 0.15 for s in st):
                continue
            marked.add(w.id)
            M.w(w, "CON-01", "aviso", "CON-01", gloss=w.gloss, majority=majority, n_majority=n_majority, n=n)
    # CON-02: por Strong, na Bíblia inteira (só palavras de conteúdo)
    by_strong = defaultdict(list)
    for w in d.words:
        if not w.gloss or not w.strong or is_proper_name(w):
            continue
        p = grk(w.morph)[0] if w.language == "G" else heb_segs(w.morph)[2][:1]
        if p in ("N", "V", "A"):
            by_strong[w.strong].append(w)
    for s, g_ws in by_strong.items():
        n = len(g_ws)
        if n < 20:
            continue
        freq = Counter()
        for w in g_ws:
            freq.update(sorted(content_stems(w.gloss)))
        top, ntop = freq.most_common(1)[0] if freq else (None, 0)
        if ntop / n < 0.6:
            continue
        polysemous = sum(1 for x, k in freq.items() if k / n >= 0.03) >= 4
        for w in g_ws:
            if w.id in marked or w.book not in scope_books or w.gloss_source == "manual":
                continue
            st = content_stems(w.gloss)
            if st and all(freq[x] / n < 0.01 for x in st):
                M.w(w, "CON-02", "info" if polysemous else "aviso", "CON-02", gloss=w.gloss, s=s, top=top, ntop=ntop, n=n)
