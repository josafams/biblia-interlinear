"""What the export reads besides the database: data/ (themes, questions, lexicon in Portuguese) and the review."""

import csv
import glob
import json
import os
from collections import defaultdict
from pathlib import Path

from interlinear.paths import ROOT
from interlinear.tsv import lexicon_pt


def read_lexicon_pt():
    """{key: (origin, meaning)} of data/lexicon_pt."""
    return {k: (r["origin"], r["meaning"]) for k, r in lexicon_pt().items()}


DATA_DIR = os.path.join(ROOT, "data")


def read_themes(code, folder=DATA_DIR):
    """{chapter: theme} of data/themes/<BOOK>.tsv (or of another folder with the same files: data/en)."""
    fname = os.path.join(folder, "themes", f"{code}.tsv")
    if not os.path.exists(fname):
        return {}
    with open(fname, encoding="utf8") as f:
        return {int(r["chapter"]): r["theme"] for r in csv.DictReader(f, delimiter="\t")}


def read_questions(folder=DATA_DIR):
    """Perguntas ao texto (data/questions/<BOOK>.tsv): {(book, chapter): [[kind, question, verses, strong], ...]}."""
    out = defaultdict(list)
    for fname in sorted(glob.glob(os.path.join(folder, "questions", "*.tsv"))):
        code = os.path.basename(fname)[:-4]
        with open(fname, encoding="utf8") as f:
            for r in csv.DictReader(f, delimiter="\t"):
                out[(code, int(r["chapter"]))].append([r["kind"], r["question"].strip(), r["verses"] or None, r["strong"] or None])
    return out


def read_marks():
    """The marks of the automatic review that the app shows (errors and warnings of some codes), by chapter."""
    fname = os.path.join(ROOT, "build", "review", "marks.json")
    marks = defaultdict(list)
    if os.path.exists(fname):
        for m in json.loads(Path(fname).read_text(encoding="utf8")):
            if m["level"] in ("erro", "aviso") and not m["code"].startswith(("LEX", "LXG", "ARM", "FAT", "CRZ", "COB-02")):
                marks[(m["book"], m["chapter"])].append(m)
    return marks
