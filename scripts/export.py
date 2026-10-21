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
import unicodedata
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


# Nomes das letras hebraicas que a BLIVRE põe no começo do versículo nos acrósticos (Salmo 119…): "Álefe :Bem-aventurados".
# No app viram título da seção (campo "h") e saem do texto do versículo.
HEB_LETTERS = [
    "Álefe",
    "Bete",
    "Guímel",
    "Dálete",
    "Hê",
    "Vau",
    "Záin",
    "Hete",
    "Tete",
    "Iode",
    "Cafe",
    "Lâmede",
    "Mem",
    "Nun",
    "Sâmeque",
    "Áin",
    "Pê",
    "Tsadê",
    "Cofe",
    "Rexe",
    "Xin",
    "Tau",
]
LETTER_HEAD = re.compile(r"^\s*(" + "|".join(map(re.escape, HEB_LETTERS)) + r")\s*:\s*")
# Palavras da BLIVRE para a busca: o mesmo critério do alinhamento (scripts/make_glosses.py)
TOKEN_PT = re.compile(r"[^\W_]+(?:[’'][^\W_]+)?", re.U)


def split_heading(text):
    """'Álefe :Bem-aventurados…' → ('Álefe', 'Bem-aventurados…', 8). Sem título: (None, text, 0)."""
    m = LETTER_HEAD.match(text or "")
    if not m:
        return None, text, 0
    return m.group(1), text[m.end() :], m.end()


def search_norm(word):
    """Forma da busca: minúsculas, sem acentos (amor = Amor; "fe" acha "fé")."""
    nfd = unicodedata.normalize("NFD", word.lower().replace("’", "'"))
    return "".join(c for c in nfd if not unicodedata.combining(c))


def conc_bucket(key):
    """Arquivo da concordância de uma chave Strong: H1234 → H12, G25 → G0; partículas e lemas sem Strong → Hx/Gx."""
    m = re.match(r"^([HG])(\d+)$", key or "")
    return f"{m.group(1)}{int(m.group(2)) // 100}" if m else f"{(key or 'G')[0]}x"


def b36(n):
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while True:
        n, r = divmod(n, 36)
        out = digits[r] + out
        if not n:
            return out


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
    book_index = {row[0]: i for i, row in enumerate(BOOKS)}
    # concordância: chave Strong → ocorrências (livro, capítulo, versículo, palavra, glosa)
    concordance = defaultdict(list)
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
        if entry_key:
            concordance[entry_key].append((book_index[b], c, v, len(words[(b, c)][v]), gloss or ""))
        words[(b, c)][v].append((pid, w))
    # ligação palavra ↔ português: trechos da BLIVRE alinhados a cada palavra (tabela de scripts/make_glosses.py)
    has_alignment = db.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='alignment'").fetchone()[0]
    align = {pid: [int(x) for x in s.split(",")] for pid, s in db.execute("SELECT word_id, spans FROM alignment")} if has_alignment else {}

    def chapter(b, c):
        vs = []
        ids = {}
        for v in sorted(set(texts[(b, c)]) | set(words[(b, c)])):
            t, ed, note = texts[(b, c)].get(v, ("", None, "sem-blivre"))
            heading, t, cut = split_heading(t)
            ws = words[(b, c)].get(v, [])
            links = []
            for i, (pid, _) in enumerate(ws):
                ids[pid] = (v, i)
                spans = [x - cut for x in align.get(pid, [])]
                pairs = [(spans[k], spans[k + 1]) for k in range(0, len(spans), 2) if spans[k] >= 0]
                if pairs:
                    links.append([i] + [x for p in pairs for x in p])
            item = {"n": v, "b": t, "w": [w for _, w in ws]}
            if heading:
                item["h"] = heading
            if links:
                item["a"] = links
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
    write_concordance(concordance)
    write_search_index(texts, book_index)


def write_concordance(concordance):
    """dados/conc/<grupo>.js: cada chave Strong com as glosas usadas ("g") e as ocorrências ("o"), cinco números
    por ocorrência: livro (posição 0–65), capítulo, versículo, palavra no versículo e índice da glosa em "g"."""
    buckets = defaultdict(dict)
    for key, occ in concordance.items():
        glosses = [g for g, _ in Counter(o[4] for o in occ).most_common()]
        gi = {g: i for i, g in enumerate(glosses)}
        flat = [x for b, c, v, i, g in occ for x in (b, c, v, i, gi[g])]
        buckets[conc_bucket(key)][key] = {"g": glosses, "o": flat}
    os.makedirs(os.path.join(WEB, "conc"), exist_ok=True)
    for name, d in buckets.items():
        body = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
        Path(os.path.join(WEB, "conc", f"{name}.js")).write_text(f"__conc({json.dumps(name)},{body});", encoding="utf8")
    print(f"concordância: {len(concordance)} chaves em {len(buckets)} arquivos → {os.path.join(WEB, 'conc')}")


def write_search_index(texts, book_index):
    """dados/busca/<2 letras>.js: palavra da BLIVRE (sem acento, minúscula) → versículos onde aparece.
    Cada versículo é livro*1.000.000 + capítulo*1.000 + versículo, em ordem, gravado como diferença do anterior em base 36."""
    postings = defaultdict(set)
    for (b, c), vs in texts.items():
        for v, (t, _ed, _note) in vs.items():
            _h, t, _cut = split_heading(t)
            vid = book_index[b] * 1_000_000 + c * 1000 + v
            for m in TOKEN_PT.finditer(t or ""):
                postings[search_norm(m.group(0))].add(vid)
    buckets = defaultdict(dict)
    for word, ids in postings.items():
        prev, out = 0, []
        for x in sorted(ids):
            out.append(b36(x - prev))
            prev = x
        buckets[word[:2]][word] = ",".join(out)
    os.makedirs(os.path.join(WEB, "busca"), exist_ok=True)
    for name, d in buckets.items():
        body = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
        fname = "".join(ch if ch.isalnum() and ch.isascii() else f"_{ord(ch):x}" for ch in name)
        Path(os.path.join(WEB, "busca", f"{fname}.js")).write_text(f"__busca({json.dumps(name)},{body});", encoding="utf8")
    print(f"busca: {len(postings)} palavras em {len(buckets)} arquivos → {os.path.join(WEB, 'busca')}")


if __name__ == "__main__":
    main(sys.argv[1:])
