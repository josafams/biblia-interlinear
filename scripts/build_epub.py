#!/usr/bin/env python3
"""Gera um EPUB 3 por livro (66) a partir de build/web/dados (scripts/export.py).

No Kindle e em outros leitores, cada palavra do original é uma nota pop-up com glosa, análise gramatical
e significado; o verbete completo fica no léxico do livro, no fim. Um arquivo XHTML por capítulo
(e um de notas por capítulo) para os livros grandes abrirem rápido no e-reader.

Uso: python3 scripts/build_epub.py              → Bíblia completa, AT, NT e os 66 livros (build/epub)
     python3 scripts/build_epub.py volumes      → só a Bíblia completa e os volumes AT e NT
     python3 scripts/build_epub.py GEN JHN      → só esses livros
     python3 scripts/build_epub.py --lang en    → the same in English, with the BSB (build/epub/en)
"""

import html
import os
import re
import sys
import unicodedata
import uuid
import zipfile
from datetime import UTC, datetime
from pathlib import Path

from interlinear.cli import parser
from interlinear.export import edition
from interlinear.export.edition import t


def blivre_text(v):
    """Texto da BLIVRE do versículo; nos acrósticos (Salmo 119) o nome da letra volta para o começo, como na BLIVRE."""
    return f"{v['h']} :{v['b']}" if v.get("h") else v.get("b") or ""


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "build", "data")
SOURCES = os.path.join(ROOT, "epub-fonts")
OUT = os.path.join(ROOT, "build", "epub")


def out_dir(base=OUT):
    """build/epub in Portuguese; build/epub/<lang> in another language (its files have the same names)."""
    return base if edition.portuguese() else os.path.join(base, edition.lang())


PER_ROW = 4  # palavras por linha da tabela interlinear (Kindle ignora flex/inline-block)


def h(s):
    return html.escape(str(s or ""), quote=True)


def plain(t):
    """Tira cantilação, meteg e paseq (e-ink renderiza mal); mantém consoantes e vogais."""
    t = unicodedata.normalize("NFD", t.replace("/", ""))
    t = re.sub(r"[֑-ֽ֯׀׃]", "", t)
    return unicodedata.normalize("NFC", t)


# ---------- morphology (the same as the page's: the "morph" section of the locale) ----------
def M(path):
    return edition.lookup(f"morph.{path}")


def pgn(s):
    m = re.match(r"([123])?([mfcb])?([spd])?", s or "")
    return " ".join(x for x in (M("person").get(m[1]), M("he.gender").get(m[2]), M("he.number").get(m[3])) if x)


def decode_part(p):
    if p in M("he.particle"):
        return M("he.particle")[p]
    k = p[:1]
    if k == "V":
        return f"{M('verb')} {M('he.stem').get(p[1:2], p[1:2])} {M('he.type').get(p[2:3], p[2:3])} {pgn(p[3:])}".strip()
    if k in ("N", "A"):
        kinds = M("he.noun") if k == "N" else M("he.adjective")
        base = kinds.get(p[1:2], kinds["other"])
        t = p[2:]
        st = M("he.state").get(t[2:3], "")
        return " ".join(x for x in (base, M("he.gender").get(t[:1]), M("he.number").get(t[1:2]), st) if x)
    if k == "P":
        return M("pronoun")
    if k == "S":
        return M("suffix") + " " + pgn(p[2:])
    if k == "T":
        return M("particle")
    return p


def decode_morph(m, grc):
    if not m:
        return ""
    if grc:
        pos, _, p = m.partition("-")
        p = p.ljust(8, "-")
        out = [M("grc.pos").get(pos, pos)]
        if p[1] != "-":
            out += [M("grc.tense").get(p[1]), M("grc.voice").get(p[2]), M("grc.mood").get(p[3])]
        if p[0] != "-":
            out.append(M("person").get(p[0], "") + " " + M("person_word"))
        out += [M("grc.case").get(p[4]), M("grc.gender").get(p[6]), M("grc.number").get(p[5]), M("grc.degree").get(p[7])]
        return " ".join(x for x in out if x)
    pre = M("aramaic_prefix") if m[:1] == "A" else ""
    return pre + " + ".join(decode_part(x) for x in m[1:].split("/") if x)


