#!/usr/bin/env python3
"""Confere os arquivos editados à mão em dados/ antes de um commit (e no GitHub, em cada pull request).

Não precisa do banco: valida formato, colunas, referências e números de capítulos.
Se saida/biblia.sqlite existir, também confere as citações dos versículos-chave e as palavras
indicadas em dados/correcoes/glosas.tsv.

Uso: python3 scripts/verificar_dados.py        (sai com código 1 se houver erro)
"""
import csv
import glob
import json
import os
import re
import sqlite3
import sys
import unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
D = os.path.join(ROOT, "dados")
# capítulos de cada livro, na numeração das Bíblias em português
CAPS = dict(GEN=50, EXO=40, LEV=27, NUM=36, DEU=34, JOS=24, JDG=21, RUT=4, **{"1SA": 31, "2SA": 24, "1KI": 22, "2KI": 25,
            "1CH": 29, "2CH": 36}, EZR=10, NEH=13, EST=10, JOB=42, PSA=150, PRO=31, ECC=12, SNG=8, ISA=66, JER=52, LAM=5,
            EZK=48, DAN=12, HOS=14, JOL=3, AMO=9, OBA=1, JON=4, MIC=7, NAM=3, HAB=3, ZEP=3, HAG=2, ZEC=14, MAL=4,
            MAT=28, MRK=16, LUK=24, JHN=21, ACT=28, ROM=16, **{"1CO": 16, "2CO": 13}, GAL=6, EPH=6, PHP=4, COL=4,
            **{"1TH": 5, "2TH": 3, "1TI": 6, "2TI": 4}, TIT=3, PHM=1, HEB=13, JAS=5, **{"1PE": 5, "2PE": 3, "1JN": 5,
            "2JN": 1, "3JN": 1}, JUD=1, REV=22)
REF = re.compile(r"^([1-3A-Z]{3}) (\d+):(\d+)$")
erros, avisos = [], []


def erro(arq, msg):
    erros.append(f"{os.path.relpath(arq, ROOT)}: {msg}")


def tsv(arq, colunas):
    with open(arq, encoding="utf8", newline="") as f:
        linhas = list(csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE))
    if not linhas or linhas[0][:len(colunas)] != colunas:
        erro(arq, f"cabeçalho deve ser: {' | '.join(colunas)}")
        return []
    out = []
    for n, l in enumerate(linhas[1:], 2):
        if not any(c.strip() for c in l):
            continue
        if len(l) < len(linhas[0]):
            l = l + [""] * (len(linhas[0]) - len(l))  # colunas finais vazias podem faltar
        if len(l) != len(linhas[0]):
            erro(arq, f"linha {n}: {len(l)} colunas (esperado {len(linhas[0])}); tabulação a mais ou a menos?")
            continue
        out.append((n, dict(zip(linhas[0], l))))
    return out


def so_letras(t):
    return "".join(c for c in unicodedata.normalize("NFD", t or "") if unicodedata.category(c)[0] == "L").lower()


# temas dos capítulos
for cod, n in CAPS.items():
    arq = os.path.join(D, "temas", f"{cod}.tsv")
    if not os.path.exists(arq):
        erro(arq, "arquivo faltando")
        continue
    linhas = tsv(arq, ["cap", "tema"])
    caps = [int(r["cap"]) if r["cap"].isdigit() else -1 for _, r in linhas]
    if caps != list(range(1, n + 1)):
        erro(arq, f"os capítulos devem ser 1 a {n}, um por linha, em ordem")
    for ln, r in linhas:
        t = r["tema"].strip()
        if not t or t.endswith(".") or len(t.split()) > 10:
            erro(arq, f"linha {ln}: tema vazio, com ponto final ou longo demais: {t!r}")

# introduções
OBRIG = ["title_orig", "summary", "facts", "structure", "people", "writing", "events", "key_verses"]
intros = {}
for cod in CAPS:
    arq = os.path.join(D, "livros", f"{cod}.json")
    try:
        A = json.load(open(arq, encoding="utf8"))
    except FileNotFoundError:
        erro(arq, "arquivo faltando")
        continue
    except json.JSONDecodeError as e:
        erro(arq, f"JSON inválido: {e}")
        continue
    intros[cod] = A
    for k in OBRIG:
        if not A.get(k):
            erro(arq, f"campo obrigatório vazio: {k}")
    for t in (A.get("events") or {}).get("timeline", []):
        if not isinstance(t.get("from"), int) or not isinstance(t.get("to"), int) or t["from"] > t["to"]:
            erro(arq, f"linha do tempo: anos inválidos em {t.get('label')!r} (inteiros, negativos = a.C., from ≤ to)")
    for s in A.get("structure", []):
        for k in ("from", "to"):
            if s.get(k) and not 1 <= s[k] <= CAPS[cod]:
                erro(arq, f"estrutura: capítulo {s[k]} fora do livro em {s.get('title')!r}")
    for k in A.get("key_verses", []):
        if not re.match(r"^\d+:\d+([–-]\d+)?$", k.get("ref", "")):
            erro(arq, f"versículo-chave com referência fora do formato 3:14 ou 3:14–16: {k.get('ref')!r}")

