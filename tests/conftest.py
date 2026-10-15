"""Testes do projeto. Rode com: python3 -m pytest tests  (depois de gerar os dados: scripts/build.sh ou
corpus.py + make_glosses.py + export.py). Os testes que dependem de arquivos ainda não gerados são pulados."""

import json
import os
import sqlite3
from pathlib import Path

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB = os.path.join(ROOT, "build", "biblia.sqlite")
DATA = os.path.join(ROOT, "build", "data")


@pytest.fixture(scope="session")
def db():
    if not os.path.exists(DB):
        pytest.skip("build/biblia.sqlite ainda não foi gerado")
    c = sqlite3.connect(DB)
    yield c
    c.close()


@pytest.fixture(scope="session")
def books():
    fname = os.path.join(DATA, "livros.json")
    if not os.path.exists(fname):
        pytest.skip("build/data ainda não foi gerado (scripts/export.py)")
    return json.load(open(fname, encoding="utf8"))


@pytest.fixture(scope="session")
def lexicon():
    lex = {}
    for L in "HG":
        fname = os.path.join(DATA, "lex", f"{L}.json")
        if not os.path.exists(fname):
            pytest.skip("léxico exportado ainda não existe")
        lex.update(json.loads(Path(fname).read_text(encoding="utf8")))
    return lex


def chapter(cod, n):
    return json.load(open(os.path.join(DATA, "cap", cod, f"{n}.json"), encoding="utf8"))


@pytest.fixture(scope="session")
def chapters(books):
    """Todos os capítulos exportados: {(cod, n): dados}."""
    return {(b["cod"], c["n"]): chapter(b["cod"], c["n"]) for b in books for c in b["caps"]}
