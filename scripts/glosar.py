#!/usr/bin/env python3
"""Glosas em português para cada palavra hebraica, aramaica e grega, por alinhamento com a BLIVRE.

1. Cada palavra original vira uma sequência de unidades (prefixos, raiz, sufixos pronominais).
2. O eflomal (aligner estatístico, licença GPL, usado só como ferramenta) alinha as unidades
   às palavras da BLIVRE, nos dois sentidos; as duas direções são combinadas (grow-diag-final-and).
3. A glosa de cada palavra é o trecho da BLIVRE alinhado a ela, na ordem do português.
   Sem alinhamento, entra a tradução mais frequente da mesma raiz (fonte "lexico"),
   ou uma regra fixa (artigo grego, partícula de objeto hebraica…).
4. As glosas revisadas à mão (dados/glosses_pt.tsv, Gênesis 1) têm prioridade.

Grava em saida/biblia.sqlite: palavras.glosa, palavras.glosa_fonte e a tabela traducoes
("como a BLIVRE traduz" cada verbete).

Uso: python3 scripts/glosar.py
"""
import csv
import gzip
import hashlib
import difflib
import glob
import os
import re
import sqlite3
import sys
import time
import unicodedata
from collections import Counter, defaultdict

import eflomal

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB = os.path.join(ROOT, "saida", "biblia.sqlite")
TMP = os.path.join(ROOT, "saida", "alinhamento")

TOKEN_PT = re.compile(r"[^\W_]+(?:[’'][^\W_]+)?", re.U)


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c)).lower().replace("ς", "σ")


# ------------------------------------------------------------- unidades do original
def unidades_hebraico(lema, morph):
    """Lista de (tipo, token): tipo é 'pre', 'raiz' ou 'suf'."""
    partes = [p.strip() for p in lema.split("/")]
    segs = morph[1:].split("/") if morph else []
    sufixos = [s for s in segs if s.startswith("S")]
    nao_suf = [s for s in segs if not s.startswith("S")]
    out = []
    for i, p in enumerate(partes[:-1]):
        out.append(("pre", "p_" + p))
        if i < len(nao_suf) and nao_suf[i] == "Rd":  # preposição com artigo embutido
            out.append(("pre", "p_d"))
    raiz = partes[-1]
    m = re.match(r"(\d+)", raiz)
    out.append(("raiz", ("h" + m.group(1)) if m else ("p_" + raiz)))
    if nao_suf and nao_suf[-1] == "Rd" and len(partes) == 1:
        out.append(("pre", "p_d"))
    # artigo enfático aramaico (posposto)
    if len(nao_suf) > len(partes) and nao_suf[-1] == "Td":
        out.append(("suf", "p_d"))
    for s in sufixos:
        if s.startswith("Sp"):
            out.append(("suf", "s_" + s[2:]))
        elif s == "Sd":
            out.append(("suf", "s_d"))
    return out


def unidades_grego(lema, morph):
    return [("raiz", "g_" + norm(lema).replace(" ", "_"))]


# ------------------------------------------------------------- simetrização
VIZ = [(-1, 0), (0, -1), (1, 0), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]


def gdfa(fwd, rev):
    a = fwd & rev
    u = fwd | rev
    al_s = {i for i, _ in a}
    al_t = {j for _, j in a}
    mudou = True
    while mudou:
        mudou = False
        for i, j in sorted(a):
            for di, dj in VIZ:
                n = (i + di, j + dj)
                if n in u and n not in a and (n[0] not in al_s or n[1] not in al_t):
                    a.add(n)
                    al_s.add(n[0])
                    al_t.add(n[1])
                    mudou = True
    for i, j in sorted(u):
        if (i, j) not in a and i not in al_s and j not in al_t:
            a.add((i, j))
            al_s.add(i)
            al_t.add(j)
    return a


def ler_links(arq):
    out = []
    for linha in open(arq, encoding="utf8"):
        s = set()
        for par in linha.split():
            i, j = par.split("-")
            s.add((int(i), int(j)))
        out.append(s)
    return out


# ------------------------------------------------------------- regras fixas
ARTIGO_G = {  # caso + gênero + número → artigo português
    ("N", "M", "S"): "o", ("N", "F", "S"): "a", ("N", "N", "S"): "o",
    ("N", "M", "P"): "os", ("N", "F", "P"): "as", ("N", "N", "P"): "os",
    ("A", "M", "S"): "o", ("A", "F", "S"): "a", ("A", "N", "S"): "o",
    ("A", "M", "P"): "os", ("A", "F", "P"): "as", ("A", "N", "P"): "os",
    ("G", "M", "S"): "do", ("G", "F", "S"): "da", ("G", "N", "S"): "do",
    ("G", "M", "P"): "dos", ("G", "F", "P"): "das", ("G", "N", "P"): "dos",
    ("D", "M", "S"): "ao", ("D", "F", "S"): "à", ("D", "N", "S"): "ao",
    ("D", "M", "P"): "aos", ("D", "F", "P"): "às", ("D", "N", "P"): "aos",
}

PRE_H = {"p_c": "e", "p_d": "o", "p_b": "em", "p_l": "para", "p_k": "como", "p_m": "de", "p_s": "que", "p_i": "acaso"}
SUF_NOME = {"1cs": "meu", "2ms": "teu", "2fs": "teu", "3ms": "dele", "3fs": "dela", "1cp": "nosso",
            "2mp": "vosso", "2fp": "vosso", "3mp": "deles", "3fp": "delas"}
SUF_VERBO = {"1cs": "me", "2ms": "te", "2fs": "te", "3ms": "o", "3fs": "a", "1cp": "nos",
             "2mp": "vos", "2fp": "vos", "3mp": "os", "3fp": "as"}
