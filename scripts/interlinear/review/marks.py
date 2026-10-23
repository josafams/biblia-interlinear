"""The marks: each one has the code of the catalog (docs/REVISOES.md), a level and a message."""


# ------------------------------------------------------------------ marcas
class Marks:
    def __init__(self, book_scope):
        self.lst = []
        self.book_scope = book_scope
        self.seen = set()

    def inside(self, book, cap):
        lv, cp = self.book_scope
        return (lv is None or book == lv) and (cp is None or cap == cp)

    def add(self, book, cap, vers, pid, code, level, msg):
        if not self.inside(book, cap):
            return
        k = (pid, code, book, cap, vers, msg if pid is None else "")
        if k in self.seen:
            return
        self.seen.add(k)
        self.lst.append({"book": book, "chapter": cap, "verse": vers, "word_id": pid, "code": code, "level": level, "msg": msg})

    def w(self, w, code, level, msg):
        self.add(w.book, w.chapter, w.verse, w.id, code, level, msg)


def ref(w):
    return f"{w.book} {w.chapter}:{w.verse}"
