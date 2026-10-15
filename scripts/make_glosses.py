#!/usr/bin/env python3
"""Glosas em português para cada palavra hebraica, aramaica e grega, por alinhamento com a BLIVRE.

1. Cada palavra original vira uma sequência de unidades (prefixos, raiz, sufixos pronominais).
2. O eflomal (aligner estatístico, licença GPL, usado só como ferramenta) alinha as unidades
   às palavras da BLIVRE, nos dois sentidos; as duas direções são combinadas (grow-diag-final-and).
3. A glosa de cada palavra é o trecho da BLIVRE alinhado a ela, na ordem do português.
   Sem alinhamento, entra a tradução mais frequente da mesma raiz (fonte "lexico"),
   ou uma regra fixa (artigo grego, partícula de objeto hebraica…).
4. As glosas revisadas à mão (data/glosses_pt.tsv, Gênesis 1) têm prioridade.

Grava em build/biblia.sqlite: palavras.glosa, palavras.glosa_fonte e a tabela traducoes
("como a BLIVRE traduz" cada verbete).

Uso: python3 scripts/make_glosses.py
"""

import csv
import difflib
import glob
import gzip
import hashlib
import os
import re
import sqlite3
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import eflomal

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB = os.path.join(ROOT, "build", "biblia.sqlite")
TMP = os.path.join(ROOT, "build", "alignment")

TOKEN_PT = re.compile(r"[^\W_]+(?:[’'][^\W_]+)?", re.U)


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c)).lower().replace("ς", "σ")


# ------------------------------------------------------------- unidades do original
def hebrew_units(lemma, morph):
    """Lista de (tipo, token): tipo é 'pre', 'raiz' ou 'suf'."""
    pieces = [p.strip() for p in lemma.split("/")]
    segs = morph[1:].split("/") if morph else []
    suffixes = [s for s in segs if s.startswith("S")]
    no_suffix = [s for s in segs if not s.startswith("S")]
    out = []
    for i, p in enumerate(pieces[:-1]):
        out.append(("pre", "p_" + p))
        if i < len(no_suffix) and no_suffix[i] == "Rd":  # preposição com artigo embutido
            out.append(("pre", "p_d"))
    root = pieces[-1]
    m = re.match(r"(\d+)", root)
    out.append(("raiz", ("h" + m.group(1)) if m else ("p_" + root)))
    if no_suffix and no_suffix[-1] == "Rd" and len(pieces) == 1:
        out.append(("pre", "p_d"))
    # artigo enfático aramaico (posposto)
    if len(no_suffix) > len(pieces) and no_suffix[-1] == "Td":
        out.append(("suf", "p_d"))
    for s in suffixes:
        if s.startswith("Sp"):
            out.append(("suf", "s_" + s[2:]))
        elif s == "Sd":
            out.append(("suf", "s_d"))
    return out


def greek_units(lemma, morph):
    return [("raiz", "g_" + norm(lemma).replace(" ", "_"))]


# ------------------------------------------------------------- simetrização
NEIGHBORS = [(-1, 0), (0, -1), (1, 0), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]


def gdfa(fwd, rev):
    a = fwd & rev
    u = fwd | rev
    al_s = {i for i, _ in a}
    al_t = {j for _, j in a}
    changed = True
    while changed:
        changed = False
        for i, j in sorted(a):
            for di, dj in NEIGHBORS:
                n = (i + di, j + dj)
                if n in u and n not in a and (n[0] not in al_s or n[1] not in al_t):
                    a.add(n)
                    al_s.add(n[0])
                    al_t.add(n[1])
                    changed = True
    for i, j in sorted(u):
        if (i, j) not in a and i not in al_s and j not in al_t:
            a.add((i, j))
            al_s.add(i)
            al_t.add(j)
    return a


def read_links(fname):
    out = []
    for line in Path(fname).read_text(encoding="utf8").splitlines(keepends=True):
        s = set()
        for pair in line.split():
            i, j = pair.split("-")
            s.add((int(i), int(j)))
        out.append(s)
    return out