SUF_PREP = {"1cs": "mim", "2ms": "ti", "2fs": "ti", "3ms": "ele", "3fs": "ela", "1cp": "nós",
            "2mp": "vós", "2fp": "vós", "3mp": "eles", "3fp": "elas"}


def glosa_regra_suf(tok, morph):
    if tok == "s_d":
        return "para"
    p = tok[2:]
    segs = morph[1:].split("/")
    raiz = [s for s in segs if not s.startswith("S")]
    pos = raiz[-1][:1] if raiz else ""
    tab = SUF_VERBO if pos == "V" else SUF_PREP if pos in ("R", "T") else SUF_NOME
    return tab.get(p, "")


# ------------------------------------------------------------- principal
def tokens_pt(texto):
    """Tokens da BLIVRE com a posição no texto (hífen separa o pronome do verbo: disse-lhe)."""
    return [(m.group(0), m.start(), m.end()) for m in TOKEN_PT.finditer(texto)]


STOP_PT = set("""o a os as de do da dos das em no na nos nas e ao aos à às se por pelo pela
pelos pelas para com que lhe lhes""".split())


def pos_raiz(lingua, morph):
    if not morph:
        return ""
    if lingua == "G":
        return morph[:1]
    raiz = [s for s in morph[1:].split("/") if not s.startswith("S")]
    return raiz[-1][:1] if raiz else ""


def morf_raiz(lingua, morph):
    """Morfologia só da raiz (sem prefixos): 'HC/Vqw3ms' → 'Vqw3ms'."""
    if not morph:
        return ""
    if lingua == "G":
        return morph
    segs = morph[1:].split("/")
    raiz = [x for x in segs if not x.startswith("S")]
    return raiz[-1] if raiz else ""


def morf_curta(lingua, mr):
    if lingua == "G":
        return mr[:1] + (mr[3:6] if mr[:1] == "V" else mr[6:8])
    return mr[:3]


def chaves_fallback(toks, lingua, morph):
    raiz = next((t for tp, t in toks if tp == "raiz"), None)
    pre = tuple(t for tp, t in toks if tp == "pre")
    mr = morf_raiz(lingua, morph)
    return [(pre, raiz, mr), (raiz, mr), (raiz, morf_curta(lingua, mr)), (pre, raiz), raiz]


CONTRACOES = [("em-o", "no"), ("em-a", "na"), ("em-os", "nos"), ("em-as", "nas"), ("de-o", "do"),
              ("de-a", "da"), ("de-os", "dos"), ("de-as", "das"), ("a-o", "ao"), ("a-os", "aos"),
              ("em-ele", "nele"), ("em-ela", "nela"), ("em-eles", "neles"), ("em-elas", "nelas"),
              ("de-ele", "dele"), ("de-ela", "dela"), ("de-eles", "deles"), ("de-elas", "delas"),
              ("em-um", "num"), ("em-uma", "numa"), ("de-um", "dum")]


def contrair(g):
    partes = g.split("-")
    out = []
    i = 0
    while i < len(partes):
        if i + 1 < len(partes):
            par = partes[i].lower() + "-" + partes[i + 1].lower()
            c = dict(CONTRACOES).get(par)
            if c:
                out.append(c)
                i += 2
                continue
        out.append(partes[i])
        i += 1
    return "-".join(out)


FUNCAO = {"R", "C", "T", "D", "P", "X", "I"}  # preposição, conjunção, partícula, advérbio, pronome…


def montar(db, testamento):
    q = """SELECT p.id, p.livro, p.cap, p.vers, p.lingua, p.texto, p.lema, p.strong, p.morph
           FROM palavras p JOIN livros l ON l.codigo = p.livro
           WHERE l.testamento = ? ORDER BY l.ordem, p.cap, p.vers, p.pos"""
    versos = defaultdict(list)
    for r in db.execute(q, (testamento,)):
        versos[(r[1], r[2], r[3])].append(r)
    textos = {(b, c, v): t for b, c, v, t in db.execute("SELECT livro, cap, vers, blivre FROM versos")}
    itens = []
    for k, pals in versos.items():
        t = textos.get(k) or ""
        toks = tokens_pt(t)
        unid = []  # (indice da palavra, tipo, token); tipo "fora" não entra no alinhamento
        for wi, r in enumerate(pals):
            us = unidades_grego(r[6], r[8]) if r[4] == "G" else unidades_hebraico(r[6], r[8])
            for tipo, tok in us:
                if tok == "h853":  # partícula de objeto: sem equivalente em português
                    tipo = "fora"
                unid.append((wi, tipo, tok))
        itens.append((k, pals, t, toks, unid))
    return itens


