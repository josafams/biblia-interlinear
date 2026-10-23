#!/usr/bin/env python3
"""Confere os arquivos editados à mão em data/ antes de um commit (e no GitHub, em cada pull request).

Não precisa do banco: valida formato, colunas, referências e números de capítulos.
Se build/biblia.sqlite existir, também confere as citações dos versículos-chave e as palavras
indicadas em data/corrections/glosses.tsv.

Uso: python3 scripts/check_data.py        (sai com código 1 se houver erro)
"""

import csv
import json
import os
import re
import sqlite3
import sys
from dataclasses import dataclass, field
from pathlib import Path

from interlinear.books import CHAPTERS
from interlinear.paths import DATA, DB, ROOT
from interlinear.text import letters_only

REF = re.compile(r"^([1-3A-Z]{3}) (\d+):(\d+)$")
VERSES = re.compile(r"^(\d+)(?:-(\d+))?$")
QUESTION_KINDS = ("observation", "interpretation", "application", "original")
REQUIRED_INTRO = ["title_orig", "summary", "facts", "structure", "people", "writing", "events", "key_verses"]
ERRATA_STATUS = ("relatar", "relatado", "corrigido-na-fonte")


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warns: list[str] = field(default_factory=list)

    def error(self, fname, msg):
        self.errors.append(f"{os.path.relpath(fname, ROOT)}: {msg}")


def tsv(R: Report, fname, columns):
    """[(line number, row)] of a table whose header starts with `columns`; empty lines are skipped."""
    with open(fname, encoding="utf8", newline="") as f:
        lines = list(csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE))
    if not lines or lines[0][: len(columns)] != columns:
        R.error(fname, f"cabeçalho deve ser: {' | '.join(columns)}")
        return []
    out = []
    for n, cells in enumerate(lines[1:], 2):
        if not any(c.strip() for c in cells):
            continue
        if len(cells) < len(lines[0]):
            cells = cells + [""] * (len(lines[0]) - len(cells))  # empty last columns may be missing
        if len(cells) != len(lines[0]):
            R.error(fname, f"linha {n}: {len(cells)} colunas (esperado {len(lines[0])}); tabulação a mais ou a menos?")
            continue
        out.append((n, dict(zip(lines[0], cells, strict=False))))
    return out


def check_themes(R: Report, data: Path):
    for code, n in CHAPTERS.items():
        fname = data / "themes" / f"{code}.tsv"
        if not fname.exists():
            R.error(fname, "arquivo faltando")
            continue
        lines = tsv(R, fname, ["chapter", "theme"])
        caps = [int(r["chapter"]) if r["chapter"].isdigit() else -1 for _, r in lines]
        if caps != list(range(1, n + 1)):
            R.error(fname, f"os capítulos devem ser 1 a {n}, um por linha, em ordem")
        for ln, r in lines:
            t = r["theme"].strip()
            if not t or t.endswith(".") or len(t.split()) > 10:
                R.error(fname, f"linha {ln}: tema vazio, com ponto final ou longo demais: {t!r}")


def check_intros(R: Report, data: Path):
    """The introductions (data/books/<BOOK>.json); returns them by book for the checks against the text."""
    intros = {}
    for code in CHAPTERS:
        fname = data / "books" / f"{code}.json"
        try:
            A = json.loads(fname.read_text(encoding="utf8"))
        except FileNotFoundError:
            R.error(fname, "arquivo faltando")
            continue
        except json.JSONDecodeError as e:
            R.error(fname, f"JSON inválido: {e}")
            continue
        intros[code] = A
        for k in REQUIRED_INTRO:
            if not A.get(k):
                R.error(fname, f"campo obrigatório vazio: {k}")
        for t in (A.get("events") or {}).get("timeline", []):
            if not isinstance(t.get("from"), int) or not isinstance(t.get("to"), int) or t["from"] > t["to"]:
                R.error(fname, f"linha do tempo: anos inválidos em {t.get('label')!r} (inteiros, negativos = a.C., from ≤ to)")
        for s in A.get("structure", []):
            for k in ("from", "to"):
                if s.get(k) and not 1 <= s[k] <= CHAPTERS[code]:
                    R.error(fname, f"estrutura: capítulo {s[k]} fora do livro em {s.get('title')!r}")
        for k in A.get("key_verses", []):
            if not re.match(r"^\d+:\d+([–-]\d+)?$", k.get("ref", "")):
                R.error(fname, f"versículo-chave com referência fora do formato 3:14 ou 3:14–16: {k.get('ref')!r}")
    return intros


def check_lexicon_pt(R: Report, data: Path):
    seen = {}
    for fname in sorted((data / "lexicon_pt").glob("*.tsv")):
        for ln, r in tsv(R, fname, ["key", "origin", "meaning"]):
            k = r["key"]
            if not re.match(r"^[HG]\d+$", k):
                R.error(fname, f"linha {ln}: chave inválida {k!r} (ex.: H430, G2316)")
            if k in seen:
                R.error(fname, f"linha {ln}: {k} repetido (também em {seen[k]})")
            seen[k] = fname.name
            if not r["meaning"].strip():
                R.error(fname, f"linha {ln}: {k} sem significado")


