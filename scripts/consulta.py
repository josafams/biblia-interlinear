#!/usr/bin/env python3
"""Consulta rápida ao corpus (saida/biblia.sqlite), para quem escreve temas, introduções e revisões.

python3 scripts/consulta.py livros                 # códigos, nomes, nº de capítulos e versículos
python3 scripts/consulta.py capitulo EXO 3         # texto BLIVRE do capítulo, versículo a versículo
python3 scripts/consulta.py versos EXO 3:14        # um versículo (exato, para citar)
python3 scripts/consulta.py versos EXO 3:13-15     # intervalo dentro do capítulo
python3 scripts/consulta.py interlinear JHN 1:1    # posição, palavra original, Strong, glosa e de onde ela veio
python3 scripts/consulta.py verbete H430           # verbete do léxico e em que arquivo ele está
"""

import os
import sqlite3
import sys

DB = os.path.join(os.path.dirname(__file__), "..", "saida", "biblia.sqlite")


def main(argv):
    db = sqlite3.connect(DB)
    if not argv or argv[0] == "livros":
        for cod, nome, test in db.execute("SELECT codigo, nome, testamento FROM livros ORDER BY ordem"):
            caps, vs = db.execute("SELECT count(DISTINCT cap), count(*) FROM versos WHERE livro=? AND vers>0", (cod,)).fetchone()
            print(f"{cod}\t{nome}\t{test}\t{caps} capítulos\t{vs} versículos")
        return
    if argv[0] == "verbete":
        import csv
        import glob

        k = argv[1].upper()
        e = db.execute("SELECT lema, xlit, derivacao_en, def_en FROM lexico WHERE chave=?", (k,)).fetchone()
        print(f"{k}  {e[0]}  {e[1]}\n  inglês (Strong): {e[2]} | {e[3]}" if e else f"{k}: não existe no léxico")
        for arq in sorted(glob.glob(os.path.join(os.path.dirname(DB), "..", "dados", "lexico_pt", "*.tsv"))):
            with open(arq, encoding="utf8") as f:
                for n, r in enumerate(csv.DictReader(f, delimiter="\t"), 2):
                    if r["chave"] == k:
                        print(
                            f"  português: {r['origem']} | {r['significado']}\n  editar em: dados/lexico_pt/{os.path.basename(arq)}, linha {n}"
                        )
        print(
            "  "  # noqa: S608 (consulta parametrizada)
            + "; ".join(
                f"{t} ({n})" for t, n in db.execute("SELECT traducao, n FROM traducoes WHERE chave=? ORDER BY n DESC LIMIT 8", (k,))
            )
        )
        return
    cmd, livro = argv[0], argv[1].upper()
    if cmd == "capitulo":
        for v, t, nota in db.execute("SELECT vers, blivre, nota FROM versos WHERE livro=? AND cap=? ORDER BY vers", (livro, int(argv[2]))):
            print(f"{v}\t{t}" + (f"   [{nota}]" if nota else ""))
    elif cmd in ("versos", "interlinear"):
        c, vv = argv[2].split(":")
        a, _, b = vv.partition("-")
        a, b = int(a), int(b or a)
        for v, t in db.execute(
            "SELECT vers, blivre FROM versos WHERE livro=? AND cap=? AND vers BETWEEN ? AND ? ORDER BY vers", (livro, int(c), a, b)
        ):
            print(f"{c}:{v}\t{t}")
            if cmd == "interlinear":
                rows = db.execute(
                    "SELECT texto, strong, glosa, glosa_fonte FROM palavras WHERE livro=? AND cap=? AND vers=? ORDER BY pos",
                    (livro, int(c), v),
                ).fetchall()
                for i, (txt, st, g, f) in enumerate(rows, 1):
                    print(f"  {i:>3}  {txt}\t{st}\t{g}\t({f})")
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
