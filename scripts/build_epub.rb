# frozen_string_literal: true

# Gera um EPUB 3 da interlinear a partir do gen1.json (saída do build.rb).
# No Kindle e em outros leitores, cada palavra hebraica é uma nota pop-up
# com glosa, análise gramatical e o verbete Strong em português.
#
# Uso: ruby build_epub.rb saida/gen1.json fontes-epub/ saida/genesis1-interlinear.epub

require "json"
require "fileutils"
require "securerandom"
require "time"
require "cgi"

json_path, fonts_dir, out_path = ARGV
abort "uso: ruby build_epub.rb gen1.json epub-fonts/ saida.epub" unless out_path

DATA = JSON.parse(File.read(json_path, encoding: "UTF-8"))
LEX  = DATA["lex"]

def h(s) = CGI.escapeHTML(s.to_s)

# Leitores de e-ink renderizam mal os sinais de cantilação; mantém só as vogais.
def plain(heb) = heb.unicode_normalize(:nfd).gsub(/[֑-ֽ֯׀]/, "").unicode_normalize(:nfc)

# --- Análise morfológica (mesma lógica da página web) ---
STEM = { "q" => "qal", "N" => "nifal", "p" => "piel", "P" => "pual", "h" => "hifil", "H" => "hofal", "t" => "hitpael", "o" => "polel" }.freeze
TYPE = { "p" => "perfeito", "q" => "perfeito consecutivo", "i" => "imperfeito", "w" => "imperfeito consecutivo",
         "h" => "coortativo", "j" => "jussivo", "v" => "imperativo", "r" => "particípio", "s" => "particípio passivo",
         "a" => "infinitivo absoluto", "c" => "infinitivo construto" }.freeze
PERS = { "1" => "1ª", "2" => "2ª", "3" => "3ª" }.freeze
GEN  = { "m" => "masc.", "f" => "fem.", "c" => "comum", "b" => "ambos" }.freeze
NUM  = { "s" => "sing.", "p" => "plural", "d" => "dual" }.freeze
PART = { "R" => "preposição", "C" => "conjunção", "Td" => "artigo", "To" => "marcador de objeto",
         "Tr" => "relativo", "Tm" => "interjeição", "D" => "advérbio" }.freeze

def pgn(str)
  m = str.to_s.match(/\A([123])?([mfcb])?([spd])?/)
  [PERS[m[1]], GEN[m[2]], NUM[m[3]]].compact.join(" ")
end

def decode_part(p)
  return PART[p] if PART[p]
  case p[0]
  when "V" then "verbo #{STEM.fetch(p[1], p[1])} #{TYPE.fetch(p[2], p[2])} #{pgn(p[3..])}".strip
  when "N", "A"
    base = if p[0] == "N" then p[1] == "p" ? "nome próprio" : "substantivo"
           else { "c" => "numeral", "o" => "ordinal" }.fetch(p[1], "adjetivo") end
    tail = p[2..].to_s
    st = { "c" => "construto", "a" => "absoluto" }[tail[2]]
    [base, GEN[tail[0]], NUM[tail[1]], st].compact.join(" ")
  when "S" then "sufixo #{pgn(p[2..])}"
  when "T" then "partícula"
  else p
  end
end

def decode_morph(m) = m.sub(/\AH/, "").split("/").map { |p| decode_part(p) }.join(" + ")

def gloss_html(g) = h(g).gsub("[obj]", '<span class="obj">[obj]</span>')

