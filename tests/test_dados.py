"""Testes dos dados: banco (saida/biblia.sqlite) e exportação (saida/dados)."""
import json
import os
import re
import subprocess
import sys

import pytest

from conftest import ROOT, DADOS, capitulo

sys.path.insert(0, os.path.dirname(__file__))
import retrato  # noqa: E402


# ---------- contagens ----------

def test_66_livros_1189_capitulos(livros):
    assert len(livros) == 66
    assert sum(1 for b in livros if not b["nt"]) == 39
    assert sum(len(b["caps"]) for b in livros) == 1189


def test_versiculos_e_palavras(db):
    assert db.execute("SELECT count(*) FROM versos").fetchone()[0] == 31166
    assert db.execute("SELECT count(*) FROM palavras").fetchone()[0] == 443123


def test_toda_palavra_tem_glosa(db):
    sem = db.execute("SELECT livro, cap, vers, pos, texto FROM palavras WHERE glosa IS NULL OR trim(glosa) = ''").fetchall()
    assert not sem, f"{len(sem)} palavras sem glosa, por exemplo {sem[:5]}"


def test_todo_versiculo_tem_blivre(db):
    sem = db.execute("SELECT livro, cap, vers FROM versos WHERE blivre IS NULL OR trim(blivre) = ''").fetchall()
    assert not sem, f"versículos sem texto da BLIVRE: {sem[:5]}"


def test_exportacao_completa(livros, capitulos):
    for b in livros:
        for c in b["caps"]:
            d = capitulos[(b["cod"], c["n"])]
            assert d["livro"] == b["cod"] and d["cap"] == c["n"]
            assert d["v"], f"{b['cod']} {c['n']} sem versículos"
            for v in d["v"]:
                for w in v["w"]:
                    assert w[2].strip(), f"{b['cod']} {c['n']}:{v['n']} {w[0]} sem glosa na exportação"


# ---------- léxico, temas e introduções ----------

# Lemas gregos do texto crítico que não existem no dicionário de Strong (limitação conhecida, ver README).
LEMAS_SEM_STRONG_MAX = 90


def test_todo_strong_tem_verbete(capitulos, lexico):
    faltam = set()
    for d in capitulos.values():
        for v in d["v"]:
            for w in v["w"]:
                e = lexico.get(w[1])
                if not e or not (e.get("s") or "").strip():
                    faltam.add(w[1])
    numerados = sorted(s for s in faltam if not s.startswith("G:"))
    assert not numerados, f"números Strong sem verbete em português: {numerados[:10]}"
    assert len(faltam) <= LEMAS_SEM_STRONG_MAX, f"{len(faltam)} lemas sem significado (máximo {LEMAS_SEM_STRONG_MAX})"


def test_verbete_tem_pronuncia_e_transliteracao(lexico):
    ruins = [k for k, e in lexico.items() if not k.startswith("G:") and (not e.get("x") or not e.get("p"))]
    assert not ruins, f"verbetes sem transliteração ou pronúncia: {ruins[:10]}"


def test_todo_capitulo_tem_tema(livros):
    sem = [f"{b['cod']} {c['n']}" for b in livros for c in b["caps"] if not (c.get("t") or "").strip()]
    assert not sem, f"capítulos sem tema: {sem[:10]}"


def test_todo_livro_tem_introducao(livros):
    sem = [b["cod"] for b in livros if not b.get("about")]
    assert not sem, f"livros sem introdução (Sobre o livro): {sem}"


# ---------- versículos-chave ----------

def glosas(cod, cap, vers):
    return [w[2] for v in capitulo(cod, cap)["v"] if v["n"] == vers for w in v["w"]]


def test_genesis_1_1():
    assert glosas("GEN", 1, 1) == ["no-princípio", "criou", "Deus", "[obj]", "os-céus", "e-[obj]", "a-terra"]


def test_genesis_1_revisado_a_mao(db):
    n = db.execute("SELECT count(*) FROM palavras WHERE livro='GEN' AND cap=1 AND glosa_fonte='manual'").fetchone()[0]
    assert n == 434


def test_correcoes_de_glosa_aplicadas(db):
    """Cada linha de dados/correcoes/glosas.tsv tem de estar no banco com glosa_fonte = revisada."""
    import csv
    arq = os.path.join(ROOT, "dados", "correcoes", "glosas.tsv")
    for r in csv.DictReader(open(arq, encoding="utf8"), delimiter="\t"):
        if not r["ref"].strip() or r["ref"].startswith("#"):
            continue
        m = re.match(r"([1-3A-Z]{3}) (\d+):(\d+)", r["ref"])
        pals = db.execute("SELECT glosa, glosa_fonte FROM palavras WHERE livro=? AND cap=? AND vers=? ORDER BY pos",
                          (m[1], int(m[2]), int(m[3]))).fetchall()
        glosa, fonte = pals[int(r["pos"]) - 1]
        assert (glosa, fonte) == (r["glosa"].replace(" ", "-"), "revisada"), r["ref"]


def test_joao_1_1_correcoes():
    g = glosas("JHN", 1, 1)
    assert g[9] == "junto-de" and g[10] == "—"


def test_yhwh_eu_sou(db):
    """YHWH glosado “EU-SOU” só onde a BLIVRE usa essa forma (Êx 6:3 é um exemplo)."""
    n = db.execute("SELECT count(*) FROM palavras WHERE strong='H3068' AND glosa LIKE '%EU-SOU%'").fetchone()[0]
    assert 1 <= n <= 60
    assert db.execute("SELECT glosa FROM palavras WHERE livro='EXO' AND cap=6 AND vers=3 AND strong='H3068'").fetchone()[0] == "EU-SOU"
    assert db.execute("SELECT count(*) FROM palavras WHERE strong='H3068' AND glosa LIKE '%SENHOR%'").fetchone()[0] > 6000


def test_romanos_16_25_27():
    vs = {v["n"]: v for v in capitulo("ROM", 16)["v"]}
    for n in (25, 26, 27):
        assert vs[n]["w"], f"Rm 16:{n} sem o texto grego"


def test_ketiv_qere(db):
    n = db.execute("SELECT count(*) FROM palavras WHERE ketiv IS NOT NULL AND ketiv <> ''").fetchone()[0]
    assert 1200 <= n <= 1300


def test_sinais_do_aparato_fora_do_grego(db):
    ruins = db.execute("SELECT count(*) FROM palavras WHERE lingua='G' AND (texto GLOB '*[⸀⸁⸂⸃⸄⸅]*')").fetchone()[0]
    assert ruins == 0


# ---------- retrato de referência ----------

def test_retrato(db):
    ref = json.load(open(retrato.ARQ, encoding="utf8"))
    atual = retrato.calcular()
    mudaram = sorted(l for l in set(ref["livros"]) | set(atual["livros"]) if ref["livros"].get(l) != atual["livros"].get(l))
    assert not mudaram and ref["palavras"] == atual["palavras"], (
        f"As glosas mudaram em: {', '.join(mudaram)}. Se foi de propósito, rode "
        "`python3 tests/retrato.py --atualizar` e envie o tests/retrato.json junto.")


# ---------- verificação dos arquivos de dados ----------

def test_verificar_dados():
    r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "verificar_dados.py")], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout[-2000:] + r.stderr[-2000:]
