"""O texto corrido em inglês (Berean Standard Bible): no banco (translated_verses) e na camada exportada
(build/data/en/cap), que o app põe sobre o capítulo quando o idioma é inglês (#8)."""

import json
from pathlib import Path

from conftest import ROOT


def layer(book, chapter):
    return {v[0]: v[1:] for v in json.loads((Path(ROOT) / "build" / "data" / "en" / "cap" / book / f"{chapter}.json").read_text())["v"]}


def test_bsb_covers_the_bible(db):
    # 31,102 versículos da BSB menos os 16 que ela deixa vazios (texto crítico) mais os 63 títulos de salmo (v. 0)
    assert db.execute("SELECT count(*) FROM translated_verses WHERE locale='en'").fetchone()[0] == 31149


def test_verses_the_ebible_copy_loses():
    # o corpus eBible segue a numeração hebraica e perde Ml 4 e Jl 2:28-32; a cópia do scrollmapper os tem
    assert layer("MAL", 4)[1][0].startswith("“For behold, the day is coming, burning like a furnace")
    assert layer("JOL", 2)[28][0].startswith("And afterward, I will pour out My Spirit on all people.")


def test_psalm_title_is_verse_0_where_the_hebrew_numbers_it():
    ps3 = layer("PSA", 3)
    assert ps3[0][0] == "A Psalm of David, when he fled from his son Absalom"
    assert ps3[1][0] == "O LORD, how my foes have increased! How many rise up against me!"
    assert 0 not in layer("PSA", 1)


def test_notes_and_section_titles():
    assert layer("MAT", 17)[21] == ["", "sem-original"]  # omitido no texto crítico, sem original
    assert layer("ROM", 16)[25][1] == "aparato"
    assert layer("PSA", 119)[1][2] == "Aleph"
    assert layer("PSA", 119)[169][2] == "Taw"


def test_search_index_in_english():
    files = list((Path(ROOT) / "build" / "web" / "dados" / "en" / "busca").glob("*.js"))
    text = "".join(f.read_text(encoding="utf8") for f in files)
    assert '"beginning":' in text
    assert '"shepherd":' in text
