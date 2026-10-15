#!/usr/bin/env bash
# Gera tudo a partir das fontes abertas:
#   build/biblia.sqlite         corpus: textos, palavras, glosas e léxico (corpus.py + make_glosses.py)
#   build/review/              revisões automáticas (review.py)
#   build/web/                  site instalável (PWA) — também é o conteúdo dos apps Android/iOS
#   build/preview.html           página única com alguns capítulos (para publicar como artefato)
#   build/data/                dados em JSON (66 livros, 1.189 capítulos, léxico)
#   build/epub/                 um EPUB por livro (Kindle e outros leitores)
#   build/pdf/                  um PDF por livro (A4)
# Variáveis: REFAZER=1 refaz o corpus e as glosas; CAP_SYNC=1 copia a web para Android e iOS.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d sources ] || scripts/download_sources.sh
[ -d node_modules ] || npm ci
mkdir -p build/

if [ "${REFAZER:-0}" = "1" ] || [ ! -f build/biblia.sqlite ]; then
  python3 scripts/corpus.py
  python3 scripts/make_glosses.py
fi
python3 scripts/export.py > /dev/null   # grava o léxico em português no banco
python3 scripts/review.py > /dev/null
node scripts/build_web.mjs
python3 scripts/export.py --preview build/preview.json GEN.1 GEN.2 GEN.3 GEN.12 EXO.20 RUT.1 PSA.1 PSA.23 PSA.51 \
  ISA.53 DAN.2 MAT.5 JHN.1 JHN.3 ROM.8 1CO.13 REV.21
python3 - <<'PY'
t = open("web/template.html", encoding="utf8").read()
d = open("build/preview.json", encoding="utf8").read().replace("</", "<\\/")
open("build/preview.html", "w", encoding="utf8").write(t.replace("__DATA__", d, 1))
PY
python3 scripts/build_epub.py     # build/epub: um EPUB por livro
if [ "${PDF:-1}" = "1" ]; then python3 scripts/build_pdf.py; fi   # build/pdf: um PDF por livro (PDF=0 pula)

if [ "${CAP_SYNC:-0}" = "1" ]; then npx cap sync; fi
echo "Pronto: build/web, build/preview.html, build/epub e build/pdf"
