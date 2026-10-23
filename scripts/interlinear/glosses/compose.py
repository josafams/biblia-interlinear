"""Composing the glosses: the aligned Bíblia Livre words of each word, then the most frequent translation where
nothing was aligned."""

import re
from collections import Counter, defaultdict

from interlinear.glosses.fixed import ARTICLE_G, PRE_H, SUF_VERB, gloss_suffix_rule
from interlinear.glosses.portuguese import FUNCTION_POS, STOP_PT, contract, fallback_keys, root_pos, tokens_pt
from interlinear.glosses.units import greek_units, hebrew_units
from interlinear.models import AlignedWord


def assemble(db, testament):
    q = """SELECT p.id, p.book, p.chapter, p.verse, p.language, p.text, p.lemma, p.strong, p.morph
           FROM words p JOIN books l ON l.code = p.book
           WHERE l.testament = ? ORDER BY l.book_order, p.chapter, p.verse, p.pos"""
    verses = defaultdict(list)
    for r in map(AlignedWord._make, db.execute(q, (testament,))):
        verses[(r.book, r.chapter, r.verse)].append(r)
    texts = {(b, c, v): t for b, c, v, t in db.execute("SELECT book, chapter, verse, blivre FROM verses")}
    item_list = []
    for k, wds in verses.items():
        t = texts.get(k) or ""
        toks = tokens_pt(t)
        unit = []  # (indice da palavra, tipo, token); tipo "fora" não entra no alinhamento
        for wi, r in enumerate(wds):
            us = greek_units(r.lemma, r.morph) if r.language == "G" else hebrew_units(r.lemma, r.morph)
            for kind, tok in us:
                if tok == "h853":  # partícula de objeto: sem equivalente em português
                    kind = "fora"
                unit.append((wi, kind, tok))
        item_list.append((k, wds, t, toks, unit))
    return item_list


def proper_names(item_list):
    """Formas que aparecem com maiúscula no meio da frase (Deus, Moisés…) continuam com maiúscula."""
    c = defaultdict(Counter)
    for it in item_list:
        verse_text, toks = it[2], it[3]
        for n, (t, start_offset, _end_pos) in enumerate(toks):
            if n == 0 or re.search(r"[.!?:;«»“\"]\s*$", verse_text[:start_offset]):
                continue
            c[t.lower()]["M" if t[:1].isupper() else "m"] += 1
    return {k for k, v in c.items() if v["M"] > v["m"]}


def match_case(tok, propers):
    if len(tok) > 1 and tok.isupper():
        return tok  # SENHOR
    if tok[:1].isupper() and tok.lower() not in propers:
        return tok.lower()
    return tok


def compose(item_list, links):
    """First pass: the Bíblia Livre words aligned with each word. Returns the glosses, the translations seen per
    root and, per word id, the [(start, end), ...] characters of the Bíblia Livre linked to it (the alignment
    table, which the app uses to link a word with the Portuguese)."""
    propers = proper_names(item_list)
    res = []
    spans = {}
    counts = defaultdict(Counter)  # token de raiz → traduções observadas
    for (_k, wds, _verse_text, toks, unit), lk in zip(item_list, links, strict=False):
        # palavra portuguesa ligada a duas ocorrências da mesma raiz (δόξαν… δόξαν):
        # fica com a ocorrência de posição relativa mais próxima
        owners = defaultdict(list)
        for i, j in lk:
            owners[(j, unit[i][2])].append(i)
        lk = set(lk)
        for (j, _), iis in owners.items():
            ws = {unit[i][0] for i in iis}
            if len(ws) > 1:
                best_match = min(ws, key=lambda w: abs(w / max(1, len(wds)) - j / max(1, len(toks))))
                for i in iis:
                    if unit[i][0] != best_match:
                        lk.discard((i, j))
        by_unit = defaultdict(set)
        aligned_t = defaultdict(set)
        for i, j in lk:
            by_unit[i].add(j)
            aligned_t[j].add(unit[i][0])
        by_word = defaultdict(lambda: {"raiz": set(), "pre": set(), "suf": set(), "fora": set(), "toks": []})
        for ui, (wi, kind, tok) in enumerate(unit):
            by_word[wi]["toks"].append((kind if kind != "fora" else "raiz", tok))
            by_word[wi][kind] |= by_unit.get(ui, set())
        for wi, r in enumerate(wds):
            d = by_word[wi]
            # raiz de conteúdo (verbo, nome, adjetivo) ligada só a artigo/preposição: alinhamento espúrio
            if d["raiz"] and root_pos(r.language, r.morph) in ("V", "N", "A") and all(toks[j][0].lower() in STOP_PT for j in d["raiz"]):
                d["raiz"] = set()
            js = sorted(d["raiz"] | d["pre"] | d["suf"])
            if js:
                # fica o grupo contíguo (folga de 2) com mais ligações à raiz
                groups, g = [], [js[0]]
                for j in js[1:]:
                    if j - g[-1] <= 2:
                        g.append(j)
                    else:
                        groups.append(g)
                        g = [j]
                groups.append(g)
                groups.sort(key=lambda g: (-len(set(g) & d["raiz"]), -len(g)))
                g = groups[0]
                # preenche lacunas com palavras que não estão alinhadas a nada
                full = [j for j in range(g[0], g[-1] + 1) if j in g or not aligned_t.get(j)]
                if len(full) > 6:
                    full = sorted(set(g) & d["raiz"]) or g[:6]
                gloss = "-".join(match_case(toks[j][0], propers) for j in full)
                source = "alinhamento" if d["raiz"] else "parcial"
                spans[r.id] = [(toks[j][1], toks[j][2]) for j in full]
            else:
                gloss, source = None, None
            root_tok = next((t for tp, t in d["toks"] if tp == "raiz"), None)
            rend = None
            if d["raiz"] and root_tok:
                rend = "-".join(match_case(toks[j][0], propers) for j in sorted(d["raiz"]))
                for ch in fallback_keys(d["toks"], r.language, r.morph):
                    counts[ch][rend] += 1
                for j in d["raiz"]:
                    counts[("tok", root_tok)][toks[j][0].lower()] += 1
            res.append([r.id, gloss, source, d["toks"], r, rend])
    return res, counts, spans


