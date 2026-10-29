"""Composing the glosses: the aligned Bíblia Livre words of each word, then the most frequent translation where
nothing was aligned."""

import re
from collections import Counter, defaultdict

from interlinear.glosses.languages import PT
from interlinear.glosses.portuguese import FUNCTION_POS, fallback_keys, root_pos, tokens_pt
from interlinear.glosses.units import greek_units, hebrew_units
from interlinear.models import AlignedWord


def assemble(db, testament, lang=PT):
    q = """SELECT p.id, p.book, p.chapter, p.verse, p.language, p.text, p.lemma, p.strong, p.morph
           FROM words p JOIN books l ON l.code = p.book
           WHERE l.testament = ? ORDER BY l.book_order, p.chapter, p.verse, p.pos"""
    verses = defaultdict(list)
    for r in map(AlignedWord._make, db.execute(q, (testament,))):
        verses[(r.book, r.chapter, r.verse)].append(r)
    texts = {(b, c, v): t for b, c, v, t in db.execute(lang.texts_sql)}
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


def root_links(item_list, links):
    """How often each root is linked to each Portuguese word in the whole testament (lowercase)."""
    tc = defaultdict(Counter)
    for (_k, _wds, _t, toks, unit), lk in zip(item_list, links, strict=False):
        for i, j in lk:
            if unit[i][1] == "raiz":
                tc[unit[i][2]][toks[j][0].lower()] += 1
    return tc, {root: sum(c.values()) for root, c in tc.items()}


def usual(tc, totals, root, tok):
    """Share of the links of this root that go to this Portuguese word, without counting this occurrence."""
    total = totals.get(root, 0) - 1
    return (tc[root][tok] - 1) / total if total > 0 else 0.0


CLAIMED, ALIEN, MIN_SEEN = 0.2, 0.05, 3


def settle_contested(lk, unit, toks, tc, totals):
    """A Portuguese word linked to the roots of two different words ("vez" to πάλιν and to ἐμβριμώμενος in
    Jo 11:38): when one of them usually translates to it and the other almost never does, it stays only with the
    first. Returns the links and the words that lost every link of their root."""
    roots = defaultdict(dict)  # j → {word index: root token}
    for i, j in lk:
        wi, kind, tok = unit[i]
        if kind == "raiz":
            roots[j][wi] = tok
    drop = set()
    for j, ws in roots.items():
        if len(ws) < 2:
            continue
        t = toks[j][0].lower()
        share = {wi: usual(tc, totals, root, t) for wi, root in ws.items()}
        if max(share.values()) >= CLAIMED:
            # a root seen too few times elsewhere (hapax) says nothing about its translations: it keeps the word
            drop |= {(wi, j) for wi, s in share.items() if s < ALIEN and totals.get(ws[wi], 0) > MIN_SEEN}
    if not drop:
        return lk, set()
    kept = {(i, j) for i, j in lk if (unit[i][0], j) not in drop}
    had = {unit[i][0] for i, _ in lk if unit[i][1] == "raiz"}
    still = {unit[i][0] for i, _ in kept if unit[i][1] == "raiz"}
    return kept, had - still


def rescue(lk, lost, wds, unit, toks, verse_text, tc, lang=PT):
    """A content word that lost its links (settle_contested) takes a Portuguese word nobody took, when it is a
    translation seen for its root elsewhere (or shares its first 5 letters with one) or, for a verb, when it is the
    only free verb-like word near its place in the verse. A clitic joined by a hyphen comes along (Comovendo-se)."""
    taken = {j for _, j in lk}
    free = [j for j in range(len(toks)) if j not in taken and toks[j][0].lower() not in lang.stop]
    for wi in sorted(lost):
        r = wds[wi]
        pos = root_pos(r.language, r.morph)
        root_ui = next((ui for ui, (w, kind, _t) in enumerate(unit) if w == wi and kind == "raiz"), None)
        if pos not in ("V", "N", "A") or root_ui is None:
            continue
        seen = [s for s in tc[unit[root_ui][2]] if len(s) >= 5]
        place = wi / max(1, len(wds))
        near = [j for j in free if abs(j / max(1, len(toks)) - place) <= 0.25]
        known = [
            j for j in free if any(toks[j][0].lower() == s or (len(toks[j][0]) >= 5 and toks[j][0][:5].lower() == s[:5]) for s in seen)
        ]
        verbs = [j for j in near if lang.verb_like.search(toks[j][0].lower())] if pos == "V" else []
        pick = min(known, key=lambda j: abs(j / max(1, len(toks)) - place)) if known else (verbs[0] if len(verbs) == 1 else None)
        if pick is None:
            continue
        lk = lk | {(root_ui, pick)}
        free.remove(pick)
        nxt = pick + 1
        if nxt < len(toks) and nxt not in taken and verse_text[toks[pick][2] : toks[nxt][1]] == "-":
            lk = lk | {(root_ui, nxt)}
    return lk


