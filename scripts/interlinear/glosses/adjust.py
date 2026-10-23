"""Final adjustments: proper names, rare words, the reviewed glosses of Genesis 1."""

import csv
import difflib
import os
import re
import unicodedata
from collections import Counter, defaultdict

from interlinear.glosses.fixed import PRE_H
from interlinear.glosses.portuguese import contract
from interlinear.paths import ROOT
from interlinear.rules import rare_glosses
from interlinear.text import strip_marks, without_cantillation
from interlinear.tsv import lexicon_pt


def proper_name(language, morph, lemma):
    if language == "G":
        return morph.startswith("N") and lemma[:1].isupper()
    root = [x for x in (morph or "")[1:].split("/") if not x.startswith("S")]
    return bool(root) and root[-1][:2] in ("Np", "Ng")


def _initial(t):
    t = strip_marks(t).lower()
    for a, b in (("ph", "p"), ("f", "p"), ("th", "t"), ("ch", "c"), ("kh", "c"), ("k", "c"), ("q", "c"), ("y", "i"), ("j", "i"), ("h", "")):
        if t.startswith(a):
            t = b + t[len(a) :]
    return t[:1]


def similar(t, target):
    """Semelhança entre um nome em português e a transliteração (com bônus se a inicial bate)."""
    r = difflib.SequenceMatcher(None, strip_marks(t).lower(), strip_marks(target).lower()).ratio()
    return r + (0.3 if _initial(t) and _initial(t) == _initial(target) else 0)


def similar_name(target, verse_text):
    """Nome com maiúscula no versículo mais parecido com a transliteração (Thamar → Tamar)."""
    cands = set(re.findall(r"\b[A-ZÀ-Ý][\wÀ-ÿ]+(?:-[A-ZÀ-Ý][\wÀ-ÿ]+)*", verse_text))
    if not cands or not target:
        return None
    # Empate (Sansão e Samuel para Sampson): desempata pela comparação no outro sentido e, por fim, pela ordem
    # alfabética, para o resultado não depender da ordem do set (que muda a cada execução do Python).
    m = max(
        sorted(cands),
        key=lambda t: (
            similar(t, target),
            difflib.SequenceMatcher(None, strip_marks(target).lower(), strip_marks(t).lower()).ratio(),
        ),
    )
    return m if similar(m, target) >= 0.75 else None


GR_LAT = dict(
    zip(
        "αβγδεζηθικλμνξοπρστυφχψως",
        ["a", "b", "g", "d", "e", "z", "e", "th", "i", "k", "l", "m", "n", "x", "o", "p", "r", "s", "t", "u", "ph", "ch", "ps", "o", "s"],
        strict=False,
    )
)


def name_from_xlit(x):
    x = strip_marks(x or "")
    if any("\u0370" <= c <= "\u03ff" for c in x):
        x = "".join(GR_LAT.get(c.lower(), c) for c in x)
    x = re.sub(r"[\u02b0-\u02ff'’`]", "", x)
    return x[:1].upper() + x[1:] if x else ""


# English → Portuguese, for rare words without a translated entry (data/rules/rare_glosses.tsv)
RARE_GLOSSES = rare_glosses()


