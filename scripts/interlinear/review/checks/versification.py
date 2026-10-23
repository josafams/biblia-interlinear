"""B. Versification and alignment."""

from interlinear.review.morph import grk, heb_segs, is_proper_name
from interlinear.review.words import content, stem, toks
from interlinear.text import TOKEN_PT_LETTERS

# ================================================================== B. versificação e alinhamento
ALG01 = {
    ("MAT", 17, 21),
    ("MAT", 18, 11),
    ("MAT", 23, 14),
    ("MRK", 7, 16),
    ("MRK", 9, 44),
    ("MRK", 9, 46),
    ("MRK", 11, 26),
    ("MRK", 15, 28),
    ("LUK", 17, 36),
    ("LUK", 23, 17),
    ("JHN", 5, 4),
    ("ACT", 8, 37),
    ("ACT", 15, 34),
    ("ACT", 24, 7),
    ("ACT", 28, 29),
    ("ROM", 16, 24),
}
ALG02 = [
    ("MAT", 6, 13, 6, 13, "Mt 6:13b (doxologia do Pai-Nosso)"),
    ("1JN", 5, 7, 5, 8, "1Jo 5:7–8 (Comma Johanneum)"),
    ("MRK", 16, 9, 16, 20, "Mc 16:9–20 (final longo de Marcos)"),
    ("JHN", 7, 53, 8, 11, "Jo 7:53–8:11 (a mulher adúltera)"),
]
KNOWN_OT = {("NEH", 7, 68): "Ne 7:68 não existe no Texto Massorético (vem da tradição grega/latina)"}
# Diferenças de numeração do NT aplicadas pelo corpus: (livro, ref original) → (cap, vers) de exibição
ALG03 = [("2CO", "13:12.6", 13, 13), ("2CO", "13:13.1", 13, 14), ("ACT", "19:40.22", 19, 41), ("3JN", "1:15.1", 1, 14)]


