#!/usr/bin/env python3
"""Revisões automáticas do catálogo docs/REVISOES.md sobre build/biblia.sqlite (só leitura).

Roda as verificações automatizáveis sem rede e sem IA: integridade do texto-base (comparando
com os arquivos de sources/, quando presentes), versificação, cobertura, gramática × glosa
(hebraico, aramaico e grego), consistência, léxico, nomes, números e cruzamentos entre passagens
paralelas. Cada marca tem o código do catálogo e um nível: 'erro', 'aviso' ou 'info'.

Saídas em build/review/: marks.json, summary.tsv, report.md; totais por código no terminal.

Uso: python3 scripts/review.py [LIVRO [CAP]]      (ex.: GEN · GEN 1 · JHN 3)
"""

import os
import sqlite3
import sys
import time
from collections import Counter

from interlinear.cli import parser
from interlinear.paths import DB, ROOT
from interlinear.review.checks.consistency import check_consistency, check_style
from interlinear.review.checks.coverage import check_coverage, check_lexicon
from interlinear.review.checks.crossings import check_bridges, check_greek_strong, check_parallels, check_support
from interlinear.review.checks.grammar_he import check_grammar_h, check_numbers_and_divine_names
from interlinear.review.checks.greek import check_greek
from interlinear.review.checks.names import check_names
from interlinear.review.checks.text import check_aramaic, check_base_text, check_unicode, check_verses_and_chapters
from interlinear.review.checks.versification import check_offset, check_versification
from interlinear.review.data import Data
from interlinear.review.marks import Marks
from interlinear.review.report import write_out
from interlinear.review.settings import OUT


def main(argv):
    ap = parser(__doc__)
    ap.add_argument("book", nargs="?", type=str.upper, help="código do livro (GEN, JHN…); sem ele, a Bíblia inteira")
    ap.add_argument("chapter", nargs="?", type=int, help="só este capítulo do livro")
    args = ap.parse_args(argv)
    t0 = time.time()
    book, cap = args.book, args.chapter
    db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    d = Data(db)
    if book and book not in d.order:
        sys.exit(f"livro desconhecido: {book} (use os códigos de `query.py books`)")
    book_scope = (book, cap)
    M = Marks(book_scope)
    scope_books = {book} if book else set(d.order)
    ws = [w for w in d.words if (book is None or w.book == book) and (cap is None or w.chapter == cap)]

    steps = [
        ("texto-base", lambda: check_base_text(d, M, scope_books)),
        ("unicode", lambda: check_unicode(d, M, ws)),
        ("versículos", lambda: check_verses_and_chapters(d, M, scope_books)),
        ("aramaico", lambda: check_aramaic(d, M, ws)),
        ("versificação", lambda: check_versification(d, M, scope_books)),
        ("deslocamento", lambda: check_offset(d, M, scope_books)),
        ("cobertura/léxico", lambda: check_lexicon(d, M, check_coverage(d, M, ws))),
        ("gramática hebraica", lambda: check_grammar_h(d, M, ws)),
        ("números e nomes divinos", lambda: check_numbers_and_divine_names(d, M, ws)),
        ("grego", lambda: (check_greek(d, M, ws), check_greek_strong(d, M, ws))),
        ("estilo", lambda: check_style(d, M, ws)),
        ("consistência", lambda: check_consistency(d, M, ws, scope_books)),
        ("nomes", lambda: check_names(d, M, ws, scope_books)),
        ("paralelos", lambda: check_parallels(d, M, scope_books)),
        ("pontes", lambda: check_bridges(d, M, scope_books)),
        ("apoio", lambda: check_support(d, M, ws)),
    ]
    times = []
    for name, f in steps:
        t = time.time()
        f()
        times.append((name, time.time() - t))
    by_code = write_out(M, d, book_scope, t0)
    print(f"{len(ws)} palavras revisadas em {time.time() - t0:.1f}s; {len(M.lst)} marcas → {os.path.relpath(OUT, ROOT)}/")
    if os.environ.get("REVISAR_TEMPOS"):
        for name, t in times:
            print(f"  {name:<26}{t:6.1f}s")
    print(f"{'código':<8} {'erro':>6} {'aviso':>6} {'info':>6}  {'% palavras':>10}")
    for cod in sorted(by_code):
        c = by_code[cod]
        pct = 100 * sum(c.values()) / max(1, len(ws))
        print(f"{cod:<8} {c['erro']:>6} {c['aviso']:>6} {c['info']:>6}  {pct:9.2f}%")
    tot = Counter()
    for c in by_code.values():
        tot.update(c)
    print(f"{'total':<8} {tot['erro']:>6} {tot['aviso']:>6} {tot['info']:>6}")


if __name__ == "__main__":
    main(sys.argv[1:])