# "de H215" → link para o verbete no léxico
def link_refs(text)
  h(text).gsub(/H(\d+)/) do
    n = Regexp.last_match(1)
    e = LEX[n]
    e ? %(<a href="lexico.xhtml#h#{n}">H#{n} <span class="he" lang="he" dir="rtl">#{h(e["lemma"])}</span> <i>#{h(e["xlit"])}</i></a>) : "H#{n}"
  end
end

def entry_body(n)
  e = LEX[n]
  return "<p>Preposição com sufixo pronominal; o Strong não tem verbete próprio para ela.</p>" unless e

  origem = e["origem"] ? link_refs(e["origem"]) : "#{link_refs(e["origem_en"])} <i>(inglês)</i>"
  sig    = e["significado"] ? h(e["significado"]) : "#{h(e["significado_en"])} <i>(inglês)</i>"
  out = +""
  out << %(<p class="lbl">Origem</p><p>#{origem}</p>)
  out << %(<p class="lbl">Significado</p><p>#{sig}</p>)
  out << %(<p class="lbl">Como a King James traduz</p><p>#{h(e["kjv"])}</p>) if e["kjv"]
  out
end

XHTML_HEAD = lambda do |title|
  <<~X
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE html>
    <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt-BR" xml:lang="pt-BR">
    <head><meta charset="UTF-8"/><title>#{h(title)}</title><link rel="stylesheet" type="text/css" href="estilo.css"/></head>
    <body>
  X
end
XHTML_FOOT = "</body>\n</html>\n"

PRON_LEGEND = "Pronúncia aproximada: sílaba tônica em MAIÚSCULAS; rr como em “carro”; h sempre aspirado; ch como em “chave”."

DAYS = { 5 => "1º dia", 8 => "2º dia", 13 => "3º dia", 19 => "4º dia", 23 => "5º dia", 31 => "6º dia" }.freeze

# --- Capítulo ---
chapter = +XHTML_HEAD.call("Gênesis 1")
chapter << %(<section epub:type="chapter" id="gn1">\n<h1>Gênesis 1 <span class="he" lang="he" dir="rtl">בְּרֵאשִׁית</span></h1>\n)
chapter << %(<p class="intro">Leia da direita para a esquerda. Toque na palavra hebraica para abrir a nota com o verbete. #{PRON_LEGEND}</p>\n)
notes = +XHTML_HEAD.call("Notas das palavras")
notes << %(<section epub:type="endnotes" id="notas">\n<h1>Notas das palavras</h1>\n)

# Kindle ignora inline-block/flex: a linha interlinear vira tabela de largura
# fixa, PER_ROW palavras por linha, com as células já em ordem visual
# (primeira palavra à direita) para não depender do suporte a bidi do leitor.
PER_ROW = 4

DATA["verses"].each do |v|
  n = v["n"]
  day = DAYS[n] ? %( <span class="day">#{DAYS[n]}</span>) : ""
  chapter << %(<h2 class="vn" id="v#{n}">1:#{n}#{day}</h2>\n)
  v["words"].each_with_index.each_slice(PER_ROW) do |slice|
    cells = slice.map do |w, i|
      id = "n#{n}-#{i}"
      xlit = w["xlit"] ? %(<p class="x">#{h(w["xlit"])}</p>) : ""
      %(<td><p class="h"><a epub:type="noteref" href="notas.xhtml##{id}" id="r#{id}" lang="he" dir="rtl">#{h(plain(w["heb"]))}</a></p>) +
        %(#{xlit}<p class="g">#{gloss_html(w["gloss"])}</p></td>)
    end
    cells += Array.new(PER_ROW - cells.size, "<td></td>")
    # tabela só de layout: role=presentation evita "tabela, 4 colunas" no leitor de tela
    chapter << %(<table class="il" role="presentation"><tr>#{cells.reverse.join}</tr></table>\n)
  end
  v["words"].each_with_index do |w, i|
    id = "n#{n}-#{i}"
    strong = w["strong"] ? "H#{w["strong"]}" : "sem verbete Strong"
    lemma  = w["lemma"] ? %(<span class="he" lang="he" dir="rtl">#{h(w["lemma"])}</span> <i>#{h(w["xlit"])}</i> · pronúncia <span class="pr">#{h(w["pron_pt"])}</span>) : ""
    notes << %(<aside epub:type="footnote" id="#{id}" class="note">) +
             %(<p class="nh"><a href="gn1.xhtml#r#{id}">1:#{n}</a> <span class="he" lang="he" dir="rtl">#{h(plain(w["heb"]))}</span> = #{gloss_html(w["gloss"])}</p>) +
             %(<p class="morph">#{h(decode_morph(w["morph"]))}</p>) +
             %(<p class="lemma"><b>#{strong}</b> #{lemma}</p>) +
             entry_body(w["strong"]) +
             %(</aside>\n)
  end
  chapter << %(<p class="bl"><span class="tag">BLIVRE</span> #{h(v["blivre"])}</p>\n)
end
chapter << "</section>\n" << XHTML_FOOT
notes << "</section>\n" << XHTML_FOOT

# --- Léxico (apêndice legível, em ordem Strong) ---
lex = +XHTML_HEAD.call("Léxico")
lex << %(<section epub:type="glossary" id="lexico">\n<h1>Léxico</h1>\n<p class="intro">Verbetes do dicionário Strong usados em Gênesis 1, mais as raízes citadas na origem. #{PRON_LEGEND}</p>\n)
LEX.keys.sort_by(&:to_i).each do |n|
  e = LEX[n]
  uso = e["count"].to_i.positive? ? "#{e["count"]}× em Gn 1" : "raiz, não aparece em Gn 1"
  lex << %(<div class="entry" id="h#{n}"><p class="lemma"><b>H#{n}</b> <span class="he big" lang="he" dir="rtl">#{h(e["lemma"])}</span> <i>#{h(e["xlit"])}</i> · pronúncia <span class="pr">#{h(e["pron_pt"])}</span> <span class="day">#{uso}</span></p>#{entry_body(n)}</div>\n)
end
lex << "</section>\n" << XHTML_FOOT

# --- Créditos ---
# --- Sobre o livro (resumo, pessoas, datas, contexto) ---
about = +XHTML_HEAD.call("Sobre Gênesis")
if (ab = DATA.dig("book", "about"))
  about << %(<section epub:type="introduction" id="sobre">\n<h1>Sobre Gênesis <span class="he" lang="he" dir="rtl">#{h(ab["title_he"])}</span></h1>\n)
  about << %(<p class="lead">#{h(ab["summary"])}</p>\n)
  about << %(<ul class="facts">#{ab["facts"].map { |k, v| "<li><b>#{h(k)}:</b> #{h(v)}</li>" }.join}</ul>\n)
  about << %(<h2>O nome</h2><p>#{h(ab["name"])}</p>\n)
  about << %(<h2>Como o livro se divide</h2><ul>#{ab["structure"].map { |p| "<li><b>#{h(p["title"])}</b> (caps. #{p["from"]}–#{p["to"]}): #{h(p["text"])}</li>" }.join}</ul><p>#{h(ab["toledot"])}</p>\n)
  about << %(<h2>Pessoas principais</h2><ul>#{ab["people"].map { |p| "<li><b>#{h(p["name"])}</b> (caps. #{h(p["chapters"])}): #{h(p["note"])}</li>" }.join}</ul>\n)
  about << %(<h2>Quando foi escrito</h2><p><b>Segundo a tradição.</b> #{h(ab.dig("writing", "tradition"))}</p><p><b>Segundo a pesquisa acadêmica.</b> #{h(ab.dig("writing", "academic"))}</p>\n)
  ev = ab["events"]
  about << %(<h2>Quando se passam os acontecimentos</h2><p>#{h(ev["intro"])}</p>)
  about << %(<ul>#{ev["timeline"].map { |t| "<li><b>#{h(t["label"])}</b>: c. #{t["from"]}–#{t["to"]} a.C. (#{h(t["note"])})</li>" }.join}</ul>\n)
  about << %(<h2>Contexto histórico</h2><p>#{h(ab["context"])}</p><p><b>Lugares:</b> #{ab["places"].map { |x| h(x) }.join(" · ")}</p>\n)
  about << %(<h2>Temas</h2><p>#{ab["themes"].map { |x| h(x) }.join(" · ")}</p>\n)
  about << %(<h2>Versículos-chave</h2>#{ab["key_verses"].map { |k| "<blockquote><p>#{h(k["text"])}</p><p class=\"cite\">Gênesis #{h(k["ref"])} · BLIVRE</p></blockquote>" }.join}\n)
  about << %(<p class="intro">#{h(ab["note"])}</p>\n</section>\n)
end
about << XHTML_FOOT

credits = +XHTML_HEAD.call("Fontes e licenças")
credits << <<~X
  <section epub:type="colophon" id="creditos">
  <h1>Fontes e licenças</h1>
  <p><b>Texto hebraico e morfologia:</b> Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb (CC BY 4.0), baseado no Westminster Leningrad Codex (domínio público). Os sinais de cantilação foram omitidos nesta edição para facilitar a leitura em telas de tinta eletrônica.</p>
  <p><b>Tradução corrida:</b> Bíblia Livre (BLIVRE), © 2018 Diego Santos, Mario Sérgio e Marco Teles, versão de fevereiro de 2018, https://sites.google.com/site/biblialivre/, licença Creative Commons Atribuição 4.0 Brasil. Texto reproduzido sem alterações, obtido do corpus eBible (BibleNLP).</p>
  <p><b>Transliteração, pronúncia, origem, significado e traduções da King James:</b> dicionário de James Strong (1894, domínio público), edição digital © 2010 Open Scriptures, https://github.com/openscriptures/strongs, licença CC BY-SA. Origem, significado e traduções da King James foram vertidos para o português, e a pronúncia aproximada em português foi derivada da pronúncia do Strong, nesta edição (adaptações sob a mesma licença).</p>
  <p><b>Glosas palavra a palavra:</b> feitas para este protótipo, com revisão pendente. Não fazem parte da BLIVRE e não têm endosso de seus autores.</p>
  <p><b>Fonte tipográfica:</b> Noto Serif Hebrew, © 2022 The Noto Project Authors, SIL Open Font License 1.1 (texto completo abaixo).</p>
  <div class="ofl">#{File.read(File.join(fonts_dir, "OFL.txt"), encoding: "UTF-8").split(/\n{2,}/).map { |para| "<p>#{h(para.strip)}</p>" }.join}</div>
  </section>
X
credits << XHTML_FOOT

CSS = <<~CSS
  @font-face { font-family: "NotoHeb"; font-weight: normal; src: url(fonts/NotoSerifHebrew-400.ttf); }
  @font-face { font-family: "NotoHeb"; font-weight: bold; src: url(fonts/NotoSerifHebrew-600.ttf); }
  body { margin: 0 2%; line-height: 1.45; }
  h1 { font-size: 1.5em; margin: 0.6em 0 0.3em; text-align: left; }
  .he, .h { font-family: "NotoHeb", serif; }
  .intro { font-size: 0.85em; font-style: italic; margin: 0 0 1em; }
  h2.vn { font-size: 0.85em; font-weight: bold; margin: 1.4em 0 0.3em; page-break-after: avoid; text-align: left; }
  .pr { font-family: monospace; letter-spacing: 0.02em; }
  .day { font-weight: normal; font-style: italic; font-size: 0.9em; }
  table.il { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 0.4em; }
  table.il td { width: 25%; vertical-align: top; text-align: center; padding: 0.2em 0.15em; }
  table.il p { margin: 0; text-indent: 0; text-align: center; }
  table.il .h { font-size: 1.5em; line-height: 1.35; }
  table.il .h a { color: inherit; text-decoration: none; }
  table.il .x { font-size: 0.72em; font-style: italic; line-height: 1.2; }
  table.il .g { font-size: 0.78em; line-height: 1.2; }
  .obj { font-size: 0.85em; font-style: normal; }
  .bl { margin: 0.4em 0 0; text-indent: 0; text-align: left; padding-bottom: 0.6em; border-bottom: 1px solid #ccc; }
  .tag { font-size: 0.7em; font-weight: bold; letter-spacing: 0.05em; }
  .note, .entry { margin: 0 0 1.2em; padding-bottom: 0.6em; border-bottom: 1px solid #ccc; }
  .note p, .entry p { margin: 0.2em 0; text-indent: 0; }
  .nh { font-size: 1.05em; }
  .nh .he { font-size: 1.3em; }
  .morph { font-size: 0.85em; font-style: italic; }
  .lbl { font-size: 0.7em; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 0.5em; }
  .big { font-size: 1.4em; }
  .lead { font-size: 1.1em; text-indent: 0; }
  .facts { list-style: none; padding: 0; }
  #sobre h2 { font-size: 1.1em; margin: 1.2em 0 0.4em; }
  #sobre p { text-indent: 0; margin: 0.4em 0; }
  blockquote { margin: 0.6em 1em; font-style: italic; }
  blockquote .cite { font-style: normal; font-size: 0.8em; }
  .ofl p { font-size: 0.75em; margin: 0.4em 0; text-indent: 0; }
CSS

NAV = <<~X
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE html>
  <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt-BR" xml:lang="pt-BR">
  <head><meta charset="UTF-8"/><title>Sumário</title></head>
  <body>
  <nav epub:type="toc" id="toc"><h1>Sumário</h1><ol>
    <li><a href="sobre.xhtml">Sobre Gênesis</a></li>
    <li><a href="gn1.xhtml">Gênesis 1</a></li>
    <li><a href="lexico.xhtml">Léxico</a></li>
    <li><a href="notas.xhtml">Notas das palavras</a></li>
    <li><a href="creditos.xhtml">Fontes e licenças</a></li>
  </ol></nav>
  <nav epub:type="landmarks" hidden=""><ol><li><a epub:type="bodymatter" href="gn1.xhtml">Início</a></li></ol></nav>
  </body>
  </html>
X

uuid = "urn:uuid:#{SecureRandom.uuid}"
OPF = <<~X
  <?xml version="1.0" encoding="UTF-8"?>
  <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="pt-BR">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:identifier id="bookid">#{uuid}</dc:identifier>
      <dc:title>Gênesis 1 Interlinear</dc:title>
      <dc:language>pt-BR</dc:language>
      <dc:creator>Protótipo BLIVRE interlinear</dc:creator>
      <dc:rights>Texto BLIVRE CC BY 4.0; hebraico OSHB CC BY 4.0; léxico Strong (Open Scriptures) CC BY-SA</dc:rights>
      <meta property="dcterms:modified">#{Time.now.utc.strftime("%Y-%m-%dT%H:%M:%SZ")}</meta>
      <meta property="schema:accessMode">textual</meta>
      <meta property="schema:accessModeSufficient">textual</meta>
      <meta property="schema:accessibilityFeature">structuralNavigation</meta>
      <meta property="schema:accessibilityFeature">tableOfContents</meta>
      <meta property="schema:accessibilityFeature">readingOrder</meta>
      <meta property="schema:accessibilityFeature">alternativeScript</meta>
      <meta property="schema:accessibilityFeature">displayTransformability</meta>
      <meta property="schema:accessibilityHazard">none</meta>
      <meta property="schema:accessibilitySummary">Texto hebraico de Gênesis 1 com transliteração, glosa em português, pronúncia aproximada e notas de verbete para cada palavra. Os versículos são títulos navegáveis; o sumário leva à introdução do livro, ao capítulo, ao léxico, às notas e aos créditos. O hebraico está marcado com idioma e direção próprios. Sem imagens, áudio ou animações.</meta>
    </metadata>
    <manifest>
      <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
      <item id="css" href="estilo.css" media-type="text/css"/>
      <item id="f400" href="fonts/NotoSerifHebrew-400.ttf" media-type="font/ttf"/>
      <item id="f600" href="fonts/NotoSerifHebrew-600.ttf" media-type="font/ttf"/>
      <item id="sobre" href="sobre.xhtml" media-type="application/xhtml+xml"/>
      <item id="gn1" href="gn1.xhtml" media-type="application/xhtml+xml"/>
      <item id="lexico" href="lexico.xhtml" media-type="application/xhtml+xml"/>
      <item id="notas" href="notas.xhtml" media-type="application/xhtml+xml"/>
      <item id="creditos" href="creditos.xhtml" media-type="application/xhtml+xml"/>
    </manifest>
    <spine>
      <itemref idref="sobre"/>
      <itemref idref="gn1"/>
      <itemref idref="lexico"/>
      <itemref idref="notas" linear="yes"/>
      <itemref idref="creditos"/>
    </spine>
  </package>
X

CONTAINER = <<~X
  <?xml version="1.0" encoding="UTF-8"?>
  <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
  </container>
X

dir = File.join(File.dirname(File.expand_path(out_path)), "epub-build")
FileUtils.rm_rf(dir)
FileUtils.mkdir_p(File.join(dir, "META-INF"))
FileUtils.mkdir_p(File.join(dir, "OEBPS", "fonts"))
File.write(File.join(dir, "mimetype"), "application/epub+zip")
File.write(File.join(dir, "META-INF", "container.xml"), CONTAINER)
o = File.join(dir, "OEBPS")
{ "content.opf" => OPF, "nav.xhtml" => NAV, "estilo.css" => CSS, "gn1.xhtml" => chapter, "sobre.xhtml" => about,
  "lexico.xhtml" => lex, "notas.xhtml" => notes, "creditos.xhtml" => credits }.each do |name, body|
  File.write(File.join(o, name), body)
end
%w[NotoSerifHebrew-400.ttf NotoSerifHebrew-600.ttf].each { |f| FileUtils.cp(File.join(fonts_dir, f), File.join(o, "fonts", f)) }

out = File.expand_path(out_path)
FileUtils.rm_f(out)
Dir.chdir(dir) do
  system("zip", "-X0q", out, "mimetype", exception: true)
  system("zip", "-Xr9Dq", out, "META-INF", "OEBPS", exception: true)
end
warn "EPUB gerado: #{out}"
