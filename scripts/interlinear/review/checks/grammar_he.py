"""D. Grammar × gloss (Hebrew and Aramaic), numbers and divine names."""

import re

from interlinear.review.morph import gloss_names, heb_segs
from interlinear.review.words import (
    CONJUNCTIONS,
    CONTRACTIONS,
    DETERMINERS,
    NEGATION,
    NUMBERS,
    ORDINALS,
    PRON,
    PRON_ALL,
    PRON_AMBIG,
    STRONG_NUMBERS,
    content,
    toks,
)
from interlinear.text import strip_marks

# ================================================================== D. gramática × glosa (hebraico/aramaico)
CONJ_H = CONJUNCTIONS | {"e"}
PREP_B = set(
    [
        "em",
        "no",
        "na",
        "nos",
        "nas",
        "num",
        "numa",
        "com",
        "por",
        "pelo",
        "pela",
        "pelos",
        "pelas",
        "entre",
        "dentro",
        "sobre",
        "quando",
        "ao",
        "aos",
        "à",
        "às",
        "durante",
        "contra",
        "nele",
        "nela",
        "neles",
        "nelas",
        "mediante",
        "diante",
        "perante",
        "comigo",
        "contigo",
        "consigo",
        "conosco",
        "convosco",
        "sob",
        "enquanto",
    ]
)
PREP_L = set(
    [
        "para",
        "a",
        "ao",
        "aos",
        "à",
        "às",
        "de",
        "do",
        "da",
        "dos",
        "das",
        "lhe",
        "lhes",
        "por",
        "pelo",
        "pela",
        "pelos",
        "pelas",
        "em",
        "no",
        "na",
        "nos",
        "nas",
        "contra",
        "sobre",
        "até",
        "quanto",
        "segundo",
        "me",
        "te",
        "nos",
        "vos",
        "se",
        "mim",
        "ti",
        "si",
        "dele",
        "dela",
        "deles",
        "delas",
        "comigo",
        "contigo",
        "consigo",
        "conosco",
        "convosco",
        "que",
        "como",
        "diante",
        "perante",
        "entre",
        "ele",
        "ela",
        "eles",
        "elas",
        "com",
    ]
)
PREP_K = set(
    [
        "como",
        "conforme",
        "segundo",
        "qual",
        "assim",
        "quando",
        "quase",
        "cerca",
        "semelhante",
        "tal",
        "tais",
        "igual",
        "iguais",
        "quanto",
        "mesmo",
        "modo",
        "ao",
        "logo",
        "enquanto",
        "depois",
        "apenas",
    ]
)
PREP_M = set(
    [
        "de",
        "do",
        "da",
        "dos",
        "das",
        "desde",
        "dentre",
        "que",
        "deste",
        "desta",
        "dele",
        "dela",
        "deles",
        "delas",
        "daquele",
        "daquela",
        "por",
        "pelo",
        "pela",
        "pelos",
        "pelas",
        "fora",
        "mais",
        "sem",
        "dali",
        "daí",
        "daqui",
        "donde",
        "após",
        "depois",
    ]
)
PART_H = {
    "H3808": (NEGATION | {"senão", "sim"}, "partícula negativa לֹא sem 'não/nem/nenhum'"),
    "H408": (NEGATION, "partícula negativa אַל sem 'não/nem/nenhum'"),
    "H2009": ({"eis", "olha", "olhai", "vede", "veja", "vê", "aqui", "ei-lo", "ei-la", "se", "agora"}, "הִנֵּה sem 'eis'"),
    "H3588": (
        CONJUNCTIONS | {"ainda", "verdade", "verdadeiramente", "certo", "quando", "porquanto", "visto", "senão", "mas"},
        "כִּי sem 'que/porque/pois/quando'",
    ),
}
# palavras em que o sufixo faz parte do sentido lexical (Adonai "Senhor", kol "todos", levad "sozinho",
# ein/yesh/od/hinneh + sufixo)
SUF_LEXICAL = {"H136", "H3605", "H905", "H369", "H3426", "H5750", "H2009", "H2005", "H413"}
PLURAL_ONLY = {"H136", "H6440", "H4325", "H8064", "H430", "H2416", "H7356", "H5271", "H2208", "H2205", "H1170"}


