# frozen_string_literal: true

# Gera os dados de uma interlinear Hebraico → Português (Gênesis 1).
#
# Fontes:
#   - Hebraico + morfologia: Open Scriptures Hebrew Bible (morphhb), CC BY 4.0
#     https://github.com/openscriptures/morphhb  (texto WLC, domínio público)
#   - Tradução corrida: Bíblia Livre (BLIVRE), © 2018 Diego Santos, Mario Sérgio
#     e Marco Teles, CC BY 4.0 — via corpus eBible (github.com/BibleNLP/ebible)
#   - Glosas palavra a palavra: glosses_pt.tsv (feitas para este protótipo)
#   - Transliteração e pronúncia do lema: dicionário Strong (1894, domínio
#     público), edição JSON da Open Scriptures, CC BY-SA
#     https://github.com/openscriptures/strongs
#
# Uso:
#   (normalmente chamado por scripts/build.sh)
#   ruby build.rb Gen.xml blivre-gn1.txt glosses_pt.tsv \
#     strongs-hebrew-dictionary.js lexicon_pt.tsv chapters_pt.tsv sections_pt.tsv \
#     sobre_genesis.json > gen1.json
#
# chapters_pt.tsv: tema de cada capítulo do livro (para o navegador "Ir para").
# sections_pt.tsv: seções com rótulo e tema (cap, versículo inicial e final).
# Atenção: a numeração de versículos segue o texto hebraico (morphhb). Em alguns
# capítulos (ex.: Gn 31–32) ela difere da numeração das Bíblias em português;
# ao incluir esses capítulos será preciso alinhar com a BLIVRE.
#
# lexicon_pt.tsv: origem, significado e traduções da King James de cada lema, traduzidos para o
# português a partir do dicionário Strong (adaptação, mesma licença CC BY-SA).

require "json"
require "rexml/document"

xml_path, blivre_path, gloss_path, strongs_path, lexicon_path, chapters_path, sections_path, about_path = ARGV
abort "uso: ruby build.rb Gen.xml gen1.txt glosses_pt.tsv strongs-hebrew-dictionary.js lexicon_pt.tsv" unless lexicon_path

# O arquivo é JS: "var strongsHebrewDictionary = {...};" — extrai o objeto JSON.
strongs_js = File.read(strongs_path, encoding: "UTF-8")
STRONGS = JSON.parse(strongs_js[strongs_js.index("{")..strongs_js.rindex("}")])

CHAPTER = 1

# Remove sinais de cantilação (U+0591–U+05AF), meteg e paseq; mantém vogais.
def strip_accents(heb)
  heb.unicode_normalize(:nfd).gsub(/[֑-ֽ֯׀]/, "")
end

# "c/d/776" → "776"; "1254 a" → "1254"
def strong_of(lemma)
  lemma.split("/").last.to_s[/\d+/]
end

PREFIX = { "b" => "em", "c" => "e", "d" => "o/a", "k" => "como", "l" => "para", "m" => "de" }.freeze

POS = {
  "V" => "verbo", "N" => "substantivo", "A" => "adjetivo", "R" => "preposição",
  "C" => "conjunção", "T" => "partícula", "D" => "advérbio", "S" => "sufixo", "P" => "pronome"
}.freeze

def pos_label(morph)
  # morph ex.: "HC/Vqw3ms" → última parte com conteúdo lexical
  core = morph.sub(/\AH/, "").split("/").reject { |p| p.start_with?("S") }.last.to_s
  POS.fetch(core[0], core[0])
end

# ---------------------------------------------------------------------------
# Pronúncia aproximada para quem fala português, derivada da pronúncia do
# Strong (escrita em convenção inglesa: "aw-mar'", "el-o-heem'").
# Convenções da saída: sílaba tônica em MAIÚSCULAS; "rr" = som do ח/כ
# (como em "carro"); "h" sempre aspirado; "ch" como em "chave".
PRON_OVERRIDES = {
  "khah'-ee" => "RRAI",     # חַי
  "haw-yaw"  => "ha-IA",    # הָיָה (o Strong não marca a tônica)
  "baw-kar"  => "ba-KAR",
  "ates"     => "ÊTS",      # עֵץ
  "eh'seb"   => "É-sev",    # עֵשֶׂב
  "bo"       => "bô",
  "law-hem'" => "la-HEM",
  "law-kem'" => "la-KEM"
}.freeze
PT_VOWEL = /\A[aeiouéê]/

