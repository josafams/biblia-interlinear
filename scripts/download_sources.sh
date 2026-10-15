#!/usr/bin/env bash
# Baixa as fontes de dados abertas usadas pelo projeto para sources/
# (essa pasta não vai para o repositório: os dados são de terceiros e devem
#  ser obtidos sempre da origem, que é onde as correções são publicadas).
# Licenças de cada fonte: docs/LICENCAS.md
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p sources && cd sources

# Texto hebraico e aramaico + morfologia — Open Scriptures Hebrew Bible (CC BY 4.0)
[ -d morphhb ] || git clone --depth 1 https://github.com/openscriptures/morphhb.git

# Texto grego SBLGNT (CC BY 4.0) + morfologia e lemas MorphGNT (CC BY-SA)
[ -d sblgnt ] || git clone --depth 1 https://github.com/morphgnt/sblgnt.git

# Dicionário Strong (1890/1894, domínio público) — edição Open Scriptures (CC BY-SA)
[ -d strongs ] || git clone --depth 1 https://github.com/openscriptures/strongs.git

# Léxico grego de Jeffrey Dodson (domínio público / CC0)
[ -d dodson ] || git clone --depth 1 https://github.com/biblicalhumanities/Dodson-Greek-Lexicon.git dodson

# Bíblia Livre, revisão 2018 (CC BY 4.0) — via corpus eBible (BibleNLP), só os arquivos necessários
if [ ! -d ebible ]; then
  git clone --depth 1 --filter=blob:none --sparse https://github.com/BibleNLP/ebible.git
  git -C ebible sparse-checkout set --no-cone /corpus/por-porbr2018.txt /metadata/vref.txt
fi

# Bíblia Livre, edição 2017 (CC BY 3.0 BR; módulo CrossWire) — via scrollmapper/bible_databases
if [ ! -f scrollmapper/PorBLivre.csv ]; then
  rm -rf .sm && git clone -q --depth 1 --filter=blob:none --sparse https://github.com/scrollmapper/bible_databases.git .sm
  git -C .sm sparse-checkout set --no-cone /formats/csv/PorBLivre.csv /sources/pt/PorBLivre/PorBLivre.zip
  mkdir -p scrollmapper
  cp .sm/formats/csv/PorBLivre.csv scrollmapper/
  unzip -p .sm/sources/pt/PorBLivre/PorBLivre.zip 'mods.d/porblivre.conf' > scrollmapper/porblivre.conf || true
  rm -rf .sm
fi

# Gênesis 1 da BLIVRE (linhas 1–31 do corpus = GEN 1:1–31 no vref) — usado pelas glosas revisadas de Gn 1
head -31 ebible/corpus/por-porbr2018.txt > blivre-gn1.txt
echo "Fontes prontas em sources/"
