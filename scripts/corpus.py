#!/usr/bin/env python3
"""Monta o corpus da Bíblia inteira num banco SQLite (build/biblia.sqlite).

- BLIVRE versículo a versículo, na numeração das Bíblias em português:
  edição 2018 (eBible, CC BY 4.0) como base; versículos que faltam nela (onde a
  numeração hebraica difere) e títulos dos Salmos vêm da edição 2017 (CrossWire,
  CC BY 3.0 BR), mesmos autores.
- Hebraico e aramaico (Open Scriptures, morphhb, CC BY 4.0) com o mapa oficial
  de versificação hebraico → KJV (VerseMap.xml); títulos dos Salmos viram o versículo 0.
- Grego: SBLGNT (CC BY 4.0) com morfologia e lemas do MorphGNT (CC BY-SA).
- Léxicos de Strong (domínio público; edição digital Open Scriptures, CC BY-SA).

Uso: python3 scripts/corpus.py
"""

import csv
import difflib
import json
import os
import re
import sqlite3
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

from books import BOOKS, BY_CODE, OT_BOOKS
from interlinear.paths import DB
from interlinear.paths import SOURCES as SOURCES_DIR
from interlinear.sources import dodson_file, morphgnt_lines, morphhb_file
from interlinear.text import norm_greek


# ---------------------------------------------------------------- BLIVRE
def load_blivre():
    vref = Path(os.path.join(SOURCES_DIR, "ebible/metadata/vref.txt")).read_text(encoding="utf8").split("\n")
    corpus_lines = Path(os.path.join(SOURCES_DIR, "ebible/corpus/por-porbr2018.txt")).read_text(encoding="utf8").split("\n")
    e18 = {}
    for ref, txt in zip(vref, corpus_lines, strict=False):
        if ref and txt.strip():
            b, cv = ref.split(" ")
            c, v = cv.split(":")
            e18[(b, int(c), int(v))] = txt.strip()
    sm_name = {row[3]: row[0] for row in BOOKS}
    e17 = {}
    with open(os.path.join(SOURCES_DIR, "scrollmapper/PorBLivre.csv"), encoding="utf8") as f:
        for b, c, v, t in list(csv.reader(f))[1:]:
            e17[(sm_name[b], int(c), int(v))] = t.strip()
    verses = {}
    for k in set(e17) | set(e18):
        t17 = e17.get(k, "")
        t18 = e18.get(k, "")
        empty17 = t17.strip() in ("", "—", "-")
        if k[0] in OT_BOOKS:
            # AT: revisão de 2018; a de 2017 cobre os versículos que a 2018 perdeu na conversão
            if t18:
                verses[k] = (t18, "2018")
            elif not empty17:
                verses[k] = (t17, "2017")
        else:
            # NT: a edição 2017 traduz o texto crítico (o mesmo do SBLGNT);
            # a 2018 segue o Textus Receptus e só entra onde a 2017 deixa o versículo vazio
            if not empty17:
                verses[k] = (t17, "2017")
            elif t18:
                verses[k] = (t18, "2018")
    return verses, e17, e18


def psalm_title(t17, t18):
    """Na edição 2017 o título do salmo vem no começo do v. 1; a 2018 traz só o versículo.
    Devolve (título limpo, trecho original com a pontuação) ou (None, None)."""
    if not t17 or not t18 or t17 == t18:
        return None, None
    sm = difflib.SequenceMatcher(None, t17, t18, autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size > 12]
    if not blocks:
        return None, None
    start_offset = blocks[0].a - blocks[0].b  # onde o texto da 2018 começa dentro da 2017
    if start_offset <= 3:
        return None, None
    clean = t17[:start_offset].strip().rstrip(":;,. ").strip()
    return (clean or None), t17[:start_offset]


# ---------------------------------------------------------------- hebraico
def load_versemap():
    """Mapa versículo hebraico → versículo na numeração das traduções (só versículos inteiros).
    Os 7 casos em que um versículo hebraico se divide entre dois ficam em DIVISOES."""
    x = Path(os.path.join(SOURCES_DIR, "morphhb/wlc/VerseMap.xml")).read_text(encoding="utf8")
    m = {}
    for wlc, kjv, kind in re.findall(r'<verse wlc="([^"]+)" kjv="([^"]+)" type="([^"]+)"', x):
        if kind == "full" and "!" not in wlc and "!" not in kjv:
            m[wlc] = kjv
    return m


