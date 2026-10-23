"""The full output: build/data (JSON, for the EPUB, the PDF and the site build) and build/web/dados (.js the site and the
app load on demand)."""

import json
import os
import shutil
from pathlib import Path

from interlinear.export.common import OUT, WEB, compact


def write_site(books, chapters, lex):
    shutil.rmtree(WEB, ignore_errors=True)
    os.makedirs(os.path.join(OUT, "lex"), exist_ok=True)
    os.makedirs(os.path.join(WEB, "lex"), exist_ok=True)
    Path(os.path.join(OUT, "books.json")).write_text(compact(books), encoding="utf8")
    for L, d in lex.items():
        Path(os.path.join(OUT, "lex", f"{L}.json")).write_text(compact(d), encoding="utf8")
    # .js copies (they work opening the page from the disk, where the browser blocks fetch)
    for L, d in lex.items():
        Path(os.path.join(WEB, "lex", f"{L}.js")).write_text(f"__lex({json.dumps(L)},{compact(d)});", encoding="utf8")
    n = 0
    for b, c in sorted(chapters.texts):
        os.makedirs(os.path.join(OUT, "cap", b), exist_ok=True)
        os.makedirs(os.path.join(WEB, "cap", b), exist_ok=True)
        cap = compact(chapters.chapter(b, c))
        Path(os.path.join(OUT, "cap", b, f"{c}.json")).write_text(cap, encoding="utf8")
        Path(os.path.join(WEB, "cap", b, f"{c}.js")).write_text(f"__cap({json.dumps(b + '.' + str(c))},{cap});", encoding="utf8")
        n += 1
    print(f"{len(books)} livros, {n} capítulos, léxico H {len(lex['H'])} + G {len(lex['G'])} → {OUT} e {WEB}")