def gloss_html(g):
    return h(g or "—").replace("[obj]", '<span class="obj">[obj]</span>')


def short(e):
    s = e.get("s") or e.get("se") or e.get("ge") or ""
    return re.split(r"[;(]", s)[0].strip()


def fmt_y(y):
    return t("about.year_bc", y=-y) if y < 0 else t("about.year_ad", y=y)


def fmt_range(a, b):
    if a == b:
        return t("about.circa", range=fmt_y(a))
    if a < 0 and b < 0:
        return t("about.circa", range=t("about.year_bc", y=f"{-a}–{-b}"))
    if a > 0 and b > 0:
        return t("about.circa", range=t("about.year_ad", y=f"{a}–{b}"))
    return t("about.circa", range=f"{fmt_y(a)}–{fmt_y(b)}")


def html_open():
    loc = edition.locale()
    return f'<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="{loc}" xml:lang="{loc}">\n'


def page(title, body):
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
        + html_open()
        + f'<head><meta charset="UTF-8"/><title>{h(title)}</title><link rel="stylesheet" type="text/css" href="estilo.css"/></head>\n'
        f"<body>\n{body}</body>\n</html>\n"
    )


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


def part_chapters(p):
    """ " (caps. 1–4)" or " (cap. 5)" after the title of a part of the book, when it has chapters."""
    a, b = p.get("from"), p.get("to")
    if a and b and a != b:
        return f" ({h(t('about.chapters', **{'from': a, 'to': b}))})"
    return f" ({h(t('about.chapter', n=a))})" if a else ""


