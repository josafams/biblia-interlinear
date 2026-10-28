"""O app em inglês (#8): a Berean Standard Bible no banco (translated_verses), as glosas por alinhamento com ela
(translated_glosses) e as camadas exportadas (build/data/en/cap, build/web/dados/en) que o app põe sobre os
arquivos em português."""

import json
import re
from pathlib import Path

from conftest import ROOT

WEB_EN = Path(ROOT) / "build" / "web" / "dados" / "en"


def layer(book, chapter):
    return {v["n"]: v for v in json.loads((Path(ROOT) / "build" / "data" / "en" / "cap" / book / f"{chapter}.json").read_text())["v"]}


def jsonp(path):
    text = path.read_text(encoding="utf8")
    return json.loads(text[text.index(",") + 1 : text.rindex(")")])


def test_bsb_covers_the_bible(db):
    # 31,102 versículos da BSB menos os 16 que ela deixa vazios (texto crítico) mais os 63 títulos de salmo (v. 0)
    assert db.execute("SELECT count(*) FROM translated_verses WHERE locale='en'").fetchone()[0] == 31149


def test_verses_the_ebible_copy_loses():
    # o corpus eBible segue a numeração hebraica e perde Ml 4 e Jl 2:28-32; a cópia do scrollmapper os tem
    assert layer("MAL", 4)[1]["b"].startswith("“For behold, the day is coming, burning like a furnace")
    assert layer("JOL", 2)[28]["b"].startswith("And afterward, I will pour out My Spirit on all people.")


def test_psalm_title_is_verse_0_where_the_hebrew_numbers_it():
    ps3 = layer("PSA", 3)
    assert ps3[0]["b"] == "A Psalm of David, when he fled from his son Absalom"
    assert ps3[1]["b"] == "O LORD, how my foes have increased! How many rise up against me!"
    assert 0 not in layer("PSA", 1)


def test_notes_and_section_titles():
    assert layer("MAT", 17)[21] == {"n": 21, "b": "", "o": "sem-original"}  # omitido no texto crítico, sem original
    assert layer("ROM", 16)[25]["o"] == "aparato"
    assert layer("PSA", 119)[1]["h"] == "Aleph"
    assert layer("PSA", 119)[169]["h"] == "Taw"


def test_every_word_has_an_english_gloss(db):
    words = db.execute("SELECT count(*) FROM words").fetchone()[0]
    glossed = db.execute("SELECT count(*) FROM translated_glosses WHERE locale='en' AND trim(gloss) != ''").fetchone()[0]
    assert glossed == words


def test_english_glosses_of_known_verses():
    gen = [g for g, _ in layer("GEN", 1)[1]["g"]]
    assert gen[0] == "in-the-beginning"
    assert "God" in gen
    assert "created" in gen
    jhn = [g for g, _ in layer("JHN", 3)[16]["g"]]
    assert {"loved", "world", "eternal"} <= set(jhn)


def test_yhwh_is_the_lord_not_another_name(db):
    # o ajuste de nomes próprios pela transliteração não vale para YHWH: "Yehovah" não pode virar Josiah ou Joash
    glosses = dict(
        db.execute(
            "SELECT g.gloss, count(*) FROM words w JOIN translated_glosses g ON g.word_id = w.id WHERE w.strong = 'H3068' GROUP BY g.gloss"
        ).fetchall()
    )
    lord = sum(n for g, n in glosses.items() if re.search(r"LORD|GOD|\bYah", g))
    assert lord / sum(glosses.values()) > 0.97


def test_links_point_into_the_bsb_text():
    v = layer("JHN", 3)[16]
    for link in v["a"]:
        for s, e in zip(link[1::2], link[2::2], strict=True):
            assert 0 <= s < e <= len(v["b"])
            assert re.fullmatch(r"[\w’']+", v["b"][s:e])


def test_lexicon_in_english():
    h = jsonp(WEB_EN / "lex" / "H.js")
    assert h["H430"]["p"] == "el-o-HEEM"
    assert "God" in h["H430"]["s"] or "god" in h["H430"]["s"]
    assert h["H430"]["t"].startswith("god (")  # how the BSB renders it, lowercase as in Portuguese
    g = jsonp(WEB_EN / "lex" / "G.js")
    assert g["G3056"]["p"] == "LO-gos"
    # Strong splits origin and meaning inside a parenthesis; the parenthesis goes back to the origin
    assert g["G444"]["o"].endswith("(the countenance; from G3700 (ὀπτάνομαι))")
    assert g["G444"]["s"] == "man-faced, i.e. a human being"


def test_search_index_in_english():
    files = list((WEB_EN / "busca").glob("*.js"))
    text = "".join(f.read_text(encoding="utf8") for f in files)
    assert '"beginning":' in text
    assert '"shepherd":' in text


def test_translated_texts_of_the_books():
    text = (WEB_EN / "livros.js").read_text(encoding="utf8")
    texts = json.loads(text[text.index("=") + 1 : text.rindex(";")])
    assert texts["GEN"]["t"]["1"] == "The creation"
    assert sum(len(b.get("t", {})) for b in texts.values()) == 1189
    # every book has its introduction, with the chapter counts and the key verses quoted from the BSB
    assert len(texts) == 66
    assert all("about" in b for b in texts.values())
    ruth = texts["RUT"]["about"]
    assert ruth["facts"][1] == ["Chapters", "4"]
    assert ruth["key_verses"][0]["text"].startswith("But Ruth replied")
    assert all(k["text"] for b in texts.values() for k in b["about"]["key_verses"])
