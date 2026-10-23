"""A. Integrity of the base text, against the files of sources/."""

import re
import unicodedata
from collections import Counter, defaultdict

from interlinear.books import BOOKS
from interlinear.sources import morphgnt_lines, morphhb_file
from interlinear.text import consonantal


# ================================================================== A. integridade do texto-base
def hebrew_source(osis):
    """{(cap, vers) originais: [(texto, ketiv?, qere)]} lido do morphhb."""
    fname = morphhb_file(osis)
    if not fname.exists():
        return None
    x = fname.read_text(encoding="utf8")
    res = {}
    for vid, body_parts in re.findall(r'<verse osisID="([^"]+)">(.*?)</verse>', x, re.S):
        _, c, v = vid.split(".")
        ws = []
        for m in re.finditer(r"<w ([^>]*)>(.*?)</w>|<note\b.*?</note>", body_parts, re.S):
            if m.group(1) is not None:
                ws.append([re.sub(r"<[^>]+>", "", m.group(2)), 'type="x-ketiv"' in m.group(1), None])
            elif "x-qere" in m.group(0) and ws and ws[-1][1]:
                # o corpus usa a leitura (qere) no lugar da forma escrita (ketiv): a fonte de referência também
                q = [re.sub(r"<[^>]+>", "", t) for t in re.findall(r"<w [^>]*>(.*?)</w>", m.group(0), re.S)]
                if q:  # qere vazio (escrito e não lido): a palavra escrita fica no texto
                    while ws and ws[-1][1]:
                        ws.pop()
                    ws.extend([t, False, "qere"] for t in q)
        res[(int(c), int(v))] = ws
    return res


def greek_source(fname):
    lines = morphgnt_lines(fname, required=False)
    if lines is None:
        return None
    res = defaultdict(list)
    for line in lines:
        p = line.rstrip("\n").split(" ")
        if len(p) >= 4:
            res[(int(p[0][2:4]), int(p[0][4:6]))].append([p[3], False, None])
    return res


def check_base_text(d, M, scope_books):
    book_info = {row[0]: row for row in BOOKS}
    for book in scope_books:
        row = book_info.get(book)
        if not row:
            continue
        nt = d.testament.get(book) == "NT"
        src = greek_source(row[4]) if nt and row[4] else (hebrew_source(row[1]) if row[1] else None)
        code_count, cod_hash = ("TXG-01", "TXG-01") if nt else ("TXT-01", "TXT-02")
        if src is None:
            M.add(book, 1, 1, None, code_count, "info", "fonte original ausente em sources/; contagem não conferida")
            continue
        db_orig = defaultdict(list)
        for w in d.words:
            if w.book != book or not w.ref_orig:
                continue
            cv, n = w.ref_orig.split(".")
            c, v = cv.split(":")
            db_orig[(int(c), int(v))].append((int(n), w))
        for k in sorted(set(src) | set(db_orig)):
            ws = sorted(db_orig.get(k, []))
            source = src.get(k, [])
            target = ws[0][1] if ws else None
            loc = (target.chapter, target.verse) if target else k
            if not M.inside(book, loc[0]):
                continue
            if len(ws) != len(source):
                M.add(
                    book,
                    loc[0],
                    loc[1],
                    None,
                    code_count,
                    "erro",
                    f"{len(ws)} palavras no banco × {len(source)} na fonte (original {k[0]}:{k[1]})",
                )
                continue
            if [n for n, _ in ws] != list(range(1, len(ws) + 1)):
                M.add(book, loc[0], loc[1], None, code_count, "erro", f"numeração das palavras com buraco ({k[0]}:{k[1]})")
            if consonantal("".join(w.text for _, w in ws)) != consonantal("".join(f[0] for f in source)):
                M.add(book, loc[0], loc[1], None, cod_hash, "erro", f"texto consonantal difere da fonte (original {k[0]}:{k[1]})")
            elif not nt:
                for (_, w), f in zip(ws, source, strict=False):
                    if f[1]:
                        q = f" (Qere {f[2]})" if f[2] else ""
                        M.w(w, "TXT-04", "aviso", f"forma escrita (Ketiv) {w.text} no texto; a lida{q} não está registrada")


HEB_OK = re.compile(r"^[\u0591-\u05C7\u05D0-\u05EA\u05F0-\u05F4\u034F\u200D/]+$")
GRC_LETTER = re.compile(r"[\u0370-\u03FF\u1F00-\u1FFF]")
GRC_OK = re.compile(r"^[\u0370-\u03FF\u1F00-\u1FFF\u0300-\u036F.,;\u00B7\u0387\u2019\u02BC'\u1FBD\u2014]+$")
ACRONYMS = re.compile(r"[⸀-⸏⟦⟧\[\]()0-9]")


