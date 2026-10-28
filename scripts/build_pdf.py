#!/usr/bin/env python3
"""Gera um PDF por livro (66) a partir de build/web/dados, para imprimir ou ler no computador.

Cada versículo: cartões com a palavra no original, transliteração, Strong e glosa; abaixo, a BLIVRE.
No começo, a introdução do livro; no fim, o léxico dos verbetes usados no livro.
O HTML de impressão é montado aqui e o Chromium (Playwright) gera o PDF (scripts/print_pdf.mjs).

Uso: python3 scripts/build_pdf.py              → os 66 livros + Bíblia completa + AT + NT (build/pdf)
     python3 scripts/build_pdf.py volumes      → só junta os PDFs já gerados na Bíblia completa e nos volumes
     python3 scripts/build_pdf.py GEN JHN      → só esses livros
     python3 scripts/build_pdf.py --lang en    → the same in English, with the BSB (build/pdf/en)
"""

import html
import json
import os
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from build_epub import ROOT, about_html, blivre_text, gloss_html, h, out_dir, plain  # noqa: E402
from interlinear.cli import parser
from interlinear.export import edition
from interlinear.export.edition import t

TMP_BASE = os.path.join(ROOT, "build", "pdf-build")
OUT_BASE = os.path.join(ROOT, "build", "pdf")


def html_dir():
    return out_dir(TMP_BASE)


def pdf_dir():
    return out_dir(OUT_BASE)


def fonts():
    """The site's fonts (build/web/fonts), from the HTML in build/pdf-build (or build/pdf-build/<lang>)."""
    return os.path.relpath(os.path.join(ROOT, "build", "web", "fonts", "fonts.css"), html_dir())


CSS = """
@page { size: A4; margin: 16mm 14mm 16mm; }
:root { --heb: "Noto Serif Hebrew", serif; --grc: "Gentium Book Plus", "Literata", serif; }
body { font-family: "Literata", Georgia, serif; font-size: 10.5pt; line-height: 1.4; color: #111; margin: 0; }
h1 { font-size: 22pt; margin: 0 0 4pt; break-after: avoid; }
h1.cap { font-size: 16pt; margin-top: 14pt; border-bottom: 2px solid #1d5b74; padding-bottom: 3pt; }
.tema { font-style: italic; color: #1d5b74; margin: 0 0 8pt; }
.capa { text-align: center; padding-top: 70mm; break-after: page; }
.capa h1 { font-size: 34pt; }
.capa .orig { font-size: 26pt; margin: 6pt 0 18pt; }
.capa p { color: #444; }
.he { font-family: var(--heb); } .grc { font-family: var(--grc); }
.verse { break-inside: avoid-page; margin: 0 0 7pt; padding-bottom: 5pt; border-bottom: 0.5pt solid #ccc; }
.vn { font: 600 8.5pt "IBM Plex Mono", monospace; color: #1d5b74; margin: 6pt 0 3pt; }
.words { display: flex; flex-wrap: wrap; gap: 3pt 4pt; }
.words.rtl { direction: rtl; }
.w { direction: ltr; display: flex; flex-direction: column; align-items: center; min-width: 40pt; padding: 2pt 3pt;
     border: 0.5pt solid #ddd; border-radius: 3pt; break-inside: avoid; }
.w .o { font-size: 14pt; line-height: 1.3; }
.w .o.he { direction: rtl; }
.w .x { font-size: 7pt; font-style: italic; color: #1d5b74; }
.w .s { font: 6.5pt "IBM Plex Mono", monospace; color: #666; }
.w .g { font-size: 7.5pt; text-align: center; max-width: 70pt; }
.w .g.aux { font-style: italic; color: #666; }
.bl { margin: 4pt 0 0; font-size: 10pt; }
.tag { font: 600 6.5pt "IBM Plex Mono", monospace; color: #666; margin-right: 4pt; }
.vnote { font-size: 8.5pt; font-style: italic; color: #555; margin: 3pt 0 0; }
#sobre { break-after: page; } #sobre h2 { font-size: 12pt; margin: 10pt 0 3pt; } #sobre p, #sobre li { font-size: 10pt; }
.lead { font-size: 11pt; } .facts { list-style: none; padding: 0; } .intro { font-size: 8.5pt; font-style: italic; color: #555; }
blockquote { margin: 5pt 14pt; font-style: italic; } .cite { font-style: normal; font-size: 8pt; color: #555; }
.lexico { break-before: page; columns: 2; column-gap: 14pt; }
.lexico h1 { column-span: all; }
.entry { break-inside: avoid; font-size: 8.5pt; margin: 0 0 5pt; }
.entry .l { font-size: 12pt; }
.pr { font-family: "IBM Plex Mono", monospace; font-size: 7.5pt; }
.creditos { break-before: page; font-size: 8.5pt; }
"""