# Versículos hebraicos divididos entre dois versículos da tradução:
# (quantas palavras vão para o primeiro, primeiro destino, segundo destino).
# Pontos de divisão conferidos com a TAHOT (STEPBible, CC BY 4.0) e com o VerseMap.xml.
DIVISIONS = {
    # 1Rs 18:34 e 22:21: a BLIVRE segue a divisão hebraica (não a da KJV); 20:3: só "e disse-lhe" fica no v. 2
    "1Kgs.18.34": (99, "1Kgs.18.34", "1Kgs.18.34"),
    "1Kgs.20.3": (2, "1Kgs.20.2", "1Kgs.20.3"),
    "1Kgs.22.44": (99, "1Kgs.22.43", "1Kgs.22.43"),
    "Isa.63.19": (9, "Isa.63.19", "Isa.64.1"),
    "Ps.13.6": (6, "Ps.13.5", "Ps.13.6"),
}


def _cv(ref):
    _, c, v = ref.split(".")
    return int(c), int(v)


def read_hebrew(osis, vm):
    x = morphhb_file(osis).read_text(encoding="utf8")

    # ketiv/qere: no texto fica a leitura (qere), com vogais; a forma escrita (ketiv) vai num atributo
    def swap(m):
        ketiv = " ".join(re.sub(r"<[^>]+>", "", k) for k in re.findall(r"<w [^>]*>[^<]*</w>", m.group(1)))
        return re.sub(r"<w ", f'<w ketiv="{ketiv}" ', m.group(2), count=1)

    x = re.sub(
        r'((?:<w type="x-ketiv"[^>]*>[^<]*</w>\s*(?:<seg[^>]*>[^<]*</seg>)?\s*)+)'
        r'(?:<note type="exegesis">(?:(?!</note>).)*</note>\s*)?<note type="variant">\s*'
        r'<catchWord>[^<]*</catchWord>\s*<rdg type="x-qere">(.*?)</rdg>\s*</note>',
        swap,
        x,
        flags=re.S,
    )
    x = re.sub(r"<note\b.*?</note>", "", x, flags=re.S)  # demais notas fora do texto
    mapped_chapters = defaultdict(bool)
    for wlc in list(vm) + list(DIVISIONS):
        b, c, _ = wlc.split(".")
        if b == osis:
            mapped_chapters[int(c)] = True
    for vid, body_parts in re.findall(r'<verse osisID="([^"]+)">(.*?)</verse>', x, re.S):
        _, hc, hv = vid.split(".")
        hc, hv = int(hc), int(hv)
        words = []
        for attrs, txt in re.findall(r"<w ([^>]*)>(.*?)</w>", body_parts):
            a = dict(re.findall(r'(\w+)="([^"]*)"', attrs))
            words.append(
                {
                    "txt": re.sub(r"<[^>]+>", "", txt),
                    "lemma": a.get("lemma", ""),
                    "morph": a.get("morph", ""),
                    "id": a.get("id", ""),
                    "ketiv": a.get("ketiv"),
                }
            )
        if vid in DIVISIONS:
            n, r1, r2 = DIVISIONS[vid]
            yield (hc, hv), _cv(r1), words[:n], 0
            if words[n:]:
                yield (hc, hv), _cv(r2), words[n:], n
            continue
        next_item = f"{osis}.{hc}.{hv + 1}"
        if vid in vm and osis == "Ps" and vm.get(next_item) == vm[vid]:
            ec, ev = hc, 0  # título longo dos Salmos (51, 52, 54, 60): ocupa dois versículos hebraicos
        elif vid in vm:
            ec, ev = _cv(vm[vid])
        elif osis == "Ps" and mapped_chapters[hc]:
            ec, ev = hc, 0  # título do salmo (sem número na tradução)
        else:
            ec, ev = hc, hv
        yield (hc, hv), (ec, ev), words, 0


# Partículas inseparáveis do hebraico (o morphhb as marca por letra; Strong não lhes dá número).
# Palavras como לָהֶם ("a eles") têm só a partícula como lema.
PARTICLES_H = {
    "b": ("בְּ", "be", "em, com, por", "in, with, by"),
    "c": ("וְ", "ve", "e, então, mas", "and, then, but"),
    "d": ("הַ", "ha", "o, a (artigo definido)", "the (definite article)"),
    "i": ("הֲ", "ha", "partícula interrogativa (acaso…?)", "interrogative particle"),
    "k": ("כְּ", "ke", "como, conforme", "like, as, according to"),
    "l": ("לְ", "le", "a, para, de (posse)", "to, for, of"),
    "m": ("מִן", "min", "de, desde, mais que", "from, out of, than"),
    "s": ("שֶׁ", "she", "que, o qual", "that, which, who"),
}


