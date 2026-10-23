"""The marks: each one has the code of the catalog (docs/REVISOES.md), a level and a message.

A message is a key and its params: the text comes from the "review" section of the app locale
(src/i18n/locales/pt-BR.json), the same one the app shows; report.md is written with it."""

import json
import re
from functools import cache

from interlinear.paths import ROOT

LOCALE = ROOT / "src" / "i18n" / "locales" / "pt-BR.json"


@cache
def templates() -> dict[str, str]:
    return json.loads(LOCALE.read_text(encoding="utf8"))["review"]


def render(key, params):
    """The text of a message, as t() of the app makes it: {name} becomes the param (a missing one stays)."""
    return re.sub(r"\{(\w+)\}", lambda m: params.get(m[1], m[0]), templates()[key])


# ------------------------------------------------------------------ marcas
class Marks:
    def __init__(self, book_scope):
        self.lst = []
        self.book_scope = book_scope
        self.seen = set()

    def inside(self, book, cap):
        lv, cp = self.book_scope
        return (lv is None or book == lv) and (cp is None or cap == cp)

    def add(self, book, cap, vers, pid, code, level, key, **params):
        if not self.inside(book, cap):
            return
        params = {k: str(v) for k, v in params.items()}
        msg = render(key, params)
        k = (pid, code, book, cap, vers, msg if pid is None else "")
        if k in self.seen:
            return
        self.seen.add(k)
        self.lst.append(
            {
                "book": book,
                "chapter": cap,
                "verse": vers,
                "word_id": pid,
                "code": code,
                "level": level,
                "key": key,
                "params": params,
                "msg": msg,
            }
        )

    def w(self, w, code, level, key, **params):
        self.add(w.book, w.chapter, w.verse, w.id, code, level, key, **params)


def ref(w):
    return f"{w.book} {w.chapter}:{w.verse}"
