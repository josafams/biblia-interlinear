"""What the review reads from build/biblia.sqlite."""

from collections import Counter, defaultdict

from interlinear.models import WORD_COLUMNS, Word
from interlinear.text import TOKEN_PT_LETTERS, strip_marks
from interlinear.tsv import lexicon_pt


# ------------------------------------------------------------------ dados
class Data:
    def __init__(self, db):
        self.books = [r for r in db.execute("SELECT book_order, code, name, abbrev, testament FROM books ORDER BY book_order")]
        self.order = {r[1]: r[0] for r in self.books}
        self.testament = {r[1]: r[4] for r in self.books}
        self.verses = {}
        for b, c, v, t, ed, note in db.execute("SELECT book, chapter, verse, blivre, edition, note FROM verses"):
            self.verses[(b, c, v)] = (t or "", ed, note)
        self.words = [Word._make(r) for r in db.execute(f"SELECT {WORD_COLUMNS} FROM words")]  # noqa: S608 (fixed columns)
        self.words.sort(key=lambda w: (self.order.get(w.book, 999), w.chapter, w.verse, w.pos))
        self.by_verse = defaultdict(list)
        for w in self.words:
            self.by_verse[(w.book, w.chapter, w.verse)].append(w)
        # def_pt: the meaning in Portuguese of data/lexicon_pt, or the one the corpus gives (the Hebrew particles)
        pt = lexicon_pt()
        self.lexicon = {
            r[0]: (*r[:9], pt[r[0]]["meaning"] if r[0] in pt else r[9])
            for r in db.execute(
                "SELECT entry_key, language, lemma, xlit, pron_en, derivation_en, def_en, kjv_en, gloss_en, def_pt FROM lexicon"
            )
        }
        # the characters of the Bíblia Livre each word is linked to (alignment table of make_glosses.py)
        self.spans = {}
        for wid, sp in db.execute("SELECT word_id, spans FROM alignment"):
            n = [int(x) for x in sp.split(",")]
            self.spans[wid] = set(zip(n[::2], n[1::2], strict=False))
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
