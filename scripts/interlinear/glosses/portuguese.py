"""The Portuguese side: tokens of a verse, stop words, contractions and the keys of the fallback translations."""

from interlinear.text import TOKEN_PT


# ------------------------------------------------------------- principal
def tokens_pt(verse_text):
    """Tokens da BLIVRE com a posição no texto (hífen separa o pronome do verbo: disse-lhe)."""
    return [(m.group(0), m.start(), m.end()) for m in TOKEN_PT.finditer(verse_text)]


STOP_PT = set(
    [
        "o",
        "a",
        "os",
        "as",
        "de",
        "do",
        "da",
        "dos",
        "das",
        "em",
        "no",
        "na",
        "nos",
        "nas",
        "e",
        "ao",
        "aos",
        "à",
        "às",
        "se",
        "por",
        "pelo",
        "pela",
        "pelos",
        "pelas",
        "para",
        "com",
        "que",
        "lhe",
        "lhes",
    ]
)


def root_pos(language, morph):
    if not morph:
        return ""
    if language == "G":
        return morph[:1]
    root = [s for s in morph[1:].split("/") if not s.startswith("S")]
    return root[-1][:1] if root else ""


def root_morph(language, morph):
    """Morfologia só da raiz (sem prefixos): 'HC/Vqw3ms' → 'Vqw3ms'."""
    if not morph:
        return ""
    if language == "G":
        return morph
    segs = morph[1:].split("/")
    root = [x for x in segs if not x.startswith("S")]
    return root[-1] if root else ""


def short_morph(language, mr):
    if language == "G":
        return mr[:1] + (mr[3:6] if mr[:1] == "V" else mr[6:8])
    return mr[:3]


def fallback_keys(toks, language, morph):
    root = next((t for tp, t in toks if tp == "raiz"), None)
    pre = tuple(t for tp, t in toks if tp == "pre")
    mr = root_morph(language, morph)
    return [(pre, root, mr), (root, mr), (root, short_morph(language, mr)), (pre, root), root]


CONTRACTIONS = [
    ("em-o", "no"),
    ("em-a", "na"),
    ("em-os", "nos"),
    ("em-as", "nas"),
    ("de-o", "do"),
    ("de-a", "da"),
    ("de-os", "dos"),
    ("de-as", "das"),
    ("a-o", "ao"),
    ("a-os", "aos"),
    ("em-ele", "nele"),
    ("em-ela", "nela"),
    ("em-eles", "neles"),
    ("em-elas", "nelas"),
    ("de-ele", "dele"),
    ("de-ela", "dela"),
    ("de-eles", "deles"),
    ("de-elas", "delas"),
    ("em-um", "num"),
    ("em-uma", "numa"),
    ("de-um", "dum"),
]


def contract(g):
    pieces = g.split("-")
    out = []
    i = 0
    while i < len(pieces):
        if i + 1 < len(pieces):
            pair = pieces[i].lower() + "-" + pieces[i + 1].lower()
            c = dict(CONTRACTIONS).get(pair)
            if c:
                out.append(c)
                i += 2
                continue
        out.append(pieces[i])
        i += 1
    return "-".join(out)


FUNCTION_POS = {"R", "C", "T", "D", "P", "X", "I"}  # preposição, conjunção, partícula, advérbio, pronome…