def check_versification(d, M, scope_books):
    for (b, c, v), (t, _ed, note) in d.verses.items():
        if b not in scope_books:
            continue
        nt = d.testament.get(b) == "NT"
        if note == "sem-original":
            if b == "PSA" and v == 0:
                M.add(b, c, v, None, "ALN-04", "aviso", "ALN-04_2")
            elif nt and (b, c, v) in ALG01:
                M.add(b, c, v, None, "ALG-01", "info", "ALG-01")
            elif nt and any(b == lb and (c1, v1) <= (c, v) <= (c2, v2) for lb, c1, v1, c2, v2, _ in ALG02):
                M.add(b, c, v, None, "ALG-02", "aviso", "ALG-02_2")
            elif (b, c, v) in KNOWN_OT:
                M.add(b, c, v, None, "ALN-02", "info", "ALN-02_3", text=KNOWN_OT[(b, c, v)])
            else:
                M.add(
                    b,
                    c,
                    v,
                    None,
                    "ALG-01" if nt else "ALN-01",
                    "erro" if nt else "aviso",
                    "ALN-01",
                )
        if note == "sem-blivre" or not t.strip():
            if b == "PSA" and v == 0:
                M.add(b, c, v, None, "ALN-04", "aviso", "ALN-04_3")
            else:
                M.add(b, c, v, None, "ALN-05", "erro", "ALN-05_2")
        else:
            prev = d.verses.get((b, c, v - 1))
            if prev and prev[0].strip() and prev[0].strip() == t.strip():
                M.add(b, c, v, None, "ALN-05", "erro", "ALN-05_3", value=v - 1)
    for k in d.by_verse:
        if k[0] in scope_books and k not in d.verses:
            M.add(*k, None, "ALN-05", "erro", "ALN-05_1")
    # ALG-02: trechos conhecidos e versículos em que a BLIVRE é bem mais longa que o grego
    for lb, c1, v1, c2, v2, name in ALG02:
        if lb in scope_books:
            ks = [k for k in d.verses if k[0] == lb and (c1, v1) <= k[1:] <= (c2, v2)]
            if ks:
                k = min(ks)
                M.add(*k, None, "ALG-02", "aviso", "ALG-02_1", name=name)
    for b in scope_books:
        ratios = []
        item_list = []
        for k, ws in d.by_verse.items():
            if k[0] != b:
                continue
            nb = len(TOKEN_PT_LETTERS.findall(d.verses.get(k, ("",))[0]))
            if ws and nb:
                ratios.append(nb / len(ws))
                item_list.append((k, nb, len(ws)))
        if len(ratios) < 10:
            continue
        median = sorted(ratios)[len(ratios) // 2]
        nt = d.testament.get(b) == "NT"
        for k, nb, no in item_list:
            expected = no * median
            if nb > 2.3 * expected and nb - expected >= 14:
                M.add(
                    *k,
                    None,
                    "ALG-02" if nt else "ALN-03",
                    "aviso",
                    "ALN-03_2",
                    nb=nb,
                    no=no,
                    expected=format(expected, ".0f"),
                )
            elif nb < 0.4 * expected and expected - nb >= 14:
                M.add(
                    *k,
                    None,
                    "ALG-02" if nt else "ALN-03",
                    "aviso",
                    "ALN-03_3",
                    nb=nb,
                    no=no,
                    expected=format(expected, ".0f"),
                )
    # ALN-02 / ALN-04: versículo de exibição que junta mais de um versículo original
    for k, vs in d.by_verse.items():
        if k[0] not in scope_books:
            continue
        origs = []
        for w in vs:
            o = w.ref_orig.split(".")[0] if w.ref_orig else None
            if o and o not in origs:
                origs.append(o)
        if len(origs) < 2:
            continue
        b, c, v = k
        if b == "PSA" and v == 1 and (b, c, 0) in d.by_verse:
            M.add(
                b,
                c,
                v,
                None,
                "ALN-04",
                "erro",
                "ALN-04_1",
                original=origs[0],
                original2=origs[1],
            )
        else:
            M.add(
                b,
                c,
                v,
                None,
                "ALG-03" if d.testament.get(b) == "NT" else "ALN-02",
                "info",
                "ALN-02_1",
                count=len(origs),
                value=", ".join(origs),
            )
    # ALG-03 / ALN-02: mapa de versificação aplicado e ordem do texto original preservada
    by_ref = {}
    for w in d.words:
        if w.book in ("2CO", "ACT", "3JN") and w.book in scope_books:
            by_ref[(w.book, w.ref_orig)] = w
    for b, r, c, v in ALG03:
        if b in scope_books:
            w = by_ref.get((b, r))
            if not w or (w.chapter, w.verse) != (c, v):
                M.add(b, c, v, None, "ALG-03", "erro", "ALG-03", r=r, c=c, v=v)
    last_by_book = {}
    for w in d.words:
        if w.book not in scope_books or not w.ref_orig:
            continue
        cv, n = w.ref_orig.split(".")
        c, v = cv.split(":")
        o = (int(c), int(v), int(n))
        p = last_by_book.get(w.book)
        if p and o < p[0] and w.book != "PSA":
            M.w(w, "ALG-03" if w.language == "G" else "ALN-02", "erro", "ALN-02_2", ref_orig=w.ref_orig, previous=p[1])
        last_by_book[w.book] = (o, w.ref_orig)


def check_offset(d, M, scope_books):
    """ALN-03: as traduções usuais das palavras combinam mais com o versículo vizinho da BLIVRE."""
    transl = {}
    for ch, c in d.transl.items():
        tot = sum(c.values())
        s = set()
        for t, n in c.items():
            if n / tot >= 0.02:
                s |= {stem(x) for x in content(toks(t))}
        if s:
            transl[ch] = s
    stems_v = {}

    def sv(k):
        s = stems_v.get(k)
        if s is None:
            s = stems_v[k] = {stem(x) for x in d.tokset_blivre(k)}
        return s

    def score(ws, k):
        if k not in d.verses or not d.verses[k][0]:
            return 0
        s = sv(k)
        return sum(1 for t in ws if t & s) / len(ws)

    for k, ws in d.by_verse.items():
        if k[0] not in scope_books:
            continue
        tally = []
        for w in ws:
            if w.language == "G":
                p = grk(w.morph)[0]
            else:
                p = heb_segs(w.morph)[2][:1]
            if p in ("N", "V", "A") and not is_proper_name(w):
                ch = w.strong or ("G:" + w.lemma)
                if ch in transl:
                    tally.append(transl[ch])
        if len(tally) < 5:
            continue
        own = score(tally, k)
        if own > 0.4:
            continue
        b, c, v = k
        neighbors = [(score(tally, (b, c, v + dv)), v + dv) for dv in (-1, 1)]
        best, vv = max(neighbors)
        if best >= 0.6 and best >= own + 0.3:
            M.add(b, c, v, None, "ALN-03", "aviso", "ALN-03_1", vv=vv, best=format(best, ".0%"), own=format(own, ".0%"))