def check_grammar_h(d, M, ws):
    for w in ws:
        if w.language == "G" or not w.morph or not w.gloss:
            continue
        lang, pre, root, suf = heb_segs(w.morph)
        ts = toks(w.gloss)
        tset = set(ts)
        g = w.gloss
        manual = w.gloss_source == "manual"
        # GRA-12: partícula de objeto
        if w.strong == "H853":
            if "[obj]" not in tset and not (tset & PRON_ALL) and not (tset & CONTRACTIONS):
                M.w(w, "GRA-12", "aviso", f"partícula de objeto אֵת com glosa '{g}'")
            continue
        if "[obj]" in g:
            M.w(w, "GRA-12", "erro", f"'[obj]' fora da partícula אֵת ({w.strong})")
        # GRA-13: partículas com glosa fixa
        if w.strong in PART_H:
            ok, msg = PART_H[w.strong]
            if not (tset & ok):
                M.w(w, "GRA-13", "aviso", f"{msg}: '{g}'")
        prefs = (w.prefixes or "").split("/") if w.prefixes else []
        # GRA-01: conjunção prefixada
        if "c" in prefs and not (tset & CONJ_H):
            M.w(w, "GRA-01", "info", f"conjunção ו prefixada sem conjunção na glosa: '{g}'")
        # GRA-03: preposições prefixadas
        for p, conj, name in (("b", PREP_B, "בְּ"), ("l", PREP_L, "לְ"), ("k", PREP_K, "כְּ"), ("m", PREP_M, "מִן")):
            if p in prefs and not (tset & conj) and not (root.startswith("V") and root[2:3] == "c"):
                M.w(w, "GRA-03", "aviso" if p in ("k",) else "info", f"preposição {name} prefixada sem equivalente: '{g}'")
        # GRA-02: artigo
        if (
            ("d" in prefs or any(s == "Rd" for s in pre) or root == "Rd")
            and lang == "H"
            and (
                not (tset & (DETERMINERS | CONTRACTIONS))
                and not gloss_names(g)
                and "SENHOR" not in g
                and not root.startswith("Vr")
                and not root.startswith("Vs")
            )
        ):
            M.w(w, "GRA-02", "info", f"artigo ה sem artigo na glosa: '{g}'")
        # GRA-04: sufixo pronominal
        for s in suf:
            if not s.startswith("Sp") or len(s) < 5 or w.strong in SUF_LEXICAL or (root.startswith("V") and root[2:3] == "c"):
                continue
            person, num = s[2], s[4]
            target = "3" if person == "3" else person + ("s" if num == "s" else "p")
            if not (tset & PRON_ALL) and not (tset & CONTRACTIONS) and not any(t.endswith(("-lo", "-la")) for t in ts):
                M.w(w, "GRA-04", "aviso", f"sufixo pronominal {s[2:]} sem pronome/possessivo na glosa: '{g}'")
            else:
                others = set().union(*(v for k, v in PRON.items() if k != target))
                if (
                    (tset & others)
                    and not (tset & PRON[target])
                    and not (target == "1p" and "nos" in tset)
                    and not (target == "3" and tset & PRON_AMBIG)
                ):
                    M.w(w, "GRA-04", "aviso", f"sufixo {s[2:]} mas glosa com pronome de outra pessoa: '{g}'")
        # GRA-05: pessoa do verbo (1ª e 2ª do plural, verbos finitos)
        if root.startswith("V") and len(root) >= 6 and root[2] in "pqiwhjv":
            person, num = root[3], root[5]
            if person == "1" and num == "p" and not any(t.endswith(("mos", "mo")) or t in ("nós", "nos") for t in ts):
                M.w(w, "GRA-05", "aviso", f"verbo 1ª pl. ({root}) sem forma de 'nós' na glosa: '{g}'")
        # GRA-07: infinitivo construto com ל
        if root.startswith("V") and len(root) >= 3 and root[2] == "c" and "l" in prefs and w.strong != "H559":
            if not (tset & {"para", "a", "de", "ao", "à", "por", "que", "até", "quando", "se", "em"}) and not any(
                t.endswith(("ar", "er", "ir", "or")) for t in ts
            ):
                M.w(w, "GRA-07", "info", f"infinitivo com ל sem 'para/a + infinitivo': '{g}'")
        # GRA-10: plural
        if root.startswith("Nc") and len(root) >= 5 and root[3] == "p" and w.strong not in PLURAL_ONLY and not manual:
            tally = content(ts)
            if tally and not any(t.endswith("s") for t in ts) and not gloss_names(g):
                M.w(w, "GRA-10", "info", f"substantivo plural com glosa no singular: '{g}'")
        # ARM-03: estado enfático do aramaico
        if lang == "A" and root.startswith("N") and root.endswith("d") and root[1] != "p":
            if not (tset & (DETERMINERS | CONTRACTIONS | PRON_ALL)):
                M.w(w, "ARM-03", "info", f"estado enfático sem artigo na glosa: '{g}'")
        # ARM-04: partícula דִּי
        if (
            lang == "A"
            and w.strong == "H1768"
            and not (
                tset
                & (
                    {
                        "que",
                        "qual",
                        "quais",
                        "quem",
                        "porque",
                        "pois",
                        "de",
                        "do",
                        "da",
                        "dos",
                        "das",
                        "quando",
                        "cujo",
                        "cuja",
                        "cujos",
                        "cujas",
                        "onde",
                        "como",
                        "para",
                    }
                    | DETERMINERS
                )
            )
        ):
            M.w(w, "ARM-04", "aviso", f"partícula דִּי com glosa '{g}'")


