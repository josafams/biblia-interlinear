#!/usr/bin/env python3
"""Gera um EPUB 3 por livro (66) a partir de build/web/dados (scripts/export.py).

No Kindle e em outros leitores, cada palavra do original é uma nota pop-up com glosa, análise gramatical
e significado; o verbete completo fica no léxico do livro, no fim. Um arquivo XHTML por capítulo
(e um de notas por capítulo) para os livros grandes abrirem rápido no e-reader.

Uso: python3 scripts/build_epub.py              → Bíblia completa, AT, NT e os 66 livros (build/epub)
     python3 scripts/build_epub.py volumes      → só a Bíblia completa e os volumes AT e NT
     python3 scripts/build_epub.py GEN JHN      → só esses livros
"""

import html
import json
import os
import re
import sys
import unicodedata
import uuid
import zipfile
from datetime import UTC, datetime
from pathlib import Path

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "build", "data")
SOURCES = os.path.join(ROOT, "epub-fonts")
OUT = os.path.join(ROOT, "build", "epub")
PER_ROW = 4  # palavras por linha da tabela interlinear (Kindle ignora flex/inline-block)


def h(s):
    return html.escape(str(s or ""), quote=True)


def plain(t):
    """Tira cantilação, meteg e paseq (e-ink renderiza mal); mantém consoantes e vogais."""
    t = unicodedata.normalize("NFD", t.replace("/", ""))
    t = re.sub(r"[֑-ֽ֯׀׃]", "", t)
    return unicodedata.normalize("NFC", t)


# ---------- morfologia (mesma lógica da página) ----------
STEM = {
    "q": "qal",
    "N": "nifal",
    "p": "piel",
    "P": "pual",
    "h": "hifil",
    "H": "hofal",
    "t": "hitpael",
    "o": "polel",
    "O": "polal",
    "r": "hitpolel",
    "m": "poel",
    "M": "poal",
    "k": "palel",
    "K": "pulal",
    "Q": "qal passivo",
    "l": "pilpel",
    "L": "polpal",
    "f": "hitpalpel",
    "D": "nitpael",
    "j": "pealal",
    "i": "pilel",
    "u": "hotpaal",
    "c": "tifil",
    "v": "hishtafel",
    "w": "nitpael",
    "y": "hitpoel",
    "z": "hitpael",
    "e": "peal",
    "E": "peil",
    "a": "afel",
    "A": "hafel",
}
TYPE = {
    "p": "perfeito",
    "q": "perfeito consecutivo",
    "i": "imperfeito",
    "w": "imperfeito consecutivo",
    "h": "coortativo",
    "j": "jussivo",
    "v": "imperativo",
    "r": "particípio",
    "s": "particípio passivo",
    "a": "infinitivo absoluto",
    "c": "infinitivo construto",
}
PERS = {"1": "1ª", "2": "2ª", "3": "3ª"}
GEN = {"m": "masc.", "f": "fem.", "c": "comum", "b": "ambos"}
NUM = {"s": "sing.", "p": "plural", "d": "dual"}
PART = {
    "R": "preposição",
    "Rd": "preposição com artigo",
    "C": "conjunção",
    "Td": "artigo",
    "To": "marcador de objeto",
    "Tr": "relativo",
    "Tm": "interjeição",
    "Ti": "interrogativo",
    "Tn": "negação",
    "D": "advérbio",
    "Sd": "he direcional",
    "Sh": "he paragógico",
    "Sn": "nun paragógico",
}


def pgn(s):
    m = re.match(r"([123])?([mfcb])?([spd])?", s or "")
    return " ".join(x for x in (PERS.get(m[1]), GEN.get(m[2]), NUM.get(m[3])) if x)


def decode_part(p):
    if p in PART:
        return PART[p]
    k = p[:1]
    if k == "V":
        return f"verbo {STEM.get(p[1:2], p[1:2])} {TYPE.get(p[2:3], p[2:3])} {pgn(p[3:])}".strip()
    if k in ("N", "A"):
        base = (
            ("nome próprio" if p[1:2] == "p" else "nome gentílico" if p[1:2] == "g" else "substantivo")
            if k == "N"
            else {"c": "numeral", "o": "ordinal"}.get(p[1:2], "adjetivo")
        )
        t = p[2:]
        st = {"c": "construto", "a": "absoluto", "d": "determinado"}.get(t[2:3], "")
        return " ".join(x for x in (base, GEN.get(t[:1]), NUM.get(t[1:2]), st) if x)
    if k == "P":
        return "pronome"
    if k == "S":
        return "sufixo " + pgn(p[2:])
    if k == "T":
        return "partícula"
    return p