def pron_syllable(syl, final:)
  # dígrafos consonantais viram marcadores de 1 caractere antes da regra do "e" mudo
  s = syl.downcase.gsub("sh", "§").gsub("kh", "®").gsub("th", "t").gsub("ph", "f")
  # "e" mudo final do inglês: o-r-e → or; a-l-e → êl; b-e-n-e → bin; b-a-sh-e → bêch
  if (m = s.match(/\A([^aeiou]*)([aeiou])([^aeiouwyh]{1,2})e\z/))
    v = { "a" => "ê", "e" => "i", "i" => "ai", "o" => "o", "u" => "u" }[m[2]]
    s = "#{m[1]}#{v}#{m[3]}"
  end
  s = s.gsub("aw", "a").gsub("ay", "ê").gsub("ee", "i").gsub("oo", "u")
  # "eh" final de palavra = e aberto; no meio da palavra, e breve
  s = s.gsub(/eh(?![aeiou])/, final ? "é" : "e").gsub(/ah(?![aeiou])/, "a")
  s = s.gsub("§", "ch").gsub("®", "rr")
  s = s.sub(/\Ayi/, "i").sub(/\Ay/, "i").gsub("y", "i")
  s.gsub(/g(?=[eiéê])/, "gu")
end

def pron_pt(pron)
  return nil if pron.nil? || pron.empty?
  return PRON_OVERRIDES[pron] if PRON_OVERRIDES.key?(pron)

  raw = pron.split("-")
  parts = raw.each_with_index.map do |p, i|
    stressed = p.include?("'")
    syl = pron_syllable(p.delete("'"), final: i == raw.size - 1)
    # e aberto quando tônico no meio da palavra (eh'-rets → É-rets)
    syl = syl.sub(/\A([^aeiou]*i?)e(?=[^aeiou]*\z)/, '\\1é') if stressed && p.match?(/eh/) && i < raw.size - 1
    [syl, stressed]
  end
  # ressilabação à moda do português: consoante final passa para a sílaba
  # seguinte quando esta começa por vogal (el-o-heem → e-lo-him)
  (0...parts.size - 1).each do |i|
    cur, nxt = parts[i][0], parts[i + 1][0]
    next unless nxt.match?(PT_VOWEL)
    coda = cur[/(rr|ch|[^aeiouéê])\z/]
    next unless coda && cur.size > coda.size
    parts[i][0] = cur[0...-coda.size]
    parts[i + 1][0] = coda + nxt
  end
  parts.map { |syl, stressed| stressed ? syl.upcase : syl }.join("-")
end

# Preposições inseparáveis com sufixo (ב, ל) não têm verbete no Strong.
NO_STRONG = {
  "ב/וֹ"   => { "lemma" => "בּוֹ", "xlit" => "bô", "pron" => "bo" },
  "בּ/וֹ"  => { "lemma" => "בּוֹ", "xlit" => "bô", "pron" => "bo" },
  "לָ/הֶם" => { "lemma" => "לָהֶם", "xlit" => "lâhem", "pron" => "law-hem'" },
  "לָ/כֶם" => { "lemma" => "לָכֶם", "xlit" => "lâkem", "pron" => "law-kem'" }
}.freeze

glosses = {}
File.foreach(gloss_path, encoding: "UTF-8").drop(1).each do |line|
  heb, morph, gloss = line.chomp.split("\t")
  glosses["#{heb}|#{morph}"] = gloss
end

lexicon_pt = {}
File.foreach(lexicon_path, encoding: "UTF-8").drop(1).each do |line|
  strong, origem, significado, kjv = line.chomp.split("\t")
  lexicon_pt[strong] = { origem: origem, significado: significado, kjv: kjv }
end