def root_strong(lemma):
    pieces = lemma.split("/")
    root = pieces[-1].strip()
    num = re.match(r"(\d+)", root)
    prefixes = [p for p in pieces[:-1]]
    if num:
        return "H" + num.group(1), prefixes
    if root == "m":
        return "H4480", prefixes
    if root in PARTICLES_H:
        return "H" + root, prefixes
    return None, prefixes


# ---------------------------------------------------------------- grego
# Versículos do SBLGNT numerados de outro jeito nas Bíblias em português:
# (livro, cap, vers) → (palavras que ficam no 1º destino, 1º destino, 2º destino)
DIVISIONS_G = {
    ("2CO", 13, 12): (5, (13, 12), (13, 13)),
    ("2CO", 13, 13): (99, (13, 14), None),
    ("ACT", 19, 40): (21, (19, 40), (19, 41)),
    ("3JN", 1, 15): (99, (1, 14), None),
}


def read_greek(fname):
    for line in morphgnt_lines(fname):
        ref, pos, parse, verse_text, word, normal, lemma = line.rstrip("\n").split(" ")
        c, v = int(ref[2:4]), int(ref[4:6])
        verse_text = re.sub(r"[\u2E00-\u2E05\u27E6\u27E7]|(?<=[\u2E00-\u2E05])\d+", "", verse_text)
        yield (c, v), {"txt": verse_text, "palavra": word, "normal": normal, "lemma": lemma, "pos": pos, "parse": parse}


def load_dodson():
    """Léxico grego de Jeffrey Dodson (domínio público): lema → número de Strong e glosa curta."""
    x = dodson_file().read_text(encoding="utf8")
    by_lemma, gloss = {}, {}
    for lemma, num, body_parts in re.findall(r'<entry n="([^"|]+) \| (\d+)">(.*?)</entry>', x, re.S):
        k = "G" + str(int(num))
        lemma = unicodedata.normalize("NFC", lemma.strip())
        by_lemma.setdefault(lemma, k)
        g = re.search(r'<def role="brief">(.*?)</def>', body_parts, re.S)
        if g:
            gloss.setdefault(k, re.sub(r"\s+", " ", g.group(1)).strip())
    return by_lemma, gloss


# Lemas do SBLGNT cuja grafia não bate com nenhum verbete de Strong/Dodson (conferidos à mão).
G_MANUAL = {
    "πίμπλημι": "G4130",
    "ἐμπίμπλημι": "G1705",
    "γαμίζω": "G1061",
    "ἔπειμι": "G1966",
    "στεῖρα": "G4723",
    "λεγιών": "G3003",
    "Ναζαρά": "G3478",
    "λεμά": "G2982",
    "προσαίτης": "G4319",
    "ἀνάγαιον": "G508",
    "ἐφοράω": "G1896",
    "δεκαοκτώ": "G1176",
    "πλοῦς": "G4144",
    "ὀψία": "G3798",
    "διαρρήγνυμι": "G1284",
    "Ἰσκαριώθ": "G2469",
    "Βόες": "G1003",
    "κρυφαῖος": "G2927",
    "ψίξ": "G5589",
    "ἔνθεν": "G1782",
    "ἐχθές": "G5504",
    "μήγε": "G3361",
    "Μωϋσῆς": "G3475",
    "Μαριάμ": "G3137",
    "τεσσεράκοντα": "G5062",
    "Καφαρναούμ": "G2584",
    "ἀφίσταμαι": "G868",
    "Σαμαρίτης": "G4541",
    "ἕλκω": "G1670",
    "Ἰωβήδ": "G5601",
    "ἀλλαχοῦ": "G237",
    "δύσις": "G1424",
    "κόπριον": "G2874",
    "διόρθωμα": "G2735",
    "κημόω": "G5392",
    "ἐγκαυχάομαι": "G2744",
    "στάδιος": "G4712",
    "ἐγκακέω": "G1573",
    "ἐραυνάω": "G2045",
    "Μαθθαῖος": "G3156",
}


def greek_variants(lemma):
    lemma = unicodedata.normalize("NFC", lemma)
    out = [lemma]
    m = re.match(r"^(.*)\((.+)\)$", lemma)  # οὕτω(ς), ἔξεστι(ν)
    if m:
        out += [m.group(1) + m.group(2), m.group(1)]
    for b in list(out):
        for a, c in [
            ("άομαι", "άω"),
            ("έομαι", "έω"),
            ("όομαι", "όω"),
            ("ομαι", "ω"),
            ("υμι", "ύω"),
            ("άω", "έω"),
            ("έω", "άω"),
            ("μαι", "μι"),
        ]:
            if b.endswith(a):
                out.append(b[: -len(a)] + c)
    return out