# ------------------------------------------------------------- regras fixas
ARTICLE_G = {  # caso + gênero + número → artigo português
    ("N", "M", "S"): "o",
    ("N", "F", "S"): "a",
    ("N", "N", "S"): "o",
    ("N", "M", "P"): "os",
    ("N", "F", "P"): "as",
    ("N", "N", "P"): "os",
    ("A", "M", "S"): "o",
    ("A", "F", "S"): "a",
    ("A", "N", "S"): "o",
    ("A", "M", "P"): "os",
    ("A", "F", "P"): "as",
    ("A", "N", "P"): "os",
    ("G", "M", "S"): "do",
    ("G", "F", "S"): "da",
    ("G", "N", "S"): "do",
    ("G", "M", "P"): "dos",
    ("G", "F", "P"): "das",
    ("G", "N", "P"): "dos",
    ("D", "M", "S"): "ao",
    ("D", "F", "S"): "à",
    ("D", "N", "S"): "ao",
    ("D", "M", "P"): "aos",
    ("D", "F", "P"): "às",
    ("D", "N", "P"): "aos",
}

PRE_H = {"p_c": "e", "p_d": "o", "p_b": "em", "p_l": "para", "p_k": "como", "p_m": "de", "p_s": "que", "p_i": "acaso"}
SUF_NOUN = {
    "1cs": "meu",
    "2ms": "teu",
    "2fs": "teu",
    "3ms": "dele",
    "3fs": "dela",
    "1cp": "nosso",
    "2mp": "vosso",
    "2fp": "vosso",
    "3mp": "deles",
    "3fp": "delas",
}
SUF_VERB = {
    "1cs": "me",
    "2ms": "te",
    "2fs": "te",
    "3ms": "o",
    "3fs": "a",
    "1cp": "nos",
    "2mp": "vos",
    "2fp": "vos",
    "3mp": "os",
    "3fp": "as",
}
SUF_PREP = {
    "1cs": "mim",
    "2ms": "ti",
    "2fs": "ti",
    "3ms": "ele",
    "3fs": "ela",
    "1cp": "nós",
    "2mp": "vós",
    "2fp": "vós",
    "3mp": "eles",
    "3fp": "elas",
}


def gloss_suffix_rule(tok, morph):
    if tok == "s_d":
        return "para"
    p = tok[2:]
    segs = morph[1:].split("/")
    root = [s for s in segs if not s.startswith("S")]
    pos = root[-1][:1] if root else ""
    tab = SUF_VERB if pos == "V" else SUF_PREP if pos in ("R", "T") else SUF_NOUN
    return tab.get(p, "")


# ------------------------------------------------------------- principal
def tokens_pt(verse_text):
    """Tokens da BLIVRE com a posição no texto (hífen separa o pronome do verbo: disse-lhe)."""
    return [(m.group(0), m.start(), m.end()) for m in TOKEN_PT.finditer(verse_text)]


STOP_PT = set(
    [
        "o",
        "a",
        "os",
        "as",
        "de",
        "do",
        "da",
        "dos",
        "das",
        "em",
        "no",
        "na",
        "nos",
        "nas",
        "e",
        "ao",
        "aos",
        "à",
        "às",
        "se",
        "por",
        "pelo",
        "pela",
        "pelos",
        "pelas",
        "para",
        "com",
        "que",
        "lhe",
        "lhes",
    ]
)


def root_pos(language, morph):
    if not morph:
        return ""
    if language == "G":
        return morph[:1]
    root = [s for s in morph[1:].split("/") if not s.startswith("S")]
    return root[-1][:1] if root else ""


def root_morph(language, morph):
    """Morfologia só da raiz (sem prefixos): 'HC/Vqw3ms' → 'Vqw3ms'."""
    if not morph:
        return ""
    if language == "G":
        return morph
    segs = morph[1:].split("/")
    root = [x for x in segs if not x.startswith("S")]
    return root[-1] if root else ""


def short_morph(language, mr):
    if language == "G":
        return mr[:1] + (mr[3:6] if mr[:1] == "V" else mr[6:8])
    return mr[:3]


def fallback_keys(toks, language, morph):
    root = next((t for tp, t in toks if tp == "raiz"), None)
    pre = tuple(t for tp, t in toks if tp == "pre")
    mr = root_morph(language, morph)
    return [(pre, root, mr), (root, mr), (root, short_morph(language, mr)), (pre, root), root]


CONTRACTIONS = [
    ("em-o", "no"),
    ("em-a", "na"),
    ("em-os", "nos"),
    ("em-as", "nas"),
    ("de-o", "do"),
    ("de-a", "da"),
    ("de-os", "dos"),
    ("de-as", "das"),
    ("a-o", "ao"),
    ("a-os", "aos"),
    ("em-ele", "nele"),
    ("em-ela", "nela"),
    ("em-eles", "neles"),
    ("em-elas", "nelas"),
    ("de-ele", "dele"),
    ("de-ela", "dela"),
    ("de-eles", "deles"),
    ("de-elas", "delas"),
    ("em-um", "num"),
    ("em-uma", "numa"),
    ("de-um", "dum"),
]


