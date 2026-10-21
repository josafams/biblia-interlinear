"""Testes das funções do export.py usadas pelo app: títulos dos acrósticos, concordância e índice de busca."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import export  # noqa: E402


def test_acrostic_heading_leaves_the_verse_text():
    # Arrange
    text = "Álefe :Bem-aventurados são os puros em seus caminhos"
    # Act
    heading, rest, cut = export.split_heading(text)
    # Assert
    assert heading == "Álefe"
    assert rest == "Bem-aventurados são os puros em seus caminhos"
    assert text[cut:] == rest


@pytest.mark.parametrize("text", ["Disse-lhe Jesus: Eu sou", "Bem-aventurados são", "", None])
def test_verse_without_heading_is_unchanged(text):
    heading, rest, cut = export.split_heading(text)
    assert heading is None
    assert rest == text
    assert cut == 0


@pytest.mark.parametrize(("word", "expected"), [("Amor", "amor"), ("fé", "fe"), ("Coração", "coracao"), ("d’Ele", "d'ele")])
def test_search_ignores_case_and_accents(word, expected):
    assert export.search_norm(word) == expected


@pytest.mark.parametrize(
    ("key", "bucket"), [("G25", "G0"), ("G3588", "G35"), ("H1254", "H12"), ("H7225", "H72"), ("Hb", "Hx"), ("G:λόγος", "Gx")]
)
def test_concordance_bucket_by_strong_number(key, bucket):
    assert export.conc_bucket(key) == bucket


@pytest.mark.parametrize(("n", "text"), [(0, "0"), (35, "z"), (36, "10"), (43003016, "plpc8")])
def test_base36_matches_javascript_parseint(n, text):
    assert export.b36(n) == text
    assert int(text, 36) == n