G_POS = {
    "A": "adjetivo",
    "C": "conjunção",
    "D": "advérbio",
    "I": "interjeição",
    "N": "substantivo",
    "P": "preposição",
    "RA": "artigo",
    "RD": "pronome demonstrativo",
    "RI": "pronome interrogativo/indefinido",
    "RP": "pronome pessoal",
    "RR": "pronome relativo",
    "V": "verbo",
    "X": "partícula",
}
G_TENSE = {"P": "presente", "I": "imperfeito", "F": "futuro", "A": "aoristo", "X": "perfeito", "Y": "mais-que-perfeito"}
G_VOICE = {"A": "ativo", "M": "médio", "P": "passivo"}
G_MOOD = {"I": "indicativo", "D": "imperativo", "S": "subjuntivo", "O": "optativo", "N": "infinitivo", "P": "particípio"}
G_CASE = {"N": "nominativo", "G": "genitivo", "D": "dativo", "A": "acusativo", "V": "vocativo"}
G_NUM = {"S": "sing.", "P": "plural"}
G_GEN = {"M": "masc.", "F": "fem.", "N": "neutro"}
G_DEG = {"C": "comparativo", "S": "superlativo"}


def decode_morph(m, grc):
    if not m:
        return ""
    if grc:
        pos, _, p = m.partition("-")
        p = p.ljust(8, "-")
        out = [G_POS.get(pos, pos)]
        if p[1] != "-":
            out += [G_TENSE.get(p[1]), G_VOICE.get(p[2]), G_MOOD.get(p[3])]
        if p[0] != "-":
            out.append(PERS.get(p[0], "") + " pessoa")
        out += [G_CASE.get(p[4]), G_GEN.get(p[6]), G_NUM.get(p[5]), G_DEG.get(p[7])]
        return " ".join(x for x in out if x)
    pre = "aramaico: " if m[:1] == "A" else ""
    return pre + " + ".join(decode_part(x) for x in m[1:].split("/") if x)


def gloss_html(g):
    return h(g or "—").replace("[obj]", '<span class="obj">[obj]</span>')


def short(e):
    s = e.get("s") or e.get("se") or e.get("ge") or ""
    return re.split(r"[;(]", s)[0].strip()


def fmt_y(y):
    return f"{-y} a.C." if y < 0 else f"{y} d.C."


def fmt_range(a, b):
    if a == b:
        return "c. " + fmt_y(a)
    if a < 0 and b < 0:
        return f"c. {-a}–{-b} a.C."
    if a > 0 and b > 0:
        return f"c. {a}–{b} d.C."
    return f"c. {fmt_y(a)}–{fmt_y(b)}"


def page(title, body):
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt-BR" xml:lang="pt-BR">\n'
        f'<head><meta charset="UTF-8"/><title>{h(title)}</title><link rel="stylesheet" type="text/css" href="estilo.css"/></head>\n'
        f"<body>\n{body}</body>\n</html>\n"
    )


PRON = "Pronúncia aproximada: sílaba tônica em MAIÚSCULAS; rr como em “carro”; h sempre aspirado; ch como em “chave”; th como no inglês “think”."

CSS = """@font-face { font-family: "NotoHeb"; font-weight: normal; src: url(fonts/NotoSerifHebrew-400.ttf); }
@font-face { font-family: "NotoHeb"; font-weight: bold; src: url(fonts/NotoSerifHebrew-600.ttf); }
body { margin: 0 2%; line-height: 1.45; }
h1 { font-size: 1.5em; margin: 0.6em 0 0.2em; text-align: left; }
.he, .h { font-family: "NotoHeb", serif; }
.grc { font-family: serif; }
.tema { font-style: italic; margin: 0 0 0.8em; text-indent: 0; }
.intro { font-size: 0.85em; font-style: italic; margin: 0 0 1em; text-indent: 0; }
h2.vn { font-size: 0.85em; font-weight: bold; margin: 1.4em 0 0.3em; page-break-after: avoid; text-align: left; }
.pr { font-family: monospace; letter-spacing: 0.02em; }
table.il { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 0.4em; }
table.il td { width: 25%; vertical-align: top; text-align: center; padding: 0.2em 0.15em; }
table.il p { margin: 0; text-indent: 0; text-align: center; }
table.il .h { font-size: 1.5em; line-height: 1.35; }
table.il .h.grc { font-size: 1.25em; }
table.il .h a { color: inherit; text-decoration: none; }
table.il .x { font-size: 0.72em; font-style: italic; line-height: 1.2; }
table.il .g { font-size: 0.78em; line-height: 1.2; }
.obj { font-size: 0.85em; font-style: normal; }
.bl { margin: 0.4em 0 0; text-indent: 0; text-align: left; padding-bottom: 0.6em; border-bottom: 1px solid #ccc; }
.vnote { font-size: 0.85em; font-style: italic; text-indent: 0; }
.tag { font-size: 0.7em; font-weight: bold; letter-spacing: 0.05em; }
.note, .entry { margin: 0 0 1em; padding-bottom: 0.5em; border-bottom: 1px solid #ccc; }
.note p, .entry p { margin: 0.2em 0; text-indent: 0; }
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
ol.caps { padding-left: 1.2em; }
"""