def book_html(B, LEX, idx):
    grc = B["nt"]
    ocls = "grc" if grc else "he"
    olang = 'lang="grc"' if grc else 'lang="he" dir="rtl"'
    A = B.get("about") or {}
    out = [
        f'<!doctype html><html lang="{edition.locale()}"><head><meta charset="utf-8"><title>{h(B["name"])} · {h(t("app.name"))}</title>'
        f'<link rel="stylesheet" href="{fonts()}"><style>{CSS}</style></head><body>',
        f'<section class="capa"><h1>{h(B["name"])}</h1><div class="orig {ocls}" {olang}>{h(A.get("title_orig"))}</div>'
        f"<p>{h(t('edition.pdf.cover_kind', language=t('edition.language.' + ('greek' if grc else 'hebrew'))))}</p>"
        f"<p>{h(t('edition.pdf.cover_text'))}</p>"
        f'<p class="intro">{h(t("edition.read_ltr" if grc else "edition.pdf.read_rtl"))} '
        f"{h(t('edition.pdf.aux'))}</p></section>",
    ]
    about_section = about_html(B)
    if about_section:
        out.append(about_section.replace('epub:type="introduction" ', ""))
    used = {}
    for c in B["chapters"]:
        n = c["n"]
        d = edition.chapter(B["code"], n)
        out.append(f'<h1 class="cap" id="c{n}">{h(B["name"])} {n}</h1>' + (f'<p class="tema">{h(c["t"])}</p>' if c.get("t") else ""))
        for v in d["v"]:
            vn = v["n"]
            cards = []
            for w in v["w"]:
                word, k, g, f = w[0], w[1], w[2], w[3]
                e = LEX.get(k) or {}
                if k and e:
                    used[k] = e
                num = t("edition.particle_short") if k and len(k) == 2 and k[1].isalpha() else (k if k and not k.startswith("G:") else "—")
                cards.append(
                    f'<div class="w"><span class="o {ocls}" {olang}>{h(word if grc else plain(word))}</span>'
                    + (f'<span class="x">{h(e.get("x"))}</span>' if e.get("x") else "")
                    + f'<span class="s">{h(num)}</span><span class="g{" aux" if f and f != "m" else ""}">{gloss_html(g)}</span></div>'
                )
            note = ""
            if v.get("o") == "sem-original":
                note = f'<p class="vnote">{h(t("edition.no_original"))}</p>'
            elif v.get("o") == "aparato":
                note = f'<p class="vnote">{h(t("edition.apparatus_short"))}</p>'
            out.append(
                f'<div class="verse"><div class="vn">{h(t("edition.superscription")) if vn == 0 else f"{n}:{vn}"}</div>'
                + (f'<div class="words{"" if grc else " rtl"}">{"".join(cards)}</div>' if cards else "")
                + f'{note}<p class="bl"><span class="tag">{t("edition.abbrev")}</span>{h(blivre_text(v))}</p></div>'
            )

    def order(k):
        return (k.startswith("G:"), int(k[1:]) if k[1:].isdigit() else 10**9, k)

    out.append(f'<section class="lexico"><h1>{h(t("edition.lexicon_of", name=B["name"]))}</h1>')
    for k in sorted(used, key=order):
        e = used[k]
        lang = 'class="l grc" lang="grc"' if k[0] == "G" else 'class="l he" lang="he" dir="rtl"'
        out.append(
            f'<div class="entry"><b>{"" if k.startswith("G:") else h(k)}</b> <span {lang}>{h(e.get("l"))}</span> '
            f'<i>{h(e.get("x"))}</i> · <span class="pr">{h(e.get("p"))}</span><br>'
            f"{h(e.get('s') or e.get('se') or e.get('ge') or '')}"
            + (f'<br><span class="intro">{t("edition.abbrev")}: {h(e["t"])}</span>' if e.get("t") else "")
            + "</div>"
        )
    out.append("</section>")
    out.append(f'<section class="creditos"><h1>{h(t("edition.sources"))}</h1><p>{h(t("edition.pdf.credits"))}</p></section>')
    out.append("</body></html>")
    return "\n".join(out)


