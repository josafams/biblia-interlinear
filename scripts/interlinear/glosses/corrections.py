"""Corrections of glosses made by reviewers (data/corrections/glosses.tsv), applied last."""

import csv
import os
import re

from interlinear.paths import ROOT
from interlinear.text import letters_only


def apply_corrections(db):
    """Correções de glosa feitas por revisores (data/corrections/glosses.tsv), aplicadas por último.

    Colunas: ref (ex.: "JHN 1:1"), pos (posição da palavra no versículo, contando de 1),
    original (a palavra no original, para conferência; vogais e acentos são ignorados),
    glosa (a nova glosa, palavras unidas por hífen), revisor, nota.
    Se a palavra naquela posição não for a indicada em "original", a linha é ignorada com aviso."""
    fname = os.path.join(ROOT, "data", "corrections", "glosses.tsv")
    if not os.path.exists(fname):
        return
    ok = errors = 0
    with open(fname, encoding="utf8") as f:
        lines = [r for r in csv.DictReader(f, delimiter="\t") if (r.get("ref") or "").strip() and not r["ref"].startswith("#")]
    for n, r in enumerate(lines, 2):
        m = re.match(r"\s*([1-3A-Z]{3})\s+(\d+):(\d+)\s*$", r["ref"])
        if not m or not (r.get("pos") or "").strip().isdigit() or not (r.get("gloss") or "").strip():
            print(f"  correções, linha {n}: referência, posição ou glosa inválida: {r}")
            errors += 1
            continue
        wds = db.execute(
            "SELECT id, text FROM words WHERE book=? AND chapter=? AND verse=? ORDER BY pos", (m[1], int(m[2]), int(m[3]))
        ).fetchall()
        i = int(r["pos"]) - 1
        if not 0 <= i < len(wds):
            print(f"  correções, linha {n}: {r['ref']} não tem palavra na posição {r['pos']} ({len(wds)} palavras)")
            errors += 1
            continue
        pid, verse_text = wds[i]
        if (r.get("original") or "").strip() and letters_only(r["original"]) != letters_only(verse_text):
            print(f"  correções, linha {n}: em {r['ref']} posição {r['pos']} está {verse_text}, não {r['original']}; ignorada")
            errors += 1
            continue
        db.execute("UPDATE words SET gloss = ?, gloss_source = 'revisada' WHERE id = ?", (r["gloss"].strip().replace(" ", "-"), pid))
        ok += 1
    db.commit()
    print(f"correções de glosa (data/corrections/glosses.tsv): {ok} aplicadas, {errors} com problema")
    return errors