CREDITS = """<p><b>Hebraico e aramaico, com morfologia:</b> Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb (CC BY 4.0), baseado no Westminster Leningrad Codex (domínio público). Os sinais de cantilação foram omitidos nesta edição para facilitar a leitura em telas de tinta eletrônica. Onde o texto tem leitura indicada à margem (qere), é ela que aparece.</p>
<p><b>Grego:</b> SBL Greek New Testament (SBLGNT), © 2010 Society of Biblical Literature e Logos Bible Software, licença CC BY 4.0; os sinais do aparato crítico foram retirados do texto. Morfologia e lemas: MorphGNT, J. K. Tauber (CC BY-SA 3.0).</p>
<p><b>Tradução corrida:</b> Bíblia Livre (BLIVRE), de Diego Santos, Mario Sérgio e Marco Teles, https://sites.google.com/site/biblialivre/. Antigo Testamento: revisão de fevereiro de 2018 (CC BY 4.0 Brasil, via corpus eBible), completada pela edição de 2017 onde faltam versículos. Novo Testamento: edição de 2017 (CC BY 3.0 Brasil). Texto reproduzido sem alterações.</p>
<p><b>Léxico:</b> dicionário de James Strong (domínio público), edição digital Open Scriptures (CC BY-SA); léxico grego de Jeffrey Dodson (domínio público). Origem e significado vertidos para o português nesta edição, que por isso é distribuída sob CC BY-SA.</p>
<p><b>Glosas palavra a palavra:</b> obtidas por alinhamento estatístico com a BLIVRE e completadas por regras; revisão pendente. Não fazem parte da BLIVRE e não têm endosso de seus autores.</p>
<p><b>Introdução e temas dos capítulos:</b> escritos para esta edição; datas aproximadas.</p>
<p><b>Fonte tipográfica:</b> Noto Serif Hebrew, © 2022 The Noto Project Authors, SIL Open Font License 1.1 (texto completo abaixo).</p>
"""


def about_html(B):
    A = B.get("about")
    if not A:
        return ""
    lang = 'lang="grc" class="grc"' if B["nt"] else 'lang="he" dir="rtl" class="he"'
    o = [
        f'<section epub:type="introduction" id="sobre">\n<h1>Sobre {h(B["nome"])} <span {lang}>{h(A.get("title_orig"))}</span></h1>',
        f'<p class="lead">{h(A.get("summary"))}</p>',
        '<ul class="facts">' + "".join(f"<li><b>{h(k)}:</b> {h(v)}</li>" for k, v in A.get("facts", [])) + "</ul>",
    ]
    if A.get("name"):
        o.append(f"<h2>O nome</h2><p>{h(A['name'])}</p>")
    if A.get("structure"):
        o.append(
            "<h2>Como o livro se divide</h2><ul>"
            + "".join(
                f"<li><b>{h(p['title'])}</b>{' (caps. {}–{})'.format(p['from'], p['to']) if p.get('from') and p.get('to') and p['to'] != p['from'] else (' (cap. {})'.format(p['from']) if p.get('from') else '')}: {h(p['text'])}</li>"
                for p in A["structure"]
            )
            + "</ul>"
        )
    if A.get("extra"):
        o.append(f"<h2>{h(A['extra']['title'])}</h2><p>{h(A['extra']['text'])}</p>")
    if A.get("people"):
        o.append(
            "<h2>Pessoas principais</h2><ul>"
            + "".join(
                f"<li><b>{h(p['name'])}</b>{' (' + h(p.get('chapters')) + ')' if p.get('chapters') else ''}: {h(p.get('note'))}</li>"
                for p in A["people"]
            )
            + "</ul>"
        )
    if A.get("writing"):
        o.append(
            f"<h2>Quando foi escrito</h2><p><b>Segundo a tradição.</b> {h(A['writing'].get('tradition'))}</p>"
            f"<p><b>Segundo a pesquisa acadêmica.</b> {h(A['writing'].get('academic'))}</p>"
        )
    E = A.get("events")
    if E:
        o.append(
            f"<h2>Quando se passam os acontecimentos</h2><p>{h(E.get('intro'))}</p><ul>"
            + "".join(
                f"<li><b>{h(t['label'])}</b>: {fmt_range(min(t['from'], t['to']), max(t['from'], t['to']))}{' — ' + h(t['note']) if t.get('note') else ''}</li>"
                for t in E.get("timeline", [])
            )
            + "</ul>"
        )
    if A.get("context"):
        o.append(f"<h2>Contexto histórico</h2><p>{h(A['context'])}</p>")
        if A.get("places"):
            o.append("<p><b>Lugares:</b> " + " · ".join(h(x) for x in A["places"]) + "</p>")
    if A.get("themes"):
        o.append("<h2>Temas</h2><p>" + " · ".join(h(x) for x in A["themes"]) + "</p>")
    if A.get("key_verses"):
        o.append(
            "<h2>Versículos-chave</h2>"
            + "".join(
                f'<blockquote><p>{h(k["text"])}</p><p class="cite">{h(B["nome"])} {h(k["ref"])} · BLIVRE</p></blockquote>'
                for k in A["key_verses"]
            )
        )
    if A.get("note"):
        o.append(f'<p class="intro">{h(A["note"])}</p>')
    o.append('<p class="intro">Introdução escrita para esta edição; datas aproximadas e sujeitas a revisão.</p>\n</section>\n')
    return "\n".join(o)


