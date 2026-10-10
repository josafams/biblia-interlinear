#!/usr/bin/env python3
"""Consulta rápida ao corpus (saida/biblia.sqlite), para quem escreve temas, introduções e revisões.

  python3 scripts/consulta.py livros                 # códigos, nomes, nº de capítulos e versículos
  python3 scripts/consulta.py capitulo EXO 3         # texto BLIVRE do capítulo, versículo a versículo
  python3 scripts/consulta.py versos EXO 3:14        # um versículo (exato, para citar)
  python3 scripts/consulta.py versos EXO 3:13-15     # intervalo dentro do capítulo
  python3 scripts/consulta.py interlinear JHN 1:1    # palavra original, Strong e glosa
"""
import os
import sqlite3
import sys

DB = os.path.join(os.path.dirname(__file__), "..", "saida", "biblia.sqlite")


def main(argv):
    db = sqlite3.connect(DB)
    if not argv or argv[0] == "livros":
        for cod, nome, test in db.execute("SELECT codigo, nome, testamento FROM livros ORDER BY ordem"):
            caps, vs = db.execute("SELECT count(DISTINCT cap), count(*) FROM versos WHERE livro=? AND vers>0",
                                  (cod,)).fetchone()
            print(f"{cod}\t{nome}\t{test}\t{caps} capítulos\t{vs} versículos")
        return
    cmd, livro = argv[0], argv[1].upper()
    if cmd == "capitulo":
        for v, t, nota in db.execute("SELECT vers, blivre, nota FROM versos WHERE livro=? AND cap=? ORDER BY vers",
                                     (livro, int(argv[2]))):
            print(f"{v}\t{t}" + (f"   [{nota}]" if nota else ""))
    elif cmd in ("versos", "interlinear"):
        c, vv = argv[2].split(":")
        a, _, b = vv.partition("-")
        a, b = int(a), int(b or a)
        for v, t in db.execute("SELECT vers, blivre FROM versos WHERE livro=? AND cap=? AND vers BETWEEN ? AND ? "
                               "ORDER BY vers", (livro, int(c), a, b)):
            print(f"{c}:{v}\t{t}")
            if cmd == "interlinear":
                for txt, st, g, f in db.execute("SELECT texto, strong, glosa, glosa_fonte FROM palavras WHERE livro=? "
                                                "AND cap=? AND vers=? ORDER BY pos", (livro, int(c), v)):
                    print(f"    {txt}\t{st}\t{g}\t({f})")
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