def check_unicode(d, M, ws):
    not_nfc = Counter()
    example = {}
    acronyms = defaultdict(list)
    for w in ws:
        t = w.text or ""
        if t != unicodedata.normalize("NFC", t):
            not_nfc[(w.book, w.language == "G")] += 1
            example.setdefault((w.book, w.language == "G"), w)
        if w.language == "G":
            if ACRONYMS.search(t):
                acronyms[(w.book, w.chapter)].append(w)
            letters = "".join(GRC_LETTER.findall(unicodedata.normalize("NFC", t)))
            if "ς" in letters[:-1]:
                M.w(w, "TXG-02", "erro", f"sigma final no meio da palavra: {t}")
            elif len(letters) > 1 and letters[-1] == "σ" and "’" not in t:
                M.w(w, "TXG-02", "aviso", f"sigma medial no fim da palavra: {t}")
            if not GRC_OK.match(ACRONYMS.sub("", t)):
                M.w(w, "TXG-02", "erro", f"caractere fora do permitido: {t!r}")
        else:
            if not HEB_OK.match(t):
                M.w(w, "TXT-03", "erro", f"caractere fora do permitido: {t!r}")
    for (book, cap), wds_in_verse in acronyms.items():
        signs = "".join(sorted({c for w in wds_in_verse for c in ACRONYMS.findall(w.text)}))
        M.add(
            book,
            cap,
            wds_in_verse[0].verse,
            None,
            "TXG-02",
            "aviso",
            f"{len(wds_in_verse)} palavras com sinais do aparato crítico ({signs}) no texto grego; ex.: {wds_in_verse[0].text}",
        )
    for (book, greek), n in not_nfc.items():
        w = example[(book, greek)]
        M.add(
            book,
            w.chapter,
            w.verse,
            None,
            "TXG-02" if greek else "TXT-03",
            "info",
            f"{n} palavras fora da forma NFC (ordem dos sinais da fonte preservada)",
        )


def check_verses_and_chapters(d, M, scope_books):
    caps = defaultdict(lambda: defaultdict(set))
    for b, c, v in d.verses:
        caps[b][c].add(v)
    for b, c, v in d.by_verse:
        caps[b][c].add(v)
    for b in scope_books:
        cs = sorted(caps[b])
        for i, c in enumerate(cs, 1):
            if c != i and i <= (cs[-1] if cs else 0):
                M.add(b, c, 1, None, "TXT-05", "erro", f"capítulo {i} ausente (numeração pula para {c})")
                break
        for c in cs:
            vs = sorted(v for v in caps[b][c] if v > 0)
            missing = sorted(set(range(1, vs[-1] + 1)) - set(vs)) if vs else []
            if missing:
                M.add(b, c, missing[0], None, "TXT-05", "erro", f"versículo(s) ausente(s): {missing[:8]}")
        for k, ws in d.by_verse.items():
            if k[0] != b:
                continue
            ps = [w.pos for w in ws]
            if ps != list(range(1, len(ps) + 1)):
                M.add(b, k[1], k[2], None, "TXT-05", "erro", "posições das palavras repetidas ou com buraco")


ARAMAIC = [("GEN", 31, 47, 31, 47), ("JER", 10, 11, 10, 11), ("EZR", 4, 8, 6, 18), ("EZR", 7, 12, 7, 26), ("DAN", 2, 4, 7, 28)]


def in_aramaic(b, c, v):
    return any(b == lb and (c1, v1) <= (c, v) <= (c2, v2) for lb, c1, v1, c2, v2 in ARAMAIC)


def check_aramaic(d, M, ws):
    by_verse = defaultdict(list)
    for w in ws:
        if w.language == "G":
            continue
        by_verse[(w.book, w.chapter, w.verse)].append(w)
        lang = (w.morph or "?")[:1]
        if (w.language == "A") != (lang == "A"):
            M.w(w, "ARM-02", "erro", f"língua {w.language} × morfologia {w.morph}")
    for k, vs in by_verse.items():
        inside = in_aramaic(*k)
        aram = [w for w in vs if w.language == "A"]
        if not inside:
            for w in aram:
                M.w(w, "ARM-01", "erro", "palavra aramaica fora dos trechos aramaicos conhecidos")
            continue
        if k == ("GEN", 31, 47):
            if len(aram) != 2:
                M.add(*k, None, "ARM-01", "erro", f"Gn 31:47 deveria ter 2 palavras aramaicas, tem {len(aram)}")
            continue
        if k == ("DAN", 2, 4):
            idx = [i for i, w in enumerate(vs) if w.language == "A"]
            if not idx or any(w.language == "H" for w in vs[idx[0] :]):
                M.add(*k, None, "ARM-01", "erro", "troca hebraico → aramaico em Dn 2:4b fora do lugar")
            continue
        for w in vs:
            if w.language == "H":
                M.w(w, "ARM-01", "aviso", "palavra marcada como hebraica dentro de trecho aramaico")
        if not aram:
            M.add(*k, None, "TXT-06", "aviso", "versículo de trecho aramaico sem palavras aramaicas")
