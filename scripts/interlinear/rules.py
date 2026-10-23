"""The word tables of data/rules/ (tab-separated; lines starting with # are comments): what the automatic review
and the glosses know about Portuguese."""

import csv
from collections import defaultdict
from functools import cache

from interlinear.paths import DATA

RULES = DATA / "rules"


def _rows(name: str) -> list[dict[str, str]]:
    with open(RULES / name, encoding="utf8", newline="") as f:
        lines = [ln for ln in f if not ln.startswith("#")]
    return list(csv.DictReader(lines, delimiter="\t", quoting=csv.QUOTE_NONE))


@cache
def word_classes() -> dict[str, frozenset[str]]:
    """pt_words.tsv: the words of each class ("article", "preposition", "pron_1s", "number", "english"…)."""
    out: dict[str, set[str]] = defaultdict(set)
    for r in _rows("pt_words.tsv"):
        out[r["class"]].add(r["word"])
    return {k: frozenset(v) for k, v in out.items()}


def irregular_verbs() -> list[tuple[str, str]]:
    """pt_irregular_verbs.tsv: (family, form), in the order of the file."""
    return [(r["family"], r["form"]) for r in _rows("pt_irregular_verbs.tsv")]


def synonym_groups() -> list[list[str]]:
    """pt_synonyms.tsv: the groups of synonyms, in the order of the file."""
    return [r["words"].split() for r in _rows("pt_synonyms.tsv")]


def rare_glosses() -> dict[str, str]:
    """rare_glosses.tsv: English gloss of the lexicon → Portuguese gloss."""
    return {r["en"]: r["pt"] for r in _rows("rare_glosses.tsv")}