def map_greek(lemmas, strong_g, dodson):
    """Devolve {lema: (chave Strong, como foi achada)}; 'aprox' marca correspondências por semelhança."""
    dods = {}
    for k, v in dodson.items():
        dods.setdefault(norm_greek(k), v)
    sgs = {}
    for k, e in strong_g.items():
        sgs.setdefault(norm_greek(e.get("lemma", "")), k)
    all_books = {**sgs, **dods}
    entry_keys = list(all_books)
    res = {}
    for lemma in lemmas:
        if lemma in G_MANUAL:
            res[lemma] = (G_MANUAL[lemma], "manual")
            continue
        found = None
        for v in greek_variants(lemma):
            found = dodson.get(v) or dods.get(norm_greek(v)) or sgs.get(norm_greek(v))
            if found:
                res[lemma] = (found, "lema")
                break
        if found:
            continue
        n = norm_greek(lemma)
        m = difflib.get_close_matches(n, entry_keys, n=1, cutoff=0.82)
        if m and m[0][0] == n[0] and abs(len(m[0]) - len(n)) <= 3:
            res[lemma] = (all_books[m[0]], "aprox")
        else:
            res[lemma] = (None, None)
    return res


def load_strong(fname):
    js = Path(os.path.join(SOURCES_DIR, f"strongs/{fname}")).read_text(encoding="utf8")
    return json.loads(js[js.index("{") : js.rindex("}") + 1])


