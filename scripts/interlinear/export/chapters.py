"""cap/<BOOK>/<n>: one chapter as the app reads it: verses, words, glosses, the links to the Bíblia Livre, the marks of
the automatic review and the questions.

Compact form of each word: [text, Strong key, gloss, gloss source, morphology, lemma (Greek) | None, ketiv]."""

from collections import Counter, defaultdict

from interlinear.books import BOOKS
from interlinear.export.common import split_heading

SHORT_SOURCE = {"alinhamento": "", "manual": "m", "revisada": "m", "lexico": "l", "regra": "r", "parcial": "p", "sem": "s"}


class Chapters:
    """Everything the chapters need, read once; chapter(book, n) builds one."""

    def __init__(self, db, marks, questions):
        self.marks, self.questions = marks, questions
        self.texts = defaultdict(dict)
        for b, c, v, t, ed, note in db.execute("SELECT book, chapter, verse, blivre, edition, note FROM verses"):
            self.texts[(b, c)][v] = (t, ed, note)
        self.words = defaultdict(lambda: defaultdict(list))
        self.usage = Counter()
        self.book_index = {row[0]: i for i, row in enumerate(BOOKS)}
        # concordance: Strong key → occurrences (book, chapter, verse, word, gloss)
        self.concordance = defaultdict(list)
        for pid, b, c, v, language, verse_text, lemma, strong, morph, gloss, source, ketiv in db.execute(
            "SELECT id, book, chapter, verse, language, text, lemma, strong, morph, gloss, gloss_source, ketiv FROM words "
            "ORDER BY book, chapter, verse, pos"
        ):
            entry_key = strong or ("G:" + lemma if language == "G" else None)
            self.usage[entry_key] += 1
            w = [verse_text, entry_key, gloss or "", SHORT_SOURCE.get(source, ""), morph or ""]
            if language == "G":
                w.append(lemma)
            elif ketiv:
                w += [None, ketiv]  # the written form (ketiv); the text has the form read (qere)
            if entry_key:
                self.concordance[entry_key].append((self.book_index[b], c, v, len(self.words[(b, c)][v]), gloss or ""))
            self.words[(b, c)][v].append((pid, w))
        # word ↔ Portuguese: the Bíblia Livre spans aligned with each word (table of scripts/make_glosses.py)
        has_alignment = db.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='alignment'").fetchone()[0]
        self.align = (
            {pid: [int(x) for x in s.split(",")] for pid, s in db.execute("SELECT word_id, spans FROM alignment")} if has_alignment else {}
        )

    def chapter(self, b, c):
        vs = []
        ids = {}
        for v in sorted(set(self.texts[(b, c)]) | set(self.words[(b, c)])):
            t, ed, note = self.texts[(b, c)].get(v, ("", None, "sem-blivre"))
            heading, t, cut = split_heading(t)
            ws = self.words[(b, c)].get(v, [])
            links = []
            for i, (pid, _) in enumerate(ws):
                ids[pid] = (v, i)
                spans = [x - cut for x in self.align.get(pid, [])]
                pairs = [(spans[k], spans[k + 1]) for k in range(0, len(spans), 2) if spans[k] >= 0]
                if pairs:
                    links.append([i] + [x for p in pairs for x in p])
            item = {"n": v, "b": t, "w": [w for _, w in ws]}
            if heading:
                item["h"] = heading
            if links:
                item["a"] = links
            if note:
                item["o"] = note
            vs.append(item)
        ms = []
        for m in self.marks.get((b, c), []):
            pos = ids.get(m.get("word_id"))
            ms.append([m["verse"], pos[1] if pos else None, m["level"][0], m["code"], m["msg"]])
        d = {"book": b, "chapter": c, "v": vs, "m": ms}
        if self.questions.get((b, c)):
            d["q"] = self.questions[(b, c)]
        return d
