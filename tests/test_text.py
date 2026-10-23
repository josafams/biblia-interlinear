"""Testes da normalização de texto comum aos scripts (scripts/interlinear/text.py)."""

import os
import sys
import unicodedata

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from interlinear import text  # noqa: E402


def test_strip_marks_takes_accents_and_points():
    assert text.strip_marks("coração") == "coracao"
    assert text.strip_marks("λόγος") == "λογος"
    assert text.strip_marks("בְּרֵאשִׁית") == "בראשית"


def test_letters_only_keeps_letters_in_lowercase():
    assert text.letters_only("וַ/יְהִ֗י") == "ויהי"
    assert text.letters_only("Ἐν ἀρχῇ,") == "εναρχη"
    assert text.letters_only(None) == ""


def test_greek_final_sigma():
    assert text.norm_greek("Λόγος") == "λογοσ"
    assert text.consonantal("λόγος") == "λογοσ"


def test_cantillation_keeps_vowels_and_dagesh():
    heb = "בְּרֵאשִׁ֖ית"  # with a tipeha (U+0596)
    out = text.without_cantillation(heb)
    assert "֖" not in out
    assert out == unicodedata.normalize("NFD", "בְּרֵאשִׁית")
    # the review also drops sof pasuq; the glosses keep it
    assert text.CANTILLATION_AND_VERSE_END.sub("", "אֶרֶץ׃") == "אֶרֶץ"
    assert text.CANTILLATION.sub("", "אֶרֶץ׃") == "אֶרֶץ׃"


def test_the_two_token_rules():
    verse = "Disse-lhe d’Ele 3 vezes"
    assert text.TOKEN_PT.findall(verse) == ["Disse", "lhe", "d’Ele", "3", "vezes"]
    assert text.TOKEN_PT_LETTERS.findall(verse) == ["Disse", "lhe", "d", "Ele", "vezes"]
