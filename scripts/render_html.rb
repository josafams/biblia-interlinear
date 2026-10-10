# frozen_string_literal: true
# Insere os dados (JSON) no template e gera a página final.
# Uso: ruby render_html.rb web/template.html saida/gen1.json saida/genesis1-interlinear.html
require "json"
template_path, json_path, out_path = ARGV
abort "uso: ruby render_html.rb template.html dados.json saida.html" unless out_path
data = JSON.generate(JSON.parse(File.read(json_path, encoding: "UTF-8"))).gsub("</", "<\\/")
html = File.read(template_path, encoding: "UTF-8").sub("__DATA__") { data }
File.write(out_path, html)
warn "Página gerada: #{out_path}"
