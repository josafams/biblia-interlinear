#!/usr/bin/env python3
"""Confere os arquivos editados à mão em data/ antes de um commit (e no GitHub, em cada pull request).

Não precisa do banco: valida formato, colunas, referências e números de capítulos.
Se build/biblia.sqlite existir, também confere as citações dos versículos-chave e as palavras
indicadas em data/corrections/glosses.tsv.

Uso: python3 scripts/check_data.py        (sai com código 1 se houver erro)
"""

import csv
import glob
import json
import os
import re
import sqlite3
import sys
import unicodedata
from pathlib import Path

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
D = os.path.join(ROOT, "data")
# capítulos de cada livro, na numeração das Bíblias em português
CAPS = dict(
    GEN=50,
    EXO=40,
    LEV=27,
    NUM=36,
    DEU=34,
    JOS=24,
    JDG=21,
    RUT=4,
    **{"1SA": 31, "2SA": 24, "1KI": 22, "2KI": 25, "1CH": 29, "2CH": 36},
    EZR=10,
    NEH=13,
    EST=10,
    JOB=42,
    PSA=150,
    PRO=31,
    ECC=12,
    SNG=8,
    ISA=66,
    JER=52,
    LAM=5,
    EZK=48,
    DAN=12,
    HOS=14,
    JOL=3,
    AMO=9,
    OBA=1,
    JON=4,
    MIC=7,
    NAM=3,
    HAB=3,
    ZEP=3,
    HAG=2,
    ZEC=14,
    MAL=4,
    MAT=28,
    MRK=16,
    LUK=24,
    JHN=21,
    ACT=28,
    ROM=16,
    **{"1CO": 16, "2CO": 13},
    GAL=6,
    EPH=6,
    PHP=4,
    COL=4,
    **{"1TH": 5, "2TH": 3, "1TI": 6, "2TI": 4},
    TIT=3,
    PHM=1,
    HEB=13,
    JAS=5,
    **{"1PE": 5, "2PE": 3, "1JN": 5, "2JN": 1, "3JN": 1},
    JUD=1,
    REV=22,
)
REF = re.compile(r"^([1-3A-Z]{3}) (\d+):(\d+)$")
errors, warns = [], []


def error(fname, msg):
    errors.append(f"{os.path.relpath(fname, ROOT)}: {msg}")


def tsv(fname, columns):
    with open(fname, encoding="utf8", newline="") as f:
        lines = list(csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE))
    if not lines or lines[0][: len(columns)] != columns:
        error(fname, f"cabeçalho deve ser: {' | '.join(columns)}")
        return []
    out = []
    for n, cells in enumerate(lines[1:], 2):
        if not any(c.strip() for c in cells):
            continue
        if len(cells) < len(lines[0]):
            cells = cells + [""] * (len(lines[0]) - len(cells))  # colunas finais vazias podem faltar
        if len(cells) != len(lines[0]):
            error(fname, f"linha {n}: {len(cells)} colunas (esperado {len(lines[0])}); tabulação a mais ou a menos?")
            continue
        out.append((n, dict(zip(lines[0], cells, strict=False))))
    return out


def letters_only(t):
    return "".join(c for c in unicodedata.normalize("NFD", t or "") if unicodedata.category(c)[0] == "L").lower()


# temas dos capítulos
for cod, n in CAPS.items():
    fname = os.path.join(D, "themes", f"{cod}.tsv")
    if not os.path.exists(fname):
        error(fname, "arquivo faltando")
        continue
    lines = tsv(fname, ["chapter", "theme"])
    caps = [int(r["chapter"]) if r["chapter"].isdigit() else -1 for _, r in lines]
    if caps != list(range(1, n + 1)):
        error(fname, f"os capítulos devem ser 1 a {n}, um por linha, em ordem")
    for ln, r in lines:
        t = r["theme"].strip()
        if not t or t.endswith(".") or len(t.split()) > 10:
            error(fname, f"linha {ln}: tema vazio, com ponto final ou longo demais: {t!r}")

