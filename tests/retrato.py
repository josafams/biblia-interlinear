"""Retrato de referência das glosas: contagens e um resumo (hash) das glosas de cada livro.

O teste tests/test_dados.py::test_retrato compara os dados atuais com tests/retrato.json. Se uma mudança
alterar glosas sem querer, o teste falha e mostra os livros afetados. Se a mudança for de propósito
(uma correção em dados/correcoes, por exemplo), atualize o retrato e envie junto:

    python3 tests/retrato.py --atualizar
"""

import hashlib
import json
import os
import sqlite3
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB = os.path.join(ROOT, "saida", "biblia.sqlite")
ARQ = os.path.join(os.path.dirname(__file__), "retrato.json")


def calcular(db_path=DB):
    db = sqlite3.connect(db_path)
    r = {
        "versiculos": db.execute("SELECT count(*) FROM versos").fetchone()[0],
        "palavras": db.execute("SELECT count(*) FROM palavras").fetchone()[0],
        "livros": {},
    }
    for (livro,) in db.execute("SELECT DISTINCT livro FROM palavras ORDER BY livro"):
        h = hashlib.sha256()
        n = 0
        for cap, vers, pos, texto, glosa in db.execute(
            "SELECT cap, vers, pos, texto, glosa FROM palavras WHERE livro=? ORDER BY cap, vers, pos", (livro,)
        ):
            h.update(f"{cap}:{vers}:{pos}:{texto}:{glosa}\n".encode())
            n += 1
        r["livros"][livro] = {"palavras": n, "glosas": h.hexdigest()[:16]}
    db.close()
    return r


if __name__ == "__main__":
    atual = calcular()
    if "--atualizar" in sys.argv:
        json.dump(atual, open(ARQ, "w", encoding="utf8"), indent=1, sort_keys=True)
        print(f"retrato atualizado: {ARQ}")
    else:
        ref = json.load(open(ARQ, encoding="utf8"))
        dif = [l for l in atual["livros"] if ref["livros"].get(l) != atual["livros"][l]]
        print("igual ao retrato" if not dif and ref["palavras"] == atual["palavras"] else f"mudaram: {dif}")
