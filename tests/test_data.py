"""Testes dos dados: banco (build/biblia.sqlite) e exportação (build/data)."""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

from conftest import ROOT, chapter

sys.path.insert(0, os.path.dirname(__file__))
import snapshot  # noqa: E402

# ---------- contagens ----------


def test_66_books_1189_chapters(books):
    assert len(books) == 66
    assert sum(1 for b in books if not b["nt"]) == 39
    assert sum(len(b["chapters"]) for b in books) == 1189


def test_verses_and_words(db):
    assert db.execute("SELECT count(*) FROM verses").fetchone()[0] == 31166
    assert db.execute("SELECT count(*) FROM words").fetchone()[0] == 443123


def test_every_word_has_gloss(db):
    missing_gloss = db.execute("SELECT book, chapter, verse, pos, text FROM words WHERE gloss IS NULL OR trim(gloss) = ''").fetchall()
    assert not missing_gloss, f"{len(missing_gloss)} palavras sem glosa, por exemplo {missing_gloss[:5]}"


def test_every_verse_has_blivre(db):
    missing_gloss = db.execute("SELECT book, chapter, verse FROM verses WHERE blivre IS NULL OR trim(blivre) = ''").fetchall()
    assert not missing_gloss, f"versículos sem texto da BLIVRE: {missing_gloss[:5]}"


def test_full_export(books, chapters):
    for b in books:
        for c in b["chapters"]:
            d = chapters[(b["code"], c["n"])]
            assert d["book"] == b["code"]
            assert d["chapter"] == c["n"]
            assert d["v"], f"{b['code']} {c['n']} sem versículos"
            for v in d["v"]:
                for w in v["w"]:
                    assert w[2].strip(), f"{b['code']} {c['n']}:{v['n']} {w[0]} sem glosa na exportação"


# ---------- léxico, temas e introduções ----------

# Lemas gregos do texto crítico que não existem no dicionário de Strong (limitação conhecida, ver README).
LEMMAS_WITHOUT_STRONG_MAX = 90


def test_every_strong_has_entry(chapters, lexicon):
    missing_files = set()
    for d in chapters.values():
        for v in d["v"]:
            for w in v["w"]:
                e = lexicon.get(w[1])
                if not e or not (e.get("s") or "").strip():
                    missing_files.add(w[1])
    numbered = sorted(s for s in missing_files if not s.startswith("G:"))
    assert not numbered, f"números Strong sem verbete em português: {numbered[:10]}"
    assert len(missing_files) <= LEMMAS_WITHOUT_STRONG_MAX, (
        f"{len(missing_files)} lemas sem significado (máximo {LEMMAS_WITHOUT_STRONG_MAX})"
    )


def test_entry_has_pronunciation_and_transliteration(lexicon):
    bad = [k for k, e in lexicon.items() if not k.startswith("G:") and (not e.get("x") or not e.get("p"))]
    assert not bad, f"verbetes sem transliteração ou pronúncia: {bad[:10]}"


def test_every_chapter_has_theme(books):
    missing_gloss = [f"{b['code']} {c['n']}" for b in books for c in b["chapters"] if not (c.get("t") or "").strip()]
    assert not missing_gloss, f"capítulos sem tema: {missing_gloss[:10]}"


def test_every_book_has_intro(books):
    missing_gloss = [b["code"] for b in books if not b.get("about")]
    assert not missing_gloss, f"livros sem introdução (Sobre o livro): {missing_gloss}"


# ---------- versículos-chave ----------


def glosses(cod, cap, vers):
    return [w[2] for v in chapter(cod, cap)["v"] if v["n"] == vers for w in v["w"]]


def test_genesis_1_1():
    assert glosses("GEN", 1, 1) == ["no-princípio", "criou", "Deus", "[obj]", "os-céus", "e-[obj]", "a-terra"]


def test_genesis_1_hand_reviewed(db):
    n = db.execute("SELECT count(*) FROM words WHERE book='GEN' AND chapter=1 AND gloss_source='manual'").fetchone()[0]
    assert n == 434


def test_hundred_without_alignment_is_not_another_number(db):
    """מֵאָה (H3967) without an alignment: "cem/centos/duzentos" by its number, not the most common whole number
    ("seiscentos"), wrong in Gn 5:5 (930 years)."""
    assert db.execute("SELECT gloss FROM words WHERE book='GEN' AND chapter=5 AND verse=5 AND pos=8").fetchone()[0] == "centos"
    rest = db.execute("SELECT gloss FROM words WHERE strong='H3967' AND gloss_source='lexico'").fetchall()
    assert rest
    assert all(re.search(r"(^|-)(cem|centos|duzentos)$", g) for (g,) in rest), rest


