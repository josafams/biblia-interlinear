"""Portuguese: the words of a gloss, stems, stop words and the verb forms the checks compare."""

from interlinear.rules import irregular_verbs, synonym_groups, word_classes
from interlinear.text import strip_marks


# ------------------------------------------------------------------ português
def toks(gloss):
    return [t for t in (gloss or "").lower().split("-") if t]


# the classes of words, from data/rules/pt_words.tsv
_C = word_classes()
ARTICLES = set(_C["article"])
DETERMINERS = ARTICLES | _C["determiner"]
PREPOSITIONS = set(_C["preposition"])
CONTRACTIONS = set(_C["contraction"])
CONJUNCTIONS = set(_C["conjunction"])
PRON = {k: set(_C["pron_" + k]) for k in ("1s", "1p", "2s", "2p", "3")}
PRON_AMBIG = set(_C["pron_ambiguous"])
PRON_ALL = set().union(*PRON.values()) | PRON_AMBIG
STOP = DETERMINERS | PREPOSITIONS | CONTRACTIONS | CONJUNCTIONS | PRON_ALL | {"não"}
NEGATION = set(_C["negation"])
NUMBERS = set(_C["number"])
STRONG_NUMBERS = NUMBERS - {"um", "uma"}
ORDINALS = set(_C["ordinal"])
ENGLISH = set(_C["english"])
# irregular verbs (data/rules/pt_irregular_verbs.tsv): each form points to its family (SER joins ser/estar/haver/ir)
IRREG_MAP = {}
for _k, _f in irregular_verbs():
    IRREG_MAP.setdefault(_f, _k)


def singular(t):
    if t.endswith("us"):
        return t
    for a, b in (("ões", "ão"), ("ães", "ão"), ("ãos", "ão"), ("ns", "m"), ("res", "r"), ("zes", "z"), ("ses", "s")):
        if t.endswith(a) and len(t) > len(a):
            return t[: -len(a)] + b
    if t.endswith("s") and len(t) > 3:
        return t[:-1]
    return t


def _root(t):
    t = t.lower()
    if t in IRREG_MAP:
        return IRREG_MAP[t]
    r = strip_marks(singular(t))[:4]  # prefixo: criou/criar/criado → cri; santo/santa → sant
    return r[:3] if len(r) == 4 and r[3] in "aeiou" else r


# synonyms the Bíblia Livre alternates for the same original word (data/rules/pt_synonyms.tsv)
_parent = {}


def _find(x):
    while _parent.get(x, x) != x:
        x = _parent[x]
    return x


for _group in synonym_groups():
    _rs = [_root(p) for p in _group]
    for _r in _rs[1:]:
        _parent[_find(_r)] = _find(_rs[0])
SIN_STEM = {r: _find(r).upper() for r in list(_parent) + [_find(r) for r in _parent]}


def stem(t):
    """Raiz aproximada de uma palavra portuguesa: verbos irregulares, plural, terminações verbais, sinônimos."""
    r = _root(t)
    return SIN_STEM.get(r, r)


def content(ts):
    return [t for t in ts if t not in STOP and not t.startswith("[")]


def content_stems(gloss):
    # a set: a Counter fed with it must get it sorted, or most_common breaks ties differently on each run
    return {stem(t) for t in content(toks(gloss))}
