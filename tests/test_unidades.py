"""Testes de unidade das funções puras dos scripts."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
glosar = pytest.importorskip("glosar", reason="glosar.py precisa do eflomal (pip install eflomal)")


@pytest.mark.parametrize("entrada, saida", [
    ("em-o-princípio", "no-princípio"),
    ("de-a-terra", "da-terra"),
    ("a-os-filhos", "aos-filhos"),
    ("em-ele", "nele"),
    ("e-de-os-céus", "e-dos-céus"),
    ("criou", "criou"),
])
def test_contracoes(entrada, saida):
    assert glosar.contrair(entrada) == saida


@pytest.mark.parametrize("nome, xlit", [("Tamar", "Thâmâr"), ("Davi", "Dâvid"), ("Moisés", "Môsheh"), ("Filipe", "Philippos")])
def test_nome_parecido_com_transliteracao(nome, xlit):
    assert glosar.parecido(nome, glosar.nome_de_xlit(xlit)) >= 0.75


def test_nome_parecido_escolhe_o_nome_do_versiculo():
    texto = "E Judá tomou mulher para Er, seu primogênito, a qual se chamava Tamar."
    assert glosar.nome_parecido(glosar.nome_de_xlit("Thâmâr"), texto) == "Tamar"


def test_nome_parecido_sem_candidato():
    assert glosar.nome_parecido("Thamar", "e disse a ele") is None
