#!/usr/bin/env python3
"""Exporta o banco (saida/biblia.sqlite) e os textos de dados/ para os arquivos que o app lê.

saida/web/dados/
  livros.json             os 66 livros: nome, abreviação, capítulos (versículos, tema), introdução
  cap/<COD>/<n>.json      um capítulo: versículos, palavras, glosas e marcas da revisão automática
  lex/H.json, lex/G.json  léxico hebraico/aramaico e grego

Formato compacto de cada palavra: [texto, chave Strong, glosa, fonte da glosa, morfologia, lema].
Uso: python3 scripts/exportar.py [--previa ARQ.json COD.CAP ...]  (a prévia junta tudo num JSON só)
"""
import csv
import glob
import json
import os
import re
import sqlite3
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from livros import LIVROS  # noqa: E402
from pronuncia import pron_grego, pron_hebraico  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB = os.path.join(ROOT, "saida", "biblia.sqlite")
OUT = os.path.join(ROOT, "saida", "dados")          # JSON (lido pelo EPUB, PDF e pela página)
WEB = os.path.join(ROOT, "saida", "web", "dados")   # .js carregados pelo site e pelo app
FONTE_CURTA = {"alinhamento": "", "manual": "m", "lexico": "l", "regra": "r", "parcial": "p", "sem": "s"}
GRUPOS = [  # agrupamento dos livros no índice
    ("Pentateuco", "GEN", "DEU"), ("Históricos", "JOS", "EST"), ("Poéticos e sapienciais", "JOB", "SNG"),
    ("Profetas", "ISA", "MAL"), ("Evangelhos e Atos", "MAT", "ACT"), ("Cartas de Paulo", "ROM", "PHM"),
    ("Outras cartas e Apocalipse", "HEB", "REV"),
]


def fmt_int(n):
    return f"{n:,}".replace(",", ".")


def ler_lexico_pt():
    pt = {}
    for arq in sorted(glob.glob(os.path.join(ROOT, "dados", "lexico_pt", "*.tsv"))):
        with open(arq, encoding="utf8") as f:
            for r in csv.DictReader(f, delimiter="\t"):
                pt[r["chave"]] = (r["origem"], r["significado"])
    with open(os.path.join(ROOT, "dados", "lexicon_pt.tsv"), encoding="utf8") as f:  # Gênesis 1, revisado
        for r in csv.DictReader(f, delimiter="\t"):
            pt["H" + r["strong"]] = (r["origem"], r["significado"])
    return pt


def ler_temas(cod):
    arq = os.path.join(ROOT, "dados", "temas", f"{cod}.tsv")
    if not os.path.exists(arq):
        return {}
    with open(arq, encoding="utf8") as f:
        return {int(r["cap"]): r["tema"] for r in csv.DictReader(f, delimiter="\t")}


def ler_marcas():
    arq = os.path.join(ROOT, "saida", "revisao", "marcas.json")
    marcas = defaultdict(list)
    if os.path.exists(arq):
        for m in json.load(open(arq, encoding="utf8")):
            if m["nivel"] in ("erro", "aviso") and not m["codigo"].startswith(("LEX", "LXG", "ARM", "FAT", "CRZ", "COB-02")):
                marcas[(m["livro"], m["cap"])].append(m)
    return marcas


