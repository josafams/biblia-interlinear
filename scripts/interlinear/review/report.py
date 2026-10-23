"""The outputs in build/review: marks.json, summary.tsv and report.md."""

import json
import os
import time
from collections import Counter, defaultdict

from interlinear.review.settings import OUT


# ================================================================== saída
def write_out(M, d, book_scope, t0):
    os.makedirs(OUT, exist_ok=True)
    order = d.order
    marks = sorted(
        M.lst,
        key=lambda m: (order.get(m["book"], 999), m["chapter"], m["verse"] if m["verse"] is not None else 0, m["word_id"] or 0, m["code"]),
    )
    with open(os.path.join(OUT, "marks.json"), "w", encoding="utf8") as f:
        # each mark with its code, key and params; the text is the locale's (the app makes it with t())
        lines = (json.dumps({k: v for k, v in m.items() if k != "msg"}, ensure_ascii=False) for m in marks)
        f.write("[\n" + ",\n".join(lines) + "\n]\n")
    by_chapter = defaultdict(Counter)
    for m in marks:
        by_chapter[(m["book"], m["chapter"])][m["level"]] += 1
    with open(os.path.join(OUT, "summary.tsv"), "w", encoding="utf8") as f:
        f.write("livro\tcap\tn_erros\tn_avisos\tn_info\n")
        for b, c in sorted(by_chapter, key=lambda k: (order.get(k[0], 999), k[1])):
            n = by_chapter[(b, c)]
            f.write(f"{b}\t{c}\t{n['erro']}\t{n['aviso']}\t{n['info']}\n")
    by_code = defaultdict(Counter)
    examples = defaultdict(list)
    by_book = defaultdict(Counter)
    for m in marks:
        by_code[m["code"]][m["level"]] += 1
        by_book[m["book"]][m["level"]] += 1
        if len(examples[m["code"]]) < 3 and (not examples[m["code"]] or examples[m["code"]][-1]["book"] != m["book"] or len(marks) < 50):
            examples[m["code"]].append(m)
    for m in marks:  # completa exemplos quando o código só aparece num livro
        if len(examples[m["code"]]) < 3 and m not in examples[m["code"]]:
            examples[m["code"]].append(m)
    texts = {}
    pids = {m["word_id"] for es in examples.values() for m in es if m["word_id"]}
    for w in d.words:
        if w.id in pids:
            texts[w.id] = w
    abbrev = {r[1]: r[3] for r in d.books}
    esc = "Bíblia inteira" if book_scope == (None, None) else " ".join(str(x) for x in book_scope if x is not None)
    L = [
        f"# Relatório de revisão automática — {esc}",
        "",
        f"Gerado por `scripts/review.py` em {time.strftime('%Y-%m-%d %H:%M')} ({time.time() - t0:.0f}s). Catálogo: `docs/REVISOES.md`.",
        "",
        f"**Total:** {len(marks)} marcas — "
        f"{sum(c['erro'] for c in by_code.values())} erros, {sum(c['aviso'] for c in by_code.values())} avisos, "
        f"{sum(c['info'] for c in by_code.values())} informativas.",
        "",
        "## Totais por código",
        "",
        "| Código | Erros | Avisos | Info | Total |",
        "|---|---:|---:|---:|---:|",
    ]
    for cod in sorted(by_code):
        c = by_code[cod]
        L.append(f"| {cod} | {c['erro']} | {c['aviso']} | {c['info']} | {sum(c.values())} |")
    L += ["", "## Totais por livro", "", "| Livro | Erros | Avisos | Info |", "|---|---:|---:|---:|"]
    for b in sorted(by_book, key=lambda k: order.get(k, 999)):
        c = by_book[b]
        L.append(f"| {b} | {c['erro']} | {c['aviso']} | {c['info']} |")
    L += ["", "## Exemplos por código", ""]
    for cod in sorted(examples):
        L.append(f"### {cod}")
        L.append("")
        for m in examples[cod]:
            w = texts.get(m["word_id"])
            wd = f" — `{w.text}` ({w.strong}, {w.morph})" if w else ""
            L.append(f"- {abbrev.get(m['book'], m['book'])} {m['chapter']}:{m['verse']} [{m['level']}]{wd}: {m['msg']}")
        L.append("")
    with open(os.path.join(OUT, "report.md"), "w", encoding="utf8") as f:
        f.write("\n".join(L))
    return by_code