# ---------------------------------------------------------------- banco
def main():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    if os.path.exists(DB):
        os.remove(DB)
    db = sqlite3.connect(DB)
    db.executescript("""
    CREATE TABLE books(book_order INTEGER PRIMARY KEY, code TEXT UNIQUE, name TEXT, abbrev TEXT, testament TEXT, language TEXT);
    CREATE TABLE verses(book TEXT, chapter INTEGER, verse INTEGER, blivre TEXT, edition TEXT, note TEXT,
                        PRIMARY KEY(book, chapter, verse));
    CREATE TABLE words(id INTEGER PRIMARY KEY, book TEXT, chapter INTEGER, verse INTEGER, pos INTEGER,
                          language TEXT, text TEXT, lemma TEXT, strong TEXT, prefixes TEXT, morph TEXT,
                          ref_orig TEXT, gloss TEXT, gloss_source TEXT, strong_source TEXT,
                          ketiv TEXT);
    CREATE INDEX ix_words ON words(book, chapter, verse, pos);
    CREATE TABLE lexicon(entry_key TEXT PRIMARY KEY, language TEXT, lemma TEXT, xlit TEXT, pron_en TEXT,
                        derivation_en TEXT, def_en TEXT, kjv_en TEXT, gloss_en TEXT, def_pt TEXT);
    """)
    verses, e17, e18 = load_blivre()

    vm = load_versemap()
    strong_h = load_strong("hebrew/strongs-hebrew-dictionary.js")
    strong_g = load_strong("greek/strongs-greek-dictionary.js")
    dodson, dodson_gloss = load_dodson()
    lemmas_g = set()
    for row in BOOKS:
        if row[4]:
            lemmas_g.update(p["lemma"] for _, p in read_greek(row[4]))
    g_map = map_greek(lemmas_g, strong_g, dodson)

    rows = []
    without_orig_text = Counter()
    for order, (cod, osis, _tahot, _sm, mgnt, name, abbrev) in enumerate(BOOKS, 1):
        test = "AT" if cod in OT_BOOKS else "NT"
        language = "hebraico" if test == "AT" else "grego"
        db.execute("INSERT INTO books VALUES (?,?,?,?,?,?)", (order, cod, name, abbrev, test, language))
        if osis:
            for (hc, hv), (ec, ev), wds, offset in read_hebrew(osis, vm):
                for i, p in enumerate(wds, offset + 1):
                    strong, pref = root_strong(p["lemma"])
                    lang = "A" if p["morph"].startswith("A") else "H"
                    rows.append(
                        (
                            cod,
                            ec,
                            ev,
                            None,
                            lang,
                            p["txt"],
                            p["lemma"],
                            strong,
                            "/".join(pref),
                            p["morph"],
                            f"{hc}:{hv}.{i}",
                            None,
                            None,
                            None,
                            p["ketiv"],
                        )
                    )
        else:
            n_g = Counter()
            for (c, v), p in read_greek(mgnt):
                entry_key, gloss_how = g_map[p["lemma"]]
                morph = p["pos"].replace("-", "") + "-" + p["parse"]
                n_g[(c, v)] += 1
                i = n_g[(c, v)]
                ec, ev = c, v
                if (cod, c, v) in DIVISIONS_G:
                    n, d1, d2 = DIVISIONS_G[(cod, c, v)]
                    ec, ev = d1 if i <= n else d2
                rows.append(
                    (
                        cod,
                        ec,
                        ev,
                        None,
                        "G",
                        p["txt"],
                        p["lemma"],
                        entry_key,
                        "",
                        morph,
                        f"{c}:{v}.{i}",
                        None,
                        None,
                        gloss_how,
                        p.get("fonte"),
                    )
                )
    # posição da palavra dentro do versículo de exibição (ordem de leitura)
    pos = Counter()
    final = []
    for r in rows:
        k = (r[0], r[1], r[2])
        pos[k] += 1
        final.append(r[:3] + (pos[k],) + r[4:])
    db.executemany(
        """INSERT INTO words(book,chapter,verse,pos,language,text,lemma,strong,prefixes,morph,ref_orig,
                      gloss,gloss_source,strong_source,ketiv) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        final,
    )

    # títulos dos Salmos: versículo 0 quando o hebraico os numera à parte;
    # quando o título está dentro do v. 1 hebraico, ele volta para o começo do v. 1
    with_title = {r[1] for r in final if r[0] == "PSA" and r[2] == 0}
    for c in range(1, 151):
        t18 = e18.get(("PSA", c, 1))
        clean, raw_text = psalm_title(e17.get(("PSA", c, 1)), t18)
        if not clean:
            continue
        if c in with_title:
            verses[("PSA", c, 0)] = (clean, "2017")
        else:
            verses[("PSA", c, 1)] = (raw_text.rstrip() + " " + t18, "2017+2018")

    # versículos: BLIVRE + nota quando não há texto original correspondente
    with_orig = {(r[0], r[1], r[2]) for r in final}
    for (b, c, v), (t, ed) in sorted(verses.items(), key=lambda kv: (list(BY_CODE).index(kv[0][0]), kv[0][1], kv[0][2])):
        note = "aparato" if (b, c, v) in {("ROM", 16, 25), ("ROM", 16, 26), ("ROM", 16, 27)} else None
        if (b, c, v) not in with_orig:
            note = "sem-original"
            without_orig_text[b] += 1
        db.execute("INSERT INTO verses VALUES (?,?,?,?,?,?)", (b, c, v, t, ed, note))
    # versículos com texto original e sem BLIVRE
    without_blivre = sorted(k for k in with_orig if k not in verses)
    for b, c, v in without_blivre:
        db.execute("INSERT INTO verses VALUES (?,?,?,?,?,?)", (b, c, v, "", None, "sem-blivre"))

    for k, e in strong_h.items():
        db.execute(
            "INSERT INTO lexicon VALUES (?,?,?,?,?,?,?,?,?,?)",
            (k, "H", e.get("lemma"), e.get("xlit"), e.get("pron"), e.get("derivation"), e.get("strongs_def"), e.get("kjv_def"), None, None),
        )
    for letter, (heb, xlit, pt, en) in PARTICLES_H.items():
        if letter != "m":
            db.execute(
                "INSERT INTO lexicon VALUES (?,?,?,?,?,?,?,?,?,?)",
                ("H" + letter, "H", heb, xlit, xlit, "partícula inseparável (prefixo)", en, None, en, pt),
            )
    for k, e in strong_g.items():
        db.execute(
            "INSERT INTO lexicon VALUES (?,?,?,?,?,?,?,?,?,?)",
            (
                k,
                "G",
                e.get("lemma"),
                e.get("translit"),
                None,
                e.get("derivation"),
                e.get("strongs_def"),
                e.get("kjv_def"),
                dodson_gloss.get(k),
                None,
            ),
        )
    db.commit()

    n_words = db.execute("SELECT count(*) FROM words").fetchone()[0]
    n_verses = db.execute("SELECT count(*) FROM verses").fetchone()[0]
    without_strong = db.execute("SELECT count(*) FROM words WHERE strong IS NULL").fetchone()[0]
    print(f"{n_words} palavras, {n_verses} versículos; sem Strong: {without_strong}")
    print("versículos BLIVRE sem texto original:", sum(without_orig_text.values()), dict(without_orig_text.most_common(8)))
    print("versículos com original e sem BLIVRE:", len(without_blivre), without_blivre[:10])
    print("grego, Strong por:", dict(Counter(r[0] for r in db.execute("SELECT strong_source FROM words WHERE language='G'"))))
    print("edição 2017 usada em:", db.execute("SELECT count(*) FROM verses WHERE edition='2017'").fetchone()[0], "versículos")


if __name__ == "__main__":
    main()