def alinhar(itens, nome):
    os.makedirs(TMP, exist_ok=True)
    src = [" ".join(u[2] for u in it[4] if u[1] != "fora") or "_" for it in itens]
    trg = [" ".join(norm(tk[0]) for tk in it[3]) or "_" for it in itens]
    fwd = os.path.join(TMP, f"{nome}.fwd")
    rev = os.path.join(TMP, f"{nome}.rev")
    # O eflomal é aleatório: o alinhamento fica salvo em dados/alinhamento/ para as glosas serem estáveis.
    # Só é refeito se o texto de entrada mudar ou com REALINHAR=1.
    salvo = os.path.join(ROOT, "dados", "alinhamento", f"{nome}.links.gz")
    assinatura = hashlib.sha256(("\n".join(src) + "\0" + "\n".join(trg)).encode()).hexdigest()
    pares = None
    if os.path.exists(salvo) and os.environ.get("REALINHAR") != "1":
        with gzip.open(salvo, "rt", encoding="utf8") as f:
            if f.readline().strip() == assinatura:
                pares = [tuple(l.rstrip("\n").split("\t")) for l in f]
        if pares is None:
            print(f"  {nome}: o texto mudou desde o último alinhamento; refazendo")
    if pares is None:
        if os.environ.get("ADOTAR") == "1" and os.path.exists(fwd) and os.path.exists(rev):
            print(f"  {nome}: adotando o último alinhamento de {os.path.relpath(TMP, ROOT)}")
        else:
            t0 = time.time()
            al = eflomal.Aligner(model=3, n_samplers=2)
            al.align(src, trg, links_filename_fwd=fwd, links_filename_rev=rev, quiet=True)
            print(f"  eflomal {nome}: {len(src)} versículos em {time.time() - t0:.0f}s")
        fw = open(fwd, encoding="utf8").read().split("\n")[:len(src)]
        rv = open(rev, encoding="utf8").read().split("\n")[:len(src)]
        pares = list(zip(fw, rv))
        os.makedirs(os.path.dirname(salvo), exist_ok=True)
        with gzip.open(salvo, "wt", encoding="utf8", compresslevel=9) as f:
            f.write(assinatura + "\n")
            f.writelines(f"{a}\t{b}\n" for a, b in pares)
    else:
        print(f"  {nome}: alinhamento salvo reaproveitado ({os.path.relpath(salvo, ROOT)})")
    def _links(linha):
        return {tuple(map(int, p.split("-"))) for p in linha.split()}
    links = []
    for it, (a, b) in zip(itens, ((_links(x), _links(y)) for x, y in pares)):
        idx = [ui for ui, u in enumerate(it[4]) if u[1] != "fora"]  # índice no alinhamento → unidade
        links.append({(idx[i], j) for i, j in gdfa(a, b) if i < len(idx) and j < len(it[3])})
    return links


def nomes_proprios(itens):
    """Formas que aparecem com maiúscula no meio da frase (Deus, Moisés…) continuam com maiúscula."""
    c = defaultdict(Counter)
    for it in itens:
        texto, toks = it[2], it[3]
        for n, (t, ini, fim) in enumerate(toks):
            if n == 0 or re.search(r"[.!?:;«»“\"]\s*$", texto[:ini]):
                continue
            c[t.lower()]["M" if t[:1].isupper() else "m"] += 1
    return {k for k, v in c.items() if v["M"] > v["m"]}


def caixa(tok, proprios):
    if len(tok) > 1 and tok.isupper():
        return tok  # SENHOR
    if tok[:1].isupper() and tok.lower() not in proprios:
        return tok.lower()
    return tok


def compor(itens, links):
    """Primeira passada: trecho da BLIVRE alinhado a cada palavra."""
    proprios = nomes_proprios(itens)
    res = []
    contagem = defaultdict(Counter)  # token de raiz → traduções observadas
    for (k, pals, texto, toks, unid), lk in zip(itens, links):
        # palavra portuguesa ligada a duas ocorrências da mesma raiz (δόξαν… δόξαν):
        # fica com a ocorrência de posição relativa mais próxima
        donos = defaultdict(list)
        for i, j in lk:
            donos[(j, unid[i][2])].append(i)
        lk = set(lk)
        for (j, _), iis in donos.items():
            ws = {unid[i][0] for i in iis}
            if len(ws) > 1:
                melhor = min(ws, key=lambda w: abs(w / max(1, len(pals)) - j / max(1, len(toks))))
                for i in iis:
                    if unid[i][0] != melhor:
                        lk.discard((i, j))
        por_unid = defaultdict(set)
        alinhados_t = defaultdict(set)
        for i, j in lk:
            por_unid[i].add(j)
            alinhados_t[j].add(unid[i][0])
        por_palavra = defaultdict(lambda: {"raiz": set(), "pre": set(), "suf": set(), "fora": set(), "toks": []})
        for ui, (wi, tipo, tok) in enumerate(unid):
            por_palavra[wi]["toks"].append((tipo if tipo != "fora" else "raiz", tok))
            por_palavra[wi][tipo] |= por_unid.get(ui, set())
        for wi, r in enumerate(pals):
            d = por_palavra[wi]
            # raiz de conteúdo (verbo, nome, adjetivo) ligada só a artigo/preposição: alinhamento espúrio
            if d["raiz"] and pos_raiz(r[4], r[8]) in ("V", "N", "A") and \
                    all(toks[j][0].lower() in STOP_PT for j in d["raiz"]):
                d["raiz"] = set()
            js = sorted(d["raiz"] | d["pre"] | d["suf"])
            if js:
                # fica o grupo contíguo (folga de 2) com mais ligações à raiz
                grupos, g = [], [js[0]]
                for j in js[1:]:
                    if j - g[-1] <= 2:
                        g.append(j)
                    else:
                        grupos.append(g)
                        g = [j]
                grupos.append(g)
                grupos.sort(key=lambda g: (-len(set(g) & d["raiz"]), -len(g)))
                g = grupos[0]
                # preenche lacunas com palavras que não estão alinhadas a nada
                cheio = [j for j in range(g[0], g[-1] + 1) if j in g or not alinhados_t.get(j)]
                if len(cheio) > 6:
                    cheio = sorted(set(g) & d["raiz"]) or g[:6]
                glosa = "-".join(caixa(toks[j][0], proprios) for j in cheio)
                fonte = "alinhamento" if d["raiz"] else "parcial"
            else:
                glosa, fonte = None, None
            raiz_tok = next((t for tp, t in d["toks"] if tp == "raiz"), None)
            rend = None
            if d["raiz"] and raiz_tok:
                rend = "-".join(caixa(toks[j][0], proprios) for j in sorted(d["raiz"]))
                for ch in chaves_fallback(d["toks"], r[4], r[8]):
                    contagem[ch][rend] += 1
                for j in d["raiz"]:
                    contagem[("tok", raiz_tok)][toks[j][0].lower()] += 1
            res.append([r[0], glosa, fonte, d["toks"], r, rend])
    return res, contagem


def traducao_preferida(cont):
    """Tradução mais frequente."""
    return cont.most_common(1)[0][0] if cont else None