# introduções
REQUIRED = ["title_orig", "summary", "facts", "structure", "people", "writing", "events", "key_verses"]
intros = {}
for cod in CAPS:
    fname = os.path.join(D, "books", f"{cod}.json")
    try:
        A = json.loads(Path(fname).read_text(encoding="utf8"))
    except FileNotFoundError:
        error(fname, "arquivo faltando")
        continue
    except json.JSONDecodeError as e:
        error(fname, f"JSON inválido: {e}")
        continue
    intros[cod] = A
    for k in REQUIRED:
        if not A.get(k):
            error(fname, f"campo obrigatório vazio: {k}")
    for t in (A.get("events") or {}).get("timeline", []):
        if not isinstance(t.get("from"), int) or not isinstance(t.get("to"), int) or t["from"] > t["to"]:
            error(fname, f"linha do tempo: anos inválidos em {t.get('label')!r} (inteiros, negativos = a.C., from ≤ to)")
    for s in A.get("structure", []):
        for k in ("from", "to"):
            if s.get(k) and not 1 <= s[k] <= CAPS[cod]:
                error(fname, f"estrutura: capítulo {s[k]} fora do livro em {s.get('title')!r}")
    for k in A.get("key_verses", []):
        if not re.match(r"^\d+:\d+([–-]\d+)?$", k.get("ref", "")):
            error(fname, f"versículo-chave com referência fora do formato 3:14 ou 3:14–16: {k.get('ref')!r}")

# léxico em português
seen = {}
for fname in sorted(glob.glob(os.path.join(D, "lexicon_pt", "*.tsv"))):
    for ln, r in tsv(fname, ["key", "origin", "meaning"]):
        k = r["key"]
        if not re.match(r"^[HG]\d+$", k):
            error(fname, f"linha {ln}: chave inválida {k!r} (ex.: H430, G2316)")
        if k in seen:
            error(fname, f"linha {ln}: {k} repetido (também em {seen[k]})")
        seen[k] = os.path.basename(fname)
        if not r["meaning"].strip():
            error(fname, f"linha {ln}: {k} sem significado")

# perguntas ao texto (fase 8): 3 a 5 por capítulo, sem respostas
QUESTION_KINDS = ("observation", "interpretation", "application", "original")
VERSES = re.compile(r"^(\d+)(?:-(\d+))?$")
questions = {}  # cod -> [(linha, registro)], conferidas contra o banco mais abaixo
for cod, n in CAPS.items():
    fname = os.path.join(D, "questions", f"{cod}.tsv")
    if not os.path.exists(fname):
        continue  # livros ainda sem perguntas (o teste test_every_chapter_has_questions cobra a Bíblia inteira)
    lines = tsv(fname, ["chapter", "kind", "verses", "strong", "question"])
    questions[cod] = lines
    per_chapter = {}
    for ln, r in lines:
        if not r["chapter"].isdigit() or not 1 <= int(r["chapter"]) <= n:
            error(fname, f"linha {ln}: capítulo {r['chapter']!r} fora do livro (1 a {n})")
            continue
        per_chapter.setdefault(int(r["chapter"]), []).append(r["kind"])
        q = r["question"].strip()
        if r["kind"] not in QUESTION_KINDS:
            error(fname, f"linha {ln}: tipo {r['kind']!r} (use {', '.join(QUESTION_KINDS)})")
        if not q.endswith("?") or len(q) > 240:
            error(fname, f"linha {ln}: a pergunta deve terminar com ? e ter até 240 caracteres")
        if r["verses"] and not VERSES.match(r["verses"]):
            error(fname, f"linha {ln}: versículos {r['verses']!r} fora do formato 5 ou 5-8")
        if r["kind"] == "original" and not re.match(r"^[HG]\d+$", r["strong"]):
            error(fname, f"linha {ln}: pergunta sobre a língua original precisa do número Strong (ex.: H7725)")
        if r["kind"] != "original" and r["strong"]:
            error(fname, f"linha {ln}: só perguntas do tipo original levam número Strong")
    for c in range(1, n + 1):
        kinds = per_chapter.get(c, [])
        if not 3 <= len(kinds) <= 5:
            error(fname, f"capítulo {c}: {len(kinds)} perguntas (devem ser de 3 a 5)")
        for k in ("observation", "interpretation", "application"):
            if kinds and k not in kinds:
                error(fname, f"capítulo {c}: falta uma pergunta do tipo {k}")

# correções de glosa
file_g = os.path.join(D, "corrections", "glosses.tsv")
corrections = []
if os.path.exists(file_g):
    for ln, r in tsv(file_g, ["ref", "pos", "original", "gloss", "reviewer", "note"]):
        m = REF.match(r["ref"].strip())
        if not m or m[1] not in CAPS or not 1 <= int(m[2]) <= CAPS[m[1]]:
            error(file_g, f"linha {ln}: referência inválida {r['ref']!r} (ex.: JHN 1:1)")
            continue
        if not r["pos"].isdigit() or int(r["pos"]) < 1:
            error(file_g, f"linha {ln}: posição deve ser um número a partir de 1")
            continue
        g = r["gloss"].strip()
        if not g or " " in g:
            error(file_g, f"linha {ln}: glosa vazia ou com espaço (use hífen: junto-de)")
        if not r["original"].strip():
            warns.append(f"data/corrections/glosses.tsv: linha {ln}: sem a palavra original, a conferência não é feita")
        corrections.append((ln, m, r))