def about_html(B):
    A = B.get("about")
    if not A:
        return ""
    lang = 'lang="grc" class="grc"' if B["nt"] else 'lang="he" dir="rtl" class="he"'
    o = [
        f'<section epub:type="introduction" id="sobre">\n<h1>{h(t("edition.about_title", name=B["name"]))} <span {lang}>{h(A.get("title_orig"))}</span></h1>',
        f'<p class="lead">{h(A.get("summary"))}</p>',
        '<ul class="facts">' + "".join(f"<li><b>{h(k)}:</b> {h(v)}</li>" for k, v in A.get("facts", [])) + "</ul>",
    ]
    if A.get("name"):
        o.append(f"<h2>{h(t('about.the_name'))}</h2><p>{h(A['name'])}</p>")
    if A.get("structure"):
        o.append(
            f"<h2>{h(t('about.structure'))}</h2><ul>"
            + "".join(f"<li><b>{h(p['title'])}</b>{part_chapters(p)}: {h(p['text'])}</li>" for p in A["structure"])
            + "</ul>"
        )
    if A.get("extra"):
        o.append(f"<h2>{h(A['extra']['title'])}</h2><p>{h(A['extra']['text'])}</p>")
    if A.get("people"):
        o.append(
            f"<h2>{h(t('about.people'))}</h2><ul>"
            + "".join(
                f"<li><b>{h(p['name'])}</b>{' (' + h(p.get('chapters')) + ')' if p.get('chapters') else ''}: {h(p.get('note'))}</li>"
                for p in A["people"]
            )
            + "</ul>"
        )
    if A.get("writing"):
        o.append(
            f"<h2>{h(t('about.written'))}</h2><p><b>{h(t('about.tradition'))}.</b> {h(A['writing'].get('tradition'))}</p>"
            f"<p><b>{h(t('about.academic'))}.</b> {h(A['writing'].get('academic'))}</p>"
        )
    E = A.get("events")
    if E:
        o.append(
            f"<h2>{h(t('about.when'))}</h2><p>{h(E.get('intro'))}</p><ul>"
            + "".join(
                f"<li><b>{h(t['label'])}</b>: {fmt_range(min(t['from'], t['to']), max(t['from'], t['to']))}{' — ' + h(t['note']) if t.get('note') else ''}</li>"
                for t in E.get("timeline", [])
            )
            + "</ul>"
        )
    if A.get("context"):
        o.append(f"<h2>{h(t('about.context'))}</h2><p>{h(A['context'])}</p>")
        if A.get("places"):
            o.append(f"<p><b>{h(t('about.places'))}:</b> " + " · ".join(h(x) for x in A["places"]) + "</p>")
    if A.get("themes"):
        o.append(f"<h2>{h(t('about.themes'))}</h2><p>" + " · ".join(h(x) for x in A["themes"]) + "</p>")
    if A.get("key_verses"):
        o.append(
            f"<h2>{h(t('about.key_verses'))}</h2>"
            + "".join(
                f'<blockquote><p>{h(k["text"])}</p><p class="cite">{h(B["name"])} {h(k["ref"])} · {t("edition.abbrev")}</p></blockquote>'
                for k in A["key_verses"]
            )
        )
    if A.get("note"):
        o.append(f'<p class="intro">{h(A["note"])}</p>')
    o.append(f'<p class="intro">{h(t("edition.about_disclaimer"))}</p>\n</section>\n')
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
    cod = B["code"]
    olang = 'lang="grc"' if grc else 'lang="he" dir="rtl"'
    ocls = "grc" if grc else "he"
    files, used, caps = {}, set(), []
    for c in B["chapters"]:
        n = c["n"]
        d = edition.chapter(cod, n)
        body = [f'<section epub:type="chapter" id="c{n}">\n<h1>{h(B["name"])} {n}</h1>']
        if c.get("t"):
            body.append(f'<p class="tema">{h(c["t"])}</p>')
        notes = [f'<section epub:type="endnotes" id="notas{n}">\n<h1>{h(t("edition.notes", ref=f"{B['name']} {n}"))}</h1>']
        for v in d["v"]:
            vn = v["n"]
            label = h(t("edition.superscription")) if vn == 0 else f"{n}:{vn}"
            body.append(f'<h2 class="vn" id="v{vn}">{label}</h2>')
            ws = v["w"]
            for i0 in range(0, len(ws), PER_ROW):
                cells = []
                for i in range(i0, min(i0 + PER_ROW, len(ws))):
                    w = ws[i]
                    word, k, g = w[0], w[1], w[2]
                    e = LEX.get(k) or {}
                    if k:
                        used.add(k)
                    nid = f"n{vn}-{i}"
                    x = f'<p class="x">{h(e.get("x"))}</p>' if e.get("x") else ""
                    orig = h(plain(word) if not grc else word)
                    cells.append(
                        f'<td><p class="h {ocls}"><a epub:type="noteref" href="{pre}notas{n}.xhtml#{nid}" id="r{nid}" {olang}>{orig}</a></p>{x}<p class="g">{gloss_html(g)}</p></td>'
                    )
                    strong = (
                        t("edition.particle_no_strong")
                        if k and len(k) == 2 and k[1].isalpha()
                        else (k if k and not k.startswith("G:") else t("edition.no_strong"))
                    )
                    lemma = (
                        f'<span {olang} class="{ocls}">{h(e.get("l"))}</span> <i>{h(e.get("x"))}</i> · {t("edition.pronounced")} <span class="pr">{h(e.get("p"))}</span>'
                        if e
                        else ""
                    )
                    ketiv = (
                        f'<p class="morph">{h(t("edition.ketiv"))} <span lang="he" dir="rtl" class="he">{h(w[6])}</span></p>'
                        if len(w) > 6 and w[6]
                        else ""
                    )
                    ver = f' <a href="lexico.xhtml#{k}">{h(t("edition.entry_link"))}</a>' if e and k else ""
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
                body.append(f'<p class="vnote">{h(t("edition.no_original"))}</p>')
            elif v.get("o") == "aparato":
                body.append(f'<p class="vnote">{h(t("edition.apparatus"))}</p>')
            body.append(f'<p class="bl"><span class="tag">{t("edition.abbrev")}</span> {h(blivre_text(v))}</p>')
        body.append("</section>\n")
        notes.append("</section>\n")
        files[f"{pre}c{n}.xhtml"] = page(f"{B['name']} {n}", "\n".join(body))
        files[f"{pre}notas{n}.xhtml"] = page(t("edition.notes", ref=f"{B['name']} {n}"), "\n".join(notes))
        caps.append((n, c.get("t", "")))
    about_section = about_html(B)
    if about_section:
        files[f"{pre}sobre.xhtml"] = page(t("edition.about_title", name=B["name"]), about_section)
    files[f"{pre}capitulos.xhtml"] = page(
        B["name"],
        (
            f'<section id="capitulos"><h1>{h(B["name"])}</h1><p class="intro">{h(t("edition.tap_word"))} '
            f"{h(t('edition.read_ltr' if grc else 'edition.read_rtl'))}</p>"
            + (f'<p><a href="{pre}sobre.xhtml">{h(t("edition.about_book"))}</a></p>' if about_section else "")
            + '<ol class="caps">'
            + "".join(
                f'<li><a href="{pre}c{n}.xhtml">{h(t("edition.chapter", n=n))}</a>{" — " + h(theme) if theme else ""}</li>'
                for n, theme in caps
            )
            + "</ol></section>\n"
        ),
    )
    return files, caps, used, bool(about_section)


