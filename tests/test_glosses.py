"""Testes do desempate de palavras portuguesas disputadas por duas palavras do original (Jo 11:38)."""

import os
import sys
from collections import Counter, defaultdict
from typing import NamedTuple

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from interlinear.glosses.compose import rescue, settle_contested  # noqa: E402
from interlinear.glosses.portuguese import tokens_pt  # noqa: E402


class W(NamedTuple):
    language: str
    morph: str


TEXT = "Comovendo-se pois Jesus outra vez"
TOKS = tokens_pt(TEXT)  # Comovendo, se, pois, Jesus, outra, vez
WDS = [W("G", "N-----NSM-"), W("G", "D---------"), W("G", "V--PMPNSM-")]  # Ἰησοῦς, πάλιν, ἐμβριμώμενος
UNIT = [(0, "raiz", "g:iesous"), (1, "raiz", "g:palin"), (2, "raiz", "g:embrim")]


def counts(extra=None):
    tc = defaultdict(Counter)
    tc["g:iesous"]["jesus"] = 900
    tc["g:palin"].update({"vez": 120, "outra": 118, "novamente": 20})
    tc["g:embrim"].update({"advertiu": 2, "comoveu": 1, "vez": 1})  # the "vez" is this verse's
    for root, c in (extra or {}).items():
        tc[root].update(c)
    return tc, {root: sum(c.values()) for root, c in tc.items()}


def test_contested_word_stays_with_the_root_that_usually_translates_to_it():
    tc, totals = counts()
    lk = {(0, 3), (1, 4), (1, 5), (2, 5)}
    kept, lost = settle_contested(lk, UNIT, TOKS, tc, totals)
    assert kept == {(0, 3), (1, 4), (1, 5)}
    assert lost == {2}


def test_lost_word_takes_a_free_word_seen_for_its_root_with_the_clitic():
    tc, totals = counts()
    kept, lost = settle_contested({(0, 3), (1, 4), (1, 5), (2, 5)}, UNIT, TOKS, tc, totals)
    assert rescue(kept, lost, WDS, UNIT, TOKS, TEXT, tc) == kept | {(2, 0), (2, 1)}  # Comovendo-se


def test_both_kept_when_the_word_is_usual_for_both():
    # Jesus Cristo: Χριστός is often linked to "Jesus" too, so nothing is dropped
    unit = [(0, "raiz", "g:iesous"), (1, "raiz", "g:christos")]
    toks = tokens_pt("Jesus Cristo")
    tc, totals = counts({"g:christos": {"cristo": 400, "jesus": 150}})
    lk = {(0, 0), (1, 0), (1, 1)}
    assert settle_contested(lk, unit, toks, tc, totals) == (lk, set())


def test_rare_root_keeps_its_word():
    # a root seen only here says nothing about its translations
    tc, totals = counts({"g:hapax": {"vez": 1}})
    unit = [(0, "raiz", "g:palin"), (1, "raiz", "g:hapax")]
    toks = tokens_pt("outra vez")
    lk = {(0, 0), (0, 1), (1, 1)}
    assert settle_contested(lk, unit, toks, tc, totals) == (lk, set())
