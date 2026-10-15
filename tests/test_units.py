"""Testes de unidade das funções puras dos scripts."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
make_glosses = pytest.importorskip("make_glosses", reason="make_glosses.py precisa do eflomal (pip install eflomal)")


@pytest.mark.parametrize(
    ("entry", "expected"),
    [
        ("em-o-princípio", "no-princípio"),
        ("de-a-terra", "da-terra"),
        ("a-os-filhos", "aos-filhos"),
        ("em-ele", "nele"),
        ("e-de-os-céus", "e-dos-céus"),
        ("criou", "criou"),
    ],
)
def test_contractions(entry, expected):
    assert make_glosses.contract(entry) == expected


@pytest.mark.parametrize(("name", "xlit"), [("Tamar", "Thâmâr"), ("Davi", "Dâvid"), ("Moisés", "Môsheh"), ("Filipe", "Philippos")])
def test_similar_name_by_transliteration(name, xlit):
    assert make_glosses.similar(name, make_glosses.name_from_xlit(xlit)) >= 0.75


def test_similar_name_picks_verse_name():
    verse_text = "E Judá tomou mulher para Er, seu primogênito, a qual se chamava Tamar."
    assert make_glosses.similar_name(make_glosses.name_from_xlit("Thâmâr"), verse_text) == "Tamar"


def test_similar_name_without_candidate():
    assert make_glosses.similar_name("Thamar", "e disse a ele") is None


def test_similar_name_stable_tiebreak():
    """Hb 11:32: Sampson empata com Sansão e Samuel no sentido direto; o resultado não pode depender da ordem do set."""
    verse_text = "E que mais direi? Porque me faltará o tempo se eu contar de Gedeão, Baraque, Sansão, Jefté, Davi, Samuel e dos profetas"
    assert make_glosses.similar_name(make_glosses.name_from_xlit("Sampsōn"), verse_text) == "Sansão"