def preferred_translation(tally):
    """Tradução mais frequente."""
    return tally.most_common(1)[0][0] if tally else None


def complete(res, counts):
    """Segunda passada: palavras sem alinhamento da raiz recebem a tradução mais comum ou uma regra."""
    pref = {tok: preferred_translation(c) for tok, c in counts.items()}
    for item in res:
        pid, gloss, source, toks, r, rend = item
        language, morph = r.language, r.morph or ""
        root_tok = next((t for tp, t in toks if tp == "raiz"), None)
        # palavra gramatical alinhada a uma tradução rara para ela: provável erro de alinhamento;
        # ficam só as palavras portuguesas que são traduções comuns dela
        if source == "alinhamento" and rend and root_pos(language, morph) in FUNCTION_POS:
            c = counts[root_tok]
            if c[rend] / max(1, sum(c.values())) < 0.03:
                ct = counts[("tok", root_tok)]
                tot = max(1, sum(ct.values()))
                good = [t for t in rend.split("-") if ct[t.lower()] / tot >= 0.05]
                if good:
                    pre = [PRE_H.get(t, "") for tp, t in toks if tp == "pre"] if language != "G" else []
                    item[1] = contract("-".join([p for p in pre if p] + good))
                    item[2] = "alinhamento"
                    continue
                source = item[2] = "rejeitado"
        if root_tok == "h853":
            pre = [PRE_H.get(t, "") for tp, t in toks if tp == "pre"]
            suf = [SUF_VERB.get(t[2:], "") for tp, t in toks if tp == "suf" and t.startswith("s_")]
            item[1] = "-".join([p for p in pre if p] + ([s for s in suf if s] or ["[obj]"]))
            item[2] = "regra"
            continue
        if source == "alinhamento":
            continue
        if language == "G" and morph.startswith("RA"):
            parse = morph.split("-", 1)[1] if "-" in morph else ""
            art = ARTICLE_G.get((parse[4:5], parse[6:7], parse[5:6])) if len(parse) >= 7 else None
            item[1], item[2] = art or "o", "regra"
            continue
        base = None
        for ch in fallback_keys(toks, language, morph):
            if ch in counts and sum(counts[ch].values()) >= 3:
                base = pref[ch]
                break
        if base is None:
            base = next((pref[ch] for ch in fallback_keys(toks, language, morph) if ch in pref), None)
        if not base:
            item[1] = gloss  # pode ser só o prefixo
            item[2] = "parcial" if gloss else "sem"
            continue
        if language == "G":
            item[1], item[2] = base, "lexico"
            continue
        pre = [PRE_H.get(t, "") for tp, t in toks if tp == "pre"]
        suf = [gloss_suffix_rule(t, morph) for tp, t in toks if tp == "suf"]
        pieces = [p for p in pre if p] + [base] + [s for s in suf if s]
        item[1], item[2] = contract("-".join(pieces)), "lexico"
    return pref
