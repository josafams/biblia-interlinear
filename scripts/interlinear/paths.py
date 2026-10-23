"""Where things are: the repository, the downloaded sources, the generated files and the database."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "sources"  # scripts/download_sources.sh
DATA = ROOT / "data"  # edited by hand: themes, lexicon in Portuguese, corrections, questions
BUILD = ROOT / "build"  # everything generated (not in git)
DB = BUILD / "biblia.sqlite"
