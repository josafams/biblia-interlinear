"""Text normalization used by more than one script. Each function keeps the exact behavior the scripts had,
so the generated files stay byte for byte the same; where two scripts differ on purpose, there are two names."""

import re
import unicodedata

# ------------------------------------------------------------------ any language


def strip_marks(s: str) -> str:
    """Without combining marks: accents (Portuguese, Greek) and vowel points, cantillation (Hebrew)."""
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


def letters_only(t: str | None) -> str:
    """Only the letters, in lowercase: without cantillation, vowels, accents, punctuation and slashes."""
    return "".join(c for c in unicodedata.normalize("NFD", t or "") if unicodedata.category(c)[0] == "L").lower()


# ------------------------------------------------------------------ Greek


def norm_greek(s: str) -> str:
    """Greek to compare: without accents and breathings, lowercase, final sigma as σ."""
    return strip_marks(s).lower().replace("ς", "σ")


def consonantal(t: str) -> str:
    """Letters only (Hebrew consonants, Greek letters), lowercase, final sigma as σ."""
    return letters_only(t).replace("ς", "σ")


# ------------------------------------------------------------------ Hebrew

# accents, meteg and paseq (vowels and dagesh stay)
CANTILLATION = re.compile(r"[֑-ֽ֯׀]")
# the same plus sof pasuq and the upper and lower dots (to compare forms, not to show them)
CANTILLATION_AND_VERSE_END = re.compile(r"[֑-ֽ֯׀׃ׅׄ]")


def without_cantillation(heb: str) -> str:
    """Hebrew without cantillation, meteg and paseq; vowels and dagesh stay (NFD)."""
    return CANTILLATION.sub("", unicodedata.normalize("NFD", heb))


# ------------------------------------------------------------------ Portuguese

# a word of the Bíblia Livre for the alignment and the search: letters and digits, with an apostrophe inside
TOKEN_PT = re.compile(r"[^\W_]+(?:[’'][^\W_]+)?", re.U)
# a word of a gloss or a verse for the review: letters only
TOKEN_PT_LETTERS = re.compile(r"[^\W\d_]+", re.U)
