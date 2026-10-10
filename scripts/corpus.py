#!/usr/bin/env python3
"""Monta o corpus da Bíblia inteira num banco SQLite (saida/biblia.sqlite).

- BLIVRE versículo a versículo, na numeração das Bíblias em português:
  edição 2018 (eBible, CC BY 4.0) como base; versículos que faltam nela (onde a
  numeração hebraica difere) e títulos dos Salmos vêm da edição 2017 (CrossWire,
  CC BY 3.0 BR), mesmos autores.
- Hebraico e aramaico (Open Scriptures, morphhb, CC BY 4.0) com o mapa oficial
  de versificação hebraico → KJV (VerseMap.xml); títulos dos Salmos viram o versículo 0.
- Grego: SBLGNT (CC BY 4.0) com morfologia e lemas do MorphGNT (CC BY-SA).
- Léxicos de Strong (domínio público; edição digital Open Scriptures, CC BY-SA).

Uso: python3 scripts/corpus.py
"""
import csv
import difflib
import json
import os
import re
import sqlite3
import sys
import unicodedata
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from livros import LIVROS, POR_CODIGO, AT  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FD = os.path.join(ROOT, "fontes-dados")
DB = os.path.join(ROOT, "saida", "biblia.sqlite")


def strip_marks(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


def norm_greek(s):
    return strip_marks(s).lower().replace("ς", "σ")


# ---------------------------------------------------------------- BLIVRE
def carregar_blivre():
    vref = open(os.path.join(FD, "ebible/metadata/vref.txt"), encoding="utf8").read().split("\n")
    corp = open(os.path.join(FD, "ebible/corpus/por-porbr2018.txt"), encoding="utf8").read().split("\n")
    e18 = {}
    for ref, txt in zip(vref, corp):
        if ref and txt.strip():
            b, cv = ref.split(" ")
            c, v = cv.split(":")
            e18[(b, int(c), int(v))] = txt.strip()
    sm_nome = {l[3]: l[0] for l in LIVROS}
    e17 = {}
    with open(os.path.join(FD, "scrollmapper/PorBLivre.csv"), encoding="utf8") as f:
        for b, c, v, t in list(csv.reader(f))[1:]:
            e17[(sm_nome[b], int(c), int(v))] = t.strip()
    versos = {}
    for k in set(e17) | set(e18):
        t17 = e17.get(k, "")
        t18 = e18.get(k, "")
        vazio17 = t17.strip() in ("", "—", "-")
        if k[0] in AT:
            # AT: revisão de 2018; a de 2017 cobre os versículos que a 2018 perdeu na conversão
            if t18:
                versos[k] = (t18, "2018")
            elif not vazio17:
                versos[k] = (t17, "2017")
        else:
            # NT: a edição 2017 traduz o texto crítico (o mesmo do SBLGNT);
            # a 2018 segue o Textus Receptus e só entra onde a 2017 deixa o versículo vazio
            if not vazio17:
                versos[k] = (t17, "2017")
            elif t18:
                versos[k] = (t18, "2018")
    return versos, e17, e18


def titulo_salmo(t17, t18):
    """Na edição 2017 o título do salmo vem no começo do v. 1; a 2018 traz só o versículo.
    Devolve (título limpo, trecho original com a pontuação) ou (None, None)."""
    if not t17 or not t18 or t17 == t18:
        return None, None
    sm = difflib.SequenceMatcher(None, t17, t18, autojunk=False)
    blocos = [b for b in sm.get_matching_blocks() if b.size > 12]
    if not blocos:
        return None, None
    ini = blocos[0].a - blocos[0].b  # onde o texto da 2018 começa dentro da 2017
    if ini <= 3:
        return None, None
    limpo = t17[:ini].strip().rstrip(":;,. ").strip()
    return (limpo or None), t17[:ini]


# ---------------------------------------------------------------- hebraico
def carregar_versemap():
    """Mapa versículo hebraico → versículo na numeração das traduções (só versículos inteiros).
    Os 7 casos em que um versículo hebraico se divide entre dois ficam em DIVISOES."""
    x = open(os.path.join(FD, "morphhb/wlc/VerseMap.xml"), encoding="utf8").read()
    m = {}
    for wlc, kjv, tipo in re.findall(r'<verse wlc="([^"]+)" kjv="([^"]+)" type="([^"]+)"', x):
        if tipo == "full" and "!" not in wlc and "!" not in kjv:
            m[wlc] = kjv
    return m


# Versículos hebraicos divididos entre dois versículos da tradução:
# (quantas palavras vão para o primeiro, primeiro destino, segundo destino).
# Pontos de divisão conferidos com a TAHOT (STEPBible, CC BY 4.0) e com o VerseMap.xml.
DIVISOES = {
    # 1Rs 18:34 e 22:21: a BLIVRE segue a divisão hebraica (não a da KJV); 20:3: só "e disse-lhe" fica no v. 2
    "1Kgs.18.34": (99, "1Kgs.18.34", "1Kgs.18.34"),
    "1Kgs.20.3": (2, "1Kgs.20.2", "1Kgs.20.3"),
    "1Kgs.22.44": (99, "1Kgs.22.43", "1Kgs.22.43"),
    "Isa.63.19": (9, "Isa.63.19", "Isa.64.1"),
    "Ps.13.6": (6, "Ps.13.5", "Ps.13.6"),
}


def _cv(ref):
    _, c, v = ref.split(".")
    return int(c), int(v)


def ler_hebraico(osis, vm):
    x = open(os.path.join(FD, f"morphhb/wlc/{osis}.xml"), encoding="utf8").read()
    # ketiv/qere: no texto fica a leitura (qere), com vogais; a forma escrita (ketiv) vai num atributo
    def troca(m):
        ketiv = " ".join(re.sub(r"<[^>]+>", "", k) for k in re.findall(r"<w [^>]*>[^<]*</w>", m.group(1)))
        return re.sub(r"<w ", f'<w ketiv="{ketiv}" ', m.group(2), count=1)
    x = re.sub(r'((?:<w type="x-ketiv"[^>]*>[^<]*</w>\s*(?:<seg[^>]*>[^<]*</seg>)?\s*)+)'
               r'(?:<note type="exegesis">(?:(?!</note>).)*</note>\s*)?<note type="variant">\s*'
               r'<catchWord>[^<]*</catchWord>\s*<rdg type="x-qere">(.*?)</rdg>\s*</note>', troca, x, flags=re.S)
    x = re.sub(r"<note\b.*?</note>", "", x, flags=re.S)  # demais notas fora do texto
    capitulos_mapeados = defaultdict(bool)
    for wlc in list(vm) + list(DIVISOES):
        b, c, _ = wlc.split(".")
        if b == osis:
            capitulos_mapeados[int(c)] = True
    for vid, corpo in re.findall(r'<verse osisID="([^"]+)">(.*?)</verse>', x, re.S):
        _, hc, hv = vid.split(".")
        hc, hv = int(hc), int(hv)
        palavras = []
        for attrs, txt in re.findall(r"<w ([^>]*)>(.*?)</w>", corpo):
            a = dict(re.findall(r'(\w+)="([^"]*)"', attrs))
            palavras.append({"txt": re.sub(r"<[^>]+>", "", txt), "lemma": a.get("lemma", ""),
                             "morph": a.get("morph", ""), "id": a.get("id", ""), "ketiv": a.get("ketiv")})
        if vid in DIVISOES:
            n, r1, r2 = DIVISOES[vid]
            yield (hc, hv), _cv(r1), palavras[:n], 0
            if palavras[n:]:
                yield (hc, hv), _cv(r2), palavras[n:], n
            continue
        prox = f"{osis}.{hc}.{hv + 1}"
        if vid in vm and osis == "Ps" and vm.get(prox) == vm[vid]:
            ec, ev = hc, 0  # título longo dos Salmos (51, 52, 54, 60): ocupa dois versículos hebraicos
        elif vid in vm:
            ec, ev = _cv(vm[vid])
        elif osis == "Ps" and capitulos_mapeados[hc]:
            ec, ev = hc, 0  # título do salmo (sem número na tradução)
        else:
            ec, ev = hc, hv
        yield (hc, hv), (ec, ev), palavras, 0


# Partículas inseparáveis do hebraico (o morphhb as marca por letra; Strong não lhes dá número).
# Palavras como לָהֶם ("a eles") têm só a partícula como lema.
PARTICULAS_H = {
    "b": ("בְּ", "be", "em, com, por", "in, with, by"),
    "c": ("וְ", "ve", "e, então, mas", "and, then, but"),
    "d": ("הַ", "ha", "o, a (artigo definido)", "the (definite article)"),
    "i": ("הֲ", "ha", "partícula interrogativa (acaso…?)", "interrogative particle"),
    "k": ("כְּ", "ke", "como, conforme", "like, as, according to"),
    "l": ("לְ", "le", "a, para, de (posse)", "to, for, of"),
    "m": ("מִן", "min", "de, desde, mais que", "from, out of, than"),
    "s": ("שֶׁ", "she", "que, o qual", "that, which, who"),
}


def raiz_strong(lemma):
    partes = lemma.split("/")
    raiz = partes[-1].strip()
    num = re.match(r"(\d+)", raiz)
    prefixos = [p for p in partes[:-1]]
    if num:
        return "H" + num.group(1), prefixos
    if raiz == "m":
        return "H4480", prefixos
    if raiz in PARTICULAS_H:
        return "H" + raiz, prefixos
    return None, prefixos


# ---------------------------------------------------------------- grego
# Versículos do SBLGNT numerados de outro jeito nas Bíblias em português:
# (livro, cap, vers) → (palavras que ficam no 1º destino, 1º destino, 2º destino)
DIVISOES_G = {
    ("2CO", 13, 12): (5, (13, 12), (13, 13)),
    ("2CO", 13, 13): (99, (13, 14), None),
    ("ACT", 19, 40): (21, (19, 40), (19, 41)),
    ("3JN", 1, 15): (99, (1, 14), None),
}


def ler_grego(arq):
    linhas = list(open(os.path.join(FD, f"sblgnt/{arq}-morphgnt.txt"), encoding="utf8"))
    sup = os.path.join(ROOT, "dados", f"grego_suplemento_{arq}.txt")
    if os.path.exists(sup):  # trechos que o SBLGNT põe só no aparato (ex.: Rm 16:25–27)
        linhas += [l for l in open(sup, encoding="utf8") if l.strip() and not l.startswith("#")]
    for linha in linhas:
        ref, pos, parse, texto, palavra, normal, lema = linha.rstrip("\n").split(" ")
        c, v = int(ref[2:4]), int(ref[4:6])
        texto = re.sub(r"[\u2E00-\u2E05\u27E6\u27E7]|(?<=[\u2E00-\u2E05])\d+", "", texto)
        yield (c, v), {"txt": texto, "palavra": palavra, "normal": normal, "lemma": lema, "pos": pos, "parse": parse}


def carregar_dodson():
    """Léxico grego de Jeffrey Dodson (domínio público): lema → número de Strong e glosa curta."""
    x = open(os.path.join(FD, "dodson/dodson.xml"), encoding="utf8").read()
    por_lema, glosa = {}, {}
    for lema, num, corpo in re.findall(r'<entry n="([^"|]+) \| (\d+)">(.*?)</entry>', x, re.S):
        k = "G" + str(int(num))
        lema = unicodedata.normalize("NFC", lema.strip())
        por_lema.setdefault(lema, k)
        g = re.search(r'<def role="brief">(.*?)</def>', corpo, re.S)
        if g:
            glosa.setdefault(k, re.sub(r"\s+", " ", g.group(1)).strip())
    return por_lema, glosa


# Lemas do SBLGNT cuja grafia não bate com nenhum verbete de Strong/Dodson (conferidos à mão).
G_MANUAL = {
    "πίμπλημι": "G4130", "ἐμπίμπλημι": "G1705", "γαμίζω": "G1061", "ἔπειμι": "G1966",
    "στεῖρα": "G4723", "λεγιών": "G3003", "Ναζαρά": "G3478", "λεμά": "G2982", "προσαίτης": "G4319",
    "ἀνάγαιον": "G508", "ἐφοράω": "G1896", "δεκαοκτώ": "G1176", "πλοῦς": "G4144", "ὀψία": "G3798",
    "διαρρήγνυμι": "G1284", "Ἰσκαριώθ": "G2469", "Βόες": "G1003", "κρυφαῖος": "G2927", "ψίξ": "G5589",
    "ἔνθεν": "G1782", "ἐχθές": "G5504", "μήγε": "G3361", "Μωϋσῆς": "G3475", "Μαριάμ": "G3137",
    "τεσσεράκοντα": "G5062", "Καφαρναούμ": "G2584", "ἀφίσταμαι": "G868", "Σαμαρίτης": "G4541",
    "ἕλκω": "G1670", "Ἰωβήδ": "G5601", "ἀλλαχοῦ": "G237", "δύσις": "G1424", "κόπριον": "G2874",
    "διόρθωμα": "G2735", "κημόω": "G5392", "ἐγκαυχάομαι": "G2744", "στάδιος": "G4712", "ἐγκακέω": "G1573", "ἐραυνάω": "G2045", "Μαθθαῖος": "G3156",
}


def variantes_gregas(lema):
    lema = unicodedata.normalize("NFC", lema)
    out = [lema]
    m = re.match(r"^(.*)\((.+)\)$", lema)  # οὕτω(ς), ἔξεστι(ν)
    if m:
        out += [m.group(1) + m.group(2), m.group(1)]
    for b in list(out):
        for a, c in [("άομαι", "άω"), ("έομαι", "έω"), ("όομαι", "όω"), ("ομαι", "ω"), ("υμι", "ύω"),
                     ("άω", "έω"), ("έω", "άω"), ("μαι", "μι")]:
            if b.endswith(a):
                out.append(b[:-len(a)] + c)
    return out


def mapear_grego(lemas, strong_g, dodson):
    """Devolve {lema: (chave Strong, como foi achada)}; 'aprox' marca correspondências por semelhança."""
    dods = {}
    for k, v in dodson.items():
        dods.setdefault(norm_greek(k), v)
    sgs = {}
    for k, e in strong_g.items():
        sgs.setdefault(norm_greek(e.get("lemma", "")), k)
    todos = {**sgs, **dods}
    chaves = list(todos)
    res = {}
    for lema in lemas:
        if lema in G_MANUAL:
            res[lema] = (G_MANUAL[lema], "manual")
            continue
        achado = None
        for v in variantes_gregas(lema):
            achado = dodson.get(v) or dods.get(norm_greek(v)) or sgs.get(norm_greek(v))
            if achado:
                res[lema] = (achado, "lema")
                break
        if achado:
            continue
        n = norm_greek(lema)
        m = difflib.get_close_matches(n, chaves, n=1, cutoff=0.82)
        if m and m[0][0] == n[0] and abs(len(m[0]) - len(n)) <= 3:
            res[lema] = (todos[m[0]], "aprox")
        else:
            res[lema] = (None, None)
    return res


def carregar_strong(arq):
    js = open(os.path.join(FD, f"strongs/{arq}"), encoding="utf8").read()
    return json.loads(js[js.index("{"):js.rindex("}") + 1])


# ---------------------------------------------------------------- banco
def main():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    if os.path.exists(DB):
        os.remove(DB)
    db = sqlite3.connect(DB)
    db.executescript("""
    CREATE TABLE livros(ordem INTEGER PRIMARY KEY, codigo TEXT UNIQUE, nome TEXT, abrev TEXT, testamento TEXT, lingua TEXT);
    CREATE TABLE versos(livro TEXT, cap INTEGER, vers INTEGER, blivre TEXT, edicao TEXT, nota TEXT,
                        PRIMARY KEY(livro, cap, vers));
    CREATE TABLE palavras(id INTEGER PRIMARY KEY, livro TEXT, cap INTEGER, vers INTEGER, pos INTEGER,
                          lingua TEXT, texto TEXT, lema TEXT, strong TEXT, prefixos TEXT, morph TEXT,
                          ref_orig TEXT, glosa TEXT, glosa_fonte TEXT, strong_fonte TEXT,
                          ketiv TEXT);
    CREATE INDEX ix_pal ON palavras(livro, cap, vers, pos);
    CREATE TABLE lexico(chave TEXT PRIMARY KEY, lingua TEXT, lema TEXT, xlit TEXT, pron_en TEXT,
                        derivacao_en TEXT, def_en TEXT, kjv_en TEXT, glosa_en TEXT, def_pt TEXT);
    """)
    versos, e17, e18 = carregar_blivre()

    vm = carregar_versemap()
    strong_h = carregar_strong("hebrew/strongs-hebrew-dictionary.js")
    strong_g = carregar_strong("greek/strongs-greek-dictionary.js")
    dodson, dodson_glosa = carregar_dodson()
    lemas_g = set()
    for l in LIVROS:
        if l[4]:
            lemas_g.update(p["lemma"] for _, p in ler_grego(l[4]))
    g_map = mapear_grego(lemas_g, strong_g, dodson)

    rows = []
    sem_texto_orig = Counter()
    for ordem, (cod, osis, _tahot, _sm, mgnt, nome, abrev) in enumerate(LIVROS, 1):
        test = "AT" if cod in AT else "NT"
        lingua = "hebraico" if test == "AT" else "grego"
        db.execute("INSERT INTO livros VALUES (?,?,?,?,?,?)", (ordem, cod, nome, abrev, test, lingua))
        if osis:
            for (hc, hv), (ec, ev), pals, desloc in ler_hebraico(osis, vm):
                for i, p in enumerate(pals, desloc + 1):
                    strong, pref = raiz_strong(p["lemma"])
                    lang = "A" if p["morph"].startswith("A") else "H"
                    rows.append((cod, ec, ev, None, lang, p["txt"], p["lemma"], strong,
                                 "/".join(pref), p["morph"], f"{hc}:{hv}.{i}", None, None, None, p["ketiv"]))
        else:
            n_g = Counter()
            for (c, v), p in ler_grego(mgnt):
                chave, como = g_map[p["lemma"]]
                morph = p["pos"].replace("-", "") + "-" + p["parse"]
                n_g[(c, v)] += 1
                i = n_g[(c, v)]
                ec, ev = c, v
                if (cod, c, v) in DIVISOES_G:
                    n, d1, d2 = DIVISOES_G[(cod, c, v)]
                    ec, ev = d1 if i <= n else d2
                rows.append((cod, ec, ev, None, "G", p["txt"], p["lemma"], chave, "", morph,
                             f"{c}:{v}.{i}", None, None, como, p.get("fonte")))
    # posição da palavra dentro do versículo de exibição (ordem de leitura)
    pos = Counter()
    final = []
    for r in rows:
        k = (r[0], r[1], r[2])
        pos[k] += 1
        final.append(r[:3] + (pos[k],) + r[4:])
    db.executemany("""INSERT INTO palavras(livro,cap,vers,pos,lingua,texto,lema,strong,prefixos,morph,ref_orig,
                      glosa,glosa_fonte,strong_fonte,ketiv) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", final)

    # títulos dos Salmos: versículo 0 quando o hebraico os numera à parte;
    # quando o título está dentro do v. 1 hebraico, ele volta para o começo do v. 1
    com_titulo = {r[1] for r in final if r[0] == "PSA" and r[2] == 0}
    for c in range(1, 151):
        t18 = e18.get(("PSA", c, 1))
        limpo, bruto = titulo_salmo(e17.get(("PSA", c, 1)), t18)
        if not limpo:
            continue
        if c in com_titulo:
            versos[("PSA", c, 0)] = (limpo, "2017")
        else:
            versos[("PSA", c, 1)] = (bruto.rstrip() + " " + t18, "2017+2018")

    # versículos: BLIVRE + nota quando não há texto original correspondente
    com_orig = {(r[0], r[1], r[2]) for r in final}
    for (b, c, v), (t, ed) in sorted(versos.items(), key=lambda kv: (list(POR_CODIGO).index(kv[0][0]), kv[0][1], kv[0][2])):
        nota = "aparato" if (b, c, v) in {("ROM", 16, 25), ("ROM", 16, 26), ("ROM", 16, 27)} else None
        if (b, c, v) not in com_orig:
            nota = "sem-original"
            sem_texto_orig[b] += 1
        db.execute("INSERT INTO versos VALUES (?,?,?,?,?,?)", (b, c, v, t, ed, nota))
    # versículos com texto original e sem BLIVRE
    sem_blivre = sorted(k for k in com_orig if k not in versos)
    for b, c, v in sem_blivre:
        db.execute("INSERT INTO versos VALUES (?,?,?,?,?,?)", (b, c, v, "", None, "sem-blivre"))

    for k, e in strong_h.items():
        db.execute("INSERT INTO lexico VALUES (?,?,?,?,?,?,?,?,?,?)",
                   (k, "H", e.get("lemma"), e.get("xlit"), e.get("pron"), e.get("derivation"),
                    e.get("strongs_def"), e.get("kjv_def"), None, None))
    for letra, (heb, xlit, pt, en) in PARTICULAS_H.items():
        if letra != "m":
            db.execute("INSERT INTO lexico VALUES (?,?,?,?,?,?,?,?,?,?)",
                       ("H" + letra, "H", heb, xlit, xlit, "partícula inseparável (prefixo)", en, None, en, pt))
    for k, e in strong_g.items():
        db.execute("INSERT INTO lexico VALUES (?,?,?,?,?,?,?,?,?,?)",
                   (k, "G", e.get("lemma"), e.get("translit"), None, e.get("derivation"),
                    e.get("strongs_def"), e.get("kjv_def"), dodson_glosa.get(k), None))
    db.commit()

    n_pal = db.execute("SELECT count(*) FROM palavras").fetchone()[0]
    n_ver = db.execute("SELECT count(*) FROM versos").fetchone()[0]
    sem_strong = db.execute("SELECT count(*) FROM palavras WHERE strong IS NULL").fetchone()[0]
    print(f"{n_pal} palavras, {n_ver} versículos; sem Strong: {sem_strong}")
    print("versículos BLIVRE sem texto original:", sum(sem_texto_orig.values()), dict(sem_texto_orig.most_common(8)))
    print("versículos com original e sem BLIVRE:", len(sem_blivre), sem_blivre[:10])
    print("grego, Strong por:", dict(Counter(r[0] for r in db.execute("SELECT strong_fonte FROM palavras WHERE lingua='G'"))))
    print("edição 2017 usada em:", db.execute("SELECT count(*) FROM versos WHERE edicao='2017'").fetchone()[0], "versículos")


if __name__ == "__main__":
    main()