def contract(g):
    pieces = g.split("-")
    out = []
    i = 0
    while i < len(pieces):
        if i + 1 < len(pieces):
            pair = pieces[i].lower() + "-" + pieces[i + 1].lower()
            c = dict(CONTRACTIONS).get(pair)
            if c:
                out.append(c)
                i += 2
                continue
        out.append(pieces[i])
        i += 1
    return "-".join(out)


FUNCTION_POS = {"R", "C", "T", "D", "P", "X", "I"}  # preposição, conjunção, partícula, advérbio, pronome…


def assemble(db, testament):
    q = """SELECT p.id, p.book, p.chapter, p.verse, p.language, p.text, p.lemma, p.strong, p.morph
           FROM words p JOIN books l ON l.code = p.book
           WHERE l.testament = ? ORDER BY l.book_order, p.chapter, p.verse, p.pos"""
    verses = defaultdict(list)
    for r in db.execute(q, (testament,)):
        verses[(r[1], r[2], r[3])].append(r)
    texts = {(b, c, v): t for b, c, v, t in db.execute("SELECT book, chapter, verse, blivre FROM verses")}
    item_list = []
    for k, wds in verses.items():
        t = texts.get(k) or ""
        toks = tokens_pt(t)
        unit = []  # (indice da palavra, tipo, token); tipo "fora" não entra no alinhamento
        for wi, r in enumerate(wds):
            us = greek_units(r[6], r[8]) if r[4] == "G" else hebrew_units(r[6], r[8])
            for kind, tok in us:
                if tok == "h853":  # partícula de objeto: sem equivalente em português
                    kind = "fora"
                unit.append((wi, kind, tok))
        item_list.append((k, wds, t, toks, unit))
    return item_list


def align_corpus(item_list, name):
    os.makedirs(TMP, exist_ok=True)
    src = [" ".join(u[2] for u in it[4] if u[1] != "fora") or "_" for it in item_list]
    trg = [" ".join(norm(tk[0]) for tk in it[3]) or "_" for it in item_list]
    fwd = os.path.join(TMP, f"{name}.fwd")
    rev = os.path.join(TMP, f"{name}.rev")
    # O eflomal é aleatório: o alinhamento fica salvo em data/alignment/ para as glosas serem estáveis.
    # Só é refeito se o texto de entrada mudar ou com REALINHAR=1.
    saved = os.path.join(ROOT, "data", "alignment", f"{name}.links.gz")
    signature = hashlib.sha256(("\n".join(src) + "\0" + "\n".join(trg)).encode()).hexdigest()
    pairs = None
    if os.path.exists(saved) and os.environ.get("REALINHAR") != "1":
        with gzip.open(saved, "rt", encoding="utf8") as f:
            if f.readline().strip() == signature:
                pairs = [tuple(ln.rstrip("\n").split("\t")) for ln in f]
        if pairs is None:
            print(f"  {name}: o texto mudou desde o último alinhamento; refazendo")
    if pairs is None:
        if os.environ.get("ADOTAR") == "1" and os.path.exists(fwd) and os.path.exists(rev):
            print(f"  {name}: adotando o último alinhamento de {os.path.relpath(TMP, ROOT)}")
        else:
            t0 = time.time()
            al = eflomal.Aligner(model=3, n_samplers=2)
            al.align(src, trg, links_filename_fwd=fwd, links_filename_rev=rev, quiet=True)
            print(f"  eflomal {name}: {len(src)} versículos em {time.time() - t0:.0f}s")
        fw = Path(fwd).read_text(encoding="utf8").split("\n")[: len(src)]
        rv = Path(rev).read_text(encoding="utf8").split("\n")[: len(src)]
        pairs = list(zip(fw, rv, strict=False))
        os.makedirs(os.path.dirname(saved), exist_ok=True)
        with gzip.open(saved, "wt", encoding="utf8", compresslevel=9) as f:
            f.write(signature + "\n")
            f.writelines(f"{a}\t{b}\n" for a, b in pairs)
    else:
        print(f"  {name}: alinhamento salvo reaproveitado ({os.path.relpath(saved, ROOT)})")

    def _links(line):
        return {tuple(map(int, p.split("-"))) for p in line.split()}

    links = []
    for it, (a, b) in zip(item_list, ((_links(x), _links(y)) for x, y in pairs), strict=False):
        idx = [ui for ui, u in enumerate(it[4]) if u[1] != "fora"]  # índice no alinhamento → unidade
        links.append({(idx[i], j) for i, j in gdfa(a, b) if i < len(idx) and j < len(it[3])})
    return links


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
    """Primeira passada: trecho da BLIVRE alinhado a cada palavra."""
    propers = proper_names(item_list)
    res = []
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
            if d["raiz"] and root_pos(r[4], r[8]) in ("V", "N", "A") and all(toks[j][0].lower() in STOP_PT for j in d["raiz"]):
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
            else:
                gloss, source = None, None
            root_tok = next((t for tp, t in d["toks"] if tp == "raiz"), None)
            rend = None
            if d["raiz"] and root_tok:
                rend = "-".join(match_case(toks[j][0], propers) for j in sorted(d["raiz"]))
                for ch in fallback_keys(d["toks"], r[4], r[8]):
                    counts[ch][rend] += 1
                for j in d["raiz"]:
                    counts[("tok", root_tok)][toks[j][0].lower()] += 1
            res.append([r[0], gloss, source, d["toks"], r, rend])
    return res, counts