def final_adjustments(res, counts, pref, texts, lexicon):
    """Correções apontadas pela revisão automática:
    - YHWH: onde a BLIVRE diz "EU SOU", a glosa cortada "SOU" vira "EU-SOU";
    - nomes próprios trocados pelo alinhamento: usa o nome que a BLIVRE dá a essa palavra, se ele está no versículo;
    - palavras sem glosa: significado do léxico em português, nome transliterado ou glosa curta."""
    n = Counter()
    verse_names = defaultdict(set)  # nomes (tradução preferida) das palavras de nome próprio de cada versículo
    for item in res:
        r = item[4]
        if proper_name(r.language, r.morph or "", r.lemma or ""):
            rt = next((t for tp, t in item[3] if tp == "raiz"), None)
            if pref.get(rt):
                verse_names[(r.book, r.chapter, r.verse)].add((rt, pref[rt]))
    for item in res:
        pid, gloss, source, toks, r, rend = item
        language, morph, lemma = r.language, r.morph or "", r.lemma or ""
        verse_text = texts.get((r.book, r.chapter, r.verse), "")
        root_tok = next((t for tp, t in toks if tp == "raiz"), None)
        if r.strong == "H3068" and gloss and re.search(r"(^|-)SOU($|-)", gloss) and re.search(r"EU[ -]SOU", verse_text):
            item[1] = re.sub(r"(^|-)SOU($|-)", r"\1EU-SOU\2", gloss)
            n["YHWH EU-SOU"] += 1
            continue
        if gloss and rend and proper_name(language, morph, lemma):
            # nome no começo da frase perdeu a maiúscula (hendã → Hendã)
            def fix(t):
                return (
                    t[:1].upper() + t[1:]
                    if len(t) > 2 and t[:1].islower() and re.search(r"(?<!\w)" + re.escape(t[:1].upper() + t[1:]) + r"(?!\w)", verse_text)
                    else t
                )

            rend = "-".join(fix(t) for t in rend.split("-"))
            gloss = item[1] = "-".join(fix(t) for t in gloss.split("-"))
        capsg = [t for t in (gloss or "").split("-") if t[:1].isupper() and len(t) > 1]
        if (
            gloss
            and proper_name(language, morph, lemma)
            and len(capsg) > 1
            and not re.search(r"(?<!\w)" + r"[- ]".join(map(re.escape, capsg)) + r"(?!\w)", verse_text)
        ):
            rend = gloss
            # dois nomes colados (Tamar-Perez): fica o mais parecido com a transliteração
            target = name_from_xlit((lexicon.get(r.strong) or {}).get("xlit") or lemma)
            caps = [t for t in rend.split("-") if t[:1].isupper() and len(t) > 1]
            best_match = max(caps, key=lambda t: similar(t, target))
            item[1] = "-".join(t for t in gloss.split("-") if not (t[:1].isupper() and len(t) > 1) or t == best_match)
            if best_match not in item[1].split("-"):
                item[1] = best_match
            item[2] = "regra"
            n["nome próprio duplo"] += 1
            continue
        if gloss and not rend and proper_name(language, morph, lemma):
            rend = gloss.split("-")[-1]  # glosa pelo léxico: confere o nome também
        if rend and proper_name(language, morph, lemma):
            target = name_from_xlit((lexicon.get(r.strong) or {}).get("xlit") or lemma)
            caps = [t for t in rend.split("-") if t[:1].isupper()]
            found = similar_name(target, verse_text)
            if caps and found and found not in caps and similar(found, target) > max(similar(t, target) for t in caps) + 0.2:
                item[1] = "-".join(t for t in gloss.split("-") if not t[:1].isupper()) + (
                    "-" if gloss.split("-")[0][:1].islower() and len(gloss.split("-")) > 1 else ""
                )
                item[1] = (item[1] + found) if item[1].endswith("-") else found
                item[2] = "regra"
                n["nome próprio pela transliteração"] += 1
                continue
            name = pref.get(root_tok)
            others = {nm for rt, nm in verse_names[(r.book, r.chapter, r.verse)] if rt != root_tok}
            target2 = name_from_xlit((lexicon.get(r.strong) or {}).get("xlit") or lemma)
            if (
                name
                and name[:1].isupper()
                and name.lower() != rend.lower()
                and re.search(r"(?<!\w)" + re.escape(name) + r"(?!\w)", verse_text)
                and any(t in others for t in rend.split("-"))
                and name not in rend.split("-")
                and similar(name, target2) > max(similar(t, target2) for t in rend.split("-"))
            ):
                # o nome alinhado é de outra pessoa/lugar: troca só a parte da raiz, mantendo prefixos
                item[1] = gloss.replace(rend, name) if rend in gloss else name
                item[2] = "regra"
                n["nome próprio"] += 1
                continue
        if item[2] in ("sem", "parcial") or not item[1]:
            e = lexicon.get(r.strong) or {}
            if proper_name(language, morph, lemma):
                base = similar_name(name_from_xlit(e.get("xlit") or lemma), verse_text) or name_from_xlit(e.get("xlit") or lemma)
            elif e.get("pt"):
                base = re.split(r"[;,(]| ou ", e["pt"])[0].strip(" .")
                base = re.sub(r"^(um|uma|o|a) ", "", base).replace(" ", "-")
            else:
                en = re.sub(r"\[[a-z]+\]|[{}]", "", e.get("en") or "")
                en = re.split(r"[;,(]|\. (?:Compare|See)", en)[0].strip(" .")
                base = RARE_GLOSSES.get(en) or ("[" + (en or "?") + "]")
            pre = [PRE_H.get(t, "") for tp, t in toks if tp == "pre"] if language != "G" else []
            item[1] = contract("-".join([p for p in pre if p] + [base]))
            item[2] = "lexico"
            n["sem glosa → léxico"] += 1
    for item in res:  # "Boaz-Boaz" → "Boaz"
        if item[1] and "-" in item[1]:
            ps = item[1].split("-")
            item[1] = "-".join(p for i, p in enumerate(ps) if i == 0 or p != ps[i - 1])
    return n


def apply_manual(db, res, report=None):
    """Glosas revisadas à mão (Gênesis 1) por forma + morfologia, só dentro de Gn 1."""
    fname = os.path.join(ROOT, "data", "glosses_pt.tsv")
    if not os.path.exists(fname):
        return 0, 0, 0
    manual_glosses = {}
    with open(fname, encoding="utf8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            manual_glosses[(unicodedata.normalize("NFD", row["hebrew"]), row["morph"])] = row["gloss"]
    n = equal = 0
    for item in res:
        r = item[4]
        if r.book == "GEN" and r.chapter == 1:
            g = manual_glosses.get((without_cantillation(r.text), r.morph))
            if g:
                n += 1
                auto = (item[1] or "").lower().replace(" ", "-")
                if auto == g.lower():
                    equal += 1
                elif report is not None:
                    report.append((r.verse, without_cantillation(r.text), g, item[1], item[2]))
                item[1], item[2] = g, "manual"
    return n, equal, len(manual_glosses)


def load_lexicon(db):
    """Significado curto de cada verbete: português (data/lexicon_pt) ou inglês (Strong/Dodson)."""
    pt = {k: r["meaning"] for k, r in lexicon_pt().items()}
    lex = {}
    for entry_key, xlit, gloss_en, kjv, def_en, def_pt in db.execute(
        "SELECT entry_key, xlit, gloss_en, kjv_en, def_en, def_pt FROM lexicon"
    ):
        en = gloss_en or (kjv if kjv and re.sub(r"\[[a-z]+\]|[{}().,;\s-]", "", kjv) else None) or def_en
        lex[entry_key] = {"xlit": xlit, "pt": pt.get(entry_key) or def_pt, "en": en}
    return lex