# léxico em português
vistos = {}
for arq in sorted(glob.glob(os.path.join(D, "lexico_pt", "*.tsv"))):
    for ln, r in tsv(arq, ["chave", "origem", "significado"]):
        k = r["chave"]
        if not re.match(r"^[HG]\d+$", k):
            erro(arq, f"linha {ln}: chave inválida {k!r} (ex.: H430, G2316)")
        if k in vistos:
            erro(arq, f"linha {ln}: {k} repetido (também em {vistos[k]})")
        vistos[k] = os.path.basename(arq)
        if not r["significado"].strip():
            erro(arq, f"linha {ln}: {k} sem significado")

# correções de glosa
arq_g = os.path.join(D, "correcoes", "glosas.tsv")
correcoes = []
if os.path.exists(arq_g):
    for ln, r in tsv(arq_g, ["ref", "pos", "original", "glosa", "revisor", "nota"]):
        m = REF.match(r["ref"].strip())
        if not m or m[1] not in CAPS or not 1 <= int(m[2]) <= CAPS[m[1]]:
            erro(arq_g, f"linha {ln}: referência inválida {r['ref']!r} (ex.: JHN 1:1)")
            continue
        if not r["pos"].isdigit() or int(r["pos"]) < 1:
            erro(arq_g, f"linha {ln}: posição deve ser um número a partir de 1")
            continue
        g = r["glosa"].strip()
        if not g or " " in g:
            erro(arq_g, f"linha {ln}: glosa vazia ou com espaço (use hífen: junto-de)")
        if not r["original"].strip():
            avisos.append(f"dados/correcoes/glosas.tsv: linha {ln}: sem a palavra original, a conferência não é feita")
        correcoes.append((ln, m, r))

# erratas da BLIVRE
arq_b = os.path.join(D, "correcoes", "blivre.tsv")
if os.path.exists(arq_b):
    for ln, r in tsv(arq_b, ["ref", "trecho", "sugestao", "status", "nota"]):
        m = REF.match(r["ref"].strip())
        if not m or m[1] not in CAPS:
            erro(arq_b, f"linha {ln}: referência inválida {r['ref']!r}")
        if r["status"] not in ("relatar", "relatado", "corrigido-na-fonte"):
            erro(arq_b, f"linha {ln}: status deve ser relatar, relatado ou corrigido-na-fonte")

# conferências que precisam do banco
DB = os.path.join(ROOT, "saida", "biblia.sqlite")
if os.path.exists(DB):
    db = sqlite3.connect(DB)
    for ln, m, r in correcoes:
        pals = db.execute("SELECT texto FROM palavras WHERE livro=? AND cap=? AND vers=? ORDER BY pos",
                          (m[1], int(m[2]), int(m[3]))).fetchall()
        i = int(r["pos"]) - 1
        if not 0 <= i < len(pals):
            erro(arq_g, f"linha {ln}: {r['ref']} tem {len(pals)} palavras; não há a posição {r['pos']}")
        elif r["original"].strip() and so_letras(r["original"]) != so_letras(pals[i][0]):
            erro(arq_g, f"linha {ln}: em {r['ref']} a palavra {r['pos']} é {pals[i][0]}, não {r['original']}")
    for cod, A in intros.items():
        for k in A.get("key_verses", []):
            mm = re.match(r"^(\d+):(\d+)(?:[–-](\d+))?$", k.get("ref", ""))
            if not mm:
                continue
            c, a, b = int(mm[1]), int(mm[2]), int(mm[3] or mm[2])
            txt = " ".join(t for (t,) in db.execute("SELECT blivre FROM versos WHERE livro=? AND cap=? AND vers BETWEEN ? AND ? "
                                                     "ORDER BY vers", (cod, c, a, b)))
            if " ".join(k.get("text", "").split()) not in " ".join(txt.split()):
                avisos.append(f"dados/livros/{cod}.json: versículo-chave {k['ref']} não confere com a BLIVRE")
    if os.path.exists(arq_b):
        for ln, r in tsv(arq_b, ["ref", "trecho", "sugestao", "status", "nota"]):
            m = REF.match(r["ref"].strip())
            if m and r["status"] == "relatar":
                t = db.execute("SELECT blivre FROM versos WHERE livro=? AND cap=? AND vers=?",
                               (m[1], int(m[2]), int(m[3]))).fetchone()
                if t and r["trecho"].strip() and r["trecho"].strip() not in t[0]:
                    avisos.append(f"dados/correcoes/blivre.tsv: linha {ln}: {r['trecho']!r} não aparece em {r['ref']}")
else:
    avisos.append("saida/biblia.sqlite não existe: conferências contra o texto foram puladas")

for a in avisos:
    print("aviso:", a)
for e in erros:
    print("ERRO:", e)
print(f"{len(erros)} erro(s), {len(avisos)} aviso(s)")
sys.exit(1 if erros else 0)
