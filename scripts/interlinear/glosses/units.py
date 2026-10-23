"""The original words as sequences of units (prefixes, root, pronominal suffixes) for the alignment."""

import re

from interlinear.text import norm_greek


# ------------------------------------------------------------- unidades do original
def hebrew_units(lemma, morph):
    """Lista de (tipo, token): tipo é 'pre', 'raiz' ou 'suf'."""
    pieces = [p.strip() for p in lemma.split("/")]
    segs = morph[1:].split("/") if morph else []
    suffixes = [s for s in segs if s.startswith("S")]
    no_suffix = [s for s in segs if not s.startswith("S")]
    out = []
    for i, p in enumerate(pieces[:-1]):
        out.append(("pre", "p_" + p))
        if i < len(no_suffix) and no_suffix[i] == "Rd":  # preposição com artigo embutido
            out.append(("pre", "p_d"))
    root = pieces[-1]
    m = re.match(r"(\d+)", root)
    out.append(("raiz", ("h" + m.group(1)) if m else ("p_" + root)))
    if no_suffix and no_suffix[-1] == "Rd" and len(pieces) == 1:
        out.append(("pre", "p_d"))
    # artigo enfático aramaico (posposto)
    if len(no_suffix) > len(pieces) and no_suffix[-1] == "Td":
        out.append(("suf", "p_d"))
    for s in suffixes:
        if s.startswith("Sp"):
            out.append(("suf", "s_" + s[2:]))
        elif s == "Sd":
            out.append(("suf", "s_d"))
    return out


def greek_units(lemma, morph):
    return [("raiz", "g_" + norm_greek(lemma).replace(" ", "_"))]