def check_questions(R: Report, data: Path):
    """Perguntas ao texto: 3 to 5 per chapter, without answers; returns the rows by book for the checks against the text."""
    questions = {}
    for code, n in CHAPTERS.items():
        fname = data / "questions" / f"{code}.tsv"
        if not fname.exists():
            continue  # books without questions yet (test_every_chapter_has_questions asks for the whole Bible)
        lines = tsv(R, fname, ["chapter", "kind", "verses", "strong", "question"])
        questions[code] = lines
        per_chapter = {}
        for ln, r in lines:
            if not r["chapter"].isdigit() or not 1 <= int(r["chapter"]) <= n:
                R.error(fname, f"linha {ln}: capítulo {r['chapter']!r} fora do livro (1 a {n})")
                continue
            per_chapter.setdefault(int(r["chapter"]), []).append(r["kind"])
            q = r["question"].strip()
            if r["kind"] not in QUESTION_KINDS:
                R.error(fname, f"linha {ln}: tipo {r['kind']!r} (use {', '.join(QUESTION_KINDS)})")
            if not q.endswith("?") or len(q) > 240:
                R.error(fname, f"linha {ln}: a pergunta deve terminar com ? e ter até 240 caracteres")
            if r["verses"] and not VERSES.match(r["verses"]):
                R.error(fname, f"linha {ln}: versículos {r['verses']!r} fora do formato 5 ou 5-8")
            if r["kind"] == "original" and not re.match(r"^[HG]\d+$", r["strong"]):
                R.error(fname, f"linha {ln}: pergunta sobre a língua original precisa do número Strong (ex.: H7725)")
            if r["kind"] != "original" and r["strong"]:
                R.error(fname, f"linha {ln}: só perguntas do tipo original levam número Strong")
        for c in range(1, n + 1):
            kinds = per_chapter.get(c, [])
            if not kinds:
                continue  # a chapter without questions yet: the reader just does not show the section
            if not 3 <= len(kinds) <= 5:
                R.error(fname, f"capítulo {c}: {len(kinds)} perguntas (devem ser de 3 a 5)")
            for k in ("observation", "interpretation", "application"):
                if k not in kinds:
                    R.error(fname, f"capítulo {c}: falta uma pergunta do tipo {k}")
    return questions


def check_gloss_corrections(R: Report, data: Path):
    """data/corrections/glosses.tsv; returns the rows to check against the words of the text."""
    fname = data / "corrections" / "glosses.tsv"
    corrections = []
    if not fname.exists():
        return corrections
    for ln, r in tsv(R, fname, ["ref", "pos", "original", "gloss", "reviewer", "note"]):
        m = REF.match(r["ref"].strip())
        if not m or m[1] not in CHAPTERS or not 1 <= int(m[2]) <= CHAPTERS[m[1]]:
            R.error(fname, f"linha {ln}: referência inválida {r['ref']!r} (ex.: JHN 1:1)")
            continue
        if not r["pos"].isdigit() or int(r["pos"]) < 1:
            R.error(fname, f"linha {ln}: posição deve ser um número a partir de 1")
            continue
        g = r["gloss"].strip()
        if not g or " " in g:
            R.error(fname, f"linha {ln}: glosa vazia ou com espaço (use hífen: junto-de)")
        if not r["original"].strip():
            R.warns.append(f"data/corrections/glosses.tsv: linha {ln}: sem a palavra original, a conferência não é feita")
        corrections.append((ln, m, r))
    return corrections


def check_errata(R: Report, data: Path):
    """data/corrections/blivre.tsv: typos found in the Bíblia Livre, to report to the translators."""
    fname = data / "corrections" / "blivre.tsv"
    if not fname.exists():
        return []
    lines = tsv(R, fname, ["ref", "snippet", "suggestion", "status", "note"])
    for ln, r in lines:
        m = REF.match(r["ref"].strip())
        if not m or m[1] not in CHAPTERS:
            R.error(fname, f"linha {ln}: referência inválida {r['ref']!r}")
        if r["status"] not in ERRATA_STATUS:
            R.error(fname, f"linha {ln}: status deve ser relatar, relatado ou corrigido-na-fonte")
    return lines


