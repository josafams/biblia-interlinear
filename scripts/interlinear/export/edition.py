"""The language of a book file (EPUB, PDF), #8: its words, from the app's locale file (src/i18n/locales/<locale>.json:
the "edition" section, and "morph" and "about" shared with the app), and its data: build/data in Portuguese; in
another language, with the layer of build/data/<lang> over it (running text, glosses, lexicon, chapter themes and
introductions), the same layer the reader puts over the Portuguese files.

use("en") picks the language of the files written next; t(key, name=…) is the app's t()."""

import copy
import json
import os
import re
from functools import cache
from pathlib import Path

from interlinear.export.common import OUT as DATA
from interlinear.paths import ROOT

LOCALES = {"pt": "pt-BR", "en": "en"}
_lang = "pt"


def use(lang):
    global _lang
    if lang not in LOCALES:
        raise SystemExit(f"language {lang!r}: one of {', '.join(LOCALES)}")
    _lang = lang


def lang():
    return _lang


def locale():
    return LOCALES[_lang]


def portuguese():
    return _lang == "pt"


@cache
def _messages(loc):
    return json.loads((ROOT / "src" / "i18n" / "locales" / f"{loc}.json").read_text(encoding="utf8"))


def lookup(key):
    node = _messages(locale())
    for part in key.split("."):
        node = node[part]
    return node


def t(key, **params):
    """The text of a key, as t() of the app makes it: {name} becomes the param (a missing one stays)."""
    return re.sub(r"\{(\w+)\}", lambda m: str(params.get(m[1], m[0])), lookup(key))


def _read(*parts):
    return json.loads(Path(os.path.join(*parts)).read_text(encoding="utf8"))


def books():
    """The 66 books in the language: name and group from the locale; chapter themes and introduction from the
    translated texts (a book without them has none, so an English file does not mix in Portuguese)."""
    out = _read(DATA, "books.json")
    if portuguese():
        return out
    out = copy.deepcopy(out)
    texts = _read(DATA, _lang, "livros.json")
    for b in out:
        b["name"] = lookup(f"books.{b['code']}.name")
        b["group"] = lookup(f"book_groups.{b['group']}")
        own = texts.get(b["code"], {})
        if own.get("about"):
            b["about"] = own["about"]
        else:
            b.pop("about", None)
        for c in b["chapters"]:
            if own.get("t", {}).get(str(c["n"])):
                c["t"] = own["t"][str(c["n"])]
            else:
                c.pop("t", None)
    return out


def lexicon():
    """Every entry (H and G); in another language its origin, meaning, pronunciation and translations come from
    the language's lexicon, over the Portuguese one."""
    lex = {}
    for L in "HG":
        lex.update(_read(DATA, "lex", f"{L}.json"))
        if not portuguese():
            for k, e in _read(DATA, _lang, "lex", f"{L}.json").items():
                if k in lex:
                    lex[k] = {**{f: v for f, v in lex[k].items() if f not in ("o", "oe", "s", "se", "ge", "t")}, **e}
    return lex


def chapter(code, n):
    """A chapter as build/data/cap has it; in another language each verse has the language's running text (b, h)
    and each word the language's gloss and its source."""
    d = _read(DATA, "cap", code, f"{n}.json")
    if portuguese():
        return d
    layer = {v["n"]: v for v in _read(DATA, _lang, "cap", code, f"{n}.json")["v"]}
    for v in d["v"]:
        own = layer.get(v["n"], {})
        v["b"] = own.get("b", "")
        if own.get("h"):
            v["h"] = own["h"]
        else:
            v.pop("h", None)
        glosses = own.get("g", [])
        for i, w in enumerate(v["w"]):
            g, source = glosses[i] if i < len(glosses) else ("", "")
            w[2], w[3] = g, source
    return d
