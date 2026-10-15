#!/usr/bin/env python3
"""Gera um PDF por livro (66) a partir de saida/web/dados, para imprimir ou ler no computador.

Cada versículo: cartões com a palavra no original, transliteração, Strong e glosa; abaixo, a BLIVRE.
No começo, a introdução do livro; no fim, o léxico dos verbetes usados no livro.
O HTML de impressão é montado aqui e o Chromium (Playwright) gera o PDF (scripts/imprimir_pdf.mjs).

Uso: python3 scripts/build_pdf.py              → os 66 livros + Bíblia completa + AT + NT (saida/pdf)
     python3 scripts/build_pdf.py volumes      → só junta os PDFs já gerados na Bíblia completa e nos volumes
     python3 scripts/build_pdf.py GEN JHN      → só esses livros
"""

import html
import json
import os
import shutil
import subprocess
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(__file__))
from build_epub import DADOS, ROOT, about_html, gloss_html, h, plain  # noqa: E402

TMP = os.path.join(ROOT, "saida", "pdf-build")
OUT = os.path.join(ROOT, "saida", "pdf")

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


def html_livro(B, LEX, idx):
    grc = B["nt"]
    ocls = "grc" if grc else "he"
    olang = 'lang="grc"' if grc else 'lang="he" dir="rtl"'
    A = B.get("about") or {}
    out = [
        f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>{h(B["nome"])} · Bíblia Interlinear</title>'
        f'<link rel="stylesheet" href="../web/fonts/fonts.css"><style>{CSS}</style></head><body>',
        f'<section class="capa"><h1>{h(B["nome"])}</h1><div class="orig {ocls}" {olang}>{h(A.get("title_orig"))}</div>'
        f"<p>Bíblia Interlinear · {'grego' if grc else 'hebraico'} e português</p>"
        f"<p>Original, transliteração, número Strong e glosa de cada palavra, com o texto da Bíblia Livre (BLIVRE).</p>"
        f'<p class="intro">{"Leia da esquerda para a direita." if grc else "Os cartões se leem da direita para a esquerda."} '
        "Glosas em itálico cinza não vieram do alinhamento direto com a BLIVRE.</p></section>",
    ]
    sobre = about_html(B)
    if sobre:
        out.append(sobre.replace('epub:type="introduction" ', ""))
    usados = {}
    for c in B["caps"]:
        n = c["n"]
        d = json.load(open(os.path.join(DADOS, "cap", B["cod"], f"{n}.json"), encoding="utf8"))
        out.append(f'<h1 class="cap" id="c{n}">{h(B["nome"])} {n}</h1>' + (f'<p class="tema">{h(c["t"])}</p>' if c.get("t") else ""))
        for v in d["v"]:
            vn = v["n"]
            cards = []
            for w in v["w"]:
                t, k, g, f = w[0], w[1], w[2], w[3]
                e = LEX.get(k) or {}
                if k and e:
                    usados[k] = e
                num = "part." if k and len(k) == 2 and k[1].isalpha() else (k if k and not k.startswith("G:") else "—")
                cards.append(
                    f'<div class="w"><span class="o {ocls}" {olang}>{h(t if grc else plain(t))}</span>'
                    + (f'<span class="x">{h(e.get("x"))}</span>' if e.get("x") else "")
                    + f'<span class="s">{h(num)}</span><span class="g{" aux" if f and f != "m" else ""}">{gloss_html(g)}</span></div>'
                )
            nota = ""
            if v.get("o") == "sem-original":
                nota = '<p class="vnote">Sem correspondente no texto original usado nesta edição.</p>'
            elif v.get("o") == "aparato":
                nota = '<p class="vnote">No SBLGNT este trecho está só no aparato crítico; leitura de Westcott-Hort, Tregelles e NA28.</p>'
            out.append(
                f'<div class="verse"><div class="vn">{"Título" if vn == 0 else f"{n}:{vn}"}</div>'
                + (f'<div class="words{"" if grc else " rtl"}">{"".join(cards)}</div>' if cards else "")
                + f'{nota}<p class="bl"><span class="tag">BLIVRE</span>{h(v["b"])}</p></div>'
            )

    def ordem(k):
        return (k.startswith("G:"), int(k[1:]) if k[1:].isdigit() else 10**9, k)

    out.append(f'<section class="lexico"><h1>Léxico de {h(B["nome"])}</h1>')
    for k in sorted(usados, key=ordem):
        e = usados[k]
        lang = 'class="l grc" lang="grc"' if k[0] == "G" else 'class="l he" lang="he" dir="rtl"'
        out.append(
            f'<div class="entry"><b>{"" if k.startswith("G:") else h(k)}</b> <span {lang}>{h(e.get("l"))}</span> '
            f'<i>{h(e.get("x"))}</i> · <span class="pr">{h(e.get("p"))}</span><br>'
            f"{h(e.get('s') or e.get('se') or e.get('ge') or '')}"
            + (f'<br><span class="intro">BLIVRE: {h(e["t"])}</span>' if e.get("t") else "")
            + "</div>"
        )
    out.append("</section>")
    out.append(
        '<section class="creditos"><h1>Fontes e licenças</h1>'
        "<p>Hebraico e aramaico: Open Scriptures Hebrew Bible (CC BY 4.0), sobre o Westminster Leningrad Codex. "
        "Grego: SBL Greek New Testament (CC BY 4.0) e MorphGNT (CC BY-SA 3.0). Tradução corrida: Bíblia Livre (BLIVRE), "
        "de Diego Santos, Mario Sérgio e Marco Teles, CC BY 4.0 / 3.0 Brasil, reproduzida sem alterações. Léxico: Strong "
        "(domínio público; edição Open Scriptures, CC BY-SA) e Dodson (domínio público), vertidos para o português nesta edição. "
        "Glosas por alinhamento estatístico com a BLIVRE, revisão pendente; não fazem parte da BLIVRE. Introdução e temas escritos "
        "para esta edição. Fontes tipográficas sob a SIL Open Font License 1.1. Este PDF é distribuído sob CC BY-SA.</p></section>"
    )
    out.append("</body></html>")
    return "\n".join(out)


