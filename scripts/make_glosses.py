#!/usr/bin/env python3
"""Glosas em português para cada palavra hebraica, aramaica e grega, por alinhamento com a BLIVRE.

1. Cada palavra original vira uma sequência de unidades (prefixos, raiz, sufixos pronominais).
2. O eflomal (aligner estatístico, licença GPL, usado só como ferramenta) alinha as unidades
   às palavras da BLIVRE, nos dois sentidos; as duas direções são combinadas (grow-diag-final-and).
3. A glosa de cada palavra é o trecho da BLIVRE alinhado a ela, na ordem do português.
   Sem alinhamento, entra a tradução mais frequente da mesma raiz (fonte "lexico"),
   ou uma regra fixa (artigo grego, partícula de objeto hebraica…).
4. As glosas revisadas à mão (data/glosses_pt.tsv, Gênesis 1) têm prioridade.

Grava em build/biblia.sqlite: palavras.glosa, palavras.glosa_fonte e a tabela traducoes
("como a BLIVRE traduz" cada verbete).

Uso: python3 scripts/make_glosses.py
"""

import os
import sqlite3
import sys
from collections import Counter, defaultdict

from interlinear.cli import parser
from interlinear.glosses.adjust import apply_manual, final_adjustments, load_lexicon
from interlinear.glosses.align import TMP, align_corpus
from interlinear.glosses.compose import assemble, complete, compose
from interlinear.glosses.corrections import apply_corrections
from interlinear.paths import DB


def main():
    parser(__doc__).parse_args()
    db = sqlite3.connect(DB)
    db.execute("DROP TABLE IF EXISTS traducoes")
    db.execute("DROP TABLE IF EXISTS translations")
    db.execute("CREATE TABLE translations(entry_key TEXT, translation TEXT, n INTEGER)")
    db.execute("DROP TABLE IF EXISTS alignment")
    db.execute("CREATE TABLE alignment(word_id INTEGER PRIMARY KEY, spans TEXT)")
    spans = {}
    total = Counter()
    for test, name in (("AT", "at"), ("NT", "nt")):
        item_list = assemble(db, test)
        links = align_corpus(item_list, name)
        res, counts, new_spans = compose(item_list, links)
        spans.update(new_spans)
        pref = complete(res, counts)
        lexicon = load_lexicon(db)
        texts = {(b, c, v): t or "" for b, c, v, t in db.execute("SELECT book, chapter, verse, blivre FROM verses")}
        print("  ajustes:", dict(final_adjustments(res, counts, pref, texts, lexicon)))
        if test == "AT":
            diffs = []
            n, equal, _ = apply_manual(db, res, diffs)
            if n:
                print(f"  Gênesis 1: {equal}/{n} glosas automáticas iguais às revisadas ({100 * equal / n:.0f}%)")
                with open(os.path.join(TMP, "gn1_diferencas.tsv"), "w", encoding="utf8") as f:
                    f.write("vers\thebraico\trevisada\tautomatica\tfonte\n")
                    for d in diffs:
                        f.write("\t".join(str(x) for x in d) + "\n")
        db.executemany("UPDATE words SET gloss = ?, gloss_source = ? WHERE id = ?", [(g, f, pid) for pid, g, f, _, _, _ in res])
        # "como a BLIVRE traduz": por chave de Strong (ou lema grego sem Strong)
        by_key = defaultdict(Counter)
        tok_key = {}
        for _pid, _g, _f, toks, r, _ in res:
            root_tok = next((t for tp, t in toks if tp == "raiz"), None)
            if root_tok:
                tok_key.setdefault(root_tok, r.strong or ("G:" + r.lemma if r.language == "G" else None))
        for tok, c in counts.items():
            if isinstance(tok, tuple):
                continue
            ch = tok_key.get(tok)
            if ch:
                for t, n in c.items():
                    by_key[ch][t.lower()] += n
        db.executemany("INSERT INTO translations VALUES (?,?,?)", [(ch, t, n) for ch, c in by_key.items() for t, n in c.most_common(12)])
        total.update(f for _, _, f, _, _, _ in res)
    db.executemany(
        "INSERT INTO alignment VALUES (?, ?)",
        [(pid, ",".join(f"{a},{b}" for a, b in sp)) for pid, sp in spans.items() if sp],
    )
    db.commit()
    print("glosas por fonte:", dict(total))
    apply_corrections(db)


if __name__ == "__main__":
    sys.exit(main())
