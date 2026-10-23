"""scripts/dev/output_hash.py: the byte-for-byte proof for changes to the Python pipeline."""

import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("output_hash", Path(__file__).resolve().parents[1] / "scripts/dev/output_hash.py")
output_hash = importlib.util.module_from_spec(spec)
spec.loader.exec_module(output_hash)


def test_hashes_and_compare(tmp_path):
    (tmp_path / "build/data/cap").mkdir(parents=True)
    (tmp_path / "build/data/books.json").write_text("[]", encoding="utf8")
    (tmp_path / "build/data/cap/GEN.json").write_text("{}", encoding="utf8")
    before = output_hash.file_hashes(tmp_path)
    assert sorted(before) == ["build/data/books.json", "build/data/cap/GEN.json"]

    (tmp_path / "build/data/books.json").write_text("[1]", encoding="utf8")
    (tmp_path / "build/data/cap/GEN.json").unlink()
    (tmp_path / "build/data/new.json").write_text("{}", encoding="utf8")
    assert output_hash.compare(before, output_hash.file_hashes(tmp_path)) == [
        "missing   build/data/cap/GEN.json",
        "new       build/data/new.json",
        "changed   build/data/books.json",
    ]


def test_list_round_trip(tmp_path):
    listing = tmp_path / "hashes.txt"
    listing.write_text("abc  build/data/a.json\ndef  build/web/dados/b.js\n", encoding="utf8")
    assert output_hash.read_list(listing) == {"build/data/a.json": "abc", "build/web/dados/b.js": "def"}
