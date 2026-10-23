"""The tables of data/ edited by hand (tab-separated, with a header line)."""

import csv
from collections.abc import Iterator
from pathlib import Path

from interlinear.paths import DATA


def rows(path: Path) -> Iterator[tuple[int, dict[str, str]]]:
    """(line number, row) of a table; the header is line 1."""
    with open(path, encoding="utf8") as f:
        yield from enumerate(csv.DictReader(f, delimiter="\t"), 2)


def lexicon_pt_files() -> list[Path]:
    """data/lexicon_pt/*.tsv, in name order: the origin and meaning in Portuguese of each Strong entry."""
    return sorted((DATA / "lexicon_pt").glob("*.tsv"))


def lexicon_pt() -> dict[str, dict[str, str]]:
    """Every entry of data/lexicon_pt by key ("H430"): {"key", "origin", "meaning"}."""
    return {r["key"]: r for f in lexicon_pt_files() for _, r in rows(f)}
