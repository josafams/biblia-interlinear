"""Rows of build/biblia.sqlite as named tuples (the field names are the column names of the table)."""

from typing import NamedTuple


class Word(NamedTuple):
    """A word of the original, as review.py reads it from the words table."""

    id: int
    book: str
    chapter: int
    verse: int
    pos: int  # position in the verse, from 0
    language: str  # "H" Hebrew, "A" Aramaic, "G" Greek
    text: str  # with "/" between the morphemes (Hebrew)
    lemma: str | None
    strong: str | None
    prefixes: str | None
    morph: str | None
    ref_orig: str | None  # the verse in the original numbering, when it differs
    gloss: str | None
    gloss_source: str | None
    strong_source: str | None


# the columns of the words table, in the order of the fields of Word
WORD_COLUMNS = ", ".join(Word._fields)


class AlignedWord(NamedTuple):
    """A word of the original as make_glosses.py aligns it with the Bíblia Livre."""

    id: int
    book: str
    chapter: int
    verse: int
    language: str
    text: str
    lemma: str | None
    strong: str | None
    morph: str | None