def check_rules(R: Report, data: Path):
    """data/rules/: the word tables of the review and the glosses (no repeated word in a class, no repeated form)."""
    for name, columns, unique in [
        ("pt_words.tsv", ["class", "word"], ("class", "word")),
        ("pt_irregular_verbs.tsv", ["family", "form"], ("family", "form")),
        ("pt_synonyms.tsv", ["words"], ("words",)),
        ("rare_glosses.tsv", ["en", "pt"], ("en",)),
    ]:
        fname = data / "rules" / name
        if not fname.exists():
            R.error(fname, "arquivo faltando")
            continue
        text = [ln for ln in fname.read_text(encoding="utf8").splitlines(keepends=True) if not ln.startswith("#")]
        rows = list(csv.reader(text, delimiter="\t", quoting=csv.QUOTE_NONE))
        if not rows or rows[0] != columns:
            R.error(fname, f"cabeçalho deve ser: {' | '.join(columns)}")
            continue
        seen = set()
        for cells in rows[1:]:
            r = dict(zip(columns, cells, strict=False))
            if len(cells) != len(columns) or not all(c.strip() for c in cells):
                R.error(fname, f"linha incompleta: {cells}")
                continue
            k = tuple(r[c] for c in unique)
            if k in seen:
                R.error(fname, f"repetido: {' '.join(k)}")
            seen.add(k)


def check_against_text(R: Report, db, data: Path, intros, questions, corrections, errata):
    """What needs build/biblia.sqlite: the words of the corrections, the key verses, the verses and Strong numbers
    of the questions and the snippets of the errata."""
    file_g = data / "corrections" / "glosses.tsv"
    for ln, m, r in corrections:
        wds = db.execute(
            "SELECT text FROM words WHERE book=? AND chapter=? AND verse=? ORDER BY pos", (m[1], int(m[2]), int(m[3]))
        ).fetchall()
        i = int(r["pos"]) - 1
        if not 0 <= i < len(wds):
            R.error(file_g, f"linha {ln}: {r['ref']} tem {len(wds)} palavras; não há a posição {r['pos']}")
        elif r["original"].strip() and letters_only(r["original"]) != letters_only(wds[i][0]):
            R.error(file_g, f"linha {ln}: em {r['ref']} a palavra {r['pos']} é {wds[i][0]}, não {r['original']}")
    for code, A in intros.items():
        for k in A.get("key_verses", []):
            mm = re.match(r"^(\d+):(\d+)(?:[–-](\d+))?$", k.get("ref", ""))
            if not mm:
                continue
            c, a, b = int(mm[1]), int(mm[2]), int(mm[3] or mm[2])
            txt = " ".join(
                t
                for (t,) in db.execute(
                    "SELECT blivre FROM verses WHERE book=? AND chapter=? AND verse BETWEEN ? AND ? ORDER BY verse", (code, c, a, b)
                )
            )
            if " ".join(k.get("text", "").split()) not in " ".join(txt.split()):
                R.warns.append(f"data/books/{code}.json: versículo-chave {k['ref']} não confere com a BLIVRE")
    for code, lines in questions.items():
        fname = data / "questions" / f"{code}.tsv"
        for ln, r in lines:
            if not r["chapter"].isdigit():
                continue
            c = int(r["chapter"])
            last = db.execute("SELECT max(verse) FROM verses WHERE book=? AND chapter=?", (code, c)).fetchone()[0] or 0
            m = VERSES.match(r["verses"] or "")
            if m and not 1 <= int(m[1]) <= int(m[2] or m[1]) <= last:
                R.error(fname, f"linha {ln}: {code} {c} tem {last} versículos; {r['verses']} não existe")
            if r["kind"] == "original" and r["strong"]:
                where = [
                    v
                    for (v,) in db.execute(
                        "SELECT DISTINCT verse FROM words WHERE book=? AND chapter=? AND strong=?", (code, c, r["strong"])
                    )
                ]
                if not where:
                    R.error(fname, f"linha {ln}: {r['strong']} não aparece em {code} {c}")
                elif m and not any(int(m[1]) <= v <= int(m[2] or m[1]) for v in where):
                    R.error(fname, f"linha {ln}: {r['strong']} não aparece nos versículos {r['verses']} (aparece em {where[:8]})")
    for ln, r in errata:
        m = REF.match(r["ref"].strip())
        if m and r["status"] == "relatar":
            t = db.execute("SELECT blivre FROM verses WHERE book=? AND chapter=? AND verse=?", (m[1], int(m[2]), int(m[3]))).fetchone()
            if t and r["snippet"].strip() and r["snippet"].strip() not in t[0]:
                R.warns.append(f"data/corrections/blivre.tsv: linha {ln}: {r['snippet']!r} não aparece em {r['ref']}")


def check_all(data: Path = DATA, db_path: Path = DB) -> Report:
    R = Report()
    check_themes(R, data)
    intros = check_intros(R, data)
    check_lexicon_pt(R, data)
    questions = check_questions(R, data)
    corrections = check_gloss_corrections(R, data)
    errata = check_errata(R, data)
    check_rules(R, data)
    if os.path.exists(db_path):
        check_against_text(R, sqlite3.connect(db_path), data, intros, questions, corrections, errata)
    else:
        R.warns.append("build/biblia.sqlite não existe: conferências contra o texto foram puladas")
    return R


def main() -> int:
    R = check_all()
    for a in R.warns:
        print("aviso:", a)
    for e in R.errors:
        print("ERRO:", e)
    print(f"{len(R.errors)} erro(s), {len(R.warns)} aviso(s)")
    return 1 if R.errors else 0


if __name__ == "__main__":
    sys.exit(main())
