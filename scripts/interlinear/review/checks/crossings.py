"""I. Crossings: parallel passages, bridges between Hebrew and Greek, support."""

import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher

from interlinear.review.marks import ref
from interlinear.review.morph import heb_segs, norm_form
from interlinear.review.words import content, content_stems, stem, toks

# ================================================================== I. cruzamentos
PARALLELS_OT = [
    (("PSA", 18, 1, 18, 50), ("2SA", 22, 1, 22, 51)),
    (("PSA", 14, 1, 14, 7), ("PSA", 53, 1, 53, 6)),
    (("PSA", 40, 13, 40, 17), ("PSA", 70, 1, 70, 5)),
    (("PSA", 108, 1, 108, 5), ("PSA", 57, 7, 57, 11)),
    (("PSA", 108, 6, 108, 13), ("PSA", 60, 5, 60, 12)),
    (("1CH", 16, 8, 16, 22), ("PSA", 105, 1, 105, 15)),
    (("1CH", 16, 23, 16, 33), ("PSA", 96, 1, 96, 13)),
    (("ISA", 36, 1, 39, 8), ("2KI", 18, 13, 20, 19)),
    (("JER", 52, 1, 52, 34), ("2KI", 24, 18, 25, 30)),
    (("GEN", 36, 10, 36, 43), ("1CH", 1, 35, 1, 54)),
    (("EZR", 2, 1, 2, 70), ("NEH", 7, 6, 7, 73)),
    (("EXO", 20, 1, 20, 17), ("DEU", 5, 6, 5, 21)),
    (("MIC", 4, 1, 4, 3), ("ISA", 2, 2, 2, 4)),
    (("OBA", 1, 1, 1, 9), ("JER", 49, 7, 49, 22)),
    (("2SA", 7, 1, 7, 29), ("1CH", 17, 1, 17, 27)),
    (("1KI", 8, 12, 8, 53), ("2CH", 6, 1, 6, 42)),
]
PARALLELS_NT = [
    (("2PE", 2, 1, 2, 22), ("JUD", 1, 3, 1, 18)),
]


def snippet(d, t):
    b, c1, v1, c2, v2 = t
    return [w for w in d.words if w.book == b and (c1, v1) <= (w.chapter, w.verse) <= (c2, v2)]


def check_parallels(d, M, scope_books):
    for lst, cod in ((PARALLELS_OT, "CRZ-02"), (PARALLELS_NT, "CRZ-03")):
        for a, b in lst:
            if a[0] not in scope_books and b[0] not in scope_books:
                continue
            wa, wb = snippet(d, a), snippet(d, b)
            if not wa or not wb:
                continue
            sa = [(norm_form(w), w.morph) for w in wa]
            sb = [(norm_form(w), w.morph) for w in wb]
            sm = SequenceMatcher(None, sa, sb, autojunk=False)
            for bl in sm.get_matching_blocks():
                if bl.size < 3:
                    continue
                for i in range(bl.size):
                    x, y = wa[bl.a + i], wb[bl.b + i]
                    if not x.gloss or not y.gloss or x.gloss.lower() == y.gloss.lower():
                        continue
                    sx, sy = content_stems(x.gloss), content_stems(y.gloss)
                    if (sx or sy) and not (sx & sy):
                        msg = f"'{y.gloss}' × '{x.gloss}' em {ref(x)} (mesmo original)"
                        M.w(y, cod, "aviso", msg)
                        M.w(x, cod, "aviso", f"'{x.gloss}' × '{y.gloss}' em {ref(y)} (mesmo original)")


EQUIV = [
    ("H7307", "G4151", "espírito"),
    ("H8451", "G3551", "lei"),
    ("H2617", "G1656", "misericórdia"),
    ("H1285", "G1242", "aliança"),
    ("H6662", "G1342", "justo"),
    ("H5315", "G5590", "alma"),
    ("H3820", "G2588", "coração"),
    ("H3519", "G1391", "glória"),
    ("H7965", "G1515", "paz"),
    ("H3444", "G4991", "salvação"),
    ("H6944", "G40", "santo"),
    ("H4397", "G32", "anjo"),
]
CRG02 = {
    "G5008",
    "G2891",
    "G5",
    "G2188",
    "G1682",
    "G2982",
    "G4518",
    "G3134",
    "G4461",
    "G281",
    "G5614",
    "G239",
    "G2878",
    "G3126",
    "G1115",
    "G2786",
}