def preferred_translation(tally):
    """Tradução mais frequente."""
    return tally.most_common(1)[0][0] if tally else None


def complete(res, counts):
    """Segunda passada: palavras sem alinhamento da raiz recebem a tradução mais comum ou uma regra."""
    pref = {tok: preferred_translation(c) for tok, c in counts.items()}
    for item in res:
        pid, gloss, source, toks, r, rend = item
        language, morph = r[4], r[8] or ""
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


def proper_name(language, morph, lemma):
    if language == "G":
        return morph.startswith("N") and lemma[:1].isupper()
    root = [x for x in (morph or "")[1:].split("/") if not x.startswith("S")]
    return bool(root) and root[-1][:2] in ("Np", "Ng")


def without_accent(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


def _initial(t):
    t = without_accent(t).lower()
    for a, b in (("ph", "p"), ("f", "p"), ("th", "t"), ("ch", "c"), ("kh", "c"), ("k", "c"), ("q", "c"), ("y", "i"), ("j", "i"), ("h", "")):
        if t.startswith(a):
            t = b + t[len(a) :]
    return t[:1]


def similar(t, target):
    """Semelhança entre um nome em português e a transliteração (com bônus se a inicial bate)."""
    r = difflib.SequenceMatcher(None, without_accent(t).lower(), without_accent(target).lower()).ratio()
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
            difflib.SequenceMatcher(None, without_accent(target).lower(), without_accent(t).lower()).ratio(),
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
    x = without_accent(x or "")
    if any("\u0370" <= c <= "\u03ff" for c in x):
        x = "".join(GR_LAT.get(c.lower(), c) for c in x)
    x = re.sub(r"[\u02b0-\u02ff'’`]", "", x)
    return x[:1].upper() + x[1:] if x else ""


RARE_GLOSSES = {
    "I accompany": "acompanho",
    "I am exceedingly abundant": "transbordo",
    "I am with": "estou com",
    "I apportion": "reparto",
    "I change for the worse": "pioro",
    "I embark": "embarco",
    "I encourage": "encorajo",
    "I enter": "entro",
    "I mediate": "sirvo de mediador",
    "I pay": "pago",
    "I rise up against": "levanto-me contra",
    "I rise up together against": "levantam-se juntos contra",
    "I stick fast": "fico preso",
    "I wait": "espero",
    "Susanchites": "susanquitas",
    "Trachonitis": "Traconites",
    "a business": "negócio",
    "a casting": "fundição",
    "a joint of the body": "junta",
    "an enslaver": "traficante de escravos",
    "bad": "mau",
    "bark": "casca",
    "be darkened": "escurecer",
    "be put": "ser posto",
    "belonging to a mill": "de moinho",
    "better": "melhor",
    "bough": "ramo",
    "buy": "comprar",
    "chamber": "câmara",
    "cheerful": "alegre",
    "cloud": "nuvem",
    "compare": "comparar",
    "continually": "continuamente",
    "covert": "abrigo",
    "cry": "clamor",
    "damage": "dano",
    "deceit": "engano",
    "deck": "enfeitar",
    "deity": "divindade",
    "earnestly": "com insistência",
    "excellency": "excelência",
    "fierce": "feroz",
    "fisher": "pescador",
    "gather together": "ajuntar",
    "grief": "tristeza",
    "grieve": "entristecer",
    "habitation": "morada",
    "he": "ele",
    "in better health": "melhorando",
    "incense": "incenso",
    "indescribable": "indescritível",
    "joyous": "alegre",
    "left-handed": "canhoto",
    "living in the sea": "marinho",
    "lower": "inferior",
    "mercy": "misericórdia",
    "natural force": "vigor",
    "near kinswomen": "parentas próximas",
    "noise": "barulho",
    "otherwise": "de outro modo",
    "paternal": "paterno",
    "psaltery": "saltério",
    "purple": "púrpura",
    "put": "pôr",
    "respectful of what is divine": "reverente",
    "roaring": "rugido",
    "ruler": "governante",
    "scrip": "alforje",
    "stamp": "pisar",
    "standing": "em pé",
    "strive": "lutar",
    "subject to a husband": "submissa ao marido",
    "that is spread": "estendido",
    "that ought to be put": "que se deve pôr",
    "threshingfloor": "eira",
    "violence": "violência",
    "ye": "vós",
    "consume": "consumir",
    "child": "filho",
    "ancient": "antigo",
    "damsel": "moça",
    "cake": "bolo",
    "cutting": "corte",
    "kernel": "semente",
    "be an enemy": "ser inimigo",
    "?": "?",
    "Dehavites": "daavitas",
    "I am like": "sou semelhante",
    "I am out of my senses": "estou fora de mim",
    "I anticipate": "antecipo",
    "I bear away together with": "levo junto",
    "I bind around": "amarro em volta",
    "I burn with lust": "ardo de desejo",
    "I buy": "compro",
    "I cause to appear": "faço aparecer",
    "I cleanse": "purifico",
    "I come together with": "junto-me",
    "I compare": "comparo",
    "I cool": "refresco",
    "I crush": "esmago",
    "I drive away": "expulso",
    "I envy": "invejo",
    "I faint": "desfaleço",
    "I fatten": "engordo",
    "I fill completely": "encho por completo",
    "I frighten": "amedronto",
    "I have dealings with": "tenho trato com",
    "I have preeminence": "tenho a primazia",
    "I insult": "insulto",
    "I journey to": "viajo para",
    "I leap upon": "salto sobre",
    "I listen to": "escuto",
    "I resist": "resisto",
    "I roar": "rujo",
    "I rob": "roubo",
    "I roll or gather together": "enrolo",
    "I sail over": "navego",
    "I sink": "afundo",
    "I subject to regulations": "sujeito a regras",
    "I submit to": "submeto-me",
    "I take away": "tiro",
    "I turn": "volto",
    "I wait upon": "sirvo",
    "a captive": "cativo",
    "a festival assembly": "assembleia festiva",
    "a foster brother": "irmão de criação",
    "a freedman": "liberto",
    "a pail": "balde",
    "a reporter": "relator",
    "a state": "estado",
    "afore": "antes",
    "an old man": "velho",
    "angels": "anjos",
    "be meet": "convir",
    "belonging to old women": "de velhas",
    "bind": "atar",
    "break off": "romper",
    "burden": "carga",
    "burn": "queimar",
    "burning": "queimadura",
    "confusion": "confusão",
    "counsellor": "conselheiro",
    "courtiers": "cortesãos",
    "cruel": "cruel",
    "debtor": "devedor",
    "displease": "desagradar",
    "dissonant": "dissonante",
    "endure": "durar",
    "favour": "favor",
    "fellow-elect": "coeleita",
    "flight": "fuga",
    "froward": "perverso",
    "full of astonishment": "cheio de espanto",
    "gain": "lucro",
    "gall": "fel",
    "go": "ir",
    "going down": "descida",
    "gourd": "cabaça",
    "have maintenance": "ser sustentado",
    "help": "ajuda",
    "hunting": "caça",
    "image": "imagem",
    "improvement": "melhoria",
    "in secret": "em segredo",
    "inviolable": "inviolável",
    "island": "ilha",
    "join": "unir",
    "joyfully": "com alegria",
    "light": "luz",
    "living": "vivo",
    "mire": "lama",
    "not yet": "ainda não",
    "offscouring": "escória",
    "on high": "no alto",
    "perfection": "perfeição",
    "poor": "pobre",
    "rage": "fúria",
    "ready": "pronto",
    "recovery of sight": "recuperação da vista",
    "remain": "ficar",
    "roused out of sleep": "despertado",
    "scrapings": "raspas",
    "shout": "grito",
    "shut": "fechar",
    "smote": "feriu",
    "spoil": "despojo",
    "spread": "estender",
    "stay": "ficar",
    "strength": "força",
    "strong": "forte",
    "sun": "sol",
    "swearing by": "jurando por",
    "than": "que",
    "thee": "a ti",
    "think": "pensar",
    "treasurer": "tesoureiro",
    "uncountable": "incontável",
    "under": "debaixo",
    "unseemly": "indecoroso",
    "used": "usado",
    "very compassionate": "muito compassivo",
    "very rainy": "muito chuvoso",
    "waste": "desolação",
    "whom": "quem",
    "work": "obra",
    "lifting up of self": "exaltação",
    "cause": "causa",
    "any": "algo",
    "destruction": "destruição",
    "do secretly": "fazer em segredo",
    "drink offering": "libação",
    "earth": "terra",
    "hat": "chapéu",
    "point out": "indicar",
    "prophesy": "profetizar",
    "reach": "alcançar",
    "seal": "selo",
    "sedition": "sedição",
    "chapiter": "capitel",
    "muffler": "véu",
    "youth": "juventude",
    "clay": "barro",
    "drought": "seca",
    "grave": "sepultura",
    "heart": "coração",
    "sound": "som",
    "very early in the morning": "de madrugada",
    "watching": "vigília",
    "chain": "corrente",
    "shovel": "pá",
    "brier": "espinheiro",
    "fire": "fogo",
    "certain": "certo",
    "cote": "curral",
    "depth": "profundeza",
    "Ethanim": "Etanim",
    "I am in": "estou em",
    "I am in the middle": "estou no meio",
    "I appear": "apareço",
    "I conceal": "escondo",
    "I dissemble with": "finjo junto",
    "I enter secretly": "entro às escondidas",
    "I help": "ajudo",
    "I join closely": "uno-me estreitamente",
    "I overturn": "derrubo",
    "I practice soothsaying": "pratico adivinhação",
    "I receive in my turn": "recebo em troca",
    "I search diligently": "busco com cuidado",
    "I sew on": "costuro",
    "I strike": "golpeio",
    "I throw at in opposition": "atiro contra",
    "a Roman measure": "medida romana",
    "a cause of stumbling": "tropeço",
    "a narrative": "narrativa",
    "a noose or snare": "laço",
    "a particle asking a question": "acaso",
    "a porch": "pórtico",
    "a prayer or prayer for evil": "imprecação",
    "a prison": "prisão",
    "a proof": "prova",
    "a successor": "sucessor",
    "a young bird": "filhote",
    "an apron": "avental",
    "banquet": "banquete",
    "be poured": "ser derramado",
    "bend": "curvar",
    "blemish": "defeito",
    "bodily": "corporal",
    "chariot": "carro",
    "cleanness": "pureza",
    "cleave": "apegar-se",
    "company of horses": "cavalaria",
    "compass": "rodear",
    "confiscation": "confisco",
    "cover with a cloud": "cobrir de nuvem",
    "crave": "desejar",
    "darkness": "trevas",
    "destined to suffer": "destinado a sofrer",
    "disappearing": "desaparecimento",
    "doing of good": "prática do bem",
    "dulcimer": "saltério",
    "evil-mindedness": "malícia",
    "far": "longe",
    "garment": "veste",
    "gather": "juntar",
    "greater": "maior",
    "intent": "intenção",
    "jacinth": "jacinto",
    "knee": "joelho",
    "like": "como",
    "loin": "lombo",
    "mark": "marca",
    "more abundantly": "mais abundantemente",
    "mournfully": "tristemente",
    "naked": "nu",
    "on the second day": "no segundo dia",
    "one": "um",
    "other": "outro",
    "palmer-worm": "lagarta",
    "pursuing": "perseguição",
    "refreshing": "refrigério",
    "righteousness": "justiça",
    "sneeze": "espirrar",
    "solace": "consolo",
    "somewhere": "em algum lugar",
    "spice": "especiaria",
    "stamping": "pisoteio",
    "sup up": "sorver",
    "the proclamation of an appointment": "proclamação",
    "the skin": "a pele",
    "traffic": "comércio",
    "treasure": "tesouro",
    "tribe": "tribo",
    "wailing": "lamento",
    "wheel": "roda",
    "where": "onde",
    "wild ass": "jumento selvagem",
    "window": "janela",
    "winged": "alado",
    "without": "sem",
    "wrath": "ira",
    "yell": "gritar",
}  # inglês → português (palavras raras sem verbete traduzido)


def final_adjustments(res, counts, pref, texts, lexicon):
    """Correções apontadas pela revisão automática:
    - YHWH: onde a BLIVRE diz "EU SOU", a glosa cortada "SOU" vira "EU-SOU";
    - nomes próprios trocados pelo alinhamento: usa o nome que a BLIVRE dá a essa palavra, se ele está no versículo;
    - palavras sem glosa: significado do léxico em português, nome transliterado ou glosa curta."""
    n = Counter()
    verse_names = defaultdict(set)  # nomes (tradução preferida) das palavras de nome próprio de cada versículo
    for item in res:
        r = item[4]
        if proper_name(r[4], r[8] or "", r[6] or ""):
            rt = next((t for tp, t in item[3] if tp == "raiz"), None)
            if pref.get(rt):
                verse_names[(r[1], r[2], r[3])].add((rt, pref[rt]))
    for item in res:
        pid, gloss, source, toks, r, rend = item
        language, morph, lemma = r[4], r[8] or "", r[6] or ""
        verse_text = texts.get((r[1], r[2], r[3]), "")
        root_tok = next((t for tp, t in toks if tp == "raiz"), None)
        if r[7] == "H3068" and gloss and re.search(r"(^|-)SOU($|-)", gloss) and re.search(r"EU[ -]SOU", verse_text):
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
            target = name_from_xlit((lexicon.get(r[7]) or {}).get("xlit") or lemma)
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
            target = name_from_xlit((lexicon.get(r[7]) or {}).get("xlit") or lemma)
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
            others = {nm for rt, nm in verse_names[(r[1], r[2], r[3])] if rt != root_tok}
            target2 = name_from_xlit((lexicon.get(r[7]) or {}).get("xlit") or lemma)
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
            e = lexicon.get(r[7]) or {}
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


def without_cantillation(heb):
    """Tira os sinais de cantilação, o meteg e o paseq; mantém vogais e dagesh."""
    return re.sub(r"[\u0591-\u05AF\u05BD\u05C0]", "", unicodedata.normalize("NFD", heb))


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
        if r[1] == "GEN" and r[2] == 1:
            g = manual_glosses.get((without_cantillation(r[5]), r[8]))
            if g:
                n += 1
                auto = (item[1] or "").lower().replace(" ", "-")
                if auto == g.lower():
                    equal += 1
                elif report is not None:
                    report.append((r[3], without_cantillation(r[5]), g, item[1], item[2]))
                item[1], item[2] = g, "manual"
    return n, equal, len(manual_glosses)


def load_lexicon(db):
    """Significado curto de cada verbete: português (data/lexicon_pt) ou inglês (Strong/Dodson)."""
    pt = {}
    for fname in glob.glob(os.path.join(ROOT, "data", "lexicon_pt", "*.tsv")):
        with open(fname, encoding="utf8") as f:
            for row in csv.DictReader(f, delimiter="\t"):
                pt[row["key"]] = row["meaning"]
    lex = {}
    for entry_key, xlit, gloss_en, kjv, def_en, def_pt in db.execute(
        "SELECT entry_key, xlit, gloss_en, kjv_en, def_en, def_pt FROM lexicon"
    ):
        en = gloss_en or (kjv if kjv and re.sub(r"\[[a-z]+\]|[{}().,;\s-]", "", kjv) else None) or def_en
        lex[entry_key] = {"xlit": xlit, "pt": pt.get(entry_key) or def_pt, "en": en}
    return lex


def main():
    db = sqlite3.connect(DB)
    db.execute("DROP TABLE IF EXISTS traducoes")
    db.execute("CREATE TABLE translations(entry_key TEXT, translation TEXT, n INTEGER)")
    total = Counter()
    for test, name in (("AT", "at"), ("NT", "nt")):
        item_list = assemble(db, test)
        links = align_corpus(item_list, name)
        res, counts = compose(item_list, links)
        pref = complete(res, counts)
        lexicon = load_lexicon(db)
        texts = {(b, c, v): t or "" for b, c, v, t in db.execute("SELECT book, chapter, verse, blivre FROM verses")}
        print("  ajustes:", dict(final_adjustments(res, counts, pref, texts, lexicon)))
        if test == "AT":
            diffs = []
            n, equal, _ = apply_manual(db, res, diffs)
            if n:
                print(f"  Gênesis 1: {equal}/{n} glosas automáticas iguais às revisadas ({100 * equal / n:.0f}%)")
                with open(os.path.join(TMP, "gn1_diferencas.tsv"), "w", encoding="utf8") as f:
                    f.write("vers\thebraico\trevisada\tautomatica\tfonte\n")
                    for d in diffs:
                        f.write("\t".join(str(x) for x in d) + "\n")
        db.executemany("UPDATE words SET gloss = ?, gloss_source = ? WHERE id = ?", [(g, f, pid) for pid, g, f, _, _, _ in res])
        # "como a BLIVRE traduz": por chave de Strong (ou lema grego sem Strong)
        by_key = defaultdict(Counter)
        tok_key = {}
        for _pid, _g, _f, toks, r, _ in res:
            root_tok = next((t for tp, t in toks if tp == "raiz"), None)
            if root_tok:
                tok_key.setdefault(root_tok, r[7] or ("G:" + r[6] if r[4] == "G" else None))
        for tok, c in counts.items():
            if isinstance(tok, tuple):
                continue
            ch = tok_key.get(tok)
            if ch:
                for t, n in c.items():
                    by_key[ch][t.lower()] += n
        db.executemany("INSERT INTO translations VALUES (?,?,?)", [(ch, t, n) for ch, c in by_key.items() for t, n in c.most_common(12)])
        total.update(f for _, _, f, _, _, _ in res)
    db.commit()
    print("glosas por fonte:", dict(total))
    apply_corrections(db)


def _letters_only(t):
    """Forma para comparar: sem cantilação, vogais, acentos, pontuação e barras."""
    t = unicodedata.normalize("NFD", t or "")
    return "".join(c for c in t if unicodedata.category(c)[0] == "L").lower()


def apply_corrections(db):
    """Correções de glosa feitas por revisores (data/corrections/glosses.tsv), aplicadas por último.

    Colunas: ref (ex.: "JHN 1:1"), pos (posição da palavra no versículo, contando de 1),
    original (a palavra no original, para conferência; vogais e acentos são ignorados),
    glosa (a nova glosa, palavras unidas por hífen), revisor, nota.
    Se a palavra naquela posição não for a indicada em "original", a linha é ignorada com aviso."""
    fname = os.path.join(ROOT, "data", "corrections", "glosses.tsv")
    if not os.path.exists(fname):
        return
    ok = errors = 0
    with open(fname, encoding="utf8") as f:
        lines = [r for r in csv.DictReader(f, delimiter="\t") if (r.get("ref") or "").strip() and not r["ref"].startswith("#")]
    for n, r in enumerate(lines, 2):
        m = re.match(r"\s*([1-3A-Z]{3})\s+(\d+):(\d+)\s*$", r["ref"])
        if not m or not (r.get("pos") or "").strip().isdigit() or not (r.get("gloss") or "").strip():
            print(f"  correções, linha {n}: referência, posição ou glosa inválida: {r}")
            errors += 1
            continue
        wds = db.execute(
            "SELECT id, text FROM words WHERE book=? AND chapter=? AND verse=? ORDER BY pos", (m[1], int(m[2]), int(m[3]))
        ).fetchall()
        i = int(r["pos"]) - 1
        if not 0 <= i < len(wds):
            print(f"  correções, linha {n}: {r['ref']} não tem palavra na posição {r['pos']} ({len(wds)} palavras)")
            errors += 1
            continue
        pid, verse_text = wds[i]
        if (r.get("original") or "").strip() and _letters_only(r["original"]) != _letters_only(verse_text):
            print(f"  correções, linha {n}: em {r['ref']} posição {r['pos']} está {verse_text}, não {r['original']}; ignorada")
            errors += 1
            continue
        db.execute("UPDATE words SET gloss = ?, gloss_source = 'revisada' WHERE id = ?", (r["gloss"].strip().replace(" ", "-"), pid))
        ok += 1
    db.commit()
    print(f"correções de glosa (data/corrections/glosses.tsv): {ok} aplicadas, {errors} com problema")
    return errors


if __name__ == "__main__":
    sys.exit(main())
