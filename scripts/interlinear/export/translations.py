"""dados/<locale>/cap/<BOOK>/<n>.js and dados/<locale>/busca/: the running text of another language (the Berean
Standard Bible for English), as a layer the app puts over the chapter: the words of the original stay in cap/.

Each verse of the layer is [verse, text] plus, when there is one, the note ("aparato", "sem-original" or
"sem-blivre", the same codes as the Bíblia Livre) and the title of the section (the Hebrew letters of Psalm 119)."""

import json
import os
from collections import defaultdict
from pathlib import Path

from interlinear.export.common import HEB_LETTERS, OUT, WEB, compact, split_heading
from interlinear.export.search import write_search_index

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


def write_translation(db, locale, chapters):
    """The layer of every chapter and the search index of the locale's text."""
    texts = translation_texts(db, locale)
    web, out = os.path.join(WEB, locale), os.path.join(OUT, locale)
    n = 0
    for b, c in sorted(chapters.texts):
        verses = []
        for v in sorted(set(chapters.texts[(b, c)]) | set(chapters.words[(b, c)]) | set(texts[(b, c)])):
            text = texts[(b, c)].get(v, "")
            has_original = bool(chapters.words[(b, c)].get(v))
            note = "aparato" if (b, c, v) in APPARATUS else "sem-original" if not has_original else None if text else "sem-blivre"
            heading = split_heading(chapters.texts[(b, c)].get(v, ("",))[0])[0]
            item = [v, text]
            if note or heading:
                item.append(note)
            if heading:
                item.append(HEB_LETTERS_EN[heading])
            verses.append(item)
        layer = compact({"v": verses})
        os.makedirs(os.path.join(web, "cap", b), exist_ok=True)
        os.makedirs(os.path.join(out, "cap", b), exist_ok=True)
        Path(os.path.join(out, "cap", b, f"{c}.json")).write_text(layer, encoding="utf8")
        Path(os.path.join(web, "cap", b, f"{c}.js")).write_text(f"__txt({json.dumps(f'{locale}.{b}.{c}')},{layer});", encoding="utf8")
        n += 1
    index = {k: {v: (t, None, None) for v, t in vs.items()} for k, vs in texts.items()}
    write_search_index(index, chapters.book_index, os.path.join(web, "busca"))
    print(f"{locale}: {n} capítulos → {web}")