def gen_lexicon(used, LEX, desc):
    def order(k):
        return (k[0] == "G", k.startswith("G:"), int(k[1:]) if k[1:].isdigit() else 10**9, k)

    lex = [
        f'<section epub:type="glossary" id="lexico">\n<h1>{h(t("edition.lexicon"))}</h1>',
        f'<p class="intro">{desc} {h(t("edition.pronunciation"))}</p>',
    ]
    for k in sorted(used, key=order):
        e = LEX.get(k)
        if not e:
            continue
        lang = 'lang="grc" class="grc big"' if k[0] == "G" else 'lang="he" dir="rtl" class="he big"'
        num = "" if k.startswith("G:") else f"<b>{h(k)}</b> "
        origin = link_refs(e.get("o") or e.get("oe") or "", LEX, used)
        sig = h(e.get("s") or e.get("se") or e.get("ge") or "")
        lex.append(
            f'<div class="entry" id="{h(k)}"><p>{num}<span {lang}>{h(e.get("l"))}</span> <i>{h(e.get("x"))}</i> · {t("edition.pronounced")} <span class="pr">{h(e.get("p"))}</span> · {h(t("edition.in_bible", n=e.get("n", 0)))}</p>'
            + (f'<p class="lbl">{h(t("entry.origin"))}</p><p>{origin}</p>' if origin else "")
            + f'<p class="lbl">{h(t("entry.meaning"))}</p><p>{sig}</p>'
            + (f'<p class="lbl">{h(t("entry.translations"))}</p><p>{h(e["t"])}</p>' if e.get("t") else "")
            + "</div>"
        )
    lex.append("</section>\n")
    return page(t("edition.lexicon"), "\n".join(lex))


def credits(ofl):
    return page(
        t("edition.sources"),
        f'<section epub:type="colophon" id="creditos">\n<h1>{h(t("edition.sources"))}</h1>\n'
        + t("edition.credits")
        + '<div class="ofl">'
        + "".join(f"<p>{h(p.strip())}</p>" for p in re.split(r"\n{2,}", ofl) if p.strip())
        + "</div>\n</section>\n",
    )