def completar(res, contagem):
    """Segunda passada: palavras sem alinhamento da raiz recebem a tradução mais comum ou uma regra."""
    pref = {tok: traducao_preferida(c) for tok, c in contagem.items()}
    for item in res:
        pid, glosa, fonte, toks, r, rend = item
        lingua, morph = r[4], r[8] or ""
        raiz_tok = next((t for tp, t in toks if tp == "raiz"), None)
        # palavra gramatical alinhada a uma tradução rara para ela: provável erro de alinhamento;
        # ficam só as palavras portuguesas que são traduções comuns dela
        if fonte == "alinhamento" and rend and pos_raiz(lingua, morph) in FUNCAO:
            c = contagem[raiz_tok]
            if c[rend] / max(1, sum(c.values())) < 0.03:
                ct = contagem[("tok", raiz_tok)]
                tot = max(1, sum(ct.values()))
                bons = [t for t in rend.split("-") if ct[t.lower()] / tot >= 0.05]
                if bons:
                    pre = [PRE_H.get(t, "") for tp, t in toks if tp == "pre"] if lingua != "G" else []
                    item[1] = contrair("-".join([p for p in pre if p] + bons))
                    item[2] = "alinhamento"
                    continue
                fonte = item[2] = "rejeitado"
        if raiz_tok == "h853":
            pre = [PRE_H.get(t, "") for tp, t in toks if tp == "pre"]
            suf = [SUF_VERBO.get(t[2:], "") for tp, t in toks if tp == "suf" and t.startswith("s_")]
            item[1] = "-".join([p for p in pre if p] + ([s for s in suf if s] or ["[obj]"]))
            item[2] = "regra"
            continue
        if fonte == "alinhamento":
            continue
        if lingua == "G" and morph.startswith("RA"):
            parse = morph.split("-", 1)[1] if "-" in morph else ""
            art = ARTIGO_G.get((parse[4:5], parse[6:7], parse[5:6])) if len(parse) >= 7 else None
            item[1], item[2] = art or "o", "regra"
            continue
        base = None
        for ch in chaves_fallback(toks, lingua, morph):
            if ch in contagem and sum(contagem[ch].values()) >= 3:
                base = pref[ch]
                break
        if base is None:
            base = next((pref[ch] for ch in chaves_fallback(toks, lingua, morph) if ch in pref), None)
        if not base:
            item[1] = glosa  # pode ser só o prefixo
            item[2] = "parcial" if glosa else "sem"
            continue
        if lingua == "G":
            item[1], item[2] = base, "lexico"
            continue
        pre = [PRE_H.get(t, "") for tp, t in toks if tp == "pre"]
        suf = [glosa_regra_suf(t, morph) for tp, t in toks if tp == "suf"]
        partes = [p for p in pre if p] + [base] + [s for s in suf if s]
        item[1], item[2] = contrair("-".join(partes)), "lexico"
    return pref


def nome_proprio(lingua, morph, lema):
    if lingua == "G":
        return morph.startswith("N") and lema[:1].isupper()
    raiz = [x for x in (morph or "")[1:].split("/") if not x.startswith("S")]
    return bool(raiz) and raiz[-1][:2] in ("Np", "Ng")


def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


def _ini(t):
    t = sem_acento(t).lower()
    for a, b in (("ph", "p"), ("f", "p"), ("th", "t"), ("ch", "c"), ("kh", "c"), ("k", "c"), ("q", "c"),
                 ("y", "i"), ("j", "i"), ("h", "")):
        if t.startswith(a):
            t = b + t[len(a):]
    return t[:1]


def parecido(t, alvo):
    """Semelhança entre um nome em português e a transliteração (com bônus se a inicial bate)."""
    r = difflib.SequenceMatcher(None, sem_acento(t).lower(), sem_acento(alvo).lower()).ratio()
    return r + (0.3 if _ini(t) and _ini(t) == _ini(alvo) else 0)


def nome_parecido(alvo, texto):
    """Nome com maiúscula no versículo mais parecido com a transliteração (Thamar → Tamar)."""
    cands = set(re.findall(r"\b[A-ZÀ-Ý][\wÀ-ÿ]+(?:-[A-ZÀ-Ý][\wÀ-ÿ]+)*", texto))
    if not cands or not alvo:
        return None
    # Empate (Sansão e Samuel para Sampson): desempata pela comparação no outro sentido e, por fim, pela ordem
    # alfabética, para o resultado não depender da ordem do set (que muda a cada execução do Python).
    m = max(sorted(cands), key=lambda t: (parecido(t, alvo),
                                          difflib.SequenceMatcher(None, sem_acento(alvo).lower(), sem_acento(t).lower()).ratio()))
    return m if parecido(m, alvo) >= 0.75 else None


GR_LAT = dict(zip("αβγδεζηθικλμνξοπρστυφχψως", ["a", "b", "g", "d", "e", "z", "e", "th", "i", "k", "l", "m", "n", "x", "o", "p", "r", "s", "t", "u", "ph", "ch", "ps", "o", "s"]))


def nome_de_xlit(x):
    x = sem_acento(x or "")
    if any("\u0370" <= c <= "\u03ff" for c in x):
        x = "".join(GR_LAT.get(c.lower(), c) for c in x)
    x = re.sub(r"[\u02b0-\u02ff'’`]", "", x)
    return x[:1].upper() + x[1:] if x else ""