def link_refs(text, LEX, used):
    def rep(m):
        k = m.group(0)
        e = LEX.get(k)
        if not e or k not in used:
            return k
        lang = 'lang="grc" class="grc"' if k[0] == "G" else 'lang="he" dir="rtl" class="he"'
        return f'<a href="lexico.xhtml#{k}">{k} <span {lang}>{h(e.get("l"))}</span> <i>{h(e.get("x"))}</i></a>'

    return re.sub(r"\b[HG]\d+\b", rep, h(text))


def gen_chapters(B, LEX, pre=""):
    """XHTML dos capítulos e das notas de um livro. pre = prefixo dos arquivos (no volume com vários livros)."""
    grc = B["nt"]
    cod = B["cod"]
    olang = 'lang="grc"' if grc else 'lang="he" dir="rtl"'
    ocls = "grc" if grc else "he"
    files, used, caps = {}, set(), []
    for c in B["caps"]:
        n = c["n"]
        d = json.loads(Path(os.path.join(DATA, "cap", cod, f"{n}.json")).read_text(encoding="utf8"))
        body = [f'<section epub:type="chapter" id="c{n}">\n<h1>{h(B["nome"])} {n}</h1>']
        if c.get("t"):
            body.append(f'<p class="tema">{h(c["t"])}</p>')
        notes = [f'<section epub:type="endnotes" id="notas{n}">\n<h1>Notas · {h(B["nome"])} {n}</h1>']
        for v in d["v"]:
            vn = v["n"]
            label = "Título" if vn == 0 else f"{n}:{vn}"
            body.append(f'<h2 class="vn" id="v{vn}">{label}</h2>')
            ws = v["w"]
            for i0 in range(0, len(ws), PER_ROW):
                cells = []
                for i in range(i0, min(i0 + PER_ROW, len(ws))):
                    w = ws[i]
                    t, k, g = w[0], w[1], w[2]
                    e = LEX.get(k) or {}
                    if k:
                        used.add(k)
                    nid = f"n{vn}-{i}"
                    x = f'<p class="x">{h(e.get("x"))}</p>' if e.get("x") else ""
                    orig = h(plain(t) if not grc else t)
                    cells.append(
                        f'<td><p class="h {ocls}"><a epub:type="noteref" href="{pre}notas{n}.xhtml#{nid}" id="r{nid}" {olang}>{orig}</a></p>{x}<p class="g">{gloss_html(g)}</p></td>'
                    )
                    strong = (
                        "partícula (sem número Strong)"
                        if k and len(k) == 2 and k[1].isalpha()
                        else (k if k and not k.startswith("G:") else "sem número Strong")
                    )
                    lemma = (
                        f'<span {olang} class="{ocls}">{h(e.get("l"))}</span> <i>{h(e.get("x"))}</i> · pronúncia <span class="pr">{h(e.get("p"))}</span>'
                        if e
                        else ""
                    )
                    ketiv = (
                        f'<p class="morph">Leitura indicada à margem (qere); no texto consonantal está escrito (ketiv): <span lang="he" dir="rtl" class="he">{h(w[6])}</span></p>'
                        if len(w) > 6 and w[6]
                        else ""
                    )
                    ver = f' <a href="lexico.xhtml#{k}">verbete →</a>' if e and k else ""
                    notes.append(
                        f'<aside epub:type="footnote" id="{nid}" class="note">'
                        f'<p class="nh"><a href="{pre}c{n}.xhtml#r{nid}">{label}</a> <span {olang} class="{ocls}">{orig}</span> = {gloss_html(g)}</p>'
                        f'<p class="morph">{h(decode_morph(w[4], grc))}</p>{ketiv}'
                        f"<p><b>{h(strong)}</b> {lemma}</p>"
                        f"<p>{h(short(e))}{ver}</p></aside>"
                    )
                cells += ["<td></td>"] * (PER_ROW - len(cells))
                if not grc:
                    cells.reverse()  # ordem visual: primeira palavra à direita, sem depender de bidi
                body.append(f'<table class="il" role="presentation"><tr>{"".join(cells)}</tr></table>')
            if v.get("o") == "sem-original":
                body.append('<p class="vnote">Sem correspondente no texto original usado nesta edição.</p>')
            elif v.get("o") == "aparato":
                body.append(
                    '<p class="vnote">No SBLGNT, este trecho está só no aparato crítico; aqui aparece a leitura de Westcott-Hort, Tregelles e Nestle-Aland 28.</p>'
                )
            body.append(f'<p class="bl"><span class="tag">BLIVRE</span> {h(v["b"])}</p>')
        body.append("</section>\n")
        notes.append("</section>\n")
        files[f"{pre}c{n}.xhtml"] = page(f"{B['nome']} {n}", "\n".join(body))
        files[f"{pre}notas{n}.xhtml"] = page(f"Notas · {B['nome']} {n}", "\n".join(notes))
        caps.append((n, c.get("t", "")))
    about_section = about_html(B)
    if about_section:
        files[f"{pre}sobre.xhtml"] = page(f"Sobre {B['nome']}", about_section)
    files[f"{pre}capitulos.xhtml"] = page(
        B["nome"],
        (
            f'<section id="capitulos"><h1>{h(B["nome"])}</h1><p class="intro">Toque na palavra no original para abrir a nota '
            f"com glosa, gramática e significado. {'Leia da esquerda para a direita.' if grc else 'Leia da direita para a esquerda.'}</p>"
            + (f'<p><a href="{pre}sobre.xhtml">Sobre o livro</a></p>' if about_section else "")
            + '<ol class="caps">'
            + "".join(f'<li><a href="{pre}c{n}.xhtml">Capítulo {n}</a>{" — " + h(t) if t else ""}</li>' for n, t in caps)
            + "</ol></section>\n"
        ),
    )
    return files, caps, used, bool(about_section)