def main(argv):
    livros = json.load(open(os.path.join(DADOS, "livros.json"), encoding="utf8"))
    LEX = {}
    for L in "HG":
        LEX.update(json.load(open(os.path.join(DADOS, "lex", f"{L}.json"), encoding="utf8")))
    quais = {a.upper() for a in argv}
    if not quais or "BLIVRE" in quais:
        blivre(livros)
        quais.discard("BLIVRE")
        if argv and not quais:
            return
    os.makedirs(TMP, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    jobs, alvo = [], []
    for i, B in enumerate(livros, 1):
        if quais and B["cod"] not in quais:
            continue
        if quais == {"VOLUMES"}:
            continue
        nome = unicodedata.normalize("NFD", B["nome"]).encode("ascii", "ignore").decode().replace(" ", "")
        src = os.path.join(TMP, f"{B['cod']}.html")
        open(src, "w", encoding="utf8").write(html_livro(B, LEX, i))
        jobs.append([src, os.path.join(OUT, f"{i:02d}-{B['cod']}-{nome}.pdf"), f"{B['nome']} · Bíblia Interlinear"])
        alvo.append(B)
    if jobs:
        lista = os.path.join(TMP, "jobs.json")
        json.dump(jobs, open(lista, "w", encoding="utf8"))
        subprocess.run(["node", os.path.join(ROOT, "scripts", "imprimir_pdf.mjs"), lista], check=True)
        for (_, out, _), B in zip(jobs, alvo):
            marcadores(out, B)
            otimizar(out)
    if not quais or "VOLUMES" in quais:
        volumes(livros)


def blivre(livros):
    """Edição só com o texto da Bíblia Livre (A4, duas colunas), com marcadores por testamento, livro e capítulo."""
    from pypdf import PdfReader, PdfWriter

    esc = html.escape
    partes = [
        """<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Bíblia Livre</title><style>
@page { size: A4; }
body { font-family: "Literata", Georgia, serif; font-size: 10.5pt; line-height: 1.45; color: #111; margin: 0; }
.capa { height: 240mm; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always; }
.capa h1 { font-size: 34pt; margin: 0 0 8mm; } .capa p { font-size: 12pt; color: #444; max-width: 120mm; margin: 0 auto 4mm; }
.livro { page-break-before: always; columns: 2; column-gap: 8mm; }
.livro h1 { column-span: all; font-size: 22pt; text-align: center; margin: 0 0 6mm; }
h2 { font-size: 12pt; margin: 4mm 0 1mm; break-after: avoid; }
p.tema { font-style: italic; font-size: 9.5pt; color: #444; margin: 0 0 1.5mm; break-after: avoid; }
p.tit { font-style: italic; margin: 0 0 1mm; }
p.txt { text-align: justify; margin: 0 0 2mm; hyphens: auto; }
sup { font-size: 6.5pt; font-weight: 700; color: #555; margin: 0 .5pt 0 2pt; }
.creditos { page-break-before: always; font-size: 9pt; color: #333; }
</style><link rel="stylesheet" href="../web/fonts/fonts.css"></head><body>
<section class="capa"><h1>Bíblia Livre</h1><p>Os 66 livros, com o tema de cada capítulo.</p>
<p>Texto da Bíblia Livre (BLIVRE). Temas: projeto Bíblia Interlinear, com fontes abertas.</p></section>"""
    ]
    for B in livros:
        partes.append(f'<section class="livro"><h1>{esc(B["nome"])}</h1>')
        for c in B["caps"]:
            d = json.load(open(os.path.join(DADOS, "cap", B["cod"], f"{c['n']}.json"), encoding="utf8"))
            partes.append(f"<h2>{esc(B['nome'])} {c['n']}</h2>")
            if c.get("t"):
                partes.append(f'<p class="tema">{esc(c["t"])}</p>')
            corpo = []
            for v in d["v"]:
                if not (v.get("b") or "").strip():
                    continue
                if v["n"] == 0:
                    partes.append(f'<p class="tit">{esc(v["b"])}</p>')
                else:
                    corpo.append(f"<sup>{v['n']}</sup>{esc(v['b'])}")
            partes.append('<p class="txt">' + " ".join(corpo) + "</p>")
        partes.append("</section>")
    partes.append(
        '<section class="creditos"><h1>Fontes e licenças</h1><p>Texto: Bíblia Livre (BLIVRE), de Diego Santos, '
        "Mario Sérgio e Marco Teles. Temas dos capítulos: projeto Bíblia Interlinear "
        "(github.com/josafams/biblia-interlinear).</p></section></body></html>"
    )
    src = os.path.join(TMP, "BLIVRE.html")
    os.makedirs(TMP, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    open(src, "w", encoding="utf8").write("\n".join(partes))
    destino = os.path.join(OUT, "00-Biblia-Livre.pdf")
    lista = os.path.join(TMP, "jobs-blivre.json")
    json.dump([[src, destino, "Bíblia Livre"]], open(lista, "w", encoding="utf8"))
    subprocess.run(["node", os.path.join(ROOT, "scripts", "imprimir_pdf.mjs"), lista], check=True)
    if shutil.which("pdftotext"):
        txt = subprocess.run(["pdftotext", "-enc", "UTF-8", destino, "-"], capture_output=True, text=True).stdout
        paginas = [{l.strip() for l in p.splitlines() if l.strip()} for p in txt.split("\f")]
        w = PdfWriter(clone_from=PdfReader(destino))
        test = {}
        pg = 0
        for B in livros:
            t = "Novo Testamento" if B["nt"] else "Antigo Testamento"
            for k in range(pg, len(paginas)):
                if B["nome"] in paginas[k]:
                    pg = k
                    break
            if t not in test:
                test[t] = w.add_outline_item(t, pg)
            livro = w.add_outline_item(B["nome"], pg, parent=test[t])
            for c in B["caps"]:
                for k in range(pg, len(paginas)):
                    if f"{B['nome']} {c['n']}" in paginas[k]:
                        pg = k
                        break
                w.add_outline_item(f"{B['nome']} {c['n']}", pg, parent=livro)
        w.page_mode = "/UseOutlines"
        w.add_metadata({"/Title": "Bíblia Livre", "/Author": "Bíblia Livre (BLIVRE)", "/Lang": "pt-BR"})
        with open(destino, "wb") as f:
            w.write(f)
    otimizar(destino)
    print(f"00-Biblia-Livre.pdf  {os.path.getsize(destino) // 1048576} MB")


def marcadores(arq, B):
    """Marcadores do PDF (introdução, cada capítulo, léxico, créditos), achando a página de cada título pelo texto."""
    if not shutil.which("pdftotext"):
        return
    from pypdf import PdfReader, PdfWriter

    txt = subprocess.run(["pdftotext", "-enc", "UTF-8", arq, "-"], capture_output=True, text=True).stdout
    paginas = [{l.strip() for l in p.splitlines() if l.strip()} for p in txt.split("\f")]
    nome = B["nome"]
    alvos = [("Sobre o livro", lambda ls: any(l.startswith(f"Sobre {nome}") for l in ls))]
    alvos += [
        (f"{nome} {c['n']}" + (f" — {c['t']}" if c.get("t") else ""), (lambda t: lambda ls: t in ls)(f"{nome} {c['n']}")) for c in B["caps"]
    ]
    alvos += [("Léxico", lambda ls: f"Léxico de {nome}" in ls), ("Fontes e licenças", lambda ls: "Fontes e licenças" in ls)]
    w = PdfWriter(clone_from=PdfReader(arq))
    pg = 0
    for titulo, achou in alvos:
        for k in range(pg, len(paginas)):
            if achou(paginas[k]):
                w.add_outline_item(titulo, min(k, len(w.pages) - 1))
                pg = k
                break
    w.page_mode = "/UseOutlines"
    w.add_metadata({"/Title": f"{nome} · Bíblia Interlinear", "/Author": "Bíblia Interlinear (BLIVRE)"})
    with open(arq, "wb") as f:
        w.write(f)


def otimizar(arq):
    """Compacta o PDF com o qpdf (fluxos de objetos e compressão máxima). O Chromium só cria os marcadores
    quando gera o PDF com marcação de acessibilidade, que dobra o tamanho; a compactação quase desfaz isso."""
    if not shutil.which("qpdf"):
        return
    tmp = arq + ".tmp"
    r = subprocess.run(
        ["qpdf", "--object-streams=generate", "--compress-streams=y", "--recompress-flate", "--compression-level=9", arq, tmp]
    )
    if r.returncode in (0, 3) and os.path.exists(tmp):  # 3 = avisos
        os.replace(tmp, arq)


def volumes(livros):
    """Junta os PDFs dos livros na Bíblia completa e nos volumes AT e NT, com marcadores por livro e capítulo."""
    from pypdf import PdfWriter

    def arq(i, B):
        nome = unicodedata.normalize("NFD", B["nome"]).encode("ascii", "ignore").decode().replace(" ", "")
        return os.path.join(OUT, f"{i:02d}-{B['cod']}-{nome}.pdf")

    todos = [(B, arq(i, B)) for i, B in enumerate(livros, 1)]
    faltam = [os.path.basename(a) for _, a in todos if not os.path.exists(a)]
    if faltam:
        print("volumes não gerados; faltam os PDFs:", ", ".join(faltam[:5]), "…" if len(faltam) > 5 else "")
        return
    for nome, titulo, sel in (
        ("00-Biblia-Interlinear-completa.pdf", "Bíblia Interlinear — Bíblia completa", lambda B: True),
        ("00-Biblia-Interlinear-AT.pdf", "Bíblia Interlinear — Antigo Testamento", lambda B: not B["nt"]),
        ("00-Biblia-Interlinear-NT.pdf", "Bíblia Interlinear — Novo Testamento", lambda B: B["nt"]),
    ):
        w = PdfWriter()
        partes = {}
        for B, a in todos:
            if not sel(B):
                continue
            pai = None
            inicio = len(w.pages)
            w.append(a, import_outline=False)
            if nome.endswith("completa.pdf"):
                t = "Novo Testamento" if B["nt"] else "Antigo Testamento"
                if t not in partes:
                    partes[t] = w.add_outline_item(t, inicio)
                pai = partes[t]
            livro = w.add_outline_item(B["nome"], inicio, parent=pai)
            # capítulos: os marcadores que o Chromium criou no PDF do livro, um nível abaixo do livro
            from pypdf import PdfReader

            r = PdfReader(a)

            def copiar(itens, destino):
                ultimo = None
                for it in itens:
                    if isinstance(it, list):
                        if ultimo is not None:
                            copiar(it, ultimo)
                        continue
                    try:
                        pg = r.get_destination_page_number(it)
                    except Exception:
                        continue
                    ultimo = w.add_outline_item(it.title, inicio + pg, parent=destino)

            copiar(r.outline, livro)
        w.add_metadata({"/Title": titulo, "/Author": "Bíblia Interlinear (BLIVRE)", "/Lang": "pt-BR"})
        w.page_mode = "/UseOutlines"
        destino = os.path.join(OUT, nome)
        with open(destino, "wb") as f:
            w.write(f)
        otimizar(destino)
        print(f"{nome}  {len(w.pages)} páginas  {os.path.getsize(destino) // 1048576} MB")


if __name__ == "__main__":
    main(sys.argv[1:])
