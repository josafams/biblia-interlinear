"""Testes de unidade da revisão automática (scripts/interlinear/review): português, morfologia e marcas."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from interlinear.models import Word  # noqa: E402
from interlinear.review.marks import Marks, ref  # noqa: E402
from interlinear.review.morph import gloss_names, grk, heb_segs, is_proper_name  # noqa: E402
from interlinear.review.words import STOP, content, content_stems, singular, stem, toks  # noqa: E402


def word(**kw):
    base = dict.fromkeys(Word._fields)
    base.update(id=1, book="GEN", chapter=1, verse=1, pos=0, language="H", text="")
    base.update(kw)
    return Word(**base)


def test_gloss_tokens_and_stop_words():
    assert toks("e-disse-o-SENHOR") == ["e", "disse", "o", "senhor"]
    assert content(toks("e-disse-o-SENHOR")) == ["disse", "senhor"]
    assert {"o", "de", "e", "não"} <= STOP


def test_singular_and_stems():
    assert singular("nações") == "nação"
    assert singular("mulheres") == "mulher"
    assert singular("Jesus") == "Jesus"
    # irregular verbs point to their family (SER joins ser, estar, haver and ir), and the family to its synonyms
    assert stem("disse") == stem("dizer") == stem("respondeu") == stem("falou")
    assert stem("estava") == stem("foi") == stem("há")
    assert stem("disse") != stem("foi")
    # synonyms the Bíblia Livre alternates have the same stem
    assert stem("trevas") == stem("escuridão")
    assert content_stems("e-criou-Deus") == {stem("criou"), stem("Deus")}


def test_hebrew_and_greek_morphology():
    assert heb_segs("HC/Vqw3ms") == ("H", ["C"], "Vqw3ms", [])
    assert heb_segs("HNcmsc/Sp3ms") == ("H", [], "Ncmsc", ["Sp3ms"])
    assert heb_segs("ANcmsd/Td") == ("A", [], "Ncmsd", [])  # emphatic Aramaic article, after the noun
    assert grk("V-3AAI-S--") == ("V", "3AAI-S--")
    assert grk("N-----NSM-") == ("N", "----NSM-")


def test_proper_names():
    assert is_proper_name(word(morph="HNpm"))
    assert not is_proper_name(word(morph="HNcmsa"))
    assert is_proper_name(word(language="G", morph="N-----NSM-", lemma="Ἰησοῦς"))
    assert gloss_names("e-Moisés-disse-ao-SENHOR") == ["Moisés"]


def test_marks_keep_the_scope_and_skip_repeats():
    M = Marks(("GEN", 1))
    w = word(id=7, verse=3)
    M.w(w, "CON-04", "aviso", "CON-04_2", gloss="luz-luz")
    M.w(w, "CON-04", "aviso", "CON-04_2", gloss="luz-luz")  # the same word and code: once
    M.add("GEN", 2, 1, None, "TXT-05", "erro", "TXT-05_2", missing=[1])  # outside the chapter reviewed
    M.add("GEN", 1, 4, None, "TXT-05", "erro", "TXT-05_2", missing=[4, 5])
    assert [(m["code"], m["verse"]) for m in M.lst] == [("CON-04", 3), ("TXT-05", 4)]
    # the key and the params go to marks.json; the text is the locale's (as the app shows it)
    assert M.lst[0]["key"] == "CON-04_2"
    assert M.lst[0]["params"] == {"gloss": "luz-luz"}
    assert M.lst[0]["msg"] == "palavra repetida na glosa: 'luz-luz'"
    assert M.lst[1]["msg"] == "versículo(s) ausente(s): [4, 5]"
    assert ref(w) == "GEN 1:3"