def gen_lexicon(used, LEX, desc):
    def order(k):
        return (k[0] == "G", k.startswith("G:"), int(k[1:]) if k[1:].isdigit() else 10**9, k)

    lex = ['<section epub:type="glossary" id="lexico">\n<h1>Léxico</h1>', f'<p class="intro">{desc} {PRON}</p>']
    for k in sorted(used, key=order):
        e = LEX.get(k)
        if not e:
            continue
        lang = 'lang="grc" class="grc big"' if k[0] == "G" else 'lang="he" dir="rtl" class="he big"'
        num = "" if k.startswith("G:") else f"<b>{h(k)}</b> "
        origin = link_refs(e.get("o") or e.get("oe") or "", LEX, used)
        sig = h(e.get("s") or e.get("se") or e.get("ge") or "")
        lex.append(
            f'<div class="entry" id="{h(k)}"><p>{num}<span {lang}>{h(e.get("l"))}</span> <i>{h(e.get("x"))}</i> · pronúncia <span class="pr">{h(e.get("p"))}</span> · {e.get("n", 0)}× na Bíblia</p>'
            + (f'<p class="lbl">Origem</p><p>{origin}</p>' if origin else "")
            + f'<p class="lbl">Significado</p><p>{sig}</p>'
            + (f'<p class="lbl">Como a BLIVRE traduz</p><p>{h(e["t"])}</p>' if e.get("t") else "")
            + "</div>"
        )
    lex.append("</section>\n")
    return page("Léxico", "\n".join(lex))


def credits(ofl):
    return page(
        "Fontes e licenças",
        '<section epub:type="colophon" id="creditos">\n<h1>Fontes e licenças</h1>\n'
        + CREDITS
        + '<div class="ofl">'
        + "".join(f"<p>{h(p.strip())}</p>" for p in re.split(r"\n{2,}", ofl) if p.strip())
        + "</div>\n</section>\n",
    )