def main(argv):
    ap = parser(__doc__)
    ap.add_argument("books", nargs="*", metavar="LIVRO", help="códigos dos livros (RUT…), BLIVRE ou VOLUMES; sem nada, todos os PDF")
    ap.add_argument("--lang", default="pt", choices=list(edition.LOCALES), help="language of the files (en: with the BSB)")
    args = ap.parse_args(argv)
    argv = args.books
    edition.use(args.lang)
    books = edition.books()
    LEX = edition.lexicon()
    selected = {a.upper() for a in argv}
    if not selected or "BLIVRE" in selected:
        blivre(books)
        selected.discard("BLIVRE")
        if argv and not selected:
            return
    os.makedirs(html_dir(), exist_ok=True)
    os.makedirs(pdf_dir(), exist_ok=True)
    jobs, target = [], []
    for i, B in enumerate(books, 1):
        if selected and B["code"] not in selected:
            continue
        if selected == {"VOLUMES"}:
            continue
        name = unicodedata.normalize("NFD", B["name"]).encode("ascii", "ignore").decode().replace(" ", "")
        src = os.path.join(html_dir(), f"{B['code']}.html")
        Path(src).write_text(book_html(B, LEX, i), encoding="utf8")
        jobs.append([src, os.path.join(pdf_dir(), f"{i:02d}-{B['code']}-{name}.pdf"), f"{B['name']} · {t('app.name')}"])
        target.append(B)
    if jobs:
        lst = os.path.join(html_dir(), "jobs.json")
        Path(lst).write_text(json.dumps(jobs), encoding="utf8")
        subprocess.run(["node", os.path.join(ROOT, "scripts", "print_pdf.mjs"), lst], check=True)
        for (_, out, _), B in zip(jobs, target, strict=False):
            bookmarks(out, B)
            optimize(out)
    if not selected or "VOLUMES" in selected:
        volumes(books)


