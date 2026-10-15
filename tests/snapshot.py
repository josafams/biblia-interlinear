"""Retrato de referência das glosas: contagens e um resumo (hash) das glosas de cada livro.

O teste tests/test_data.py::test_retrato compara os dados atuais com tests/snapshot.json. Se uma mudança
alterar glosas sem querer, o teste falha e mostra os livros afetados. Se a mudança for de propósito
(uma correção em data/corrections, por exemplo), atualize o retrato e envie junto:

    python3 tests/snapshot.py --update
"""

import hashlib
import json
import os
import sqlite3
import sys
from pathlib import Path

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB = os.path.join(ROOT, "build", "biblia.sqlite")
SNAPSHOT_FILE = os.path.join(os.path.dirname(__file__), "snapshot.json")


def compute(db_path=DB):
    db = sqlite3.connect(db_path)
    r = {
        "versiculos": db.execute("SELECT count(*) FROM verses").fetchone()[0],
        "palavras": db.execute("SELECT count(*) FROM words").fetchone()[0],
        "livros": {},
    }
    for (book,) in db.execute("SELECT DISTINCT book FROM words ORDER BY book"):
        h = hashlib.sha256()
        n = 0
        for cap, vers, pos, verse_text, gloss in db.execute(
            "SELECT chapter, verse, pos, text, gloss FROM words WHERE book=? ORDER BY chapter, verse, pos", (book,)
        ):
            h.update(f"{cap}:{vers}:{pos}:{verse_text}:{gloss}\n".encode())
            n += 1
        r["livros"][book] = {"palavras": n, "glosas": h.hexdigest()[:16]}
    db.close()
    return r


if __name__ == "__main__":
    current = compute()
    if "--update" in sys.argv:
        Path(SNAPSHOT_FILE).write_text(json.dumps(current, indent=1, sort_keys=True), encoding="utf8")
        print(f"retrato atualizado: {SNAPSHOT_FILE}")
    else:
        ref = json.loads(Path(SNAPSHOT_FILE).read_text(encoding="utf8"))
        diff = [bk for bk in current["livros"] if ref["livros"].get(bk) != current["livros"][bk]]
        print("igual ao retrato" if not diff and ref["palavras"] == current["palavras"] else f"mudaram: {diff}")