blivre = File.readlines(blivre_path, encoding: "UTF-8", chomp: true)

doc = REXML::Document.new(File.read(xml_path, encoding: "UTF-8"))
verses = []
missing = []

REXML::XPath.each(doc, "//verse[starts-with(@osisID, 'Gen.#{CHAPTER}.')]") do |v|
  num = v.attributes["osisID"].split(".").last.to_i
  words = REXML::XPath.match(v, "w").map do |w|
    heb   = w.text.to_s
    morph = w.attributes["morph"]
    key   = "#{strip_accents(heb)}|#{morph}"
    missing << "#{num}: #{key}" unless glosses.key?(key)
    strong = strong_of(w.attributes["lemma"])
    entry  = STRONGS["H#{strong}"] || NO_STRONG.fetch(strip_accents(heb), {})
    {
      heb: heb.delete("/"),
      parts: heb.split("/"),
      strong: strong,
      lemma: entry["lemma"],
      xlit: entry["xlit"],
      pron: entry["pron"],
      pron_pt: pron_pt(entry["pron"]),
      morph: morph,
      pos: pos_label(morph),
      gloss: glosses.fetch(key, "?")
    }
  end
  verses << { n: num, words: words, blivre: blivre[num - 1] }
end

# Léxico: um verbete por lema usado no capítulo, mais os verbetes citados
# na origem (raízes), para permitir seguir a cadeia de derivação.
used = verses.flat_map { |v| v[:words].map { |w| w[:strong] } }.compact.tally
lex = {}
untranslated = []
used.each do |strong, count|
  e  = STRONGS.fetch("H#{strong}")
  pt = lexicon_pt[strong]
  untranslated << strong unless pt
  lex[strong] = {
    lemma: e["lemma"], xlit: e["xlit"], pron: e["pron"], pron_pt: pron_pt(e["pron"]),
    origem: pt&.dig(:origem), significado: pt&.dig(:significado),
    kjv: pt&.dig(:kjv), count: count
  }
end
lex.values.flat_map { |e| e[:origem].to_s.scan(/H(\d+)/).flatten }.uniq.each do |ref|
  next if lex.key?(ref)
  e = STRONGS["H#{ref}"] or next
  lex[ref] = {
    lemma: e["lemma"], xlit: e["xlit"], pron: e["pron"], pron_pt: pron_pt(e["pron"]),
    origem_en: e["derivation"], significado_en: e["strongs_def"], count: 0
  }
end
warn "verbetes sem tradução: #{untranslated.join(", ")}" unless untranslated.empty?

warn "glosas faltando: #{missing.size}" unless missing.empty?
missing.each { |m| warn "  #{m}" }
warn "#{verses.size} versículos, #{verses.sum { |v| v[:words].size }} palavras"

# Livro: versículos por capítulo (contados no texto hebraico) + tema de cada capítulo
chapter_themes = {}
if chapters_path
  File.foreach(chapters_path, encoding: "UTF-8").drop(1).each do |line|
    n, tema = line.chomp.split("\t")
    chapter_themes[n.to_i] = tema
  end
end
chapters = REXML::XPath.match(doc, "//chapter").map do |ch|
  n = ch.attributes["osisID"].split(".").last.to_i
  { n: n, verses: REXML::XPath.match(ch, "verse").size, title: chapter_themes[n], available: n == CHAPTER }
end

sections = []
if sections_path
  File.foreach(sections_path, encoding: "UTF-8").drop(1).each do |line|
    cap, ini, fim, rotulo, tema = line.chomp.split("\t")
    sections << { chapter: cap.to_i, from: ini.to_i, to: fim.to_i, label: rotulo, theme: tema }
  end
end

book = { name: "Gênesis", abbr: "Gn", osis: "Gen", chapters: chapters }
# Introdução ao livro (resumo, pessoas, datas, contexto) — sobre_genesis.json
book[:about] = JSON.parse(File.read(about_path, encoding: "UTF-8")) if about_path
puts JSON.pretty_generate({ book: book, chapter: CHAPTER, sections: sections, verses: verses, lex: lex })
