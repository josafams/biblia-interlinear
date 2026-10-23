"""E. Greek."""

from collections import defaultdict

from interlinear.review.morph import grk
from interlinear.review.words import (
    CONJUNCTIONS,
    CONTRACTIONS,
    DETERMINERS,
    NEGATION,
    PREPOSITIONS,
    PRON,
    PRON_ALL,
    PRON_AMBIG,
    content,
    toks,
)

# ================================================================== E. grego
ART_OK = DETERMINERS | CONTRACTIONS | PREPOSITIONS | PRON_ALL | {"que", "quem", "qual", "quais", "coisas", "aquilo", "aquele", "aqueles"}
PART_G = {
    "καί": CONJUNCTIONS | {"inclusive", "nem"},
    "δέ": CONJUNCTIONS | {"entretanto", "enquanto", "porém", "ora", "outro", "outros", "uns", "uma", "um"},
    "γάρ": CONJUNCTIONS | {"verdade", "realmente", "certo", "porquanto"},
    "οὖν": CONJUNCTIONS | {"isso", "isto", "pois", "portanto", "então", "logo"},
    "ἀλλά": CONJUNCTIONS | {"contrário", "senão"},
    "ἵνα": CONJUNCTIONS | {"para", "a", "fim", "de", "afim"},
    "ὅτι": CONJUNCTIONS | {"pois", "visto", "porquanto", "como"},
}
NEG_G = {
    "οὐ",
    "μή",
    "οὐδέ",
    "μηδέ",
    "οὐδείς",
    "μηδείς",
    "οὔτε",
    "μήτε",
    "οὐκέτι",
    "μηκέτι",
    "οὔπω",
    "μήπω",
    "οὐχί",
    "οὐδαμῶς",
    "οὐθείς",
    "μηθείς",
    "οὐδέποτε",
    "μηδέποτε",
}
PREP_CASE = {  # (lema, caso): (glosas que indicam o outro caso, sem as do próprio caso)
    ("διά", "A"): (
        {"meio", "através"},
        {"causa", "razão", "isso", "motivo", "porque", "porquanto"},
        "διά + acusativo ('por causa de') glosada como 'por meio de'",
    ),
    ("διά", "G"): (
        {"causa", "razão", "motivo"},
        {"meio", "através", "pelo", "pela", "por", "pelos", "pelas", "durante", "entre", "de", "em"},
        "διά + genitivo ('por meio de') glosada como 'por causa de'",
    ),
    ("μετά", "A"): (
        {"com", "conosco", "comigo", "contigo", "convosco", "consigo"},
        {"depois", "após", "passados", "passado", "dentro", "em"},
        "μετά + acusativo ('depois de') glosada como 'com'",
    ),
    ("μετά", "G"): (
        {"depois", "após"},
        {"com", "conosco", "comigo", "contigo", "convosco", "consigo", "entre"},
        "μετά + genitivo ('com') glosada como 'depois de'",
    ),
    ("ὑπό", "A"): (
        {"pelo", "pela", "pelos", "pelas"},
        {"debaixo", "sob", "abaixo"},
        "ὑπό + acusativo ('debaixo de') glosada como agente 'por'",
    ),
    ("ὑπό", "G"): (
        {"debaixo", "sob", "abaixo"},
        {"por", "pelo", "pela", "pelos", "pelas", "de"},
        "ὑπό + genitivo ('por', agente) glosada como 'debaixo de'",
    ),
}
CRASIS = {
    "κἀγώ": ({"eu", "me", "mim", "também", "nós"}, "κἀγώ (= καί + ἐγώ) sem 'eu/me/mim/também'"),
    "κἀκεῖ": ({"ali", "lá", "aí", "também", "e"}, "κἀκεῖ (= καί + ἐκεῖ) sem 'ali/lá'"),
    "κἀκεῖθεν": ({"dali", "daí", "ali", "lá", "depois", "e"}, "κἀκεῖθεν sem 'e dali'"),
    "κἀκεῖνος": (
        PRON["3"]
        | {
            "aquele",
            "aquela",
            "aqueles",
            "aquelas",
            "este",
            "esta",
            "estes",
            "também",
            "esse",
            "essa",
            "o",
            "a",
            "os",
            "as",
            "e",
            "outro",
            "outros",
            "isto",
        },
        "κἀκεῖνος sem 'e aquele/ele'",
    ),
}