GLOSAS_RARAS = {'I accompany': 'acompanho', 'I am exceedingly abundant': 'transbordo', 'I am with': 'estou com', 'I apportion': 'reparto', 'I change for the worse': 'pioro', 'I embark': 'embarco', 'I encourage': 'encorajo', 'I enter': 'entro', 'I mediate': 'sirvo de mediador', 'I pay': 'pago', 'I rise up against': 'levanto-me contra', 'I rise up together against': 'levantam-se juntos contra', 'I stick fast': 'fico preso', 'I wait': 'espero', 'Susanchites': 'susanquitas', 'Trachonitis': 'Traconites', 'a business': 'negócio', 'a casting': 'fundição', 'a joint of the body': 'junta', 'an enslaver': 'traficante de escravos', 'bad': 'mau', 'bark': 'casca', 'be darkened': 'escurecer', 'be put': 'ser posto', 'belonging to a mill': 'de moinho', 'better': 'melhor', 'bough': 'ramo', 'buy': 'comprar', 'chamber': 'câmara', 'cheerful': 'alegre', 'cloud': 'nuvem', 'compare': 'comparar', 'continually': 'continuamente', 'covert': 'abrigo', 'cry': 'clamor', 'damage': 'dano', 'deceit': 'engano', 'deck': 'enfeitar', 'deity': 'divindade', 'earnestly': 'com insistência', 'excellency': 'excelência', 'fierce': 'feroz', 'fisher': 'pescador', 'gather together': 'ajuntar', 'grief': 'tristeza', 'grieve': 'entristecer', 'habitation': 'morada', 'he': 'ele', 'in better health': 'melhorando', 'incense': 'incenso', 'indescribable': 'indescritível', 'joyous': 'alegre', 'left-handed': 'canhoto', 'living in the sea': 'marinho', 'lower': 'inferior', 'mercy': 'misericórdia', 'natural force': 'vigor', 'near kinswomen': 'parentas próximas', 'noise': 'barulho', 'otherwise': 'de outro modo', 'paternal': 'paterno', 'psaltery': 'saltério', 'purple': 'púrpura', 'put': 'pôr', 'respectful of what is divine': 'reverente', 'roaring': 'rugido', 'ruler': 'governante', 'scrip': 'alforje', 'stamp': 'pisar', 'standing': 'em pé', 'strive': 'lutar', 'subject to a husband': 'submissa ao marido', 'that is spread': 'estendido', 'that ought to be put': 'que se deve pôr', 'threshingfloor': 'eira', 'violence': 'violência', 'ye': 'vós', 'consume': 'consumir', 'child': 'filho', 'ancient': 'antigo', 'damsel': 'moça', 'cake': 'bolo', 'cutting': 'corte', 'kernel': 'semente', 'be an enemy': 'ser inimigo', '?': 'medida', '?': '?', 'Dehavites': 'daavitas', 'I am like': 'sou semelhante', 'I am out of my senses': 'estou fora de mim', 'I anticipate': 'antecipo', 'I bear away together with': 'levo junto', 'I bind around': 'amarro em volta', 'I burn with lust': 'ardo de desejo', 'I buy': 'compro', 'I cause to appear': 'faço aparecer', 'I cleanse': 'purifico', 'I come together with': 'junto-me', 'I compare': 'comparo', 'I cool': 'refresco', 'I crush': 'esmago', 'I drive away': 'expulso', 'I envy': 'invejo', 'I faint': 'desfaleço', 'I fatten': 'engordo', 'I fill completely': 'encho por completo', 'I frighten': 'amedronto', 'I have dealings with': 'tenho trato com', 'I have preeminence': 'tenho a primazia', 'I insult': 'insulto', 'I journey to': 'viajo para', 'I leap upon': 'salto sobre', 'I listen to': 'escuto', 'I resist': 'resisto', 'I roar': 'rujo', 'I rob': 'roubo', 'I roll or gather together': 'enrolo', 'I sail over': 'navego', 'I sink': 'afundo', 'I subject to regulations': 'sujeito a regras', 'I submit to': 'submeto-me', 'I take away': 'tiro', 'I turn': 'volto', 'I wait upon': 'sirvo', 'a captive': 'cativo', 'a festival assembly': 'assembleia festiva', 'a foster brother': 'irmão de criação', 'a freedman': 'liberto', 'a pail': 'balde', 'a reporter': 'relator', 'a state': 'estado', 'afore': 'antes', 'an old man': 'velho', 'angels': 'anjos', 'be meet': 'convir', 'belonging to old women': 'de velhas', 'bind': 'atar', 'break off': 'romper', 'burden': 'carga', 'burn': 'queimar', 'burning': 'queimadura', 'confusion': 'confusão', 'counsellor': 'conselheiro', 'courtiers': 'cortesãos', 'cruel': 'cruel', 'debtor': 'devedor', 'displease': 'desagradar', 'dissonant': 'dissonante', 'endure': 'durar', 'favour': 'favor', 'fellow-elect': 'coeleita', 'flight': 'fuga', 'froward': 'perverso', 'full of astonishment': 'cheio de espanto', 'gain': 'lucro', 'gall': 'fel', 'go': 'ir', 'going down': 'descida', 'gourd': 'cabaça', 'have maintenance': 'ser sustentado', 'help': 'ajuda', 'hunting': 'caça', 'image': 'imagem', 'improvement': 'melhoria', 'in secret': 'em segredo', 'inviolable': 'inviolável', 'island': 'ilha', 'join': 'unir', 'joyfully': 'com alegria', 'light': 'luz', 'living': 'vivo', 'mire': 'lama', 'not yet': 'ainda não', 'offscouring': 'escória', 'on high': 'no alto', 'perfection': 'perfeição', 'poor': 'pobre', 'rage': 'fúria', 'ready': 'pronto', 'recovery of sight': 'recuperação da vista', 'remain': 'ficar', 'roused out of sleep': 'despertado', 'scrapings': 'raspas', 'shout': 'grito', 'shut': 'fechar', 'smote': 'feriu', 'spoil': 'despojo', 'spread': 'estender', 'stay': 'ficar', 'strength': 'força', 'strong': 'forte', 'sun': 'sol', 'swearing by': 'jurando por', 'than': 'que', 'thee': 'a ti', 'think': 'pensar', 'treasurer': 'tesoureiro', 'uncountable': 'incontável', 'under': 'debaixo', 'unseemly': 'indecoroso', 'used': 'usado', 'very compassionate': 'muito compassivo', 'very rainy': 'muito chuvoso', 'waste': 'desolação', 'whom': 'quem', 'work': 'obra', 'lifting up of self': 'exaltação', 'cause': 'causa', 'any': 'algo', 'destruction': 'destruição', 'do secretly': 'fazer em segredo', 'drink offering': 'libação', 'earth': 'terra', 'hat': 'chapéu', 'point out': 'indicar', 'prophesy': 'profetizar', 'reach': 'alcançar', 'seal': 'selo', 'sedition': 'sedição', 'chapiter': 'capitel', 'muffler': 'véu', 'youth': 'juventude', 'clay': 'barro', 'drought': 'seca', 'grave': 'sepultura', 'heart': 'coração', 'sound': 'som', 'very early in the morning': 'de madrugada', 'watching': 'vigília', 'chain': 'corrente', 'shovel': 'pá', 'brier': 'espinheiro', 'fire': 'fogo', 'certain': 'certo', 'cote': 'curral', 'depth': 'profundeza', 'Ethanim': 'Etanim', 'I am in': 'estou em', 'I am in the middle': 'estou no meio', 'I appear': 'apareço', 'I conceal': 'escondo', 'I dissemble with': 'finjo junto', 'I enter secretly': 'entro às escondidas', 'I help': 'ajudo', 'I join closely': 'uno-me estreitamente', 'I overturn': 'derrubo', 'I practice soothsaying': 'pratico adivinhação', 'I receive in my turn': 'recebo em troca', 'I search diligently': 'busco com cuidado', 'I sew on': 'costuro', 'I strike': 'golpeio', 'I throw at in opposition': 'atiro contra', 'a Roman measure': 'medida romana', 'a cause of stumbling': 'tropeço', 'a narrative': 'narrativa', 'a noose or snare': 'laço', 'a particle asking a question': 'acaso', 'a porch': 'pórtico', 'a prayer or prayer for evil': 'imprecação', 'a prison': 'prisão', 'a proof': 'prova', 'a successor': 'sucessor', 'a young bird': 'filhote', 'an apron': 'avental', 'banquet': 'banquete', 'be poured': 'ser derramado', 'bend': 'curvar', 'blemish': 'defeito', 'bodily': 'corporal', 'chariot': 'carro', 'cleanness': 'pureza', 'cleave': 'apegar-se', 'company of horses': 'cavalaria', 'compass': 'rodear', 'confiscation': 'confisco', 'cover with a cloud': 'cobrir de nuvem', 'crave': 'desejar', 'darkness': 'trevas', 'destined to suffer': 'destinado a sofrer', 'disappearing': 'desaparecimento', 'doing of good': 'prática do bem', 'dulcimer': 'saltério', 'evil-mindedness': 'malícia', 'far': 'longe', 'garment': 'veste', 'gather': 'juntar', 'greater': 'maior', 'intent': 'intenção', 'jacinth': 'jacinto', 'knee': 'joelho', 'like': 'como', 'loin': 'lombo', 'mark': 'marca', 'more abundantly': 'mais abundantemente', 'mournfully': 'tristemente', 'naked': 'nu', 'on the second day': 'no segundo dia', 'one': 'um', 'other': 'outro', 'palmer-worm': 'lagarta', 'pursuing': 'perseguição', 'refreshing': 'refrigério', 'righteousness': 'justiça', 'sneeze': 'espirrar', 'solace': 'consolo', 'somewhere': 'em algum lugar', 'spice': 'especiaria', 'stamping': 'pisoteio', 'sup up': 'sorver', 'the proclamation of an appointment': 'proclamação', 'the skin': 'a pele', 'traffic': 'comércio', 'treasure': 'tesouro', 'tribe': 'tribo', 'wailing': 'lamento', 'wheel': 'roda', 'where': 'onde', 'wild ass': 'jumento selvagem', 'window': 'janela', 'winged': 'alado', 'without': 'sem', 'wrath': 'ira', 'yell': 'gritar'}  # inglês → português (palavras raras sem verbete traduzido)


