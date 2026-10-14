"""EPUB e PDF de um livro pequeno (Rute): estrutura, validação e marcadores."""
import os
import re
import shutil
import subprocess
import sys
import zipfile

import pytest

from conftest import ROOT, DADOS

EPUB = os.path.join(ROOT, "saida", "epub", "08-RUT-Rute.epub")
PDF = os.path.join(ROOT, "saida", "pdf", "08-RUT-Rute.pdf")


@pytest.fixture(scope="module")
def epub(livros):
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_epub.py"), "RUT"], check=True, capture_output=True)
    return EPUB


def test_epub_estrutura(epub):
    z = zipfile.ZipFile(epub)
    nomes = z.namelist()
    assert nomes[0] == "mimetype" and z.read("mimetype") == b"application/epub+zip"
    assert z.getinfo("mimetype").compress_type == zipfile.ZIP_STORED
    assert "META-INF/container.xml" in nomes
    textos = " ".join(z.read(n).decode("utf8") for n in nomes if n.endswith((".xhtml", ".html")))
    assert "Rute" in textos and "Noemi" in textos
    assert len(re.findall(r'epub:type="footnote"', textos)) > 1000, "cada palavra do original deve ser uma nota"


@pytest.mark.skipif(not shutil.which("epubcheck") and not os.environ.get("EPUBCHECK_JAR"), reason="epubcheck não instalado")
def test_epubcheck(epub):
    cmd = ["epubcheck", epub] if shutil.which("epubcheck") else ["java", "-jar", os.environ["EPUBCHECK_JAR"], epub]
    r = subprocess.run(cmd, capture_output=True, text=True)
    assert r.returncode == 0, r.stdout[-3000:] + r.stderr[-3000:]


def _tem_chromium():
    return os.path.exists("/opt/pw-browsers/chromium") or os.environ.get("CHROMIUM_PATH") or os.environ.get("PDF_TESTE")


@pytest.mark.skipif(not _tem_chromium(), reason="Chromium do Playwright não disponível (defina PDF_TESTE=1 para forçar)")
def test_pdf_rute_com_marcadores(livros):
    pypdf = pytest.importorskip("pypdf")
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_pdf.py"), "RUT"], check=True, capture_output=True)
    r = pypdf.PdfReader(PDF)
    assert len(r.pages) > 10
    titulos = [o.title for o in r.outline if not isinstance(o, list)]
    assert any("Sobre o livro" in t for t in titulos)
    caps = [t for t in titulos if re.match(r"Rute \d", t)]
    assert len(caps) == 4, titulos
    paginas = [r.get_destination_page_number(o) for o in r.outline if not isinstance(o, list)]
    assert paginas == sorted(paginas) and paginas[-1] < len(r.pages)


def test_epub_so_biblia_livre(livros):
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_epub.py"), "blivre"], check=True, capture_output=True)
    z = zipfile.ZipFile(os.path.join(ROOT, "saida", "epub", "00-Biblia-Livre.epub"))
    nomes = z.namelist()
    assert nomes[0] == "mimetype"
    livros_xhtml = [n for n in nomes if re.match(r"OEBPS/[1-3A-Z]{3}\.xhtml$", n)]
    assert len(livros_xhtml) == 66
    gen = z.read("OEBPS/GEN.xhtml").decode("utf8")
    assert "No princípio criou Deus os céus e a terra." in gen
    assert gen.count('<h2 id="c') == 50
    assert "epub:type=\"footnote\"" not in gen