def blivre(books):
    """Edição só com o texto da Bíblia Livre (A4, duas colunas), com marcadores por testamento, livro e capítulo."""
    from pypdf import PdfReader, PdfWriter

    esc = html.escape
    pieces = [
        f"""<!doctype html><html lang="{edition.locale()}"><head><meta charset="utf-8"><title>{esc(t("edition.text_name"))}</title><style>
@page {{ size: A4; }}
body {{ font-family: "Literata", Georgia, serif; font-size: 10.5pt; line-height: 1.45; color: #111; margin: 0; }}
.capa {{ height: 240mm; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always; }}
.capa h1 {{ font-size: 34pt; margin: 0 0 8mm; }} .capa p {{ font-size: 12pt; color: #444; max-width: 120mm; margin: 0 auto 4mm; }}
.livro {{ page-break-before: always; columns: 2; column-gap: 8mm; }}
.livro h1 {{ column-span: all; font-size: 22pt; text-align: center; margin: 0 0 6mm; }}
h2 {{ font-size: 12pt; margin: 4mm 0 1mm; break-after: avoid; }}
p.tema {{ font-style: italic; font-size: 9.5pt; color: #444; margin: 0 0 1.5mm; break-after: avoid; }}
p.tit {{ font-style: italic; margin: 0 0 1mm; }}
p.txt {{ text-align: justify; margin: 0 0 2mm; hyphens: auto; }}
sup {{ font-size: 6.5pt; font-weight: 700; color: #555; margin: 0 .5pt 0 2pt; }}
.creditos {{ page-break-before: always; font-size: 9pt; color: #333; }}
</style><link rel="stylesheet" href="{fonts()}"></head><body>
<section class="capa"><h1>{esc(t("edition.text_name"))}</h1><p>{esc(t("edition.pdf.text_cover"))}</p>
<p>{esc(t("edition.pdf.text_cover_note"))}</p></section>"""
    ]
    for B in books:
        pieces.append(f'<section class="livro"><h1>{esc(B["name"])}</h1>')
        for c in B["chapters"]:
            d = edition.chapter(B["code"], c["n"])
            pieces.append(f"<h2>{esc(B['name'])} {c['n']}</h2>")
            if c.get("t"):
                pieces.append(f'<p class="tema">{esc(c["t"])}</p>')
            body_parts = []
            for v in d["v"]:
                if not blivre_text(v).strip():
                    continue
                if v["n"] == 0:
                    pieces.append(f'<p class="tit">{esc(blivre_text(v))}</p>')
                else:
                    body_parts.append(f"<sup>{v['n']}</sup>{esc(v['b'])}")
            pieces.append('<p class="txt">' + " ".join(body_parts) + "</p>")
        pieces.append("</section>")
    pieces.append(
        f'<section class="creditos"><h1>{esc(t("edition.sources"))}</h1><p>{esc(t("edition.pdf.text_credits"))}</p></section></body></html>'
    )
    src = os.path.join(html_dir(), "BLIVRE.html")
    os.makedirs(html_dir(), exist_ok=True)
    os.makedirs(pdf_dir(), exist_ok=True)
    Path(src).write_text("\n".join(pieces), encoding="utf8")
    dest = os.path.join(pdf_dir(), t("edition.files.text") + ".pdf")
    lst = os.path.join(html_dir(), "jobs-blivre.json")
    Path(lst).write_text(json.dumps([[src, dest, t("edition.text_name")]]), encoding="utf8")
    subprocess.run(["node", os.path.join(ROOT, "scripts", "print_pdf.mjs"), lst], check=True)
    if shutil.which("pdftotext"):
        txt = subprocess.run(["pdftotext", "-enc", "UTF-8", dest, "-"], capture_output=True, text=True).stdout
        page_list = [{ln.strip() for ln in p.splitlines() if ln.strip()} for p in txt.split("\f")]
        w = PdfWriter(clone_from=PdfReader(dest))
        test = {}
        pg = 0
        for B in books:
            part = t("edition.testament." + ("nt" if B["nt"] else "ot"))
            for k in range(pg, len(page_list)):
                if B["name"] in page_list[k]:
                    pg = k
                    break
            if part not in test:
                test[part] = w.add_outline_item(part, pg)
            book = w.add_outline_item(B["name"], pg, parent=test[part])
            for c in B["chapters"]:
                for k in range(pg, len(page_list)):
                    if f"{B['name']} {c['n']}" in page_list[k]:
                        pg = k
                        break
                w.add_outline_item(f"{B['name']} {c['n']}", pg, parent=book)
        w.page_mode = "/UseOutlines"
        w.add_metadata({"/Title": t("edition.text_name"), "/Author": t("edition.text_title"), "/Lang": edition.locale()})
        with open(dest, "wb") as f:
            w.write(f)
    optimize(dest)
    print(f"{os.path.basename(dest)}  {os.path.getsize(dest) // 1048576} MB")