def ajustes_finais(res, contagem, pref, textos, lexico):
    """Correções apontadas pela revisão automática:
    - YHWH: onde a BLIVRE diz "EU SOU", a glosa cortada "SOU" vira "EU-SOU";
    - nomes próprios trocados pelo alinhamento: usa o nome que a BLIVRE dá a essa palavra, se ele está no versículo;
    - palavras sem glosa: significado do léxico em português, nome transliterado ou glosa curta."""
    n = Counter()
    nomes_verso = defaultdict(set)  # nomes (tradução preferida) das palavras de nome próprio de cada versículo
    for item in res:
        r = item[4]
        if nome_proprio(r[4], r[8] or "", r[6] or ""):
            rt = next((t for tp, t in item[3] if tp == "raiz"), None)
            if pref.get(rt):
                nomes_verso[(r[1], r[2], r[3])].add((rt, pref[rt]))
    for item in res:
        pid, glosa, fonte, toks, r, rend = item
        lingua, morph, lema = r[4], r[8] or "", r[6] or ""
        texto = textos.get((r[1], r[2], r[3]), "")
        raiz_tok = next((t for tp, t in toks if tp == "raiz"), None)
        if r[7] == "H3068" and glosa and re.search(r"(^|-)SOU($|-)", glosa) and re.search(r"EU[ -]SOU", texto):
            item[1] = re.sub(r"(^|-)SOU($|-)", r"\1EU-SOU\2", glosa)
            n["YHWH EU-SOU"] += 1
            continue
        if glosa and rend and nome_proprio(lingua, morph, lema):
            # nome no começo da frase perdeu a maiúscula (hendã → Hendã)
            fix = lambda t: t[:1].upper() + t[1:] if len(t) > 2 and t[:1].islower() and re.search(r"(?<!\w)" + re.escape(t[:1].upper() + t[1:]) + r"(?!\w)", texto) else t
            rend = "-".join(fix(t) for t in rend.split("-"))
            glosa = item[1] = "-".join(fix(t) for t in glosa.split("-"))
        capsg = [t for t in (glosa or "").split("-") if t[:1].isupper() and len(t) > 1]
        if glosa and nome_proprio(lingua, morph, lema) and len(capsg) > 1 and \
                not re.search(r"(?<!\w)" + r"[- ]".join(map(re.escape, capsg)) + r"(?!\w)", texto):
            rend = glosa
            # dois nomes colados (Tamar-Perez): fica o mais parecido com a transliteração
            alvo = nome_de_xlit((lexico.get(r[7]) or {}).get("xlit") or lema)
            caps = [t for t in rend.split("-") if t[:1].isupper() and len(t) > 1]
            melhor = max(caps, key=lambda t: parecido(t, alvo))
            item[1] = "-".join(t for t in glosa.split("-") if not (t[:1].isupper() and len(t) > 1) or t == melhor)
            if melhor not in item[1].split("-"):
                item[1] = melhor
            item[2] = "regra"
            n["nome próprio duplo"] += 1
            continue
        if glosa and not rend and nome_proprio(lingua, morph, lema):
            rend = glosa.split("-")[-1]  # glosa pelo léxico: confere o nome também
        if rend and nome_proprio(lingua, morph, lema):
            alvo = nome_de_xlit((lexico.get(r[7]) or {}).get("xlit") or lema)
            caps = [t for t in rend.split("-") if t[:1].isupper()]
            achado = nome_parecido(alvo, texto)
            if caps and achado and achado not in caps and \
                    parecido(achado, alvo) > max(parecido(t, alvo) for t in caps) + 0.2:
                item[1] = "-".join(t for t in glosa.split("-") if not t[:1].isupper()) + ("-" if glosa.split("-")[0][:1].islower() and len(glosa.split("-")) > 1 else "")
                item[1] = (item[1] + achado) if item[1].endswith("-") else achado
                item[2] = "regra"
                n["nome próprio pela transliteração"] += 1
                continue
            nome = pref.get(raiz_tok)
            outros = {nm for rt, nm in nomes_verso[(r[1], r[2], r[3])] if rt != raiz_tok}
            alvo2 = nome_de_xlit((lexico.get(r[7]) or {}).get("xlit") or lema)
            if nome and nome[:1].isupper() and nome.lower() != rend.lower() and \
                    re.search(r"(?<!\w)" + re.escape(nome) + r"(?!\w)", texto) and \
                    any(t in outros for t in rend.split("-")) and nome not in rend.split("-") and \
                    parecido(nome, alvo2) > max(parecido(t, alvo2) for t in rend.split("-")):
                # o nome alinhado é de outra pessoa/lugar: troca só a parte da raiz, mantendo prefixos
                item[1] = glosa.replace(rend, nome) if rend in glosa else nome
                item[2] = "regra"
                n["nome próprio"] += 1
                continue
        if item[2] in ("sem", "parcial") or not item[1]:
            e = lexico.get(r[7]) or {}
            if nome_proprio(lingua, morph, lema):
                base = nome_parecido(nome_de_xlit(e.get("xlit") or lema), texto) or nome_de_xlit(e.get("xlit") or lema)
            elif e.get("pt"):
                base = re.split(r"[;,(]| ou ", e["pt"])[0].strip(" .")
                base = re.sub(r"^(um|uma|o|a) ", "", base).replace(" ", "-")
            else:
                en = re.sub(r"\[[a-z]+\]|[{}]", "", e.get("en") or "")
                en = re.split(r"[;,(]|\. (?:Compare|See)", en)[0].strip(" .")
                base = GLOSAS_RARAS.get(en) or ("[" + (en or "?") + "]")
            pre = [PRE_H.get(t, "") for tp, t in toks if tp == "pre"] if lingua != "G" else []
            item[1] = contrair("-".join([p for p in pre if p] + [base]))
            item[2] = "lexico"
            n["sem glosa → léxico"] += 1
    for item in res:  # "Boaz-Boaz" → "Boaz"
        if item[1] and "-" in item[1]:
            ps = item[1].split("-")
            item[1] = "-".join(p for i, p in enumerate(ps) if i == 0 or p != ps[i - 1])
    return n