def package_epub(out, files, spine, nav_items, begin, ident, title_text, summary, series=None, css=None):
    files["estilo.css"] = css or CSS
    files["nav.xhtml"] = (
        '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
        + html_open()
        + f'<head><meta charset="UTF-8"/><title>{h(t("edition.contents"))}</title></head>\n<body>\n'
        f'<nav epub:type="toc" id="toc"><h1>{h(t("edition.contents"))}</h1><ol>{"".join(nav_items)}</ol></nav>\n'
        f'<nav epub:type="landmarks" hidden=""><ol><li><a epub:type="bodymatter" href="{begin}">{h(t("edition.start"))}</a></li></ol></nav>\n'
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
            f'    <meta property="belongs-to-collection" id="col">{h(t("app.name"))}</meta>\n'
            '    <meta refines="#col" property="collection-type">series</meta>\n'
            f'    <meta refines="#col" property="group-position">{series}</meta>\n'
        )
    now_iso = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    if not edition.portuguese():
        ident = f"{edition.lang()}-{ident}"  # another book: its own identifier
    opf = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="{edition.locale()}">\n'
        '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
        f'    <dc:identifier id="bookid">urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, "liberta.bibliainterlinear/" + ident)}</dc:identifier>\n'
        f"    <dc:title>{h(title_text)}</dc:title>\n"
        f"    <dc:language>{edition.locale()}</dc:language>\n"
        f"    <dc:creator>{h(t('edition.creator'))}</dc:creator>\n"
        f"    <dc:rights>{h(t('edition.rights'))}</dc:rights>\n" + col + f'    <meta property="dcterms:modified">{now_iso}</meta>\n'
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
    os.makedirs(out_dir(), exist_ok=True)
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
    cod = B["code"]
    files, caps, used, about_section = gen_chapters(B, LEX)
    files["lexico.xhtml"] = gen_lexicon(used, LEX, h(t("edition.lexicon_book", name=B["name"])))
    files["creditos.xhtml"] = credits(ofl)
    spine = (
        (["sobre.xhtml"] if about_section else [])
        + ["capitulos.xhtml"]
        + [f"c{n}.xhtml" for n, _ in caps]
        + ["lexico.xhtml"]
        + [f"notas{n}.xhtml" for n, _ in caps]
        + ["creditos.xhtml"]
    )
    nav = ([f'<li><a href="sobre.xhtml">{h(t("edition.about_book"))}</a></li>'] if about_section else []) + [
        f'<li><a href="capitulos.xhtml">{h(t("edition.chapters"))}</a><ol>'
        + "".join(f'<li><a href="c{n}.xhtml">{h(B["name"])} {n}{" — " + h(theme) if theme else ""}</a></li>' for n, theme in caps)
        + "</ol></li>",
        f'<li><a href="lexico.xhtml">{h(t("edition.lexicon"))}</a></li>',
        f'<li><a href="creditos.xhtml">{h(t("edition.sources"))}</a></li>',
    ]
    language = t("edition.language." + ("greek" if B["nt"] else "hebrew_aramaic" if cod in ("EZR", "DAN") else "hebrew"))
    name = unicodedata.normalize("NFD", B["name"]).encode("ascii", "ignore").decode().replace(" ", "")
    return package_epub(
        os.path.join(out_dir(), f"{idx:02d}-{cod}-{name}.epub"),
        files,
        spine,
        nav,
        f"c{caps[0][0]}.xhtml",
        cod,
        f"{B['name']} · {t('app.name')}",
        t("edition.book_summary", name=B["name"], language=language),
        series=idx,
    )


