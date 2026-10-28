"""dados/<locale>/: the app in another language (English, with the Berean Standard Bible) as layers over the
Portuguese files, so the words of the original are not repeated:

- cap/<BOOK>/<n>.js: per verse {n, b: text, o: note, h: section title, g: [[gloss, source], ...] per word,
  a: links word ↔ text}; the notes use the same codes as the Bíblia Livre ("aparato", "sem-original", "sem-blivre");
- lex/H.js, lex/G.js: per entry the origin and meaning (Strong's, in English), the pronunciation and how the
  translation renders it;
- busca/: the search index of the text; conc/: the concordance with the glosses of the locale;
- livros.js (and livros.json, lex/{H,G}.json in build/data/<locale>/ for the static pages of src/seo): the
  project's own texts translated (data/<locale>/: chapter themes and book introductions, with the
  key verses quoted from the locale's text), loaded by ler.html before the reader; the questions of each chapter go
  in its cap/ file ("q"). A book without them yet shows none: the app does not mix languages."""

import json
import os
import re
from collections import defaultdict
from pathlib import Path

from interlinear.export.books import with_counts
from interlinear.export.chapters import SHORT_SOURCE
from interlinear.export.common import HEB_LETTERS, OUT, WEB, compact, split_heading
from interlinear.export.concordance import write_concordance
from interlinear.export.inputs import read_questions, read_themes
from interlinear.export.search import write_search_index
from interlinear.paths import ROOT
from pronunciation import pron_greek, pron_hebrew_en

# the Hebrew letters of the acrostics (split_heading) as English Bibles write them
HEB_LETTERS_EN = dict(
    zip(
        HEB_LETTERS,
        [
            "Aleph",
            "Beth",
            "Gimel",
            "Daleth",
            "He",
            "Waw",
            "Zayin",
            "Heth",
            "Teth",
            "Yodh",
            "Kaph",
            "Lamedh",
            "Mem",
            "Nun",
            "Samekh",
            "Ayin",
            "Pe",
            "Tsadhe",
            "Qoph",
            "Resh",
            "Shin",
            "Taw",
        ],
        strict=True,
    )
)
APPARATUS = {("ROM", 16, 25), ("ROM", 16, 26), ("ROM", 16, 27)}


def translation_texts(db, locale):
    """{(book, chapter): {verse: text}} of a locale in the translated_verses table."""
    texts = defaultdict(dict)
    for b, c, v, t in db.execute("SELECT book, chapter, verse, text FROM translated_verses WHERE locale=?", (locale,)):
        texts[(b, c)][v] = t
    return texts


def close_parenthesis(origin, meaning):
    """Strong's text is split into origin and meaning at a ";" that can sit inside a parenthesis ("from G435 and
    (the countenance" | "from G3700); man-faced"): the rest of the parenthesis goes back to the origin."""
    depth = origin.count("(") - origin.count(")")
    if depth <= 0:
        return origin, meaning
    for i, c in enumerate(meaning):
        depth += (c == "(") - (c == ")")
        if depth == 0:
            return f"{origin}; {meaning[: i + 1]}", meaning[i + 1 :].strip(" ;,")
    return origin, meaning


def build_lexicon(db, locale, usage):
    """The entries in the locale: Strong's origin and meaning (in English), the pronunciation and the translations."""
    translates = defaultdict(list)
    for ch, t, n in db.execute(
        "SELECT entry_key, translation, n FROM translated_lexicon WHERE locale=? ORDER BY entry_key, n DESC", (locale,)
    ):
        if len(translates[ch]) < 8:
            translates[ch].append(f"{t} ({n})")
    lex = {"H": {}, "G": {}}
    for entry_key, language, lemma, pron_en, deriv, definition, gloss_en in db.execute(
        "SELECT entry_key, language, lemma, pron_en, derivation_en, def_en, gloss_en FROM lexicon"
    ):
        pron = pron_hebrew_en(pron_en) if language == "H" else pron_greek(lemma or "", "en")
        origin, meaning = close_parenthesis((deriv or "").strip(" ;"), (definition or "").strip(" ;"))
        lex[language][entry_key] = {
            "o": origin,
            "s": meaning or gloss_en or "",
            "p": pron,
            "t": "; ".join(translates.get(entry_key, [])),
        }
    for entry_key in usage:
        if entry_key and entry_key.startswith("G:"):
            lex["G"][entry_key] = {
                "o": "",
                "s": "no entry in Strong's dictionary",
                "p": pron_greek(entry_key[2:], "en"),
                "t": "; ".join(translates.get(entry_key, [])),
            }
    return lex


