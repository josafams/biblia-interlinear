"""The language of the glosses: the words and rules that depend on it. Portuguese glosses come from the Bíblia
Livre (the words table); English ones from the Berean Standard Bible (translated_glosses, for the app in English).

The rest of the pipeline (units, alignment, composition, names) is the same for both."""

import re
from collections.abc import Callable
from dataclasses import dataclass, field

from interlinear.glosses import fixed
from interlinear.glosses.portuguese import STOP_PT, contract


@dataclass(frozen=True)
class GlossLanguage:
    code: str
    stop: set[str]  # words that alone are not a translation of a content word (articles, prepositions…)
    verb_like: re.Pattern  # a word that looks like a verb, for the rescue of a verb that lost its links
    contract: Callable[[str], str]  # joins pieces as the language writes them (em-o → no)
    article_g: dict  # the Greek article by case, gender and number
    pre_h: dict  # the Hebrew prefixes (and, the, in, to…)
    suf_noun: dict
    suf_verb: dict
    suf_prep: dict
    directional: str  # he directional (-ah: toward)
    possessive_first: bool  # the possessive suffix goes before the noun ("his-house"), not after ("casa-dele")
    texts_sql: str  # the running text of each verse: book, chapter, verse, text
    lexicon_meaning: str  # the meaning used when nothing is aligned: "pt" (data/lexicon_pt) or "en" (Strong)
    portuguese_rules: bool = False  # YHWH "EU SOU", English → Portuguese rare words
    # מֵאָה (H3967) when nothing is aligned, by number (singular, plural, dual = 200). The most common translation
    # would be a whole number ("seiscentos"), wrong in every verse with another one.
    hundred: dict[str, str] = field(default_factory=lambda: {"s": "cem", "p": "centos", "d": "duzentos"})
    extra: dict = field(default_factory=dict)

    def suffix(self, tok, morph):
        """(text, before the root?) of a Hebrew suffix unit when nothing is aligned to it."""
        if tok == "s_d":
            return self.directional, False
        segs = morph[1:].split("/")
        root = [s for s in segs if not s.startswith("S")]
        pos = root[-1][:1] if root else ""
        tab = self.suf_verb if pos == "V" else self.suf_prep if pos in ("R", "T") else self.suf_noun
        return tab.get(tok[2:], ""), self.possessive_first and tab is self.suf_noun


PT = GlossLanguage(
    code="pt",
    stop=STOP_PT,
    verb_like=re.compile(r"(ndo|[aeiou]r|[aei]u|ou|[aeo]ram|am|em|va|vam|ia|iam|ado|ada|ido|ida)$"),
    contract=contract,
    article_g=fixed.ARTICLE_G,
    pre_h=fixed.PRE_H,
    suf_noun=fixed.SUF_NOUN,
    suf_verb=fixed.SUF_VERB,
    suf_prep=fixed.SUF_PREP,
    directional="para",
    possessive_first=False,
    texts_sql="SELECT book, chapter, verse, blivre FROM verses",
    lexicon_meaning="pt",
    portuguese_rules=True,
)

_YOU = {"2ms": "you", "2fs": "you", "2mp": "you", "2fp": "you"}
EN = GlossLanguage(
    code="en",
    stop={"the", "a", "an", "of", "to", "in", "and", "for", "with", "that", "on", "at", "by", "from", "as", "into", "upon", "unto"},
    verb_like=re.compile(r"(ed|ing|en|es|s)$"),
    contract=lambda g: g,
    article_g={k: "the" for k in fixed.ARTICLE_G},
    pre_h={"p_c": "and", "p_d": "the", "p_b": "in", "p_l": "to", "p_k": "like", "p_m": "from", "p_s": "who"},
    suf_noun={"1cs": "my", "3ms": "his", "3fs": "her", "1cp": "our", "3mp": "their", "3fp": "their"} | {k: "your" for k in _YOU},
    suf_verb={"1cs": "me", "3ms": "him", "3fs": "her", "1cp": "us", "3mp": "them", "3fp": "them"} | _YOU,
    suf_prep={"1cs": "me", "3ms": "him", "3fs": "her", "1cp": "us", "3mp": "them", "3fp": "them"} | _YOU,
    directional="toward",
    possessive_first=True,
    texts_sql="SELECT book, chapter, verse, text FROM translated_verses WHERE locale = 'en'",
    lexicon_meaning="en",
    hundred={"s": "hundred", "p": "hundreds", "d": "two-hundred"},
)
