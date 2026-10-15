#!/usr/bin/env python3
"""Exporta o banco (build/biblia.sqlite) e os textos de data/ para os arquivos que o app lê.

build/web/dados/
  books.json             os 66 livros: nome, abreviação, capítulos (versículos, tema), introdução
  cap/<COD>/<n>.json      um capítulo: versículos, palavras, glosas e marcas da revisão automática
  lex/H.json, lex/G.json  léxico hebraico/aramaico e grego

Formato compacto de cada palavra: [texto, chave Strong, glosa, fonte da glosa, morfologia, lema].
Uso: python3 scripts/export.py [--preview ARQ.json COD.CAP ...]  (a prévia junta tudo num JSON só)
"""

import csv
import glob
import json
import os
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from books import BOOKS  # noqa: E402
from pronunciation import pron_greek, pron_hebrew  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB = os.path.join(ROOT, "build", "biblia.sqlite")
OUT = os.path.join(ROOT, "build", "data")  # JSON (lido pelo EPUB, PDF e pela página)
WEB = os.path.join(ROOT, "build", "web", "dados")  # .js carregados pelo site e pelo app
SHORT_SOURCE = {"alinhamento": "", "manual": "m", "revisada": "m", "lexico": "l", "regra": "r", "parcial": "p", "sem": "s"}
GROUPS = [  # agrupamento dos livros no índice
    ("Pentateuco", "GEN", "DEU"),
    ("Históricos", "JOS", "EST"),
    ("Poéticos e sapienciais", "JOB", "SNG"),
    ("Profetas", "ISA", "MAL"),
    ("Evangelhos e Atos", "MAT", "ACT"),
    ("Cartas de Paulo", "ROM", "PHM"),
    ("Outras cartas e Apocalipse", "HEB", "REV"),
]


def fmt_int(n):
    return f"{n:,}".replace(",", ".")


def read_lexicon_pt():
    pt = {}
    for fname in sorted(glob.glob(os.path.join(ROOT, "data", "lexicon_pt", "*.tsv"))):
        with open(fname, encoding="utf8") as f:
            for r in csv.DictReader(f, delimiter="\t"):
                pt[r["key"]] = (r["origin"], r["meaning"])
    return pt


def read_themes(cod):
    fname = os.path.join(ROOT, "data", "themes", f"{cod}.tsv")
    if not os.path.exists(fname):
        return {}
    with open(fname, encoding="utf8") as f:
        return {int(r["chapter"]): r["theme"] for r in csv.DictReader(f, delimiter="\t")}


def read_questions():
    """Perguntas ao texto (data/questions/<LIVRO>.tsv): {(livro, capítulo): [[tipo, pergunta, versículos, strong], ...]}."""
    out = defaultdict(list)
    for fname in sorted(glob.glob(os.path.join(ROOT, "data", "questions", "*.tsv"))):
        cod = os.path.basename(fname)[:-4]
        with open(fname, encoding="utf8") as f:
            for r in csv.DictReader(f, delimiter="\t"):
                out[(cod, int(r["chapter"]))].append([r["kind"], r["question"].strip(), r["verses"] or None, r["strong"] or None])
    return out


def read_marks():
    fname = os.path.join(ROOT, "build", "review", "marks.json")
    marks = defaultdict(list)
    if os.path.exists(fname):
        for m in json.loads(Path(fname).read_text(encoding="utf8")):
            if m["level"] in ("erro", "aviso") and not m["code"].startswith(("LEX", "LXG", "ARM", "FAT", "CRZ", "COB-02")):
                marks[(m["book"], m["chapter"])].append(m)
    return marks