def quote(texts, code, ref):
    """The text of a key verse ("1:16" or "3:14–16") in the locale."""
    m = re.match(r"^(\d+):(\d+)(?:[–-](\d+))?$", ref)
    if not m:
        return ""
    c, a, b = int(m[1]), int(m[2]), int(m[3] or m[2])
    return " ".join(t for v, t in sorted(texts[(code, c)].items()) if a <= v <= b and t)


def book_texts(locale, books, texts):
    """{book: {"t": {chapter: theme}, "about": introduction}} of the books translated in data/<locale>/."""
    folder = os.path.join(ROOT, "data", locale)
    out = {}
    for b in books:
        code, d = b["code"], {}
        themes = read_themes(code, folder)
        if themes:
            d["t"] = themes
        fname = os.path.join(folder, "books", f"{code}.json")
        if os.path.exists(fname):
            about = with_counts(json.loads(Path(fname).read_text(encoding="utf8")), b["chapters"], ("Chapters", "Verses"), "{:,}".format)
            for k in about.get("key_verses", []):
                k["text"] = quote(texts, code, k["ref"])
            d["about"] = about
        if d:
            out[code] = d
    return out


def write_translation(db, locale, chapters, books):
    """Every layer of the locale: chapters, lexicon, search, concordance and the project's texts."""
    texts = translation_texts(db, locale)
    questions = read_questions(os.path.join(ROOT, "data", locale))
    glosses = {
        pid: (g or "", SHORT_SOURCE.get(f, ""))
        for pid, g, f in db.execute("SELECT word_id, gloss, gloss_source FROM translated_glosses WHERE locale=?", (locale,))
    }
    align = {
        pid: [int(x) for x in s.split(",")]
        for pid, s in db.execute("SELECT word_id, spans FROM translated_alignment WHERE locale=?", (locale,))
    }
    web, out = os.path.join(WEB, locale), os.path.join(OUT, locale)
    concordance = defaultdict(list)
    n = 0
    for b, c in sorted(chapters.texts):
        verses = []
        for v in sorted(set(chapters.texts[(b, c)]) | set(chapters.words[(b, c)]) | set(texts[(b, c)])):
            text = texts[(b, c)].get(v, "")
            words = chapters.words[(b, c)].get(v, [])
            note = "aparato" if (b, c, v) in APPARATUS else "sem-original" if not words else None if text else "sem-blivre"
            heading = split_heading(chapters.texts[(b, c)].get(v, ("",))[0])[0]
            item = {"n": v, "b": text}
            if note:
                item["o"] = note
            if heading:
                item["h"] = HEB_LETTERS_EN[heading]
            if words:
                item["g"] = [list(glosses.get(pid, ("", ""))) for pid, _ in words]
                links = []
                for i, (pid, w) in enumerate(words):
                    spans = align.get(pid, [])
                    if spans:
                        links.append([i, *spans])
                    if w[1]:
                        concordance[w[1]].append((chapters.book_index[b], c, v, i, glosses.get(pid, ("",))[0]))
                if links:
                    item["a"] = links
            verses.append(item)
        d = {"v": verses}
        if questions.get((b, c)):
            d["q"] = questions[(b, c)]
        layer = compact(d)
        os.makedirs(os.path.join(web, "cap", b), exist_ok=True)
        os.makedirs(os.path.join(out, "cap", b), exist_ok=True)
        Path(os.path.join(out, "cap", b, f"{c}.json")).write_text(layer, encoding="utf8")
        Path(os.path.join(web, "cap", b, f"{c}.js")).write_text(f"__txt({json.dumps(f'{locale}.{b}.{c}')},{layer});", encoding="utf8")
        n += 1
    translated = book_texts(locale, books, texts)
    Path(os.path.join(web, "livros.js")).write_text(f"window.BOOK_TEXTS={compact(translated)};", encoding="utf8")
    Path(os.path.join(out, "livros.json")).write_text(compact(translated), encoding="utf8")
    lex = build_lexicon(db, locale, chapters.usage)
    os.makedirs(os.path.join(web, "lex"), exist_ok=True)
    os.makedirs(os.path.join(out, "lex"), exist_ok=True)
    for L, d in lex.items():
        Path(os.path.join(web, "lex", f"{L}.js")).write_text(f"__lex({json.dumps(f'{locale}.{L}')},{compact(d)});", encoding="utf8")
        Path(os.path.join(out, "lex", f"{L}.json")).write_text(compact(d), encoding="utf8")
    index = {k: {v: (t, None, None) for v, t in vs.items()} for k, vs in texts.items()}
    write_search_index(index, chapters.book_index, os.path.join(web, "busca"))
    write_concordance(concordance, os.path.join(web, "conc"))
    print(
        f"{locale}: {n} capítulos, léxico H {len(lex['H'])} + G {len(lex['G'])}, textos do projeto em {len(translated)} livros, "
        f"perguntas em {len(questions)} capítulos → {web}"
    )
