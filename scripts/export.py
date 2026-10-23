#!/usr/bin/env python3
"""Exporta o banco (build/biblia.sqlite) e os textos de data/ para os arquivos que o app lê.

build/web/dados/
  books.json             os 66 livros: nome, abreviação, capítulos (versículos, tema), introdução
  cap/<COD>/<n>.json      um capítulo: versículos, palavras, glosas e marcas da revisão automática
  lex/H.json, lex/G.json  léxico hebraico/aramaico e grego

Cada saída tem o seu módulo em scripts/interlinear/export/ (books, chapters, lexicon, concordance, search,
preview, site).
Uso: python3 scripts/export.py [--preview ARQ.json COD.CAP ...]  (a prévia junta tudo num JSON só)
"""

import sqlite3
import sys

from interlinear.cli import parser
from interlinear.export.books import build_books
from interlinear.export.chapters import Chapters
from interlinear.export.concordance import write_concordance
from interlinear.export.inputs import read_lexicon_pt, read_marks, read_questions
from interlinear.export.lexicon import build_lexicon
from interlinear.export.preview import write_preview
from interlinear.export.search import write_search_index
from interlinear.export.site import write_site
from interlinear.paths import DB


def main(argv):
    ap = parser(__doc__)
    ap.add_argument("--preview", nargs="+", metavar="ARQ.json COD.CAP", help="só a prévia: o arquivo e os capítulos (GEN.1 JHN.3…)")
    args = ap.parse_args(argv)
    if args.preview and len(args.preview) < 2:
        ap.error("--preview precisa do arquivo e de pelo menos um capítulo")
    db = sqlite3.connect(DB)
    preview = (args.preview[0], set(args.preview[1:])) if args.preview else None
    lex_pt = read_lexicon_pt()
    books = build_books(db)
    chapters = Chapters(db, read_marks(), read_questions())
    lex = build_lexicon(db, chapters.usage, lex_pt)
    if preview:
        return write_preview(*preview, books, chapters, lex)
    write_site(books, chapters, lex)
    write_concordance(chapters.concordance)
    write_search_index(chapters.texts, chapters.book_index)


if __name__ == "__main__":
    main(sys.argv[1:])
