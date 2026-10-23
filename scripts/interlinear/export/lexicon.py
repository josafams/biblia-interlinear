"""lex/H, lex/G: the lexicon of each language, with the meaning in Portuguese (data/lexicon_pt) or in English,
the pronunciation, how often the word shows up and how the Bíblia Livre translates it."""

from collections import defaultdict

from pronunciation import pron_greek, pron_hebrew


def build_lexicon(db, usage, lex_pt):
    translates = defaultdict(list)
    for ch, t, n in db.execute("SELECT entry_key, translation, n FROM translations ORDER BY entry_key, n DESC"):
        if len(translates[ch]) < 8:
            translates[ch].append(f"{t} ({n})")
    lex = {"H": {}, "G": {}}
    for entry_key, language, lemma, xlit, pron_en, deriv, definition, _kjv, gloss_en, def_pt in db.execute(
        "SELECT entry_key, language, lemma, xlit, pron_en, derivation_en, def_en, kjv_en, gloss_en, def_pt FROM lexicon"
    ):
        pt = lex_pt.get(entry_key)
        pron = (
            pron_hebrew(pron_en)
            if language == "H" and pron_en and entry_key[1:].isdigit()
            else (pron_en if language == "H" else pron_greek(lemma or ""))
        )
        e = {"l": lemma, "x": xlit, "p": pron, "n": usage.get(entry_key, 0)}
        if pt:
            e["o"], e["s"] = pt
        elif def_pt:
            e["o"], e["s"] = deriv, def_pt
        else:
            e["oe"], e["se"] = (deriv or "").strip(" ;"), (definition or "").strip(" ;")
            if gloss_en and language == "G":
                e["ge"] = gloss_en
        if translates.get(entry_key):
            e["t"] = "; ".join(translates[entry_key])
        lex[language][entry_key] = e
    # Greek lemmas without a Strong number
    for entry_key, n in usage.items():
        if entry_key and entry_key.startswith("G:"):
            lemma = entry_key[2:]
            lex["G"][entry_key] = {
                "l": lemma,
                "x": "",
                "p": pron_greek(lemma),
                "n": n,
                "se": "sem verbete no dicionário de Strong",
                "t": "; ".join(translates.get(entry_key, [])),
            }
    return lex
