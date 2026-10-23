"""The downloaded sources (scripts/download_sources.sh): where each file is and how to read its lines.

corpus.py and review.py each parse the Hebrew on their own on purpose: the review checks the corpus against the
source, so a mistake in one reader would not hide itself.
"""

from pathlib import Path

from interlinear.paths import DATA, SOURCES


def morphhb_file(osis: str) -> Path:
    """The Westminster Leningrad Codex of a book (Open Scriptures Hebrew Bible), e.g. "Gen"."""
    return SOURCES / "morphhb" / "wlc" / f"{osis}.xml"


def morphgnt_lines(name: str, required: bool = True) -> list[str] | None:
    """The lines of a MorphGNT book (e.g. "66-Ro"), with the passages the SBLGNT keeps only in its apparatus
    (data/greek_supplement_<name>.txt, such as Romans 16:25–27). None when the book is missing and not required."""
    path = SOURCES / "sblgnt" / f"{name}-morphgnt.txt"
    if not required and not path.exists():
        return None
    lines = path.read_text(encoding="utf8").splitlines(keepends=True)
    sup = DATA / f"greek_supplement_{name}.txt"
    if sup.exists():
        lines += [ln for ln in sup.read_text(encoding="utf8").splitlines(keepends=True) if ln.strip() and not ln.startswith("#")]
    return lines


def dodson_file() -> Path:
    """Jeffrey Dodson's Greek lexicon (public domain)."""
    return SOURCES / "dodson" / "dodson.xml"
