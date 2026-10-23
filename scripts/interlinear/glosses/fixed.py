"""Fixed rules: the Greek article and the Hebrew prefixes and suffixes, when nothing is aligned."""

# ------------------------------------------------------------- regras fixas
ARTICLE_G = {  # caso + gênero + número → artigo português
    ("N", "M", "S"): "o",
    ("N", "F", "S"): "a",
    ("N", "N", "S"): "o",
    ("N", "M", "P"): "os",
    ("N", "F", "P"): "as",
    ("N", "N", "P"): "os",
    ("A", "M", "S"): "o",
    ("A", "F", "S"): "a",
    ("A", "N", "S"): "o",
    ("A", "M", "P"): "os",
    ("A", "F", "P"): "as",
    ("A", "N", "P"): "os",
    ("G", "M", "S"): "do",
    ("G", "F", "S"): "da",
    ("G", "N", "S"): "do",
    ("G", "M", "P"): "dos",
    ("G", "F", "P"): "das",
    ("G", "N", "P"): "dos",
    ("D", "M", "S"): "ao",
    ("D", "F", "S"): "à",
    ("D", "N", "S"): "ao",
    ("D", "M", "P"): "aos",
    ("D", "F", "P"): "às",
    ("D", "N", "P"): "aos",
}


PRE_H = {"p_c": "e", "p_d": "o", "p_b": "em", "p_l": "para", "p_k": "como", "p_m": "de", "p_s": "que", "p_i": "acaso"}


SUF_NOUN = {
    "1cs": "meu",
    "2ms": "teu",
    "2fs": "teu",
    "3ms": "dele",
    "3fs": "dela",
    "1cp": "nosso",
    "2mp": "vosso",
    "2fp": "vosso",
    "3mp": "deles",
    "3fp": "delas",
}


SUF_VERB = {
    "1cs": "me",
    "2ms": "te",
    "2fs": "te",
    "3ms": "o",
    "3fs": "a",
    "1cp": "nos",
    "2mp": "vos",
    "2fp": "vos",
    "3mp": "os",
    "3fp": "as",
}


SUF_PREP = {
    "1cs": "mim",
    "2ms": "ti",
    "2fs": "ti",
    "3ms": "ele",
    "3fs": "ela",
    "1cp": "nós",
    "2mp": "vós",
    "2fp": "vós",
    "3mp": "eles",
    "3fp": "elas",
}


def gloss_suffix_rule(tok, morph):
    if tok == "s_d":
        return "para"
    p = tok[2:]
    segs = morph[1:].split("/")
    root = [s for s in segs if not s.startswith("S")]
    pos = root[-1][:1] if root else ""
    tab = SUF_VERB if pos == "V" else SUF_PREP if pos in ("R", "T") else SUF_NOUN
    return tab.get(p, "")