def sem_cantilacao(heb):
    """Tira os sinais de cantilação, o meteg e o paseq; mantém vogais e dagesh."""
    return re.sub(r"[\u0591-\u05AF\u05BD\u05C0]", "", unicodedata.normalize("NFD", heb))


def aplicar_manuais(db, res, relatorio=None):
    """Glosas revisadas à mão (Gênesis 1) por forma + morfologia, só dentro de Gn 1."""
    arq = os.path.join(ROOT, "dados", "glosses_pt.tsv")
    if not os.path.exists(arq):
        return 0, 0, 0
    man = {}
    with open(arq, encoding="utf8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            man[(unicodedata.normalize("NFD", row["hebraico"]), row["morfologia"])] = row["glosa"]
    n = iguais = 0
    for item in res:
        r = item[4]
        if r[1] == "GEN" and r[2] == 1:
            g = man.get((sem_cantilacao(r[5]), r[8]))
            if g:
                n += 1
                auto = (item[1] or "").lower().replace(" ", "-")
                if auto == g.lower():
                    iguais += 1
                elif relatorio is not None:
                    relatorio.append((r[3], sem_cantilacao(r[5]), g, item[1], item[2]))
                item[1], item[2] = g, "manual"
    return n, iguais, len(man)


def carregar_lexico(db):
    """Significado curto de cada verbete: português (dados/lexico_pt) ou inglês (Strong/Dodson)."""
    pt = {}
    for arq in glob.glob(os.path.join(ROOT, "dados", "lexico_pt", "*.tsv")):
        with open(arq, encoding="utf8") as f:
            for row in csv.DictReader(f, delimiter="\t"):
                pt[row["chave"]] = row["significado"]
    lex = {}
    for chave, xlit, glosa_en, kjv, def_en, def_pt in db.execute("SELECT chave, xlit, glosa_en, kjv_en, def_en, def_pt FROM lexico"):
        en = glosa_en or (kjv if kjv and re.sub(r"\[[a-z]+\]|[{}().,;\s-]", "", kjv) else None) or def_en
        lex[chave] = {"xlit": xlit, "pt": pt.get(chave) or def_pt, "en": en}
    return lex


def main():
    db = sqlite3.connect(DB)
    db.execute("DROP TABLE IF EXISTS traducoes")
    db.execute("CREATE TABLE traducoes(chave TEXT, traducao TEXT, n INTEGER)")
    total = Counter()
    for test, nome in (("AT", "at"), ("NT", "nt")):
        itens = montar(db, test)
        links = alinhar(itens, nome)
        res, contagem = compor(itens, links)
        pref = completar(res, contagem)
        lexico = carregar_lexico(db)
        textos = {(b, c, v): t or "" for b, c, v, t in db.execute("SELECT livro, cap, vers, blivre FROM versos")}
        print("  ajustes:", dict(ajustes_finais(res, contagem, pref, textos, lexico)))
        if test == "AT":
            difs = []
            n, iguais, _ = aplicar_manuais(db, res, difs)
            if n:
                print(f"  Gênesis 1: {iguais}/{n} glosas automáticas iguais às revisadas ({100 * iguais / n:.0f}%)")
                with open(os.path.join(TMP, "gn1_diferencas.tsv"), "w", encoding="utf8") as f:
                    f.write("vers\thebraico\trevisada\tautomatica\tfonte\n")
                    for d in difs:
                        f.write("\t".join(str(x) for x in d) + "\n")
        db.executemany("UPDATE palavras SET glosa = ?, glosa_fonte = ? WHERE id = ?",
                       [(g, f, pid) for pid, g, f, _, _, _ in res])
        # "como a BLIVRE traduz": por chave de Strong (ou lema grego sem Strong)
        por_chave = defaultdict(Counter)
        tok_chave = {}
        for pid, g, f, toks, r, _ in res:
            raiz_tok = next((t for tp, t in toks if tp == "raiz"), None)
            if raiz_tok:
                tok_chave.setdefault(raiz_tok, r[7] or ("G:" + r[6] if r[4] == "G" else None))
        for tok, c in contagem.items():
            if isinstance(tok, tuple):
                continue
            ch = tok_chave.get(tok)
            if ch:
                for t, n in c.items():
                    por_chave[ch][t.lower()] += n
        db.executemany("INSERT INTO traducoes VALUES (?,?,?)",
                       [(ch, t, n) for ch, c in por_chave.items() for t, n in c.most_common(12)])
        total.update(f for _, _, f, _, _, _ in res)
    db.commit()
    print("glosas por fonte:", dict(total))
    aplicar_correcoes(db)


def _so_letras(t):
    """Forma para comparar: sem cantilação, vogais, acentos, pontuação e barras."""
    t = unicodedata.normalize("NFD", t or "")
    return "".join(c for c in t if unicodedata.category(c)[0] == "L").lower()


def aplicar_correcoes(db):
    """Correções de glosa feitas por revisores (dados/correcoes/glosas.tsv), aplicadas por último.

    Colunas: ref (ex.: "JHN 1:1"), pos (posição da palavra no versículo, contando de 1),
    original (a palavra no original, para conferência; vogais e acentos são ignorados),
    glosa (a nova glosa, palavras unidas por hífen), revisor, nota.
    Se a palavra naquela posição não for a indicada em "original", a linha é ignorada com aviso."""
    arq = os.path.join(ROOT, "dados", "correcoes", "glosas.tsv")
    if not os.path.exists(arq):
        return
    ok = erros = 0
    with open(arq, encoding="utf8") as f:
        linhas = [r for r in csv.DictReader(f, delimiter="\t") if (r.get("ref") or "").strip() and not r["ref"].startswith("#")]
    for n, r in enumerate(linhas, 2):
        m = re.match(r"\s*([1-3A-Z]{3})\s+(\d+):(\d+)\s*$", r["ref"])
        if not m or not (r.get("pos") or "").strip().isdigit() or not (r.get("glosa") or "").strip():
            print(f"  correções, linha {n}: referência, posição ou glosa inválida: {r}")
            erros += 1
            continue
        pals = db.execute("SELECT id, texto FROM palavras WHERE livro=? AND cap=? AND vers=? ORDER BY pos",
                          (m[1], int(m[2]), int(m[3]))).fetchall()
        i = int(r["pos"]) - 1
        if not 0 <= i < len(pals):
            print(f"  correções, linha {n}: {r['ref']} não tem palavra na posição {r['pos']} ({len(pals)} palavras)")
            erros += 1
            continue
        pid, texto = pals[i]
        if (r.get("original") or "").strip() and _so_letras(r["original"]) != _so_letras(texto):
            print(f"  correções, linha {n}: em {r['ref']} posição {r['pos']} está {texto}, não {r['original']}; ignorada")
            erros += 1
            continue
        db.execute("UPDATE palavras SET glosa = ?, glosa_fonte = 'revisada' WHERE id = ?",
                   (r["glosa"].strip().replace(" ", "-"), pid))
        ok += 1
    db.commit()
    print(f"correções de glosa (dados/correcoes/glosas.tsv): {ok} aplicadas, {erros} com problema")
    return erros


if __name__ == "__main__":
    sys.exit(main())