MEASURES = {
    "H520": ("côvad",),
    "H8255": ("siclo",),
    "H374": ("efa",),
    "H1969": ("him", "hin"),
    "H3734": ("coro",),
    "H6016": ("ômer", "gômer", "feixe"),
    "H1324": ("bato",),
    "H4488": ("mina", "libra"),
    "H7341": ("larg",),
    "H753": ("compr", "longo", "longa", "dura", "extens", "prolong"),
    "H1092": ("beca", "meio"),
}


def check_numbers_and_divine_names(d, M, ws):
    for w in ws:
        g = w.gloss
        if not g:
            continue
        ts = toks(g)
        tset = set(ts)
        k = (w.book, w.chapter, w.verse)
        # FAT-03: números da glosa presentes na BLIVRE
        strongs = [t for t in ts if t in STRONG_NUMBERS]
        if strongs:
            bl = d.tokset_blivre(k)
            missing = [t for t in strongs if strip_marks(t) not in bl]
            if missing:
                M.w(w, "FAT-03", "aviso", f"número '{missing[0]}' da glosa não aparece no versículo da BLIVRE")
        if w.language != "G":
            root = heb_segs(w.morph)[2]
            if (
                root.startswith("Ac")
                and w.strong not in ("H259",)
                and not (tset & NUMBERS)
                and not (tset & ORDINALS)
                and not any(t.startswith(("centuri", "dezen", "milhar", "centen")) for t in ts)
            ):
                M.w(w, "FAT-03", "aviso", f"numeral cardinal ({w.strong}) sem número na glosa: '{g}'")
        # FAT-09: medidas e unidades
        if w.strong in MEASURES and not any(t.startswith(MEASURES[w.strong]) for t in ts):
            M.w(w, "FAT-09", "aviso", f"medida {w.strong} glosada '{g}' (esperado {'/'.join(MEASURES[w.strong])}…)")
        # FAT-04: nomes divinos
        s = w.strong
        if s == "H3068" and "SENHOR" not in g and "DEUS" not in g:
            M.w(w, "FAT-04", "aviso", f"YHWH com glosa '{g}' (esperado SENHOR / DEUS)")
        elif s == "H136" and not re.search(r"(^|-)Senhor(es)?($|-)|(^|-)senhor", g):
            M.w(w, "FAT-04", "aviso", f"Adonai com glosa '{g}' (esperado Senhor)")
        elif s == "H430" and not (tset & {"deus", "deuses", "divino", "divina", "juízes", "anjos", "poderosos"}):
            M.w(w, "FAT-04", "aviso", f"Elohim com glosa '{g}' (esperado Deus/deuses)")
        elif s == "H3050" and not re.search(r"SENHOR|JAH|Jah|DEUS|aleluia", g, re.I):
            M.w(w, "FAT-04", "aviso", f"Yah com glosa '{g}'")
