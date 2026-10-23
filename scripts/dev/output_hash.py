"""Proves that a change to the Python pipeline leaves its output identical, byte for byte.

Writes one SHA-256 per file of build/data, build/web/dados and build/review (the outputs of corpus.py,
make_glosses.py, export.py and review.py) and compares two such lists.

Usage:
  python3 scripts/dev/output_hash.py > build/hash-before.txt     # before the change
  python3 scripts/dev/output_hash.py --compare build/hash-before.txt   # after: lists what changed
"""

import argparse
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUTS = ["build/data", "build/web/dados", "build/review"]


def file_hashes(root: Path = ROOT) -> dict[str, str]:
    hashes: dict[str, str] = {}
    for out in OUTPUTS:
        base = root / out
        if not base.exists():
            continue
        for f in sorted(p for p in base.rglob("*") if p.is_file()):
            hashes[f.relative_to(root).as_posix()] = hashlib.sha256(f.read_bytes()).hexdigest()
    return hashes


def read_list(path: Path) -> dict[str, str]:
    hashes: dict[str, str] = {}
    for line in path.read_text(encoding="utf8").splitlines():
        if line.strip():
            digest, name = line.split("  ", 1)
            hashes[name] = digest
    return hashes


def compare(before: dict[str, str], after: dict[str, str]) -> list[str]:
    lines = [f"missing   {n}" for n in sorted(before.keys() - after.keys())]
    lines += [f"new       {n}" for n in sorted(after.keys() - before.keys())]
    lines += [f"changed   {n}" for n in sorted(before.keys() & after.keys()) if before[n] != after[n]]
    return lines


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--compare", type=Path, help="a list written before the change; prints the differences")
    args = ap.parse_args(argv)
    now = file_hashes()
    if not now:
        print("no output found: build the data first (make data)", file=sys.stderr)
        return 2
    if not args.compare:
        for name, digest in now.items():
            print(f"{digest}  {name}")
        return 0
    diff = compare(read_list(args.compare), now)
    if diff:
        print("\n".join(diff))
        print(f"{len(diff)} file(s) differ", file=sys.stderr)
        return 1
    print(f"identical: {len(now)} files", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