def next_case(vs, i):
    for w in vs[i + 1 : i + 4]:
        pos, parse = grk(w.morph)
        if parse[4] in "NGDAV" and parse[4] != "-":
            return parse[4]
    return None


def check_greek(d, M, ws):
    by_verse = defaultdict(list)
    for w in ws:
        if w.language == "G":
            by_verse[(w.book, w.chapter, w.verse)].append(w)
    for _k, vs in by_verse.items():
        for i, w in enumerate(vs):
            g = w.gloss
            if not g:
                continue
            ts = toks(g)
            tset = set(ts)
            pos, parse = grk(w.morph)
            lemma = w.lemma or ""
            # GRG-01: artigo
            if pos == "RA":
                outside = [t for t in ts if t not in ART_OK]
                if outside:
                    M.w(w, "GRG-01", "aviso", f"artigo com glosa que não é artigo/preposição: '{g}'")
                elif (
                    parse[5] == "P"
                    and (tset - {"de", "a", "em", "que", "para", "por", "com"}) is not False
                    and tset <= {"o", "a", "do", "da", "ao", "à", "no", "na", "pelo", "pela"}
                ):
                    M.w(w, "GRG-01", "info", f"artigo plural com glosa no singular: '{g}'")
                continue
            # GRG-11: negação
            if lemma in NEG_G:
                ok = (
                    NEGATION
                    | ({"porventura", "acaso", "que", "senão", "para"} if lemma in ("μή", "μήτε") else set())
                    | ({"porventura", "acaso"} if lemma in ("οὐ", "οὐχί") else set())
                )
                if not (tset & ok):
                    M.w(w, "GRG-11", "aviso", f"negação {lemma} sem 'não/nem/nenhum' na glosa: '{g}'")
                continue
            # GRG-12: conjunções e partículas
            if lemma in PART_G and not (tset & PART_G[lemma]):
                M.w(w, "GRG-12", "aviso" if lemma in ("ἵνα", "ὅτι", "γάρ", "ἀλλά") else "info", f"{lemma} com glosa '{g}'")
                continue
            # TXG-03: crase
            if lemma in CRASIS:
                ok, msg = CRASIS[lemma]
                if not (tset & ok):
                    M.w(w, "TXG-03", "aviso", f"{msg}: '{g}'")
                continue
            # GRG-10: preposição × caso
            if pos == "P" and lemma in ("διά", "μετά", "ὑπό"):
                case = next_case(vs, i)
                rule = PREP_CASE.get((lemma, case))
                if rule:
                    wrong, right, msg = rule
                    if tset & wrong and not (tset & right):
                        M.w(w, "GRG-10", "aviso", f"{msg}: '{g}'")
                continue
            # GRG-13: pronomes pessoais
            if lemma in ("ἐγώ", "σύ", "αὐτός") and pos.startswith("R"):
                target = {"ἐγώ": ("1s", "1p"), "σύ": ("2s", "2p"), "αὐτός": ("3",)}[lemma]
                proper = set().union(*(PRON[a] for a in target)) | ({"nos"} if lemma == "ἐγώ" else set())
                others = set().union(*(v for kk, v in PRON.items() if kk not in target))
                if lemma == "αὐτός":
                    proper |= PRON_AMBIG | {"mesmo", "mesma", "mesmos", "mesmas", "próprio", "própria", "próprios"}
                if (tset & others) and not (tset & proper):
                    M.w(w, "GRG-13", "aviso", f"{lemma} ({parse[0] if parse[0] != '-' else 'pron.'}) com glosa de outra pessoa: '{g}'")
                continue
            # GRG-05: pessoa do verbo (1ª pl.)
            if pos == "V" and parse[3] in "ISOD" and parse[0] == "1" and parse[5] == "P":
                if not any(t.endswith(("mos", "mo")) or t in ("nós", "nos") for t in ts):
                    M.w(w, "GRG-05", "aviso", f"verbo 1ª pl. sem forma de 'nós' na glosa: '{g}'")
            # GRG-04: plural
            if pos == "N" and parse[5] == "P" and not lemma[:1].isupper():
                tally = content(ts)
                if tally and not any(t.endswith("s") for t in ts) and lemma not in ("οὐρανός",):
                    M.w(w, "GRG-04", "info", f"substantivo plural com glosa no singular: '{g}'")