def bookmarks(fname, B):
    """Marcadores do PDF (introdução, cada capítulo, léxico, créditos), achando a página de cada título pelo texto."""
    if not shutil.which("pdftotext"):
        return
    from pypdf import PdfReader, PdfWriter

    txt = subprocess.run(["pdftotext", "-enc", "UTF-8", fname, "-"], capture_output=True, text=True).stdout
    page_list = [{ln.strip() for ln in p.splitlines() if ln.strip()} for p in txt.split("\f")]
    name = B["name"]
    about = t("edition.about_title", name=name)
    targets = [(t("edition.about_book"), lambda ls: any(ln.startswith(about) for ln in ls))]
    targets += [
        (f"{name} {c['n']}" + (f" — {c['t']}" if c.get("t") else ""), (lambda t: lambda ls: t in ls)(f"{name} {c['n']}"))
        for c in B["chapters"]
    ]
    lexicon, sources = t("edition.lexicon_of", name=name), t("edition.sources")
    targets += [(t("edition.lexicon"), lambda ls: lexicon in ls), (sources, lambda ls: sources in ls)]
    w = PdfWriter(clone_from=PdfReader(fname))
    pg = 0
    for title_text, found_it in targets:
        for k in range(pg, len(page_list)):
            if found_it(page_list[k]):
                w.add_outline_item(title_text, min(k, len(w.pages) - 1))
                pg = k
                break
    w.page_mode = "/UseOutlines"
    w.add_metadata({"/Title": f"{name} · {t('app.name')}", "/Author": t("edition.creator")})
    with open(fname, "wb") as f:
        w.write(f)


def optimize(fname):
    """Compacta o PDF com o qpdf (fluxos de objetos e compressão máxima). O Chromium só cria os marcadores
    quando gera o PDF com marcação de acessibilidade, que dobra o tamanho; a compactação quase desfaz isso."""
    if not shutil.which("qpdf"):
        return
    tmp = fname + ".tmp"
    r = subprocess.run(
        ["qpdf", "--object-streams=generate", "--compress-streams=y", "--recompress-flate", "--compression-level=9", fname, tmp]
    )
    if r.returncode in (0, 3) and os.path.exists(tmp):  # 3 = avisos
        os.replace(tmp, fname)


def volumes(books):
    """Junta os PDFs dos livros na Bíblia completa e nos volumes AT e NT, com marcadores por livro e capítulo."""
    from pypdf import PdfWriter

    def fname(i, B):
        name = unicodedata.normalize("NFD", B["name"]).encode("ascii", "ignore").decode().replace(" ", "")
        return os.path.join(pdf_dir(), f"{i:02d}-{B['code']}-{name}.pdf")

    all_books = [(B, fname(i, B)) for i, B in enumerate(books, 1)]
    missing_files = [os.path.basename(a) for _, a in all_books if not os.path.exists(a)]
    if missing_files:
        print("volumes não gerados; faltam os PDFs:", ", ".join(missing_files[:5]), "…" if len(missing_files) > 5 else "")
        return
    for key, sel in (("complete", lambda B: True), ("ot", lambda B: not B["nt"]), ("nt", lambda B: B["nt"])):
        name, title_text = t(f"edition.files.{key}") + ".pdf", t(f"edition.volume.{key}")
        w = PdfWriter()
        pieces = {}
        for B, a in all_books:
            if not sel(B):
                continue
            parent_node = None
            begin = len(w.pages)
            w.append(a, import_outline=False)
            if key == "complete":
                part = t("edition.testament." + ("nt" if B["nt"] else "ot"))
                if part not in pieces:
                    pieces[part] = w.add_outline_item(part, begin)
                parent_node = pieces[part]
            book = w.add_outline_item(B["name"], begin, parent=parent_node)
            # capítulos: os marcadores que o Chromium criou no PDF do livro, um nível abaixo do livro
            from pypdf import PdfReader

            r = PdfReader(a)

            def copy_files(item_list, dest):
                last_one = None
                for it in item_list:
                    if isinstance(it, list):
                        if last_one is not None:
                            copy_files(it, last_one)
                        continue
                    try:
                        pg = r.get_destination_page_number(it)
                    except Exception:  # noqa: S112 (destino sem página: o marcador é pulado)
                        continue
                    last_one = w.add_outline_item(it.title, begin + pg, parent=dest)

            copy_files(r.outline, book)
        w.add_metadata({"/Title": title_text, "/Author": t("edition.creator"), "/Lang": edition.locale()})
        w.page_mode = "/UseOutlines"
        dest = os.path.join(pdf_dir(), name)
        with open(dest, "wb") as f:
            w.write(f)
        optimize(dest)
        print(f"{name}  {len(w.pages)} páginas  {os.path.getsize(dest) // 1048576} MB")


if __name__ == "__main__":
    main(sys.argv[1:])
