"""Where the export writes and the small helpers more than one output uses."""

import json
import os
import re
import unicodedata

from interlinear.paths import ROOT

OUT = os.path.join(ROOT, "build", "data")  # JSON (read by the EPUB, the PDF and the site build)
WEB = os.path.join(ROOT, "build", "web", "dados")  # .js loaded by the site and the app


def compact(d) -> str:
    """JSON without spaces, accents kept."""
    return json.dumps(d, ensure_ascii=False, separators=(",", ":"))


# Names of the Hebrew letters the Bíblia Livre puts at the start of the verse in the acrostics (Psalm 119…):
# "Álefe :Bem-aventurados". In the app they become the section title (field "h") and leave the verse text.
HEB_LETTERS = [
    "Álefe",
    "Bete",
    "Guímel",
    "Dálete",
    "Hê",
    "Vau",
    "Záin",
    "Hete",
    "Tete",
    "Iode",
    "Cafe",
    "Lâmede",
    "Mem",
    "Nun",
    "Sâmeque",
    "Áin",
    "Pê",
    "Tsadê",
    "Cofe",
    "Rexe",
    "Xin",
    "Tau",
]
LETTER_HEAD = re.compile(r"^\s*(" + "|".join(map(re.escape, HEB_LETTERS)) + r")\s*:\s*")


def split_heading(text):
    """'Álefe :Bem-aventurados…' → ('Álefe', 'Bem-aventurados…', 8). Without a title: (None, text, 0)."""
    m = LETTER_HEAD.match(text or "")
    if not m:
        return None, text, 0
    return m.group(1), text[m.end() :], m.end()


def search_norm(word):
    """The form of the search: lowercase, without accents (amor = Amor; "fe" finds "fé")."""
    nfd = unicodedata.normalize("NFD", word.lower().replace("’", "'"))
    return "".join(c for c in nfd if not unicodedata.combining(c))


def b36(n):
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while True:
        n, r = divmod(n, 36)
        out = digits[r] + out
        if not n:
            return out


def fmt_int(n):
    return f"{n:,}".replace(",", ".")
