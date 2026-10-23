"""What the review reads from build/biblia.sqlite."""

from collections import Counter, defaultdict

from interlinear.models import Word
from interlinear.text import TOKEN_PT_LETTERS, strip_marks


# ------------------------------------------------------------------ dados
class Data:
    def __init__(self, db):
        self.books = [r for r in db.execute("SELECT book_order, code, name, abbrev, testament FROM books ORDER BY book_order")]
        self.order = {r[1]: r[0] for r in self.books}
        self.testament = {r[1]: r[4] for r in self.books}
        self.verses = {}
        for b, c, v, t, ed, note in db.execute("SELECT book, chapter, verse, blivre, edition, note FROM verses"):
            self.verses[(b, c, v)] = (t or "", ed, note)
        self.words = [Word._make(r) for r in db.execute(f"SELECT {Word.COLUMNS} FROM words")]  # noqa: S608 (fixed columns)
        self.words.sort(key=lambda w: (self.order.get(w.book, 999), w.chapter, w.verse, w.pos))
        self.by_verse = defaultdict(list)
        for w in self.words:
            self.by_verse[(w.book, w.chapter, w.verse)].append(w)
        self.lexicon = {
            r[0]: r
            for r in db.execute(
                "SELECT entry_key, language, lemma, xlit, pron_en, derivation_en, def_en, kjv_en, gloss_en, def_pt FROM lexicon"
            )
        }
        self.transl = defaultdict(Counter)
        for ch, t, n in db.execute("SELECT entry_key, translation, n FROM translations"):
            self.transl[ch][t] += n
        self._tokset = {}

    def tokset_blivre(self, k):
        s = self._tokset.get(k)
        if s is None:
            t = self.verses.get(k, ("",))[0]
            s = {strip_marks(x.lower()) for x in TOKEN_PT_LETTERS.findall(t)}
            self._tokset[k] = s
        return s
