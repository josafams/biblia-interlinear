"""EPUB e PDF de um livro pequeno (Rute): estrutura, validação e marcadores."""

import os
import re
import shutil
import subprocess
import sys
import zipfile

import pytest

from conftest import ROOT

EPUB = os.path.join(ROOT, "build", "epub", "08-RUT-Rute.epub")
PDF = os.path.join(ROOT, "build", "pdf", "08-RUT-Rute.pdf")


@pytest.fixture(scope="module")
def epub(books):
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_epub.py"), "RUT"], check=True, capture_output=True)
    return EPUB


def test_epub_structure(epub):
    z = zipfile.ZipFile(epub)
    names = z.namelist()
    assert names[0] == "mimetype"
    assert z.read("mimetype") == b"application/epub+zip"
    assert z.getinfo("mimetype").compress_type == zipfile.ZIP_STORED
    assert "META-INF/container.xml" in names
    texts = " ".join(z.read(n).decode("utf8") for n in names if n.endswith((".xhtml", ".html")))
    assert "Rute" in texts
    assert "Noemi" in texts
    assert len(re.findall(r'epub:type="footnote"', texts)) > 1000, "cada palavra do original deve ser uma nota"


@pytest.mark.skipif(not shutil.which("epubcheck") and not os.environ.get("EPUBCHECK_JAR"), reason="epubcheck não instalado")
def test_epubcheck(epub):
    cmd = ["epubcheck", epub] if shutil.which("epubcheck") else ["java", "-jar", os.environ["EPUBCHECK_JAR"], epub]
    r = subprocess.run(cmd, capture_output=True, text=True)
    assert r.returncode == 0, r.stdout[-3000:] + r.stderr[-3000:]


def _has_chromium():
    return os.path.exists("/opt/pw-browsers/chromium") or os.environ.get("CHROMIUM_PATH") or os.environ.get("PDF_TESTE")


@pytest.mark.skipif(not _has_chromium(), reason="Chromium do Playwright não disponível (defina PDF_TESTE=1 para forçar)")
def test_pdf_ruth_with_bookmarks(books):
    pypdf = pytest.importorskip("pypdf")
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_pdf.py"), "RUT"], check=True, capture_output=True)
    r = pypdf.PdfReader(PDF)
    assert len(r.pages) > 10
    titles = [o.title for o in r.outline if not isinstance(o, list)]
    assert any("Sobre o livro" in t for t in titles)
    caps = [t for t in titles if re.match(r"Rute \d", t)]
    assert len(caps) == 4, titles
    page_list = [r.get_destination_page_number(o) for o in r.outline if not isinstance(o, list)]
    assert page_list == sorted(page_list)
    assert page_list[-1] < len(r.pages)


def test_epub_blivre_only(books):
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_epub.py"), "blivre"], check=True, capture_output=True)
    z = zipfile.ZipFile(os.path.join(ROOT, "build", "epub", "00-Biblia-Livre.epub"))
    names = z.namelist()
    assert names[0] == "mimetype"
    books_xhtml = [n for n in names if re.match(r"OEBPS/[1-3A-Z]{3}\.xhtml$", n)]
    assert len(books_xhtml) == 66
    gen = z.read("OEBPS/GEN.xhtml").decode("utf8")
    assert "No princípio criou Deus os céus e a terra." in gen
    assert gen.count('<h2 id="c') == 50
    assert 'epub:type="footnote"' not in gen


def test_epub_in_english(books):
    """--lang en: the same book with the BSB, the English glosses and lexicon and the English texts (#8)."""
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_epub.py"), "--lang", "en", "RUT"], check=True, capture_output=True)
    z = zipfile.ZipFile(os.path.join(ROOT, "build", "epub", "en", "08-RUT-Ruth.epub"))
    opf = z.read("OEBPS/content.opf").decode("utf8")
    assert "<dc:language>en</dc:language>" in opf
    assert "<dc:title>Ruth · Bíblia Interlinear</dc:title>" in opf
    c1 = z.read("OEBPS/c1.xhtml").decode("utf8")
    assert 'lang="en"' in c1
    assert '<span class="tag">BSB</span> In the days when the judges ruled' in c1
    texts = " ".join(z.read(n).decode("utf8") for n in z.namelist() if n.endswith(".xhtml"))
    assert "Naomi" in texts
    assert "About Ruth" in texts
    assert "How the BSB translates it" in texts
    for portuguese in ("Noemi", "BLIVRE", "Léxico", "pronúncia", "substantivo"):
        assert portuguese not in texts, portuguese


def test_epub_bsb_only(books):
    subprocess.run(
        [sys.executable, os.path.join(ROOT, "scripts", "build_epub.py"), "--lang", "en", "blivre"], check=True, capture_output=True
    )
    z = zipfile.ZipFile(os.path.join(ROOT, "build", "epub", "en", "00-Berean-Standard-Bible.epub"))
    gen = z.read("OEBPS/GEN.xhtml").decode("utf8")
    assert "In the beginning God created the heavens and the earth." in gen
    assert gen.count('<h2 id="c') == 50
    assert "<h1>Genesis</h1>" in gen


@pytest.mark.skipif(not _has_chromium(), reason="Chromium do Playwright não disponível (defina PDF_TESTE=1 para forçar)")
def test_pdf_in_english(books):
    pypdf = pytest.importorskip("pypdf")
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_pdf.py"), "--lang", "en", "RUT"], check=True, capture_output=True)
    r = pypdf.PdfReader(os.path.join(ROOT, "build", "pdf", "en", "08-RUT-Ruth.pdf"))
    titles = [o.title for o in r.outline if not isinstance(o, list)]
    assert titles[0] == "About the book"
    assert len([t for t in titles if re.match(r"Ruth \d", t)]) == 4, titles
    assert titles[-2:] == ["Lexicon", "Sources and licenses"]
    assert r.metadata["/Author"] == "Bíblia Interlinear (BSB)"
