"""C. Coverage of glosses and lexicon."""

import re
from collections import defaultdict

from interlinear.glosses.adjust import proper_name
from interlinear.glosses.portuguese import root_pos
from interlinear.review.words import ENGLISH, toks


# ================================================================== C. cobertura
def check_coverage(d, M, ws):
    used = {}
    for w in ws:
        g = w.gloss
        if not g or not g.strip() or w.gloss_source == "sem":
            M.w(w, "COB-01", "erro", "COB-01_1")
        elif w.gloss_source == "parcial":
            M.w(w, "COB-01", "aviso", "COB-01_2", gloss=g)
        k = w.strong
        if not k:
            M.w(w, "COB-02", "erro", "COB-02_1", lemma=w.lemma)
            continue
        if k not in d.lexicon:
            M.w(w, "COB-02", "erro", "COB-02_2", entry=k)
            continue
        used.setdefault(k, w)
        ts = toks(g)
        en = [t for t in ts if t in ENGLISH]
        if en:
            M.w(w, "COB-07", "aviso", "COB-07", gloss=g)
    return used


def check_shared_alignment(d, M, ws):
    """COB-08: a verb, noun or adjective whose Portuguese is all part of the gloss of another word of the verse
    ("vez" for ἐμβριμώμενος beside "outra-vez" for πάλιν): the alignment probably gave it the neighbor's word."""
    by_verse = defaultdict(list)
    for w in ws:
        by_verse[(w.book, w.chapter, w.verse)].append(w)
    for vws in by_verse.values():
        for w in vws:
            mine = d.spans.get(w.id)
            if not mine or w.gloss_source != "alinhamento" or root_pos(w.language, w.morph) not in ("V", "N", "A"):
                continue
            if proper_name(w.language, w.morph or "", w.lemma or ""):
                continue
            others = [o for o in vws if o.id != w.id and d.spans.get(o.id, set()) >= mine and len(d.spans[o.id]) > len(mine)]
            if others:
                M.w(w, "COB-08", "aviso", "COB-08", gloss=w.gloss, other=others[0].text, other_gloss=others[0].gloss)


def check_lexicon(d, M, used):
    for k, w in used.items():
        e = d.lexicon[k]
        if not (e[9] or "").strip():
            M.w(w, "COB-02", "info", "COB-02_3", entry=k, e_item=e[2])
        if k[1:].isdigit() and not ((e[6] or "").strip() and (e[7] or "").strip() and (e[5] or "").strip()):
            missing = [n for n, v in (("origem", e[5]), ("significado", e[6]), ("traduções KJV", e[7])) if not (v or "").strip()]
            M.w(w, "COB-03", "aviso", "COB-03", entry=k, value=", ".join(missing))
        if not (e[3] or "").strip():
            M.w(w, "LEX-05", "erro", "LEX-05_1", entry=k)
        elif re.search(r"[^\w\s'ʼʽ\-\.,·()ʾʿ]", e[3]):
            M.w(w, "LEX-05", "aviso", "LEX-05_2", entry=k, e_item=repr(e[3]))
        if not (e[4] or "").strip() and e[1] == "H":
            M.w(w, "COB-04", "aviso", "COB-04", entry=k)
        derivation = e[5] or ""
        for lt, num in re.findall(r"\b([HG])0*(\d+)\b", derivation):
            target = lt + num
            if target not in d.lexicon:
                hint = (
                    f" (provavelmente H{num})"
                    if lt == "G" and int(num) > 5624
                    else " (número que o próprio Strong pulou)"
                    if lt == "G" and (int(num) == 2717 or 3203 <= int(num) <= 3302)
                    else ""
                )
                M.w(w, "LEX-03", "erro", "LEX-03_1", entry=k, target=target, hint=hint)
            elif (
                re.search(r"\b" + k[0] + "0*" + k[1:] + r"\b", d.lexicon[target][5] or "")
                and target != k
                and "from" in derivation
                and "from" in (d.lexicon[target][5] or "")
            ):
                M.w(w, "LEX-03", "aviso", "LEX-03_2", entry=k, target=target)
        if k.startswith("G") and k[1:].isdigit():
            n = int(k[1:])
            if n > 5624 or n == 2717 or 3203 <= n <= 3302:
                M.w(w, "LXG-01", "erro", "LXG-01", entry=k)