def main(argv):
    db = sqlite3.connect(DB)
    preview = None
    if argv[:1] == ["--preview"]:
        preview = (argv[1], set(argv[2:]))
    lex_pt = read_lexicon_pt()
    # o significado em português também vai para o banco (usado pela revisão automática)
    db.executemany("UPDATE lexicon SET def_pt = ? WHERE entry_key = ?", [(sig, k) for k, (_, sig) in lex_pt.items()])
    db.commit()
    marks = read_marks()
    questions = read_questions()

    # ------------------------------------------------ livros
    books = []
    counts_v = defaultdict(dict)
    for cod, cap, n in db.execute("SELECT book, chapter, count(*) FROM verses WHERE verse > 0 GROUP BY book, chapter"):
        counts_v[cod][cap] = n
    group_of = {}
    order = [row[0] for row in BOOKS]
    for name, a, b in GROUPS:
        for c in order[order.index(a) : order.index(b) + 1]:
            group_of[c] = name
    for cod, osis, _t, _s, _m, name, abbrev in BOOKS:
        themes = read_themes(cod)
        caps = [{"n": c, "v": n, "t": themes.get(c, "")} for c, n in sorted(counts_v[cod].items())]
        about = None
        fname = os.path.join(ROOT, "data", "books", f"{cod}.json")
        if os.path.exists(fname):
            about = json.loads(Path(fname).read_text(encoding="utf8"))
            facts = [f for f in about.get("facts", []) if f[0] not in ("Capítulos", "Versículos")]
            facts[1:1] = [["Capítulos", str(len(caps))], ["Versículos", fmt_int(sum(c["v"] for c in caps))]]
            about["facts"] = facts
        books.append(
            {"code": cod, "name": name, "abbrev": abbrev, "nt": osis is None, "group": group_of[cod], "chapters": caps, "about": about}
        )

    # ------------------------------------------------ capítulos
    texts = defaultdict(dict)
    for b, c, v, t, ed, note in db.execute("SELECT book, chapter, verse, blivre, edition, note FROM verses"):
        texts[(b, c)][v] = (t, ed, note)
    words = defaultdict(lambda: defaultdict(list))
    usage = Counter()
    for pid, b, c, v, language, verse_text, lemma, strong, morph, gloss, source, ketiv in db.execute(
        "SELECT id, book, chapter, verse, language, text, lemma, strong, morph, gloss, gloss_source, ketiv FROM words "
        "ORDER BY book, chapter, verse, pos"
    ):
        entry_key = strong or ("G:" + lemma if language == "G" else None)
        usage[entry_key] += 1
        w = [verse_text, entry_key, gloss or "", SHORT_SOURCE.get(source, ""), morph or ""]
        if language == "G":
            w.append(lemma)
        elif ketiv:
            w += [None, ketiv]  # forma escrita (ketiv); o texto traz a forma lida (qere)
        words[(b, c)][v].append((pid, w))

    def chapter(b, c):
        vs = []
        ids = {}
        for v in sorted(set(texts[(b, c)]) | set(words[(b, c)])):
            t, ed, note = texts[(b, c)].get(v, ("", None, "sem-blivre"))
            ws = words[(b, c)].get(v, [])
            for i, (pid, _) in enumerate(ws):
                ids[pid] = (v, i)
            item = {"n": v, "b": t, "w": [w for _, w in ws]}
            if note:
                item["o"] = note
            vs.append(item)
        ms = []
        for m in marks.get((b, c), []):
            pos = ids.get(m.get("word_id"))
            ms.append([m["verse"], pos[1] if pos else None, m["level"][0], m["code"], m["msg"]])
        d = {"book": b, "chapter": c, "v": vs, "m": ms}
        if questions.get((b, c)):
            d["q"] = questions[(b, c)]
        return d

    # ------------------------------------------------ léxico
    translates = defaultdict(list)
    for ch, t, n in db.execute("SELECT entry_key, translation, n FROM translations ORDER BY entry_key, n DESC"):
        if len(translates[ch]) < 8:
            translates[ch].append(f"{t} ({n})")
    lex = {"H": {}, "G": {}}
    for entry_key, language, lemma, xlit, pron_en, deriv, definition, _kjv, gloss_en, def_pt in db.execute(
        "SELECT entry_key, language, lemma, xlit, pron_en, derivation_en, def_en, kjv_en, gloss_en, def_pt FROM lexicon"
    ):
        pt = lex_pt.get(entry_key)
        pron = (
            pron_hebrew(pron_en)
            if language == "H" and pron_en and entry_key[1:].isdigit()
            else (pron_en if language == "H" else pron_greek(lemma or ""))
        )
        e = {"l": lemma, "x": xlit, "p": pron, "n": usage.get(entry_key, 0)}
        if pt:
            e["o"], e["s"] = pt
        elif def_pt:
            e["o"], e["s"] = deriv, def_pt
        else:
            e["oe"], e["se"] = (deriv or "").strip(" ;"), (definition or "").strip(" ;")
            if gloss_en and language == "G":
                e["ge"] = gloss_en
        if translates.get(entry_key):
            e["t"] = "; ".join(translates[entry_key])
        lex[language][entry_key] = e
    # lemas gregos sem Strong
    for entry_key, n in usage.items():
        if entry_key and entry_key.startswith("G:"):
            lemma = entry_key[2:]
            lex["G"][entry_key] = {
                "l": lemma,
                "x": "",
                "p": pron_greek(lemma),
                "n": n,
                "se": "sem verbete no dicionário de Strong",
                "t": "; ".join(translates.get(entry_key, [])),
            }

    if preview:
        fname, selected = preview
        caps = {}
        used_keys = set()
        for ref in sorted(selected):
            b, c = ref.split(".")
            cap = chapter(b, int(c))
            caps[ref] = cap
            for v in cap["v"]:
                used_keys.update(w[1] for w in v["w"] if w[1])
        # verbetes citados na origem dos verbetes usados (para seguir a cadeia de derivação)
        more = set()
        for k in used_keys:
            e = lex["H"].get(k) or lex["G"].get(k) or {}
            more.update(re.findall(r"[HG]\d+", (e.get("o") or "") + (e.get("oe") or "")))
        all_keys = used_keys | more
        sub = {k: e for L in lex.values() for k, e in L.items() if k in all_keys}
        Path(fname).write_text(
            json.dumps({"books": books, "chapters": caps, "lex": sub, "complete": False}, ensure_ascii=False, separators=(",", ":")),
            encoding="utf8",
        )
        print(f"prévia: {len(caps)} capítulos, {len(sub)} verbetes → {fname} ({os.path.getsize(fname) // 1024} KB)")
        return

    import shutil

    shutil.rmtree(WEB, ignore_errors=True)
    os.makedirs(os.path.join(OUT, "lex"), exist_ok=True)
    os.makedirs(os.path.join(WEB, "lex"), exist_ok=True)
    Path(os.path.join(OUT, "books.json")).write_text(json.dumps(books, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    for L, d in lex.items():
        Path(os.path.join(OUT, "lex", f"{L}.json")).write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    # cópias em .js (funcionam abrindo o index.html direto do disco, onde o navegador bloqueia fetch)
    for L, d in lex.items():
        Path(os.path.join(WEB, "lex", f"{L}.js")).write_text(
            f"__lex({json.dumps(L)},{json.dumps(d, ensure_ascii=False, separators=(',', ':'))});", encoding="utf8"
        )
    n = 0
    for b, c in sorted(texts):
        os.makedirs(os.path.join(OUT, "cap", b), exist_ok=True)
        os.makedirs(os.path.join(WEB, "cap", b), exist_ok=True)
        cap = json.dumps(chapter(b, c), ensure_ascii=False, separators=(",", ":"))
        Path(os.path.join(OUT, "cap", b, f"{c}.json")).write_text(cap, encoding="utf8")
        Path(os.path.join(WEB, "cap", b, f"{c}.js")).write_text(f"__cap({json.dumps(b + '.' + str(c))},{cap});", encoding="utf8")
        n += 1
    print(f"{len(books)} livros, {n} capítulos, léxico H {len(lex['H'])} + G {len(lex['G'])} → {OUT} e {WEB}")


if __name__ == "__main__":
    main(sys.argv[1:])
