#!/usr/bin/env python3
"""Consulta rápida ao corpus (build/biblia.sqlite), para quem escreve temas, introduções e revisões.

python3 scripts/query.py books                 # códigos, nomes, nº de capítulos e versículos
python3 scripts/query.py chapter EXO 3         # texto BLIVRE do capítulo, versículo a versículo
python3 scripts/query.py verses EXO 3:14        # um versículo (exato, para citar)
python3 scripts/query.py verses EXO 3:13-15     # intervalo dentro do capítulo
python3 scripts/query.py interlinear JHN 1:1    # posição, palavra original, Strong, glosa e de onde ela veio
python3 scripts/query.py entry H430           # verbete do léxico e em que arquivo ele está
python3 scripts/query.py words RUT 1           # palavras-chave do capítulo no original (substantivos, verbos, adjetivos)
"""

import sqlite3
import sys

from interlinear.paths import DB
from interlinear.tsv import lexicon_pt_files
from interlinear.tsv import rows as tsv_rows

# verbos e partículas muito comuns, que não rendem pergunta sobre a língua original
COMMON = {"H1961", "H559", "H3068", "H430", "H3605", "H834", "H3588", "H1697", "H6213", "H935", "H5414", "H3212", "H7200", "H8085"}
COMMON |= {"G1510", "G3004", "G2532", "G846", "G3588", "G1096", "G2192", "G4160", "G2064", "G3956", "G2316", "G2424", "G5547"}


def main_pos(morph):
    """Classe da palavra principal: N (substantivo), V (verbo), A (adjetivo), p (nome próprio) ou outra."""
    if not morph:
        return ""
    if morph.startswith("H") or morph.startswith("A"):  # hebraico (H) e aramaico (A) do morphhb: prefixos separados por /
        last = morph[1:].split("/")[-1]
        return "p" if last.startswith("Np") else last[:1]
    return morph[:1]


def print_key_words(db, book, chapter):
    """Palavras do original que mais aparecem no capítulo, para perguntas sobre a língua original."""
    found = {}
    for verse, strong, _text, gloss, morph, lemma in db.execute(
        "SELECT verse, strong, text, gloss, morph, lemma FROM words WHERE book=? AND chapter=? ORDER BY verse, pos", (book, chapter)
    ):
        pos = main_pos(morph)
        if not strong or strong in COMMON or pos not in ("N", "V", "A", "p"):
            continue
        k = found.setdefault(strong, {"pos": pos, "verses": [], "glosses": {}, "lemma": lemma})
        k["verses"].append(verse)
        k["glosses"][gloss] = k["glosses"].get(gloss, 0) + 1
    names = {"N": "substantivo", "V": "verbo", "A": "adjetivo", "p": "nome próprio"}
    for strong, k in sorted(found.items(), key=lambda x: -len(x[1]["verses"]))[:20]:
        row = db.execute("SELECT lemma, xlit, def_pt FROM lexicon WHERE entry_key=?", (strong,)).fetchone() or ("", "", "")
        vs = sorted(set(k["verses"]))
        gl = ", ".join(g for g, _ in sorted(k["glosses"].items(), key=lambda x: -x[1])[:4])
        meaning = (row[2] or "")[:90]
        print(f"{strong}\t{row[0]}\t{row[1]}\t{names[k['pos']]}\t{len(k['verses'])}x\tv. {','.join(map(str, vs))}\tglosas: {gl}\t{meaning}")


def main(argv):
    db = sqlite3.connect(DB)
    if not argv or argv[0] == "books":
        for cod, name, test in db.execute("SELECT code, name, testament FROM books ORDER BY book_order"):
            caps, vs = db.execute("SELECT count(DISTINCT chapter), count(*) FROM verses WHERE book=? AND verse>0", (cod,)).fetchone()
            print(f"{cod}\t{name}\t{test}\t{caps} capítulos\t{vs} versículos")
        return
    if argv[0] == "entry":
        k = argv[1].upper()
        e = db.execute("SELECT lemma, xlit, derivation_en, def_en FROM lexicon WHERE entry_key=?", (k,)).fetchone()
        print(f"{k}  {e[0]}  {e[1]}\n  inglês (Strong): {e[2]} | {e[3]}" if e else f"{k}: não existe no léxico")
        for fname in lexicon_pt_files():
            for n, r in tsv_rows(fname):
                if r["key"] == k:
                    print(f"  português: {r['origin']} | {r['meaning']}\n  editar em: data/lexicon_pt/{fname.name}, linha {n}")
        print(
            "  "  # noqa: S608 (consulta parametrizada)
            + "; ".join(
                f"{t} ({n})"
                for t, n in db.execute("SELECT translation, n FROM translations WHERE entry_key=? ORDER BY n DESC LIMIT 8", (k,))
            )
        )
        return
    cmd, book = argv[0], argv[1].upper()
    if cmd == "words":
        print_key_words(db, book, int(argv[2]))
        return
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
