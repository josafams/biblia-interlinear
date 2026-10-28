"""books.json: the 66 books with the group of the index, the chapters (verse count, theme) and the introduction."""

import json
import os
from collections import defaultdict
from pathlib import Path

from interlinear.books import BOOKS
from interlinear.export.common import fmt_int
from interlinear.export.inputs import read_themes
from interlinear.paths import ROOT

GROUPS = [  # the groups of books in the index
    ("Pentateuco", "GEN", "DEU"),
    ("Históricos", "JOS", "EST"),
    ("Poéticos e sapienciais", "JOB", "SNG"),
    ("Profetas", "ISA", "MAL"),
    ("Evangelhos e Atos", "MAT", "ACT"),
    ("Cartas de Paulo", "ROM", "PHM"),
    ("Outras cartas e Apocalipse", "HEB", "REV"),
]


def with_counts(about, caps, labels=("Capítulos", "Versículos"), number=fmt_int):
    """The introduction with the chapter and verse counts as the second and third facts."""
    facts = [f for f in about.get("facts", []) if f[0] not in labels]
    facts[1:1] = [[labels[0], str(len(caps))], [labels[1], number(sum(c["v"] for c in caps))]]
    about["facts"] = facts
    return about


def build_books(db):
    counts_v = defaultdict(dict)
    for code, cap, n in db.execute("SELECT book, chapter, count(*) FROM verses WHERE verse > 0 GROUP BY book, chapter"):
        counts_v[code][cap] = n
    group_of = {}
    order = [row[0] for row in BOOKS]
    for name, a, b in GROUPS:
        for c in order[order.index(a) : order.index(b) + 1]:
            group_of[c] = name
    books = []
    for code, osis, _t, _s, _m, name, abbrev in BOOKS:
        themes = read_themes(code)
        caps = [{"n": c, "v": n, "t": themes.get(c, "")} for c, n in sorted(counts_v[code].items())]
        about = None
        fname = os.path.join(ROOT, "data", "books", f"{code}.json")
        if os.path.exists(fname):
            about = with_counts(json.loads(Path(fname).read_text(encoding="utf8")), caps)
        books.append(
            {"code": code, "name": name, "abbrev": abbrev, "nt": osis is None, "group": group_of[code], "chapters": caps, "about": about}
        )
    return books
