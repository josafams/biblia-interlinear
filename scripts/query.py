#!/usr/bin/env python3
"""Consulta rápida ao corpus (build/biblia.sqlite), para quem escreve temas, introduções e revisões.

python3 scripts/query.py books                 # códigos, nomes, nº de capítulos e versículos
python3 scripts/query.py chapter EXO 3         # texto BLIVRE do capítulo, versículo a versículo
python3 scripts/query.py verses EXO 3:14        # um versículo (exato, para citar)
python3 scripts/query.py verses EXO 3:13-15     # intervalo dentro do capítulo
python3 scripts/query.py interlinear JHN 1:1    # posição, palavra original, Strong, glosa e de onde ela veio
python3 scripts/query.py entry H430           # verbete do léxico e em que arquivo ele está
"""

import os
import sqlite3
import sys

DB = os.path.join(os.path.dirname(__file__), "..", "build", "biblia.sqlite")


def main(argv):
    db = sqlite3.connect(DB)
    if not argv or argv[0] == "books":
        for cod, name, test in db.execute("SELECT code, name, testament FROM books ORDER BY book_order"):
            caps, vs = db.execute("SELECT count(DISTINCT chapter), count(*) FROM verses WHERE book=? AND verse>0", (cod,)).fetchone()
            print(f"{cod}\t{name}\t{test}\t{caps} capítulos\t{vs} versículos")
        return
    if argv[0] == "entry":
        import csv
        import glob

        k = argv[1].upper()
        e = db.execute("SELECT lemma, xlit, derivation_en, def_en FROM lexicon WHERE entry_key=?", (k,)).fetchone()
        print(f"{k}  {e[0]}  {e[1]}\n  inglês (Strong): {e[2]} | {e[3]}" if e else f"{k}: não existe no léxico")
        for fname in sorted(glob.glob(os.path.join(os.path.dirname(DB), "..", "data", "lexicon_pt", "*.tsv"))):
            with open(fname, encoding="utf8") as f:
                for n, r in enumerate(csv.DictReader(f, delimiter="\t"), 2):
                    if r["key"] == k:
                        print(
                            f"  português: {r['origin']} | {r['meaning']}\n  editar em: data/lexicon_pt/{os.path.basename(fname)}, linha {n}"
                        )
        print(
            "  "  # noqa: S608 (consulta parametrizada)
            + "; ".join(
                f"{t} ({n})"
                for t, n in db.execute("SELECT translation, n FROM translations WHERE entry_key=? ORDER BY n DESC LIMIT 8", (k,))
            )
        )
        return
    cmd, book = argv[0], argv[1].upper()
    if cmd == "chapter":
        for v, t, note in db.execute(
            "SELECT verse, blivre, note FROM verses WHERE book=? AND chapter=? ORDER BY verse", (book, int(argv[2]))
        ):
            print(f"{v}\t{t}" + (f"   [{note}]" if note else ""))
    elif cmd in ("verses", "interlinear"):
        c, vv = argv[2].split(":")
        a, _, b = vv.partition("-")
        a, b = int(a), int(b or a)
        for v, t in db.execute(
            "SELECT verse, blivre FROM verses WHERE book=? AND chapter=? AND verse BETWEEN ? AND ? ORDER BY verse", (book, int(c), a, b)
        ):
            print(f"{c}:{v}\t{t}")
            if cmd == "interlinear":
                rows = db.execute(
                    "SELECT text, strong, gloss, gloss_source FROM words WHERE book=? AND chapter=? AND verse=? ORDER BY pos",
                    (book, int(c), v),
                ).fetchall()
                for i, (txt, st, g, f) in enumerate(rows, 1):
                    print(f"  {i:>3}  {txt}\t{st}\t{g}\t({f})")
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
