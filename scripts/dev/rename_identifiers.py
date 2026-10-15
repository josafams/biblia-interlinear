#!/usr/bin/env python3
"""Renomeia identificadores em arquivos Python a partir de um mapa (JSON {"antigo": "novo"}).

Mexe só nos tokens de nome do código (variáveis, funções, atributos, módulos importados), inclusive
dentro de f-strings; textos, comentários e docstrings ficam como estão. Antes de gravar, avisa quando
o nome novo já existe no arquivo (possível colisão) e para.

Uso: python3 scripts/dev/rename_identifiers.py mapa.json arquivo.py [...] [--dry-run]
Ferramenta da migração para identificadores em inglês (docs/adr/0003-identificadores-em-ingles.md).
"""

import io
import json
import sys
import tokenize
from pathlib import Path


def rename(source: str, mapping: dict[str, str]) -> tuple[str, set[str], set[str]]:
    tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
    names = {t.string for t in tokens if t.type == tokenize.NAME}
    used = {n for n in names if n in mapping}
    collisions = {mapping[n] for n in used if mapping[n] in names and mapping[n] not in mapping}
    lines = source.splitlines(keepends=True)
    for t in reversed(tokens):
        if t.type == tokenize.NAME and t.string in mapping:
            (row, col), (row2, col2) = t.start, t.end
            if row != row2:
                raise ValueError(f"token em várias linhas: {t}")
            line = lines[row - 1]
            lines[row - 1] = line[:col] + mapping[t.string] + line[col2:]
    return "".join(lines), used, collisions


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    mapping = json.loads(Path(args[0]).read_text(encoding="utf8"))
    problems = False
    results = {}
    for path in args[1:]:
        src = Path(path).read_text(encoding="utf8")
        new, used, collisions = rename(src, mapping)
        results[path] = new
        if collisions:
            problems = True
            print(f"{path}: colisão com nomes já existentes: {sorted(collisions)}")
        print(f"{path}: {len(used)} nomes")
    if (problems and "--force" not in sys.argv) or dry:
        sys.exit(1 if problems else 0)
    for path, new in results.items():
        Path(path).write_text(new, encoding="utf8")


if __name__ == "__main__":
    main()