def compose(item_list, links, lang=PT):
    """First pass: the Bíblia Livre words aligned with each word. Returns the glosses, the translations seen per
    root and, per word id, the [(start, end), ...] characters of the Bíblia Livre linked to it (the alignment
    table, which the app uses to link a word with the Portuguese)."""
    propers = proper_names(item_list)
    tc, totals = root_links(item_list, links)
    res = []
    spans = {}
    counts = defaultdict(Counter)  # token de raiz → traduções observadas
    for (_k, wds, verse_text, toks, unit), lk in zip(item_list, links, strict=False):
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
        lk, lost = settle_contested(lk, unit, toks, tc, totals)
        if lost:
            lk = rescue(lk, lost, wds, unit, toks, verse_text, tc, lang)
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
            if d["raiz"] and root_pos(r.language, r.morph) in ("V", "N", "A") and all(toks[j][0].lower() in lang.stop for j in d["raiz"]):
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


# זֶה, זֹאת, אֵלֶּה ("this") and the pronouns הוּא, הִיא, הֵם, הֵנָּה ("he", "that" with the article)
DEMONSTRATIVES = {"h2088": "this", "h2063": "this", "h428": "this", "h1931": "that", "h1992": "that", "h2007": "that"}


def preferred_translation(tally):
    """Tradução mais frequente."""
    return tally.most_common(1)[0][0] if tally else None


def complete(res, counts, lang=PT):
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
                    pre = [lang.pre_h.get(t, "") for tp, t in toks if tp == "pre"] if language != "G" else []
                    item[1] = lang.contract("-".join([p for p in pre if p] + good))
                    item[2] = "alinhamento"
                    continue
                source = item[2] = "rejeitado"
        if root_tok == "h853":
            pre = [lang.pre_h.get(t, "") for tp, t in toks if tp == "pre"]
            suf = [lang.suf_verb.get(t[2:], "") for tp, t in toks if tp == "suf" and t.startswith("s_")]
            item[1] = "-".join([p for p in pre if p] + ([s for s in suf if s] or ["[obj]"]))
            item[2] = "regra"
            continue
        if source == "alinhamento":
            continue
        if root_tok == "h3967":  # מֵאָה, "hundred": not the number of another verse (morph HAc?[spd]? = its number)
            pre = [lang.pre_h.get(t, "") for tp, t in toks if tp == "pre"]
            item[1] = lang.contract("-".join([p for p in pre if p] + [lang.hundred.get(morph[-2:-1], lang.hundred["s"])]))
            item[2] = "lexico"
            continue
        pre = [t for tp, t in toks if tp == "pre"]
        if root_tok in DEMONSTRATIVES and "p_d" in pre:  # הַזֶּה: "este", not "o-hoje"
            words = lang.this if DEMONSTRATIVES[root_tok] == "this" else lang.that
            pieces = [lang.pre_h.get(t, "") for t in pre if t != "p_d"]
            item[1] = lang.contract("-".join([p for p in pieces if p] + [words.get(morph[-2:], words["ms"])]))
            item[2] = "lexico"
            continue
        if language == "G" and morph.startswith("RA"):
            parse = morph.split("-", 1)[1] if "-" in morph else ""
            art = lang.article_g.get((parse[4:5], parse[6:7], parse[5:6])) if len(parse) >= 7 else None
            item[1], item[2] = art or lang.article_g[("N", "M", "S")], "regra"
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
        pre = [lang.pre_h.get(t, "") for tp, t in toks if tp == "pre"]
        suf = [lang.suffix(t, morph) for tp, t in toks if tp == "suf"]
        pieces = [p for p in pre if p] + [s for s, before in suf if s and before] + [base] + [s for s, before in suf if s and not before]
        item[1], item[2] = lang.contract("-".join(pieces)), "lexico"
    return pref
