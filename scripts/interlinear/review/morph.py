"""Morphology of the original: segments of a Hebrew code, Greek parsing, proper names."""

import unicodedata

from interlinear.text import CANTILLATION_AND_VERSE_END


# ------------------------------------------------------------------ morfologia
def heb_segs(morph):
    """'HC/Vqw3ms' → (lingua, prefixos, raiz, sufixos)."""
    if not morph:
        return "", [], "", []
    segs = morph[1:].split("/")
    suf = [s for s in segs if s.startswith("S")]
    non_suffix = [s for s in segs if not s.startswith("S")]
    if len(non_suffix) > 1 and non_suffix[-1] == "Td" and morph[0] == "A":  # artigo enfático aramaico, posposto
        non_suffix = non_suffix[:-1]
    root = non_suffix[-1] if non_suffix else ""
    return morph[0], non_suffix[:-1], root, suf


def grk(morph):
    """'V-3AAI-S--' → ('V', '3AAI-S--'); 'N-----NSM-' → ('N', '----NSM-')."""
    if not morph or "-" not in morph:
        return morph or "", ""
    pos, parse = morph.split("-", 1)
    return pos, parse.ljust(8, "-")


def is_proper_name(w):
    if w.language == "G":
        return grk(w.morph)[0] == "N" and (w.lemma or "")[:1].isupper()
    return heb_segs(w.morph)[2].startswith("Np")


def gloss_names(g):
    return [t for t in (g or "").split("-") if t[:1].isupper() and t not in ("SENHOR", "DEUS", "Deus", "Senhor")]


def norm_form(w):
    t = unicodedata.normalize("NFD", w.text or "")
    if w.language == "G":
        t = "".join(c for c in t if unicodedata.category(c)[0] in "LM").lower()
        return unicodedata.normalize("NFC", t)
    return CANTILLATION_AND_VERSE_END.sub("", t)