# erratas da BLIVRE
file_b = os.path.join(D, "corrections", "blivre.tsv")
if os.path.exists(file_b):
    for ln, r in tsv(file_b, ["ref", "snippet", "suggestion", "status", "note"]):
        m = REF.match(r["ref"].strip())
        if not m or m[1] not in CAPS:
            error(file_b, f"linha {ln}: referência inválida {r['ref']!r}")
        if r["status"] not in ("relatar", "relatado", "corrigido-na-fonte"):
            error(file_b, f"linha {ln}: status deve ser relatar, relatado ou corrigido-na-fonte")

# conferências que precisam do banco
DB = os.path.join(ROOT, "build", "biblia.sqlite")
if os.path.exists(DB):
    db = sqlite3.connect(DB)
    for ln, m, r in corrections:
        wds = db.execute(
            "SELECT text FROM words WHERE book=? AND chapter=? AND verse=? ORDER BY pos", (m[1], int(m[2]), int(m[3]))
        ).fetchall()
        i = int(r["pos"]) - 1
        if not 0 <= i < len(wds):
            error(file_g, f"linha {ln}: {r['ref']} tem {len(wds)} palavras; não há a posição {r['pos']}")
        elif r["original"].strip() and letters_only(r["original"]) != letters_only(wds[i][0]):
            error(file_g, f"linha {ln}: em {r['ref']} a palavra {r['pos']} é {wds[i][0]}, não {r['original']}")
    for cod, A in intros.items():
        for k in A.get("key_verses", []):
            mm = re.match(r"^(\d+):(\d+)(?:[–-](\d+))?$", k.get("ref", ""))
            if not mm:
                continue
            c, a, b = int(mm[1]), int(mm[2]), int(mm[3] or mm[2])
            txt = " ".join(
                t
                for (t,) in db.execute(
                    "SELECT blivre FROM verses WHERE book=? AND chapter=? AND verse BETWEEN ? AND ? ORDER BY verse", (cod, c, a, b)
                )
            )
            if " ".join(k.get("text", "").split()) not in " ".join(txt.split()):
                warns.append(f"data/books/{cod}.json: versículo-chave {k['ref']} não confere com a BLIVRE")
    for cod, lines in questions.items():
        fname = os.path.join(D, "questions", f"{cod}.tsv")
        for ln, r in lines:
            if not r["chapter"].isdigit():
                continue
            c = int(r["chapter"])
            last = db.execute("SELECT max(verse) FROM verses WHERE book=? AND chapter=?", (cod, c)).fetchone()[0] or 0
            m = VERSES.match(r["verses"] or "")
            if m and not 1 <= int(m[1]) <= int(m[2] or m[1]) <= last:
                error(fname, f"linha {ln}: {cod} {c} tem {last} versículos; {r['verses']} não existe")
            if r["kind"] == "original" and r["strong"]:
                where = [
                    v
                    for (v,) in db.execute(
                        "SELECT DISTINCT verse FROM words WHERE book=? AND chapter=? AND strong=?", (cod, c, r["strong"])
                    )
                ]
                if not where:
                    error(fname, f"linha {ln}: {r['strong']} não aparece em {cod} {c}")
                elif m and not any(int(m[1]) <= v <= int(m[2] or m[1]) for v in where):
                    error(fname, f"linha {ln}: {r['strong']} não aparece nos versículos {r['verses']} (aparece em {where[:8]})")
    if os.path.exists(file_b):
        for ln, r in tsv(file_b, ["ref", "snippet", "suggestion", "status", "note"]):
            m = REF.match(r["ref"].strip())
            if m and r["status"] == "relatar":
                t = db.execute("SELECT blivre FROM verses WHERE book=? AND chapter=? AND verse=?", (m[1], int(m[2]), int(m[3]))).fetchone()
                if t and r["snippet"].strip() and r["snippet"].strip() not in t[0]:
                    warns.append(f"data/corrections/blivre.tsv: linha {ln}: {r['snippet']!r} não aparece em {r['ref']}")
else:
    warns.append("build/biblia.sqlite não existe: conferências contra o texto foram puladas")

for a in warns:
    print("aviso:", a)
for e in errors:
    print("ERRO:", e)
print(f"{len(errors)} erro(s), {len(warns)} aviso(s)")
sys.exit(1 if errors else 0)
