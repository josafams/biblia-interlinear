"""Testes do projeto. Rode com: python3 -m pytest tests  (depois de gerar os dados: scripts/build.sh ou
corpus.py + glosar.py + exportar.py). Os testes que dependem de arquivos ainda não gerados são pulados."""

import json
import os
import sqlite3

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB = os.path.join(ROOT, "saida", "biblia.sqlite")
DADOS = os.path.join(ROOT, "saida", "dados")


@pytest.fixture(scope="session")
def db():
    if not os.path.exists(DB):
        pytest.skip("saida/biblia.sqlite ainda não foi gerado")
    c = sqlite3.connect(DB)
    yield c
    c.close()


@pytest.fixture(scope="session")
def livros():
    arq = os.path.join(DADOS, "livros.json")
    if not os.path.exists(arq):
        pytest.skip("saida/dados ainda não foi gerado (scripts/exportar.py)")
    return json.load(open(arq, encoding="utf8"))


@pytest.fixture(scope="session")
def lexico():
    lex = {}
    for L in "HG":
        arq = os.path.join(DADOS, "lex", f"{L}.json")
        if not os.path.exists(arq):
            pytest.skip("léxico exportado ainda não existe")
        lex.update(json.load(open(arq, encoding="utf8")))
    return lex


def capitulo(cod, n):
    return json.load(open(os.path.join(DADOS, "cap", cod, f"{n}.json"), encoding="utf8"))


@pytest.fixture(scope="session")
def capitulos(livros):
    """Todos os capítulos exportados: {(cod, n): dados}."""
    return {(b["cod"], c["n"]): capitulo(b["cod"], c["n"]) for b in livros for c in b["caps"]}
