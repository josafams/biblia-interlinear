#!/usr/bin/env bash
# Gera tudo a partir das fontes abertas:
#   saida/biblia.sqlite         corpus: textos, palavras, glosas e léxico (corpus.py + glosar.py)
#   saida/revisao/              revisões automáticas (revisar.py)
#   saida/web/                  site instalável (PWA) — também é o conteúdo dos apps Android/iOS
#   saida/previa.html           página única com alguns capítulos (para publicar como artefato)
#   saida/dados/                dados em JSON (66 livros, 1.189 capítulos, léxico)
#   saida/epub/                 um EPUB por livro (Kindle e outros leitores)
#   saida/pdf/                  um PDF por livro (A4)
# Variáveis: REFAZER=1 refaz o corpus e as glosas; CAP_SYNC=1 copia a web para Android e iOS.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d fontes-dados ] || scripts/baixar_fontes.sh
[ -d node_modules ] || npm ci
mkdir -p saida

if [ "${REFAZER:-0}" = "1" ] || [ ! -f saida/biblia.sqlite ]; then
  python3 scripts/corpus.py
  python3 scripts/glosar.py
fi
python3 scripts/exportar.py > /dev/null   # grava o léxico em português no banco
python3 scripts/revisar.py > /dev/null
node scripts/build_web.mjs
python3 scripts/exportar.py --previa saida/previa.json GEN.1 GEN.2 GEN.3 GEN.12 EXO.20 RUT.1 PSA.1 PSA.23 PSA.51 \
  ISA.53 DAN.2 MAT.5 JHN.1 JHN.3 ROM.8 1CO.13 REV.21
python3 - <<'PY'
t = open("web/template.html", encoding="utf8").read()
d = open("saida/previa.json", encoding="utf8").read().replace("</", "<\\/")
open("saida/previa.html", "w", encoding="utf8").write(t.replace("__DATA__", d, 1))
PY
python3 scripts/build_epub.py     # saida/epub: um EPUB por livro
if [ "${PDF:-1}" = "1" ]; then python3 scripts/build_pdf.py; fi   # saida/pdf: um PDF por livro (PDF=0 pula)

if [ "${CAP_SYNC:-0}" = "1" ]; then npx cap sync; fi
echo "Pronto: saida/web, saida/previa.html, saida/epub e saida/pdf"