def test_demonstrative_with_article_without_alignment(db):
    """הַזֶּה, הַזֹּאת, הָאֵלֶּה, הַהוּא… without an alignment: "este/esta/estes/aquele…", not "o-hoje" (the most common
    translation of הַזֶּה, from "este dia"), "o-esta" (the article before the demonstrative) nor "o-será"."""
    rest = db.execute(
        "SELECT gloss FROM words WHERE strong IN ('H2088', 'H2063', 'H428', 'H1931', 'H1992', 'H2007') AND prefixes LIKE '%d%'"
        " AND gloss_source='lexico'"
    ).fetchall()
    assert rest
    assert all(re.search(r"(^|-)(n|d)?(est|aquel)(e|a|es|as)$", g) for (g,) in rest), rest


def test_gloss_corrections_applied(db):
    """Cada linha de data/corrections/glosses.tsv tem de estar no banco com glosa_fonte = revisada."""
    import csv

    fname = os.path.join(ROOT, "data", "corrections", "glosses.tsv")
    for r in csv.DictReader(Path(fname).read_text(encoding="utf8").splitlines(keepends=True), delimiter="\t"):
        if not r["ref"].strip() or r["ref"].startswith("#"):
            continue
        m = re.match(r"([1-3A-Z]{3}) (\d+):(\d+)", r["ref"])
        wds = db.execute(
            "SELECT gloss, gloss_source FROM words WHERE book=? AND chapter=? AND verse=? ORDER BY pos", (m[1], int(m[2]), int(m[3]))
        ).fetchall()
        gloss, source = wds[int(r["pos"]) - 1]
        assert (gloss, source) == (r["gloss"].replace(" ", "-"), "revisada"), r["ref"]


def test_john_1_1_corrections():
    g = glosses("JHN", 1, 1)
    assert g[9] == "junto-de"
    assert g[10] == "—"


def test_yhwh_eu_sou(db):
    """YHWH glosado “EU-SOU” só onde a BLIVRE usa essa forma (Êx 6:3 é um exemplo)."""
    n = db.execute("SELECT count(*) FROM words WHERE strong='H3068' AND gloss LIKE '%EU-SOU%'").fetchone()[0]
    assert 1 <= n <= 60
    assert db.execute("SELECT gloss FROM words WHERE book='EXO' AND chapter=6 AND verse=3 AND strong='H3068'").fetchone()[0] == "EU-SOU"
    assert db.execute("SELECT count(*) FROM words WHERE strong='H3068' AND gloss LIKE '%SENHOR%'").fetchone()[0] > 6000


def test_romans_16_25_27():
    vs = {v["n"]: v for v in chapter("ROM", 16)["v"]}
    for n in (25, 26, 27):
        assert vs[n]["w"], f"Rm 16:{n} sem o texto grego"


def test_ketiv_qere(db):
    n = db.execute("SELECT count(*) FROM words WHERE ketiv IS NOT NULL AND ketiv <> ''").fetchone()[0]
    assert 1200 <= n <= 1300


def test_apparatus_signs_removed_from_greek(db):
    bad = db.execute("SELECT count(*) FROM words WHERE language='G' AND (text GLOB '*[⸀⸁⸂⸃⸄⸅]*')").fetchone()[0]
    assert bad == 0


# ---------- retrato de referência ----------


def test_snapshot(db):
    ref = json.loads(Path(snapshot.SNAPSHOT_FILE).read_text(encoding="utf8"))
    current = snapshot.compute()
    changed_books = sorted(bk for bk in set(ref["books"]) | set(current["books"]) if ref["books"].get(bk) != current["books"].get(bk))
    hint = "Se foi de propósito, rode `python3 tests/snapshot.py --update` e envie o tests/snapshot.json junto."
    assert not changed_books, f"As glosas mudaram em: {', '.join(changed_books)}. {hint}"
    assert ref["words"] == current["words"], f"O número de palavras mudou. {hint}"


# ---------- verificação dos arquivos de dados ----------


def test_check_data():
    r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "check_data.py")], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout[-2000:] + r.stderr[-2000:]