def check_bridges(d, M, scope_books):
    by_strong = defaultdict(list)
    targets = {s for e in EQUIV for s in e[:2]} | CRG02
    for w in d.words:
        if w.strong in targets and w.gloss:
            by_strong[w.strong].append(w)

    def dominant(s):
        c = Counter()
        for w in by_strong.get(s, []):
            c.update(sorted(content_stems(w.gloss)))
        return c

    for h, g, expected in EQUIV:
        ch, cg = dominant(h), dominant(g)
        if not ch or not cg or not by_strong[g]:
            continue
        th = {s for s, _ in ch.most_common(3)}
        tg = {s for s, _ in cg.most_common(3)}
        w = by_strong[g][0]
        if w.book not in scope_books:
            continue
        if not (th & tg):
            M.w(w, "CRZ-05", "aviso", f"{h} ↔ {g}: glosas sem família comum ({sorted(th)} × {sorted(tg)}); esperado '{expected}'")
        elif stem(expected) not in (th | tg):
            M.w(w, "CRZ-05", "info", f"{h} ↔ {g}: '{expected}' não está entre as glosas mais comuns")
    # CRG-02: palavras aramaicas/hebraicas transliteradas no NT
    for s in CRG02:
        g_ws = by_strong.get(s, [])
        if not g_ws:
            continue
        c = dominant(s)
        if not c:
            continue
        top, ntop = c.most_common(1)[0]
        for w in g_ws:
            if (
                w.book in scope_books
                and len(g_ws) >= 2
                and not (content_stems(w.gloss) & {top})
                and all(c[x] / len(g_ws) < 0.2 for x in content_stems(w.gloss))
            ):
                M.w(w, "CRG-02", "aviso", f"transliteração {w.lemma} glosada '{w.gloss}' (usual '{top}…')")
    # ARM-07: verbete aramaico "corresponding to H####" com glosa da mesma família do hebraico
    by_str_a = defaultdict(list)
    for w in d.words:
        if w.language == "A" and w.strong and w.gloss:
            by_str_a[w.strong].append(w)
    for s, g_ws in by_str_a.items():
        e = d.lexicon.get(s)
        if not e:
            continue
        derivation = e[5] or ""
        m = re.search(r"corresponding to H0*(\d+)", derivation)
        if m:
            h = "H" + m.group(1)
            th = set()
            for t, _n in d.transl.get(h, {}).items():
                th |= {stem(x) for x in content(toks(t))}
            if not th:
                continue
            ca = Counter()
            for w in g_ws:
                ca.update(sorted(content_stems(w.gloss)))
            if not ca:
                continue
            ta = {x for x, _ in ca.most_common(2)}
            w = g_ws[0]
            if w.book in scope_books and not (ta & th) and len(g_ws) >= 2:
                M.w(w, "ARM-07", "info", f"aramaico {s} glosado {sorted(ta)}; o hebraico {h} é traduzido {sorted(th)[:4]}")
        # ARM-06: verbete do Strong precisa ser o aramaico
        if (
            s[1:].isdigit()
            and "(Aramaic)" not in derivation
            and "Chaldee" not in derivation
            and not (e[2] and heb_segs(g_ws[0].morph)[2].startswith("Np"))
        ):
            for w in g_ws:
                if w.book in scope_books:
                    M.w(w, "ARM-06", "info", f"palavra aramaica com verbete {s} sem marca '(Aramaic)'")
                    break
    # ARM-10: Jr 10:11, as duas grafias de "terra"
    if "JER" in scope_books:
        ws = d.by_verse.get(("JER", 10, 11), [])
        land_words = [w for w in ws if w.strong in ("H778", "H772")]
        gl = {tuple(sorted(content_stems(w.gloss))) for w in land_words if w.gloss}
        if len(gl) > 1:
            M.add(
                "JER",
                10,
                11,
                None,
                "ARM-10",
                "aviso",
                "as duas grafias de 'terra' com glosas diferentes: " + ", ".join(w.gloss for w in land_words),
            )


def check_support(d, M, ws):
    """CRZ-01: glosa sem apoio no alinhamento e sem nenhuma palavra presente no versículo da BLIVRE."""
    for w in ws:
        if w.gloss_source not in ("lexico", "parcial") or not w.gloss:
            continue
        st = content_stems(w.gloss)
        if not st:
            continue
        bl = {stem(x) for x in d.tokset_blivre((w.book, w.chapter, w.verse))}
        if not (st & bl):
            M.w(w, "CRZ-01", "info", f"glosa '{w.gloss}' (fonte {w.gloss_source}) sem palavra correspondente na BLIVRE do versículo")


def check_greek_strong(d, M, ws):
    for w in ws:
        if w.language != "G":
            continue
        if w.strong_source == "aprox":
            e = d.lexicon.get(w.strong or "")
            M.w(w, "LXG-02", "aviso", f"lema {w.lemma} ligado a {w.strong} ({e[2] if e else '?'}) por semelhança")