def package_epub(out, files, spine, nav_items, begin, ident, title_text, summary, series=None, css=None):
    files["estilo.css"] = css or CSS
    files["nav.xhtml"] = (
        '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt-BR" xml:lang="pt-BR">\n'
        '<head><meta charset="UTF-8"/><title>Sumário</title></head>\n<body>\n'
        f'<nav epub:type="toc" id="toc"><h1>Sumário</h1><ol>{"".join(nav_items)}</ol></nav>\n'
        f'<nav epub:type="landmarks" hidden=""><ol><li><a epub:type="bodymatter" href="{begin}">Início</a></li></ol></nav>\n'
        "</body>\n</html>\n"
    )
    manifest = [
        '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
        '<item id="css" href="estilo.css" media-type="text/css"/>',
        '<item id="f400" href="fonts/NotoSerifHebrew-400.ttf" media-type="font/ttf"/>',
        '<item id="f600" href="fonts/NotoSerifHebrew-600.ttf" media-type="font/ttf"/>',
    ]
    ids = {}
    for i, f in enumerate(spine):
        ids[f] = f"x{i}"
        manifest.append(f'<item id="x{i}" href="{f}" media-type="application/xhtml+xml"/>')
    col = ""
    if series:
        col = (
            '    <meta property="belongs-to-collection" id="col">Bíblia Interlinear</meta>\n'
            '    <meta refines="#col" property="collection-type">series</meta>\n'
            f'    <meta refines="#col" property="group-position">{series}</meta>\n'
        )
    now_iso = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    opf = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="pt-BR">\n'
        '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
        f'    <dc:identifier id="bookid">urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, "liberta.bibliainterlinear/" + ident)}</dc:identifier>\n'
        f"    <dc:title>{h(title_text)}</dc:title>\n"
        "    <dc:language>pt-BR</dc:language>\n"
        "    <dc:creator>Bíblia Interlinear (BLIVRE)</dc:creator>\n"
        "    <dc:rights>Texto BLIVRE CC BY 4.0/3.0 Brasil; original OSHB/SBLGNT CC BY 4.0; léxico e morfologia CC BY-SA</dc:rights>\n"
        + col
        + f'    <meta property="dcterms:modified">{now_iso}</meta>\n'
        '    <meta property="schema:accessMode">textual</meta>\n'
        '    <meta property="schema:accessModeSufficient">textual</meta>\n'
        '    <meta property="schema:accessibilityFeature">structuralNavigation</meta>\n'
        '    <meta property="schema:accessibilityFeature">tableOfContents</meta>\n'
        '    <meta property="schema:accessibilityFeature">alternativeScript</meta>\n'
        '    <meta property="schema:accessibilityHazard">none</meta>\n'
        f'    <meta property="schema:accessibilitySummary">{h(summary)}</meta>\n'
        "  </metadata>\n  <manifest>\n"
        + "".join(f"    {m}\n" for m in manifest)
        + "  </manifest>\n  <spine>\n"
        + "".join(f'    <itemref idref="{ids[f]}"/>\n' for f in spine)
        + "  </spine>\n</package>\n"
    )
    os.makedirs(OUT, exist_ok=True)
    with zipfile.ZipFile(out, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        z.writestr(
            "META-INF/container.xml",
            '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n'
            '  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>\n</container>\n',
            compress_type=zipfile.ZIP_DEFLATED,
        )
        z.writestr("OEBPS/content.opf", opf, compress_type=zipfile.ZIP_DEFLATED)
        for f, body in files.items():
            z.writestr(f"OEBPS/{f}", body, compress_type=zipfile.ZIP_DEFLATED)
        for f in ("NotoSerifHebrew-400.ttf", "NotoSerifHebrew-600.ttf"):
            z.write(os.path.join(SOURCES, f), f"OEBPS/fonts/{f}", compress_type=zipfile.ZIP_DEFLATED)
    return out


def build(B, idx, LEX, ofl):
    """Um livro por EPUB."""
    cod = B["cod"]
    files, caps, used, about_section = gen_chapters(B, LEX)
    files["lexico.xhtml"] = gen_lexicon(used, LEX, f"Verbetes usados em {h(B['nome'])}, em ordem Strong.")
    files["creditos.xhtml"] = credits(ofl)
    spine = (
        (["sobre.xhtml"] if about_section else [])
        + ["capitulos.xhtml"]
        + [f"c{n}.xhtml" for n, _ in caps]
        + ["lexico.xhtml"]
        + [f"notas{n}.xhtml" for n, _ in caps]
        + ["creditos.xhtml"]
    )
    nav = (['<li><a href="sobre.xhtml">Sobre o livro</a></li>'] if about_section else []) + [
        '<li><a href="capitulos.xhtml">Capítulos</a><ol>'
        + "".join(f'<li><a href="c{n}.xhtml">{h(B["nome"])} {n}{" — " + h(t) if t else ""}</a></li>' for n, t in caps)
        + "</ol></li>",
        '<li><a href="lexico.xhtml">Léxico</a></li>',
        '<li><a href="creditos.xhtml">Fontes e licenças</a></li>',
    ]
    language = "grego" if B["nt"] else ("hebraico e aramaico" if cod in ("EZR", "DAN") else "hebraico")
    name = unicodedata.normalize("NFD", B["nome"]).encode("ascii", "ignore").decode().replace(" ", "")
    return package_epub(
        os.path.join(OUT, f"{idx:02d}-{cod}-{name}.epub"),
        files,
        spine,
        nav,
        f"c{caps[0][0]}.xhtml",
        cod,
        f"{B['nome']} · Bíblia Interlinear",
        f"{B['nome']} em {language} com transliteração, glosa em português e nota de cada palavra (gramática e significado), "
        "seguido do texto da Bíblia Livre. Versículos são títulos navegáveis; o original está marcado com idioma e "
        "direção próprios. Sem imagens nem áudio.",
        series=idx,
    )


def build_volume(books, LEX, ofl, ident, title_text, filename, subtitle):
    """Vários livros num EPUB só (Bíblia completa ou um testamento), com um léxico único no fim."""
    files, spine, nav, note_list, all_used = {}, [], [], [], set()
    cover = [
        f'<section id="inicio"><h1>{h(title_text)}</h1><p class="intro">{h(subtitle)} Toque na palavra no original para '
        "abrir a nota com glosa, gramática e significado; o verbete completo fica no léxico, no fim.</p>"
    ]
    group_name = None
    for B in books:
        pre = B["cod"] + "-"
        f, caps, used, about_section = gen_chapters(B, LEX, pre)
        files.update(f)
        all_used |= used
        if B["grupo"] != group_name:
            if group_name is not None:
                cover.append("</ul>")
            group_name = B["grupo"]
            cover.append(f"<h2>{h(group_name)}</h2><ul>")
        cover.append(f'<li><a href="{pre}capitulos.xhtml">{h(B["nome"])}</a> ({len(caps)} cap.)</li>')
        spine += ([f"{pre}sobre.xhtml"] if about_section else []) + [f"{pre}capitulos.xhtml"] + [f"{pre}c{n}.xhtml" for n, _ in caps]
        note_list += [f"{pre}notas{n}.xhtml" for n, _ in caps]
        nav.append(
            f'<li><a href="{pre}{"sobre" if about_section else "capitulos"}.xhtml">{h(B["nome"])}</a><ol>'
            + "".join(f'<li><a href="{pre}c{n}.xhtml">{h(B["nome"])} {n}</a></li>' for n, _ in caps)
            + "</ol></li>"
        )
    cover.append("</ul></section>\n")
    files["inicio.xhtml"] = page(title_text, "\n".join(cover))
    files["lexico.xhtml"] = gen_lexicon(
        all_used, LEX, "Verbetes usados nestes livros, em ordem Strong (hebraico e aramaico, depois grego)."
    )
    files["creditos.xhtml"] = credits(ofl)
    spine = ["inicio.xhtml"] + spine + ["lexico.xhtml"] + note_list + ["creditos.xhtml"]
    nav = (
        ['<li><a href="inicio.xhtml">Livros</a></li>']
        + nav
        + ['<li><a href="lexico.xhtml">Léxico</a></li>', '<li><a href="creditos.xhtml">Fontes e licenças</a></li>']
    )
    return package_epub(
        os.path.join(OUT, filename),
        files,
        spine,
        nav,
        f"{books[0]['cod']}-c1.xhtml",
        ident,
        title_text,
        f"{subtitle} Cada palavra do original com transliteração, glosa em português e nota (gramática e significado), "
        "seguida do texto da Bíblia Livre. Sumário por livro e capítulo; versículos são títulos navegáveis. Sem imagens nem áudio.",
    )


CSS_BLIVRE = """body { font-family: serif; line-height: 1.6; margin: 0 4%; }
h1 { font-size: 1.6em; margin: 1.2em 0 .2em; } h2 { font-size: 1.15em; margin: 1.4em 0 .1em; }
p.tema { font-style: italic; margin: 0 0 .6em; color: #444; }
p.txt { text-align: justify; margin: 0 0 .8em; text-indent: 0; }
p.tit { font-style: italic; margin: 0 0 .4em; }
sup.v { font-size: .6em; font-weight: bold; color: #555; margin: 0 .15em 0 .3em; }
section.livro { page-break-before: always; }
p.intro { margin: 0 0 1em; } ul.livros { padding-left: 1.2em; }
"""


def build_blivre(books, ofl):
    """Edição só com o texto da Bíblia Livre (como uma Bíblia comum): os 66 livros, temas dos capítulos e números
    dos versículos. Bem mais leve que a interlinear."""
    files, spine, nav, cover = (
        {},
        [],
        [],
        [
            '<section id="inicio"><h1>Bíblia Livre</h1><p class="intro">Texto da Bíblia Livre '
            "(BLIVRE), com o tema de cada capítulo escrito pelo projeto Bíblia Interlinear. "
            "Para ver o original palavra por palavra, use a edição interlinear.</p>"
        ],
    )
    group_name = None
    for B in books:
        fname = f"{B['cod']}.xhtml"
        pieces = [f'<section class="livro" epub:type="chapter" id="l-{B["cod"]}"><h1>{h(B["nome"])}</h1>']
        for c in B["caps"]:
            d = json.loads(Path(os.path.join(DATA, "cap", B["cod"], f"{c['n']}.json")).read_text(encoding="utf8"))
            pieces.append(f'<h2 id="c{c["n"]}">{h(B["nome"])} {c["n"]}</h2>')
            if c.get("t"):
                pieces.append(f'<p class="tema">{h(c["t"])}</p>')
            body_parts = []
            for v in d["v"]:
                if not (v.get("b") or "").strip():
                    continue
                if v["n"] == 0:
                    pieces.append(f'<p class="tit">{h(v["b"])}</p>')
                else:
                    body_parts.append(f'<sup class="v">{v["n"]}</sup>{h(v["b"])}')
            pieces.append('<p class="txt">' + " ".join(body_parts) + "</p>")
        pieces.append("</section>\n")
        files[fname] = page(B["nome"], "\n".join(pieces))
        spine.append(fname)
        nav.append(
            f'<li><a href="{fname}">{h(B["nome"])}</a><ol>'
            + "".join(f'<li><a href="{fname}#c{c["n"]}">{h(B["nome"])} {c["n"]}</a></li>' for c in B["caps"])
            + "</ol></li>"
        )
        if B["grupo"] != group_name:
            if group_name is not None:
                cover.append("</ul>")
            group_name = B["grupo"]
            cover.append(f'<h2>{h(group_name)}</h2><ul class="livros">')
        cover.append(f'<li><a href="{fname}">{h(B["nome"])}</a></li>')
    cover.append("</ul></section>\n")
    files["inicio.xhtml"] = page("Bíblia Livre", "\n".join(cover))
    files["creditos.xhtml"] = credits(ofl)
    spine = ["inicio.xhtml"] + spine + ["creditos.xhtml"]
    nav = ['<li><a href="inicio.xhtml">Livros</a></li>'] + nav + ['<li><a href="creditos.xhtml">Fontes e licenças</a></li>']
    return package_epub(
        os.path.join(OUT, "00-Biblia-Livre.epub"),
        files,
        spine,
        nav,
        f"{books[0]['cod']}.xhtml",
        "BLIVRE-TEXTO",
        "Bíblia Livre (BLIVRE)",
        "Texto corrido da Bíblia Livre, os 66 livros, com números de versículo e tema de cada "
        "capítulo. Sumário por livro e capítulo. Sem imagens nem áudio.",
        css=CSS_BLIVRE,
    )


def main(argv):
    books = json.loads(Path(os.path.join(DATA, "livros.json")).read_text(encoding="utf8"))
    LEX = {}
    for L in "HG":
        LEX.update(json.loads(Path(os.path.join(DATA, "lex", f"{L}.json")).read_text(encoding="utf8")))
    ofl = Path(os.path.join(SOURCES, "OFL.txt")).read_text(encoding="utf8")
    selected = set(a.upper() for a in argv)
    if not selected or "BLIVRE" in selected:
        out = build_blivre(books, ofl)
        print(f"{os.path.basename(out)}  {os.path.getsize(out) // 1024} KB")
        selected.discard("BLIVRE")
        if argv and not selected:
            return
    if not selected or "VOLUMES" in selected:
        ot = [B for B in books if not B["nt"]]
        nt = [B for B in books if B["nt"]]
        for ls, ident, title_text, fname, sub in (
            (
                books,
                "BIBLIA",
                "Bíblia Interlinear — Bíblia completa",
                "00-Biblia-Interlinear-completa.epub",
                "Os 66 livros: Antigo Testamento em hebraico e aramaico, Novo Testamento em grego, com a Bíblia Livre.",
            ),
            (
                ot,
                "AT",
                "Bíblia Interlinear — Antigo Testamento",
                "00-Biblia-Interlinear-AT.epub",
                "Os 39 livros do Antigo Testamento em hebraico e aramaico, com a Bíblia Livre.",
            ),
            (
                nt,
                "NT",
                "Bíblia Interlinear — Novo Testamento",
                "00-Biblia-Interlinear-NT.epub",
                "Os 27 livros do Novo Testamento em grego, com a Bíblia Livre.",
            ),
        ):
            out = build_volume(ls, LEX, ofl, ident, title_text, fname, sub)
            print(f"{os.path.basename(out)}  {os.path.getsize(out) // 1024} KB")
        selected.discard("VOLUMES")
        if argv and not selected:
            return
    total = 0
    for i, B in enumerate(books, 1):
        if selected and B["cod"] not in selected:
            continue
        out = build(B, i, LEX, ofl)
        total += os.path.getsize(out)
        print(f"{os.path.basename(out)}  {os.path.getsize(out) // 1024} KB")
    print(f"total {total // 1024 // 1024} MB → {OUT}")


if __name__ == "__main__":
    main(sys.argv[1:])