def main(argv):
    db = sqlite3.connect(DB)
    previa = None
    if argv[:1] == ["--previa"]:
        previa = (argv[1], set(argv[2:]))
    lex_pt = ler_lexico_pt()
    # o significado em português também vai para o banco (usado pela revisão automática)
    db.executemany("UPDATE lexico SET def_pt = ? WHERE chave = ?", [(sig, k) for k, (_, sig) in lex_pt.items()])
    db.commit()
    marcas = ler_marcas()

    # ------------------------------------------------ livros
    livros = []
    contagem_v = defaultdict(dict)
    for cod, cap, n in db.execute("SELECT livro, cap, count(*) FROM versos WHERE vers > 0 GROUP BY livro, cap"):
        contagem_v[cod][cap] = n
    grupo_de = {}
    ordem = [l[0] for l in LIVROS]
    for nome, a, b in GRUPOS:
        for c in ordem[ordem.index(a):ordem.index(b) + 1]:
            grupo_de[c] = nome
    for cod, osis, _t, _s, _m, nome, abrev in LIVROS:
        temas = ler_temas(cod)
        caps = [{"n": c, "v": n, "t": temas.get(c, "")} for c, n in sorted(contagem_v[cod].items())]
        about = None
        arq = os.path.join(ROOT, "dados", "livros", f"{cod}.json")
        if os.path.exists(arq):
            about = json.load(open(arq, encoding="utf8"))
            facts = [f for f in about.get("facts", []) if f[0] not in ("Capítulos", "Versículos")]
            facts[1:1] = [["Capítulos", str(len(caps))], ["Versículos", fmt_int(sum(c["v"] for c in caps))]]
            about["facts"] = facts
        livros.append({"cod": cod, "nome": nome, "abrev": abrev, "nt": osis is None, "grupo": grupo_de[cod],
                       "caps": caps, "about": about})

    # ------------------------------------------------ capítulos
    textos = defaultdict(dict)
    for b, c, v, t, ed, nota in db.execute("SELECT livro, cap, vers, blivre, edicao, nota FROM versos"):
        textos[(b, c)][v] = (t, ed, nota)
    palavras = defaultdict(lambda: defaultdict(list))
    uso = Counter()
    for pid, b, c, v, lingua, texto, lema, strong, morph, glosa, fonte, ketiv in db.execute(
            "SELECT id, livro, cap, vers, lingua, texto, lema, strong, morph, glosa, glosa_fonte, ketiv FROM palavras "
            "ORDER BY livro, cap, vers, pos"):
        chave = strong or ("G:" + lema if lingua == "G" else None)
        uso[chave] += 1
        w = [texto, chave, glosa or "", FONTE_CURTA.get(fonte, ""), morph or ""]
        if lingua == "G":
            w.append(lema)
        elif ketiv:
            w += [None, ketiv]  # forma escrita (ketiv); o texto traz a forma lida (qere)
        palavras[(b, c)][v].append((pid, w))

    def capitulo(b, c):
        vs = []
        ids = {}
        for v in sorted(set(textos[(b, c)]) | set(palavras[(b, c)])):
            t, ed, nota = textos[(b, c)].get(v, ("", None, "sem-blivre"))
            ws = palavras[(b, c)].get(v, [])
            for i, (pid, _) in enumerate(ws):
                ids[pid] = (v, i)
            item = {"n": v, "b": t, "w": [w for _, w in ws]}
            if nota:
                item["o"] = nota
            vs.append(item)
        ms = []
        for m in marcas.get((b, c), []):
            pos = ids.get(m.get("palavra_id"))
            ms.append([m["vers"], pos[1] if pos else None, m["nivel"][0], m["codigo"], m["msg"]])
        return {"livro": b, "cap": c, "v": vs, "m": ms}

    # ------------------------------------------------ léxico
    traduz = defaultdict(list)
    for ch, t, n in db.execute("SELECT chave, traducao, n FROM traducoes ORDER BY chave, n DESC"):
        if len(traduz[ch]) < 8:
            traduz[ch].append(f"{t} ({n})")
    lex = {"H": {}, "G": {}}
    for chave, lingua, lema, xlit, pron_en, deriv, defi, kjv, glosa_en, def_pt in db.execute(
            "SELECT chave, lingua, lema, xlit, pron_en, derivacao_en, def_en, kjv_en, glosa_en, def_pt FROM lexico"):
        pt = lex_pt.get(chave)
        pron = pron_hebraico(pron_en) if lingua == "H" and pron_en and chave[1:].isdigit() else (
            pron_en if lingua == "H" else pron_grego(lema or ""))
        e = {"l": lema, "x": xlit, "p": pron, "n": uso.get(chave, 0)}
        if pt:
            e["o"], e["s"] = pt
        elif def_pt:
            e["o"], e["s"] = deriv, def_pt
        else:
            e["oe"], e["se"] = (deriv or "").strip(" ;"), (defi or "").strip(" ;")
            if glosa_en and lingua == "G":
                e["ge"] = glosa_en
        if traduz.get(chave):
            e["t"] = "; ".join(traduz[chave])
        lex[lingua][chave] = e
    # lemas gregos sem Strong
    for chave, n in uso.items():
        if chave and chave.startswith("G:"):
            lema = chave[2:]
            lex["G"][chave] = {"l": lema, "x": "", "p": pron_grego(lema), "n": n,
                               "se": "sem verbete no dicionário de Strong", "t": "; ".join(traduz.get(chave, []))}

    if previa:
        arq, quais = previa
        caps = {}
        usadas = set()
        for ref in sorted(quais):
            b, c = ref.split(".")
            cap = capitulo(b, int(c))
            caps[ref] = cap
            for v in cap["v"]:
                usadas.update(w[1] for w in v["w"] if w[1])
        # verbetes citados na origem dos verbetes usados (para seguir a cadeia de derivação)
        mais = set()
        for k in usadas:
            e = lex["H"].get(k) or lex["G"].get(k) or {}
            mais.update(re.findall(r"[HG]\d+", (e.get("o") or "") + (e.get("oe") or "")))
        todas = usadas | mais
        sub = {k: e for L in lex.values() for k, e in L.items() if k in todas}
        json.dump({"livros": livros, "caps": caps, "lex": sub, "completo": False},
                  open(arq, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
        print(f"prévia: {len(caps)} capítulos, {len(sub)} verbetes → {arq} ({os.path.getsize(arq) // 1024} KB)")
        return

    import shutil
    shutil.rmtree(WEB, ignore_errors=True)
    os.makedirs(os.path.join(OUT, "lex"), exist_ok=True)
    os.makedirs(os.path.join(WEB, "lex"), exist_ok=True)
    json.dump(livros, open(os.path.join(OUT, "livros.json"), "w", encoding="utf8"), ensure_ascii=False,
              separators=(",", ":"))
    for L, d in lex.items():
        json.dump(d, open(os.path.join(OUT, "lex", f"{L}.json"), "w", encoding="utf8"), ensure_ascii=False,
                  separators=(",", ":"))
    # cópias em .js (funcionam abrindo o index.html direto do disco, onde o navegador bloqueia fetch)
    for L, d in lex.items():
        open(os.path.join(WEB, "lex", f"{L}.js"), "w", encoding="utf8").write(
            f"__lex({json.dumps(L)},{json.dumps(d, ensure_ascii=False, separators=(',', ':'))});")
    n = 0
    for (b, c) in sorted(textos):
        os.makedirs(os.path.join(OUT, "cap", b), exist_ok=True)
        os.makedirs(os.path.join(WEB, "cap", b), exist_ok=True)
        cap = json.dumps(capitulo(b, c), ensure_ascii=False, separators=(",", ":"))
        open(os.path.join(OUT, "cap", b, f"{c}.json"), "w", encoding="utf8").write(cap)
        open(os.path.join(WEB, "cap", b, f"{c}.js"), "w", encoding="utf8").write(f"__cap({json.dumps(b + '.' + str(c))},{cap});")
        n += 1
    print(f"{len(livros)} livros, {n} capítulos, léxico H {len(lex['H'])} + G {len(lex['G'])} → {OUT} e {WEB}")


if __name__ == "__main__":
    main(sys.argv[1:])