def build_volume(books, LEX, ofl, ident, title_text, filename, subtitle):
    """Vários livros num EPUB só (Bíblia completa ou um testamento), com um léxico único no fim."""
    files, spine, nav, note_list, all_used = {}, [], [], [], set()
    cover = [f'<section id="inicio"><h1>{h(title_text)}</h1><p class="intro">{h(t("edition.volume_intro", subtitle=subtitle))}</p>']
    group_name = None
    for B in books:
        pre = B["code"] + "-"
        f, caps, used, about_section = gen_chapters(B, LEX, pre)
        files.update(f)
        all_used |= used
        if B["group"] != group_name:
            if group_name is not None:
                cover.append("</ul>")
            group_name = B["group"]
            cover.append(f"<h2>{h(group_name)}</h2><ul>")
        cover.append(f'<li><a href="{pre}capitulos.xhtml">{h(B["name"])}</a> ({h(t("edition.chapter_count", n=len(caps)))})</li>')
        spine += ([f"{pre}sobre.xhtml"] if about_section else []) + [f"{pre}capitulos.xhtml"] + [f"{pre}c{n}.xhtml" for n, _ in caps]
        note_list += [f"{pre}notas{n}.xhtml" for n, _ in caps]
        nav.append(
            f'<li><a href="{pre}{"sobre" if about_section else "capitulos"}.xhtml">{h(B["name"])}</a><ol>'
            + "".join(f'<li><a href="{pre}c{n}.xhtml">{h(B["name"])} {n}</a></li>' for n, _ in caps)
            + "</ol></li>"
        )
    cover.append("</ul></section>\n")
    files["inicio.xhtml"] = page(title_text, "\n".join(cover))
    files["lexico.xhtml"] = gen_lexicon(all_used, LEX, h(t("edition.lexicon_volume")))
    files["creditos.xhtml"] = credits(ofl)
    spine = ["inicio.xhtml"] + spine + ["lexico.xhtml"] + note_list + ["creditos.xhtml"]
    nav = (
        [f'<li><a href="inicio.xhtml">{h(t("edition.books"))}</a></li>']
        + nav
        + [
            f'<li><a href="lexico.xhtml">{h(t("edition.lexicon"))}</a></li>',
            f'<li><a href="creditos.xhtml">{h(t("edition.sources"))}</a></li>',
        ]
    )
    return package_epub(
        os.path.join(out_dir(), filename),
        files,
        spine,
        nav,
        f"{books[0]['code']}-c1.xhtml",
        ident,
        title_text,
        t("edition.volume_summary", subtitle=subtitle),
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
        [f'<section id="inicio"><h1>{h(t("edition.text_name"))}</h1><p class="intro">{h(t("edition.text_intro"))}</p>'],
    )
    group_name = None
    for B in books:
        fname = f"{B['code']}.xhtml"
        pieces = [f'<section class="livro" epub:type="chapter" id="l-{B["code"]}"><h1>{h(B["name"])}</h1>']
        for c in B["chapters"]:
            d = edition.chapter(B["code"], c["n"])
            pieces.append(f'<h2 id="c{c["n"]}">{h(B["name"])} {c["n"]}</h2>')
            if c.get("t"):
                pieces.append(f'<p class="tema">{h(c["t"])}</p>')
            body_parts = []
            for v in d["v"]:
                if not blivre_text(v).strip():
                    continue
                if v["n"] == 0:
                    pieces.append(f'<p class="tit">{h(blivre_text(v))}</p>')
                else:
                    body_parts.append(f'<sup class="v">{v["n"]}</sup>{h(blivre_text(v))}')
            pieces.append('<p class="txt">' + " ".join(body_parts) + "</p>")
        pieces.append("</section>\n")
        files[fname] = page(B["name"], "\n".join(pieces))
        spine.append(fname)
        nav.append(
            f'<li><a href="{fname}">{h(B["name"])}</a><ol>'
            + "".join(f'<li><a href="{fname}#c{c["n"]}">{h(B["name"])} {c["n"]}</a></li>' for c in B["chapters"])
            + "</ol></li>"
        )
        if B["group"] != group_name:
            if group_name is not None:
                cover.append("</ul>")
            group_name = B["group"]
            cover.append(f'<h2>{h(group_name)}</h2><ul class="livros">')
        cover.append(f'<li><a href="{fname}">{h(B["name"])}</a></li>')
    cover.append("</ul></section>\n")
    files["inicio.xhtml"] = page(t("edition.text_name"), "\n".join(cover))
    files["creditos.xhtml"] = credits(ofl)
    spine = ["inicio.xhtml"] + spine + ["creditos.xhtml"]
    nav = (
        [f'<li><a href="inicio.xhtml">{h(t("edition.books"))}</a></li>']
        + nav
        + [f'<li><a href="creditos.xhtml">{h(t("edition.sources"))}</a></li>']
    )
    return package_epub(
        os.path.join(out_dir(), t("edition.files.text") + ".epub"),
        files,
        spine,
        nav,
        f"{books[0]['code']}.xhtml",
        "BLIVRE-TEXTO",
        t("edition.text_title"),
        t("edition.text_summary"),
        css=CSS_BLIVRE,
    )


def main(argv):
    ap = parser(__doc__)
    ap.add_argument("books", nargs="*", metavar="LIVRO", help="códigos dos livros (RUT…), BLIVRE ou VOLUMES; sem nada, todos os EPUB")
    ap.add_argument("--lang", default="pt", choices=list(edition.LOCALES), help="language of the files (en: with the BSB)")
    args = ap.parse_args(argv)
    argv = args.books
    edition.use(args.lang)
    books = edition.books()
    LEX = edition.lexicon()
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
        for ls, ident, key in ((books, "BIBLIA", "complete"), (ot, "AT", "ot"), (nt, "NT", "nt")):
            fname = t(f"edition.files.{key}") + ".epub"
            out = build_volume(ls, LEX, ofl, ident, t(f"edition.volume.{key}"), fname, t(f"edition.volume.{key}_sub"))
            print(f"{os.path.basename(out)}  {os.path.getsize(out) // 1024} KB")
        selected.discard("VOLUMES")
        if argv and not selected:
            return
    total = 0
    for i, B in enumerate(books, 1):
        if selected and B["code"] not in selected:
            continue
        out = build(B, i, LEX, ofl)
        total += os.path.getsize(out)
        print(f"{os.path.basename(out)}  {os.path.getsize(out) // 1024} KB")
    print(f"total {total // 1024 // 1024} MB → {out_dir()}")


if __name__ == "__main__":
    main(sys.argv[1:])
