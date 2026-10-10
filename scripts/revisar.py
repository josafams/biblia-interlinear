#!/usr/bin/env python3
"""Revisões automáticas do catálogo docs/REVISOES.md sobre saida/biblia.sqlite (só leitura).

Roda as verificações automatizáveis sem rede e sem IA: integridade do texto-base (comparando
com os arquivos de fontes-dados/, quando presentes), versificação, cobertura, gramática × glosa
(hebraico, aramaico e grego), consistência, léxico, nomes, números e cruzamentos entre passagens
paralelas. Cada marca tem o código do catálogo e um nível: 'erro', 'aviso' ou 'info'.

Saídas em saida/revisao/: marcas.json, resumo.tsv, relatorio.md; totais por código no terminal.

Uso: python3 scripts/revisar.py [LIVRO [CAP]]      (ex.: GEN · GEN 1 · JHN 3)
"""
import json
import os
import re
import sqlite3
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB = os.path.join(ROOT, "saida", "biblia.sqlite")
FD = os.path.join(ROOT, "fontes-dados")
OUT = os.path.join(ROOT, "saida", "revisao")

sys.path.insert(0, os.path.dirname(__file__))
try:
    from livros import LIVROS  # (código, OSIS morphhb, TAHOT, scrollmapper, MorphGNT, nome, abrev)
except Exception:  # pragma: no cover
    LIVROS = []

# campos da tabela palavras
ID, LIV, CAP, VER, POS, LING, TXT, LEMA, STR, PREF, MORF, REF, GL, GF, SF = range(15)

NIVEIS = ("erro", "aviso", "info")

# ------------------------------------------------------------------ português
def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


TOKEN_PT = re.compile(r"[^\W\d_]+", re.U)


def toks(glosa):
    return [t for t in (glosa or "").lower().split("-") if t]


ARTIGOS = set("o a os as".split())
DETERMINANTES = ARTIGOS | set("""do da dos das no na nos nas ao à aos às pelo pela pelos pelas um uma uns umas
num numa dum duma este esta estes estas isto esse essa esses essas isso aquele aquela aqueles aquelas aquilo
deste desta destes destas disto neste nesta nestes nestas nisto desse dessa desses dessas nesse nessa daquele
daquela daqueles daquelas daquilo naquele naquela naqueles naquelas naquilo àquele àquela àqueles àquelas
que qual quais quem""".split())
PREPOSICOES = set("""de em a para por com sem sob sobre entre contra até desde perante ante após segundo
conforme diante dentro fora junto acima abaixo debaixo através durante mediante trás atrás frente perto longe
pra pro""".split())
CONTRACOES = set("""do da dos das no na nos nas ao à aos às pelo pela pelos pelas num numa dum duma nele nela
neles nelas dele dela deles delas deste desta destes destas disto neste nesta nestes nestas nisto desse dessa
nesse nessa daquele daquela naquele naquela àquele àquela daí dali daqui donde aonde comigo contigo consigo
conosco convosco""".split())
CONJUNCOES = set("""e mas porém pois porque que então ou nem contudo todavia também logo portanto assim ora
quando se porquanto embora ainda senão enquanto como antes sim certamente depois tanto quer até mesmo
entretanto conforme segundo visto já agora eis""".split())
PRON = {
    "1s": set("eu me mim meu minha meus minhas comigo".split()),
    "1p": set("nós nosso nossa nossos nossas conosco".split()),
    "2s": set("tu te ti teu tua teus tuas contigo".split()),
    "2p": set("vós vos vosso vossa vossos vossas convosco".split()),
    "3": set("ele ela eles elas lhe lhes seu sua seus suas dele dela deles delas nele nela neles nelas si "
             "consigo lo la los las lho lha".split()),
}
PRON_AMBIG = set("o a os as no na nos nas se mesmo mesma próprio própria".split())
PRON_TODOS = set().union(*PRON.values()) | PRON_AMBIG
STOP = DETERMINANTES | PREPOSICOES | CONTRACOES | CONJUNCOES | PRON_TODOS | {"não"}
NEGACAO = set("não nem nenhum nenhuma nenhuns nenhumas nunca jamais ninguém nada sem tampouco".split())
NUMEROS = set("""um uma dois duas três quatro cinco seis sete oito nove dez onze doze treze catorze quatorze
quinze dezesseis dezasseis dezessete dezassete dezoito dezenove dezanove vinte trinta quarenta cinquenta
cinqüenta sessenta setenta oitenta noventa cem cento duzentos duzentas trezentos trezentas quatrocentos
quatrocentas quinhentos quinhentas seiscentos seiscentas setecentos setecentas oitocentos oitocentas
novecentos novecentas mil milhares milhão milhões dezenas centenas""".split())
NUM_FORTES = NUMEROS - {"um", "uma"}
ORDINAIS = {o + f for o in """primeir segund terceir quart quint sext sétim oitav non décim vigésim trigésim
quadragésim quinquagésim sexagésim septuagésim octogésim nonagésim centésim milésim""".split()
            for f in ("o", "a", "os", "as")} | {"ambos", "ambas", "dobro", "dobrado", "dupla", "duplo", "metade",
                                                "par", "vezes", "vez"}
INGLES = set("""the and of unto shall thou thee thy thine his which with from that this they them said lord
was not have hath ye you your its who whom upon into out all by men god king people land day house word
were their there what when where shalt""".split())


# Verbos irregulares: radical(is) + terminações; cada forma aponta para a família (SER junta ser/estar/haver/ir).
_T_PRES = "o es e emos eis em ".split(" ")
_FORMAS = {
    "SER": """sou és é somos sois são era eras éramos éreis eram fui foste foi fomos fostes foram fora foras
           seja sejas sejamos sejais sejam fosse fosses fôssemos fôsseis fossem for fores formos fordes forem
           serei serás será seremos sereis serão seria serias seríamos seríeis seriam ser sendo sido sê sede
           estou estás está estamos estais estão estava estavas estávamos estáveis estavam estive estiveste esteve
           estivemos estivestes estiveram estivera esteja estejas estejamos estejais estejam estivesse estivesses
           estivéssemos estivésseis estivessem estiver estiveres estivermos estiverdes estiverem estarei estarás
           estará estaremos estareis estarão estaria estariam estar estando estado há hei hás havemos haveis hão
           havia haviam houve houveram haja hajam houvesse houvessem houver houverem haverá haverão haveria haver
           havendo vou vais vai vamos ides vão ia ias íamos íeis iam ide vá vás vades irei irás irá iremos ireis
           irão iria iriam ir indo ido existe existem existia fica ficou ficaram ficará tornou tornará tornarão
           tornaram""",
    "DIZER": """digo dizes diz dizemos dizeis dizem dizia dizias dizíamos dizíeis diziam disse disseste dissemos
             dissestes disseram dissera diga digas digamos digais digam dissesse dissessem disser disseres
             dissermos disserdes disserem direi dirás dirá diremos direis dirão diria diriam dizer dizendo dito
             dita ditos ditas dize dizei""",
    "FAZER": """faço fazes faz fazemos fazeis fazem fazia fazias fazíamos fazíeis faziam fiz fizeste fez fizemos
             fizestes fizeram fizera faça faças façamos façais façam fizesse fizesses fizéssemos fizésseis
             fizessem fizer fizeres fizermos fizerdes fizerem farei farás fará faremos fareis farão faria fariam
             fazer fazendo feito feita feitos feitas faze fazei""",
    "VER": """vejo vês vê vemos vedes veem via vias víamos víeis viam vi viste viu vistes viram vira veja vejas
           vejamos vejais vejam visse vissem virdes verei verás verá veremos vereis verão veria veriam ver vendo
           visto vista vistos vede""",
    "VIR": """venho vens vem vindes vêm vinha vinham vim vieste veio viemos viestes vieram viera venha venhas
           venhamos venhais venham viesse viessem vier vierem virei virás virá viremos vireis virão viria vir
           vindo vinde""",
    "TER": """tenho tens tem temos tendes têm tinha tinhas tínhamos tínheis tinham tive tiveste teve tivemos
           tivestes tiveram tenha tenhas tenhamos tenhais tenham tivesse tivessem tiver tiverem terei terás terá
           teremos tereis terão teria teriam ter tendo tido""",
    "DAR": """dou dás dá damos dais dão dava davam dei deste deu demos destes deram dê dês demos deis deem desse
           dessem der derem darei darás dará daremos dareis darão daria dar dando dado dada dados dadas dai""",
    "PÔR": """ponho pões põe pomos pondes põem punha punham pus puseste pôs pusemos pusestes puseram ponha
           ponhas ponhamos ponhais ponham pusesse pusessem puser puserem porei porás porá poremos poreis porão
           poria pôr pondo posto posta postos postas ponde""",
    "PODER": """posso podes pode podemos podeis podem podia podiam pude pôde pudemos puderam possa possas
             possamos possais possam pudesse pudessem puder puderem poderei poderás poderá poderemos podereis
             poderão poderia poderiam poder podendo""",
    "TRAZER": """trago trazes traz trazemos trazeis trazem trazia traziam trouxe trouxeste trouxemos trouxestes
              trouxeram traga tragas tragam trouxesse trouxer trouxerem trarei trarás trará traremos trareis
              trarão traria trazer trazendo trazido trazei""",
    "SABER": """sei sabes sabe sabemos sabeis sabem sabia sabiam soube soubeste soubemos souberam saiba saibas
             saibamos saibais saibam soubesse souber souberem saberei saberás saberá saberemos sabereis saberão
             saber sabendo sabido""",
    "OUVIR": """ouço ouves ouve ouvimos ouvis ouvem ouvia ouviam ouvi ouviste ouviu ouvistes ouviram ouça
             ouças ouçamos ouçais ouçam ouvisse ouvir ouvirem ouvirei ouvirá ouvireis ouvirão ouvindo ouvido""",
}
IRREG_MAP = {}
for _k, _v in _FORMAS.items():
    for _f in _v.split():
        IRREG_MAP.setdefault(_f, _k)
def singular(t):
    if t.endswith("us"):
        return t
    for a, b in (("ões", "ão"), ("ães", "ão"), ("ãos", "ão"), ("ns", "m"), ("res", "r"), ("zes", "z"),
                 ("ses", "s")):
        if t.endswith(a) and len(t) > len(a):
            return t[:-len(a)] + b
    if t.endswith("s") and len(t) > 3:
        return t[:-1]
    return t


def _raiz(t):
    t = t.lower()
    if t in IRREG_MAP:
        return IRREG_MAP[t]
    r = sem_acento(singular(t))[:4]  # prefixo: criou/criar/criado → cri; santo/santa → sant
    return r[:3] if len(r) == 4 and r[3] in "aeiou" else r


# sinônimos que a BLIVRE alterna para a mesma palavra original (não contam como glosa divergente)
SINONIMOS = """aconteceu sucedeu sobreveio | homem humano pessoa gente | terra país chão solo | casa família palácio
| espírito vento fôlego hálito sopro | entrar chegar | porta portão | maldade iniquidade perversidade culpa
| alheio estranho estrangeiro | escuridão trevas | todo tudo | lutar combater guerrear | sair proceder
| responder dizer falar perguntar | lealdade bondade misericórdia benignidade | povo nação gente | servo escravo
| oferta oferenda | ira furor raiva | coração ânimo mente | olhar ver observar considerar | mulher esposa
| fazer cometer agir executar realizar praticar obrar obra | pôr colocar | celebrar oferecer"""
_pai = {}


def _achar(x):
    while _pai.get(x, x) != x:
        x = _pai[x]
    return x


for _grupo in SINONIMOS.split("|"):
    _rs = [_raiz(p) for p in _grupo.split()]
    for _r in _rs[1:]:
        _pai[_achar(_r)] = _achar(_rs[0])
SIN_STEM = {r: _achar(r).upper() for r in list(_pai) + [_achar(r) for r in _pai]}


def stem(t):
    """Raiz aproximada de uma palavra portuguesa: verbos irregulares, plural, terminações verbais, sinônimos."""
    r = _raiz(t)
    return SIN_STEM.get(r, r)


def conteudo(ts):
    return [t for t in ts if t not in STOP and not t.startswith("[")]


def stems_conteudo(glosa):
    return {stem(t) for t in conteudo(toks(glosa))}


# ------------------------------------------------------------------ morfologia
def heb_segs(morph):
    """'HC/Vqw3ms' → (lingua, prefixos, raiz, sufixos)."""
    if not morph:
        return "", [], "", []
    segs = morph[1:].split("/")
    suf = [s for s in segs if s.startswith("S")]
    nao = [s for s in segs if not s.startswith("S")]
    if len(nao) > 1 and nao[-1] == "Td" and morph[0] == "A":  # artigo enfático aramaico, posposto
        nao = nao[:-1]
    raiz = nao[-1] if nao else ""
    return morph[0], nao[:-1], raiz, suf


def grk(morph):
    """'V-3AAI-S--' → ('V', '3AAI-S--'); 'N-----NSM-' → ('N', '----NSM-')."""
    if not morph or "-" not in morph:
        return morph or "", ""
    pos, parse = morph.split("-", 1)
    return pos, parse.ljust(8, "-")


def eh_nome_proprio(w):
    if w[LING] == "G":
        return grk(w[MORF])[0] == "N" and (w[LEMA] or "")[:1].isupper()
    return heb_segs(w[MORF])[2].startswith("Np")


def nomes_da_glosa(g):
    return [t for t in (g or "").split("-") if t[:1].isupper() and t not in ("SENHOR", "DEUS", "Deus", "Senhor")]


CANT = re.compile(r"[\u0591-\u05AF\u05BD\u05C0\u05C3\u05C4\u05C5]")


def forma_norm(w):
    t = unicodedata.normalize("NFD", w[TXT] or "")
    if w[LING] == "G":
        t = "".join(c for c in t if unicodedata.category(c)[0] in "LM").lower()
        return unicodedata.normalize("NFC", t)
    return CANT.sub("", t)


def consonantal(t):
    t = unicodedata.normalize("NFD", t)
    return "".join(c for c in t if unicodedata.category(c)[0] == "L").lower().replace("ς", "σ")


# ------------------------------------------------------------------ marcas
class Marcas:
    def __init__(self, escopo):
        self.lista = []
        self.escopo = escopo
        self.vistos = set()

    def dentro(self, livro, cap):
        lv, cp = self.escopo
        return (lv is None or livro == lv) and (cp is None or cap == cp)

    def add(self, livro, cap, vers, pid, codigo, nivel, msg):
        if not self.dentro(livro, cap):
            return
        k = (pid, codigo, livro, cap, vers, msg if pid is None else "")
        if k in self.vistos:
            return
        self.vistos.add(k)
        self.lista.append({"livro": livro, "cap": cap, "vers": vers, "palavra_id": pid,
                           "codigo": codigo, "nivel": nivel, "msg": msg})

    def w(self, w, codigo, nivel, msg):
        self.add(w[LIV], w[CAP], w[VER], w[ID], codigo, nivel, msg)


def ref(w):
    return f"{w[LIV]} {w[CAP]}:{w[VER]}"


# ------------------------------------------------------------------ dados
class Dados:
    def __init__(self, db):
        self.livros = [r for r in db.execute("SELECT ordem, codigo, nome, abrev, testamento FROM livros ORDER BY ordem")]
        self.ordem = {r[1]: r[0] for r in self.livros}
        self.testamento = {r[1]: r[4] for r in self.livros}
        self.versos = {}
        for b, c, v, t, ed, nota in db.execute("SELECT livro, cap, vers, blivre, edicao, nota FROM versos"):
            self.versos[(b, c, v)] = (t or "", ed, nota)
        self.palavras = db.execute("SELECT id, livro, cap, vers, pos, lingua, texto, lema, strong, prefixos, morph, "
                                   "ref_orig, glosa, glosa_fonte, strong_fonte FROM palavras").fetchall()
        self.palavras.sort(key=lambda w: (self.ordem.get(w[LIV], 999), w[CAP], w[VER], w[POS]))
        self.por_verso = defaultdict(list)
        for w in self.palavras:
            self.por_verso[(w[LIV], w[CAP], w[VER])].append(w)
        self.lexico = {r[0]: r for r in db.execute("SELECT chave, lingua, lema, xlit, pron_en, derivacao_en, def_en, "
                                                    "kjv_en, glosa_en, def_pt FROM lexico")}
        self.trad = defaultdict(Counter)
        for ch, t, n in db.execute("SELECT chave, traducao, n FROM traducoes"):
            self.trad[ch][t] += n
        self._tokset = {}

    def tokset_blivre(self, k):
        s = self._tokset.get(k)
        if s is None:
            t = self.versos.get(k, ("",))[0]
            s = {sem_acento(x.lower()) for x in TOKEN_PT.findall(t)}
            self._tokset[k] = s
        return s


# ================================================================== A. integridade do texto-base
def fonte_hebraico(osis):
    """{(cap, vers) originais: [(texto, ketiv?, qere)]} lido do morphhb."""
    arq = os.path.join(FD, f"morphhb/wlc/{osis}.xml")
    if not os.path.exists(arq):
        return None
    x = open(arq, encoding="utf8").read()
    res = {}
    for vid, corpo in re.findall(r'<verse osisID="([^"]+)">(.*?)</verse>', x, re.S):
        _, c, v = vid.split(".")
        ws = []
        for m in re.finditer(r"<w ([^>]*)>(.*?)</w>|<note\b.*?</note>", corpo, re.S):
            if m.group(1) is not None:
                ws.append([re.sub(r"<[^>]+>", "", m.group(2)), 'type="x-ketiv"' in m.group(1), None])
            elif "x-qere" in m.group(0) and ws and ws[-1][1]:
                # o corpus usa a leitura (qere) no lugar da forma escrita (ketiv): a fonte de referência também
                q = [re.sub(r"<[^>]+>", "", t) for t in re.findall(r"<w [^>]*>(.*?)</w>", m.group(0), re.S)]
                if q:  # qere vazio (escrito e não lido): a palavra escrita fica no texto
                    while ws and ws[-1][1]:
                        ws.pop()
                    ws.extend([t, False, "qere"] for t in q)
        res[(int(c), int(v))] = ws
    return res


def fonte_grego(arq):
    caminho = os.path.join(FD, f"sblgnt/{arq}-morphgnt.txt")
    if not os.path.exists(caminho):
        return None
    res = defaultdict(list)
    linhas = list(open(caminho, encoding="utf8"))
    sup = os.path.join(ROOT, "dados", f"grego_suplemento_{arq}.txt")
    if os.path.exists(sup):
        linhas += [l for l in open(sup, encoding="utf8") if l.strip() and not l.startswith("#")]
    for linha in linhas:
        p = linha.rstrip("\n").split(" ")
        if len(p) >= 4:
            res[(int(p[0][2:4]), int(p[0][4:6]))].append([p[3], False, None])
    return res


def chk_texto_base(d, M, livros_escopo):
    info_livros = {l[0]: l for l in LIVROS}
    for livro in livros_escopo:
        l = info_livros.get(livro)
        if not l:
            continue
        nt = d.testamento.get(livro) == "NT"
        src = fonte_grego(l[4]) if nt and l[4] else (fonte_hebraico(l[1]) if l[1] else None)
        cod_cont, cod_hash = ("TXG-01", "TXG-01") if nt else ("TXT-01", "TXT-02")
        if src is None:
            M.add(livro, 1, 1, None, cod_cont, "info", "fonte original ausente em fontes-dados/; contagem não conferida")
            continue
        db_orig = defaultdict(list)
        for w in d.palavras:
            if w[LIV] != livro or not w[REF]:
                continue
            cv, n = w[REF].split(".")
            c, v = cv.split(":")
            db_orig[(int(c), int(v))].append((int(n), w))
        for k in sorted(set(src) | set(db_orig)):
            ws = sorted(db_orig.get(k, []))
            fonte = src.get(k, [])
            alvo = ws[0][1] if ws else None
            loc = (alvo[CAP], alvo[VER]) if alvo else k
            if not M.dentro(livro, loc[0]):
                continue
            if len(ws) != len(fonte):
                M.add(livro, loc[0], loc[1], None, cod_cont, "erro",
                      f"{len(ws)} palavras no banco × {len(fonte)} na fonte (original {k[0]}:{k[1]})")
                continue
            if [n for n, _ in ws] != list(range(1, len(ws) + 1)):
                M.add(livro, loc[0], loc[1], None, cod_cont, "erro", f"numeração das palavras com buraco ({k[0]}:{k[1]})")
            if consonantal("".join(w[TXT] for _, w in ws)) != consonantal("".join(f[0] for f in fonte)):
                M.add(livro, loc[0], loc[1], None, cod_hash, "erro",
                      f"texto consonantal difere da fonte (original {k[0]}:{k[1]})")
            elif not nt:
                for (_, w), f in zip(ws, fonte):
                    if f[1]:
                        q = f" (Qere {f[2]})" if f[2] else ""
                        M.w(w, "TXT-04", "aviso", f"forma escrita (Ketiv) {w[TXT]} no texto; a lida{q} não está registrada")


HEB_OK = re.compile(r"^[\u0591-\u05C7\u05D0-\u05EA\u05F0-\u05F4\u034F\u200D/]+$")
GRC_LETRA = re.compile(r"[\u0370-\u03FF\u1F00-\u1FFF]")
GRC_OK = re.compile(r"^[\u0370-\u03FF\u1F00-\u1FFF\u0300-\u036F.,;\u00B7\u0387\u2019\u02BC'\u1FBD\u2014]+$")
SIGLAS = re.compile(r"[⸀-⸏⟦⟧\[\]()0-9]")


def chk_unicode(d, M, ws):
    nao_nfc = Counter()
    exemplo = {}
    siglas = defaultdict(list)
    for w in ws:
        t = w[TXT] or ""
        if t != unicodedata.normalize("NFC", t):
            nao_nfc[(w[LIV], w[LING] == "G")] += 1
            exemplo.setdefault((w[LIV], w[LING] == "G"), w)
        if w[LING] == "G":
            if SIGLAS.search(t):
                siglas[(w[LIV], w[CAP])].append(w)
            letras = "".join(GRC_LETRA.findall(unicodedata.normalize("NFC", t)))
            if "ς" in letras[:-1]:
                M.w(w, "TXG-02", "erro", f"sigma final no meio da palavra: {t}")
            elif len(letras) > 1 and letras[-1] == "σ" and "’" not in t:
                M.w(w, "TXG-02", "aviso", f"sigma medial no fim da palavra: {t}")
            if not GRC_OK.match(SIGLAS.sub("", t)):
                M.w(w, "TXG-02", "erro", f"caractere fora do permitido: {t!r}")
        else:
            if not HEB_OK.match(t):
                M.w(w, "TXT-03", "erro", f"caractere fora do permitido: {t!r}")
    for (livro, cap), l in siglas.items():
        sinais = "".join(sorted({c for w in l for c in SIGLAS.findall(w[TXT])}))
        M.add(livro, cap, l[0][VER], None, "TXG-02", "aviso",
              f"{len(l)} palavras com sinais do aparato crítico ({sinais}) no texto grego; ex.: {l[0][TXT]}")
    for (livro, grego), n in nao_nfc.items():
        w = exemplo[(livro, grego)]
        M.add(livro, w[CAP], w[VER], None, "TXG-02" if grego else "TXT-03", "info",
              f"{n} palavras fora da forma NFC (ordem dos sinais da fonte preservada)")


def chk_versos_e_capitulos(d, M, livros_escopo):
    caps = defaultdict(lambda: defaultdict(set))
    for (b, c, v) in d.versos:
        caps[b][c].add(v)
    for (b, c, v) in d.por_verso:
        caps[b][c].add(v)
    for b in livros_escopo:
        cs = sorted(caps[b])
        for i, c in enumerate(cs, 1):
            if c != i and i <= (cs[-1] if cs else 0):
                M.add(b, c, 1, None, "TXT-05", "erro", f"capítulo {i} ausente (numeração pula para {c})")
                break
        for c in cs:
            vs = sorted(v for v in caps[b][c] if v > 0)
            falta = sorted(set(range(1, vs[-1] + 1)) - set(vs)) if vs else []
            if falta:
                M.add(b, c, falta[0], None, "TXT-05", "erro", f"versículo(s) ausente(s): {falta[:8]}")
        for k, ws in d.por_verso.items():
            if k[0] != b:
                continue
            ps = [w[POS] for w in ws]
            if ps != list(range(1, len(ps) + 1)):
                M.add(b, k[1], k[2], None, "TXT-05", "erro", "posições das palavras repetidas ou com buraco")


ARAMAICO = [("GEN", 31, 47, 31, 47), ("JER", 10, 11, 10, 11), ("EZR", 4, 8, 6, 18), ("EZR", 7, 12, 7, 26),
            ("DAN", 2, 4, 7, 28)]


def em_aramaico(b, c, v):
    return any(b == lb and (c1, v1) <= (c, v) <= (c2, v2) for lb, c1, v1, c2, v2 in ARAMAICO)


def chk_aramaico(d, M, ws):
    por_verso = defaultdict(list)
    for w in ws:
        if w[LING] == "G":
            continue
        por_verso[(w[LIV], w[CAP], w[VER])].append(w)
        lang = (w[MORF] or "?")[:1]
        if (w[LING] == "A") != (lang == "A"):
            M.w(w, "ARM-02", "erro", f"língua {w[LING]} × morfologia {w[MORF]}")
    for k, vs in por_verso.items():
        dentro = em_aramaico(*k)
        aram = [w for w in vs if w[LING] == "A"]
        if not dentro:
            for w in aram:
                M.w(w, "ARM-01", "erro", "palavra aramaica fora dos trechos aramaicos conhecidos")
            continue
        if k == ("GEN", 31, 47):
            if len(aram) != 2:
                M.add(*k, None, "ARM-01", "erro", f"Gn 31:47 deveria ter 2 palavras aramaicas, tem {len(aram)}")
            continue
        if k == ("DAN", 2, 4):
            idx = [i for i, w in enumerate(vs) if w[LING] == "A"]
            if not idx or any(w[LING] == "H" for w in vs[idx[0]:]):
                M.add(*k, None, "ARM-01", "erro", "troca hebraico → aramaico em Dn 2:4b fora do lugar")
            continue
        for w in vs:
            if w[LING] == "H":
                M.w(w, "ARM-01", "aviso", "palavra marcada como hebraica dentro de trecho aramaico")
        if not aram:
            M.add(*k, None, "TXT-06", "aviso", "versículo de trecho aramaico sem palavras aramaicas")


# ================================================================== B. versificação e alinhamento
ALG01 = {("MAT", 17, 21), ("MAT", 18, 11), ("MAT", 23, 14), ("MRK", 7, 16), ("MRK", 9, 44), ("MRK", 9, 46),
         ("MRK", 11, 26), ("MRK", 15, 28), ("LUK", 17, 36), ("LUK", 23, 17), ("JHN", 5, 4), ("ACT", 8, 37),
         ("ACT", 15, 34), ("ACT", 24, 7), ("ACT", 28, 29), ("ROM", 16, 24)}
ALG02 = [("MAT", 6, 13, 6, 13, "Mt 6:13b (doxologia do Pai-Nosso)"),
         ("1JN", 5, 7, 5, 8, "1Jo 5:7–8 (Comma Johanneum)"),
         ("MRK", 16, 9, 16, 20, "Mc 16:9–20 (final longo de Marcos)"),
         ("JHN", 7, 53, 8, 11, "Jo 7:53–8:11 (a mulher adúltera)")]
CONHECIDOS_AT = {("NEH", 7, 68): "Ne 7:68 não existe no Texto Massorético (vem da tradição grega/latina)"}
# Diferenças de numeração do NT aplicadas pelo corpus: (livro, ref original) → (cap, vers) de exibição
ALG03 = [("2CO", "13:12.6", 13, 13), ("2CO", "13:13.1", 13, 14), ("ACT", "19:40.22", 19, 41), ("3JN", "1:15.1", 1, 14)]


def chk_versificacao(d, M, livros_escopo):
    for (b, c, v), (t, ed, nota) in d.versos.items():
        if b not in livros_escopo:
            continue
        nt = d.testamento.get(b) == "NT"
        if nota == "sem-original":
            if b == "PSA" and v == 0:
                M.add(b, c, v, None, "ALN-04", "aviso", "título do salmo na BLIVRE sem título no hebraico")
            elif nt and (b, c, v) in ALG01:
                M.add(b, c, v, None, "ALG-01", "info", "versículo ausente do texto crítico (lista conhecida); exibir com nota")
            elif nt and any(b == lb and (c1, v1) <= (c, v) <= (c2, v2) for lb, c1, v1, c2, v2, _ in ALG02):
                M.add(b, c, v, None, "ALG-02", "aviso", "trecho com tratamento editorial especial sem texto grego")
            elif (b, c, v) in CONHECIDOS_AT:
                M.add(b, c, v, None, "ALN-02", "info", CONHECIDOS_AT[(b, c, v)])
            else:
                M.add(b, c, v, None, "ALG-01" if nt else "ALN-01", "erro" if nt else "aviso",
                      "versículo da BLIVRE sem texto original correspondente")
        if nota == "sem-blivre" or not t.strip():
            if b == "PSA" and v == 0:
                M.add(b, c, v, None, "ALN-04", "aviso", "título hebraico do salmo sem título na BLIVRE")
            else:
                M.add(b, c, v, None, "ALN-05", "erro", "versículo da BLIVRE vazio")
        else:
            ant = d.versos.get((b, c, v - 1))
            if ant and ant[0].strip() and ant[0].strip() == t.strip():
                M.add(b, c, v, None, "ALN-05", "erro", f"texto da BLIVRE repete o v. {v - 1}")
    for k in d.por_verso:
        if k[0] in livros_escopo and k not in d.versos:
            M.add(*k, None, "ALN-05", "erro", "palavras originais num versículo inexistente na tabela versos")
    # ALG-02: trechos conhecidos e versículos em que a BLIVRE é bem mais longa que o grego
    for lb, c1, v1, c2, v2, nome in ALG02:
        if lb in livros_escopo:
            ks = [k for k in d.versos if k[0] == lb and (c1, v1) <= k[1:] <= (c2, v2)]
            if ks:
                k = min(ks)
                M.add(*k, None, "ALG-02", "aviso", f"{nome}: marcar trecho de tratamento especial")
    for b in livros_escopo:
        razoes = []
        itens = []
        for k, ws in d.por_verso.items():
            if k[0] != b:
                continue
            nb = len(TOKEN_PT.findall(d.versos.get(k, ("",))[0]))
            if ws and nb:
                razoes.append(nb / len(ws))
                itens.append((k, nb, len(ws)))
        if len(razoes) < 10:
            continue
        med = sorted(razoes)[len(razoes) // 2]
        nt = d.testamento.get(b) == "NT"
        for k, nb, no in itens:
            esperado = no * med
            if nb > 2.3 * esperado and nb - esperado >= 14:
                M.add(*k, None, "ALG-02" if nt else "ALN-03", "aviso",
                      f"BLIVRE com {nb} palavras para {no} no original (esperado ~{esperado:.0f}): trecho a mais?")
            elif nb < 0.4 * esperado and esperado - nb >= 14:
                M.add(*k, None, "ALG-02" if nt else "ALN-03", "aviso",
                      f"BLIVRE com {nb} palavras para {no} no original (esperado ~{esperado:.0f}): trecho faltando?")
    # ALN-02 / ALN-04: versículo de exibição que junta mais de um versículo original
    for k, vs in d.por_verso.items():
        if k[0] not in livros_escopo:
            continue
        origs = []
        for w in vs:
            o = w[REF].split(".")[0] if w[REF] else None
            if o and o not in origs:
                origs.append(o)
        if len(origs) < 2:
            continue
        b, c, v = k
        if b == "PSA" and v == 1 and (b, c, 0) in d.por_verso:
            M.add(b, c, v, None, "ALN-04", "erro",
                  f"título do salmo ocupa dois versículos hebraicos; a 2ª parte ({origs[0]}) caiu no v. 1 junto com {origs[1]}")
        else:
            M.add(b, c, v, None, "ALG-03" if d.testamento.get(b) == "NT" else "ALN-02", "info",
                  f"versículo junta {len(origs)} versículos originais ({', '.join(origs)})")
    # ALG-03 / ALN-02: mapa de versificação aplicado e ordem do texto original preservada
    por_ref = {}
    for w in d.palavras:
        if w[LIV] in ("2CO", "ACT", "3JN") and w[LIV] in livros_escopo:
            por_ref[(w[LIV], w[REF])] = w
    for b, r, c, v in ALG03:
        if b in livros_escopo:
            w = por_ref.get((b, r))
            if not w or (w[CAP], w[VER]) != (c, v):
                M.add(b, c, v, None, "ALG-03", "erro", f"palavra original {r} não está em {c}:{v} (mapa de versificação)")
    ult = {}
    for w in d.palavras:
        if w[LIV] not in livros_escopo or not w[REF]:
            continue
        cv, n = w[REF].split(".")
        c, v = cv.split(":")
        o = (int(c), int(v), int(n))
        p = ult.get(w[LIV])
        if p and o < p[0] and not (w[LIV] == "PSA"):
            M.w(w, "ALG-03" if w[LING] == "G" else "ALN-02", "erro",
                f"ordem do original quebrada: {w[REF]} depois de {p[1]}")
        ult[w[LIV]] = (o, w[REF])


def chk_deslocamento(d, M, livros_escopo):
    """ALN-03: as traduções usuais das palavras combinam mais com o versículo vizinho da BLIVRE."""
    trad = {}
    for ch, c in d.trad.items():
        tot = sum(c.values())
        s = set()
        for t, n in c.items():
            if n / tot >= 0.02:
                s |= {stem(x) for x in conteudo(toks(t))}
        if s:
            trad[ch] = s
    stems_v = {}

    def sv(k):
        s = stems_v.get(k)
        if s is None:
            s = stems_v[k] = {stem(x) for x in d.tokset_blivre(k)}
        return s

    def score(ws, k):
        if k not in d.versos or not d.versos[k][0]:
            return 0
        s = sv(k)
        return sum(1 for t in ws if t & s) / len(ws)

    for k, ws in d.por_verso.items():
        if k[0] not in livros_escopo:
            continue
        cont = []
        for w in ws:
            if w[LING] == "G":
                p = grk(w[MORF])[0]
            else:
                p = heb_segs(w[MORF])[2][:1]
            if p in ("N", "V", "A") and not eh_nome_proprio(w):
                ch = w[STR] or ("G:" + w[LEMA])
                if ch in trad:
                    cont.append(trad[ch])
        if len(cont) < 5:
            continue
        own = score(cont, k)
        if own > 0.4:
            continue
        b, c, v = k
        viz = [(score(cont, (b, c, v + dv)), v + dv) for dv in (-1, 1)]
        best, vv = max(viz)
        if best >= 0.6 and best >= own + 0.3:
            M.add(b, c, v, None, "ALN-03", "aviso",
                  f"glosas combinam mais com o v. {vv} da BLIVRE ({best:.0%}) que com o próprio ({own:.0%})")


# ================================================================== C. cobertura
def chk_cobertura(d, M, ws):
    usados = {}
    for w in ws:
        g = w[GL]
        if not g or not g.strip() or w[GF] == "sem":
            M.w(w, "COB-01", "erro", "palavra sem glosa")
        elif w[GF] == "parcial":
            M.w(w, "COB-01", "aviso", f"glosa só do prefixo/partícula: '{g}'")
        k = w[STR]
        if not k:
            M.w(w, "COB-02", "erro", f"sem número de Strong (lema {w[LEMA]})")
            continue
        if k not in d.lexico:
            M.w(w, "COB-02", "erro", f"{k} não existe no léxico")
            continue
        usados.setdefault(k, w)
        ts = toks(g)
        en = [t for t in ts if t in INGLES]
        if en:
            M.w(w, "COB-07", "aviso", f"palavra em inglês na glosa: '{g}'")
    return usados


def chk_lexico(d, M, usados):
    for k, w in usados.items():
        e = d.lexico[k]
        if not (e[9] or "").strip():
            M.w(w, "COB-02", "info", f"verbete {k} ({e[2]}) sem definição em português (def_pt)")
        if k[1:].isdigit() and not ((e[6] or "").strip() and (e[7] or "").strip() and (e[5] or "").strip()):
            falta = [n for n, v in (("origem", e[5]), ("significado", e[6]), ("traduções KJV", e[7])) if not (v or "").strip()]
            M.w(w, "COB-03", "aviso", f"verbete {k} sem {', '.join(falta)} (nem em inglês)")
        if not (e[3] or "").strip():
            M.w(w, "LEX-05", "erro", f"verbete {k} sem transliteração")
        elif re.search(r"[^\w\s'ʼʽ\-\.,·()ʾʿ]", e[3]):
            M.w(w, "LEX-05", "aviso", f"transliteração de {k} com caractere estranho: {e[3]!r}")
        if not (e[4] or "").strip() and e[1] == "H":
            M.w(w, "COB-04", "aviso", f"verbete {k} sem pronúncia")
        der = e[5] or ""
        for lt, num in re.findall(r"\b([HG])0*(\d+)\b", der):
            alvo = lt + num
            if alvo not in d.lexico:
                dica = f" (provavelmente H{num})" if lt == "G" and int(num) > 5624 else \
                    " (número que o próprio Strong pulou)" if lt == "G" and (int(num) == 2717 or 3203 <= int(num) <= 3302) else ""
                M.w(w, "LEX-03", "erro", f"{k} cita {alvo}, que não existe no léxico{dica}")
            elif re.search(r"\b" + k[0] + "0*" + k[1:] + r"\b", d.lexico[alvo][5] or "") and alvo != k \
                    and "from" in der and "from" in (d.lexico[alvo][5] or ""):
                M.w(w, "LEX-03", "aviso", f"derivação circular: {k} ↔ {alvo}")
        if k.startswith("G") and k[1:].isdigit():
            n = int(k[1:])
            if n > 5624 or n == 2717 or 3203 <= n <= 3302:
                M.w(w, "LXG-01", "erro", f"{k} fora da numeração válida de Strong")


# ================================================================== D. gramática × glosa (hebraico/aramaico)
CONJ_H = CONJUNCOES | {"e"}
PREP_B = set("""em no na nos nas num numa com por pelo pela pelos pelas entre dentro sobre quando ao aos à às
durante contra nele nela neles nelas mediante diante perante comigo contigo consigo conosco convosco sob
enquanto""".split())
PREP_L = set("""para a ao aos à às de do da dos das lhe lhes por pelo pela pelos pelas em no na nos nas
contra sobre até quanto segundo me te nos vos se mim ti si dele dela deles delas comigo contigo consigo conosco
convosco que como diante perante entre ele ela eles elas com""".split())
PREP_K = set("""como conforme segundo qual assim quando quase cerca semelhante tal tais igual iguais
quanto mesmo modo ao logo enquanto depois apenas""".split())
PREP_M = set("""de do da dos das desde dentre que deste desta dele dela deles delas daquele daquela por pelo
pela pelos pelas fora mais sem dali daí daqui donde após depois""".split())
PART_H = {
    "H3808": (NEGACAO | {"senão", "sim"}, "partícula negativa לֹא sem 'não/nem/nenhum'"),
    "H408": (NEGACAO, "partícula negativa אַל sem 'não/nem/nenhum'"),
    "H2009": ({"eis", "olha", "olhai", "vede", "veja", "vê", "aqui", "ei-lo", "ei-la", "se", "agora"},
              "הִנֵּה sem 'eis'"),
    "H3588": (CONJUNCOES | {"ainda", "verdade", "verdadeiramente", "certo", "quando", "porquanto",
                            "visto", "senão", "mas"}, "כִּי sem 'que/porque/pois/quando'"),
}
# palavras em que o sufixo faz parte do sentido lexical (Adonai "Senhor", kol "todos", levad "sozinho",
# ein/yesh/od/hinneh + sufixo)
SUF_LEXICAL = {"H136", "H3605", "H905", "H369", "H3426", "H5750", "H2009", "H2005", "H413"}
PLURAL_SO = {"H136", "H6440", "H4325", "H8064", "H430", "H2416", "H7356", "H5271", "H2208", "H2205", "H1170"}


def chk_gramatica_h(d, M, ws):
    for w in ws:
        if w[LING] == "G" or not w[MORF] or not w[GL]:
            continue
        lang, pre, raiz, suf = heb_segs(w[MORF])
        ts = toks(w[GL])
        tset = set(ts)
        g = w[GL]
        manual = w[GF] == "manual"
        # GRA-12: partícula de objeto
        if w[STR] == "H853":
            if "[obj]" not in tset and not (tset & PRON_TODOS) and not (tset & CONTRACOES):
                M.w(w, "GRA-12", "aviso", f"partícula de objeto אֵת com glosa '{g}'")
            continue
        if "[obj]" in g:
            M.w(w, "GRA-12", "erro", f"'[obj]' fora da partícula אֵת ({w[STR]})")
        # GRA-13: partículas com glosa fixa
        if w[STR] in PART_H:
            ok, msg = PART_H[w[STR]]
            if not (tset & ok):
                M.w(w, "GRA-13", "aviso", f"{msg}: '{g}'")
        prefs = (w[PREF] or "").split("/") if w[PREF] else []
        # GRA-01: conjunção prefixada
        if "c" in prefs and not (tset & CONJ_H):
            M.w(w, "GRA-01", "info", f"conjunção ו prefixada sem conjunção na glosa: '{g}'")
        # GRA-03: preposições prefixadas
        for p, conj, nome in (("b", PREP_B, "בְּ"), ("l", PREP_L, "לְ"), ("k", PREP_K, "כְּ"), ("m", PREP_M, "מִן")):
            if p in prefs and not (tset & conj) and not (raiz.startswith("V") and raiz[2:3] == "c"):
                M.w(w, "GRA-03", "aviso" if p in ("k",) else "info", f"preposição {nome} prefixada sem equivalente: '{g}'")
        # GRA-02: artigo
        if ("d" in prefs or any(s == "Rd" for s in pre) or raiz == "Rd") and lang == "H":
            if not (tset & (DETERMINANTES | CONTRACOES)) and not nomes_da_glosa(g) and "SENHOR" not in g \
                    and not raiz.startswith("Vr") and not raiz.startswith("Vs"):
                M.w(w, "GRA-02", "info", f"artigo ה sem artigo na glosa: '{g}'")
        # GRA-04: sufixo pronominal
        for s in suf:
            if not s.startswith("Sp") or len(s) < 5 or w[STR] in SUF_LEXICAL or \
                    (raiz.startswith("V") and raiz[2:3] == "c"):
                continue
            pessoa, num = s[2], s[4]
            alvo = "3" if pessoa == "3" else pessoa + ("s" if num == "s" else "p")
            if not (tset & PRON_TODOS) and not (tset & CONTRACOES) and not any(
                    t.endswith(("-lo", "-la")) for t in ts):
                M.w(w, "GRA-04", "aviso", f"sufixo pronominal {s[2:]} sem pronome/possessivo na glosa: '{g}'")
            else:
                outros = set().union(*(v for k, v in PRON.items() if k != alvo))
                if (tset & outros) and not (tset & PRON[alvo]) and not (alvo == "1p" and "nos" in tset) \
                        and not (alvo == "3" and tset & PRON_AMBIG):
                    M.w(w, "GRA-04", "aviso", f"sufixo {s[2:]} mas glosa com pronome de outra pessoa: '{g}'")
        # GRA-05: pessoa do verbo (1ª e 2ª do plural, verbos finitos)
        if raiz.startswith("V") and len(raiz) >= 6 and raiz[2] in "pqiwhjv":
            pessoa, num = raiz[3], raiz[5]
            if pessoa == "1" and num == "p" and not any(t.endswith(("mos", "mo")) or t in ("nós", "nos") for t in ts):
                M.w(w, "GRA-05", "aviso", f"verbo 1ª pl. ({raiz}) sem forma de 'nós' na glosa: '{g}'")
        # GRA-07: infinitivo construto com ל
        if raiz.startswith("V") and len(raiz) >= 3 and raiz[2] == "c" and "l" in prefs and w[STR] != "H559":
            if not (tset & {"para", "a", "de", "ao", "à", "por", "que", "até", "quando", "se", "em"}) and \
                    not any(t.endswith(("ar", "er", "ir", "or")) for t in ts):
                M.w(w, "GRA-07", "info", f"infinitivo com ל sem 'para/a + infinitivo': '{g}'")
        # GRA-10: plural
        if raiz.startswith("Nc") and len(raiz) >= 5 and raiz[3] == "p" and w[STR] not in PLURAL_SO and not manual:
            cont = conteudo(ts)
            if cont and not any(t.endswith("s") for t in ts) and not nomes_da_glosa(g):
                M.w(w, "GRA-10", "info", f"substantivo plural com glosa no singular: '{g}'")
        # ARM-03: estado enfático do aramaico
        if lang == "A" and raiz.startswith("N") and raiz.endswith("d") and raiz[1] != "p":
            if not (tset & (DETERMINANTES | CONTRACOES | PRON_TODOS)):
                M.w(w, "ARM-03", "info", f"estado enfático sem artigo na glosa: '{g}'")
        # ARM-04: partícula דִּי
        if lang == "A" and w[STR] == "H1768":
            if not (tset & ({"que", "qual", "quais", "quem", "porque", "pois", "de", "do", "da", "dos", "das",
                             "quando", "cujo", "cuja", "cujos", "cujas", "onde", "como", "para"} | DETERMINANTES)):
                M.w(w, "ARM-04", "aviso", f"partícula דִּי com glosa '{g}'")


MEDIDAS = {"H520": ("côvad",), "H8255": ("siclo",), "H374": ("efa",), "H1969": ("him", "hin"), "H3734": ("coro",),
           "H6016": ("ômer", "gômer", "feixe"), "H1324": ("bato",), "H4488": ("mina", "libra"), "H7341": ("larg",),
           "H753": ("compr", "longo", "longa", "dura", "extens", "prolong"), "H1092": ("beca", "meio")}


def chk_numeros_e_nomes_divinos(d, M, ws):
    for w in ws:
        g = w[GL]
        if not g:
            continue
        ts = toks(g)
        tset = set(ts)
        k = (w[LIV], w[CAP], w[VER])
        # FAT-03: números da glosa presentes na BLIVRE
        fortes = [t for t in ts if t in NUM_FORTES]
        if fortes:
            bl = d.tokset_blivre(k)
            falta = [t for t in fortes if sem_acento(t) not in bl]
            if falta:
                M.w(w, "FAT-03", "aviso", f"número '{falta[0]}' da glosa não aparece no versículo da BLIVRE")
        if w[LING] != "G":
            raiz = heb_segs(w[MORF])[2]
            if raiz.startswith("Ac") and w[STR] not in ("H259",) and not (tset & NUMEROS) and \
                    not (tset & ORDINAIS) and not any(t.startswith(("centuri", "dezen", "milhar", "centen")) for t in ts):
                M.w(w, "FAT-03", "aviso", f"numeral cardinal ({w[STR]}) sem número na glosa: '{g}'")
        # FAT-09: medidas e unidades
        if w[STR] in MEDIDAS and not any(t.startswith(MEDIDAS[w[STR]]) for t in ts):
            M.w(w, "FAT-09", "aviso", f"medida {w[STR]} glosada '{g}' (esperado {'/'.join(MEDIDAS[w[STR]])}…)")
        # FAT-04: nomes divinos
        s = w[STR]
        if s == "H3068" and "SENHOR" not in g and "DEUS" not in g:
            M.w(w, "FAT-04", "aviso", f"YHWH com glosa '{g}' (esperado SENHOR / DEUS)")
        elif s == "H136" and not re.search(r"(^|-)Senhor(es)?($|-)|(^|-)senhor", g):
            M.w(w, "FAT-04", "aviso", f"Adonai com glosa '{g}' (esperado Senhor)")
        elif s == "H430" and not (tset & {"deus", "deuses", "divino", "divina", "juízes", "anjos", "poderosos"}):
            M.w(w, "FAT-04", "aviso", f"Elohim com glosa '{g}' (esperado Deus/deuses)")
        elif s == "H3050" and not re.search(r"SENHOR|JAH|Jah|DEUS|aleluia", g, re.I):
            M.w(w, "FAT-04", "aviso", f"Yah com glosa '{g}'")


# ================================================================== E. grego
ART_OK = DETERMINANTES | CONTRACOES | PREPOSICOES | PRON_TODOS | {"que", "quem", "qual", "quais", "coisas",
                                                                  "aquilo", "aquele", "aqueles"}
PART_G = {
    "καί": CONJUNCOES | {"inclusive", "nem"},
    "δέ": CONJUNCOES | {"entretanto", "enquanto", "porém", "ora", "outro", "outros", "uns", "uma", "um"},
    "γάρ": CONJUNCOES | {"verdade", "realmente", "certo", "porquanto"},
    "οὖν": CONJUNCOES | {"isso", "isto", "pois", "portanto", "então", "logo"},
    "ἀλλά": CONJUNCOES | {"contrário", "senão"},
    "ἵνα": CONJUNCOES | {"para", "a", "fim", "de", "afim"},
    "ὅτι": CONJUNCOES | {"pois", "visto", "porquanto", "como"},
}
NEG_G = {"οὐ", "μή", "οὐδέ", "μηδέ", "οὐδείς", "μηδείς", "οὔτε", "μήτε", "οὐκέτι", "μηκέτι", "οὔπω", "μήπω",
         "οὐχί", "οὐδαμῶς", "οὐθείς", "μηθείς", "οὐδέποτε", "μηδέποτε", "οὐδαμῶς"}
PREP_CASO = {  # (lema, caso): (glosas que indicam o outro caso, sem as do próprio caso)
    ("διά", "A"): ({"meio", "através"}, {"causa", "razão", "isso", "motivo", "porque", "porquanto"},
                   "διά + acusativo ('por causa de') glosada como 'por meio de'"),
    ("διά", "G"): ({"causa", "razão", "motivo"}, {"meio", "através", "pelo", "pela", "por", "pelos", "pelas",
                                                   "durante", "entre", "de", "em"},
                   "διά + genitivo ('por meio de') glosada como 'por causa de'"),
    ("μετά", "A"): ({"com", "conosco", "comigo", "contigo", "convosco", "consigo"}, {"depois", "após", "passados",
                                                                                    "passado", "dentro", "em"},
                    "μετά + acusativo ('depois de') glosada como 'com'"),
    ("μετά", "G"): ({"depois", "após"}, {"com", "conosco", "comigo", "contigo", "convosco", "consigo", "entre"},
                    "μετά + genitivo ('com') glosada como 'depois de'"),
    ("ὑπό", "A"): ({"pelo", "pela", "pelos", "pelas"}, {"debaixo", "sob", "abaixo"},
                   "ὑπό + acusativo ('debaixo de') glosada como agente 'por'"),
    ("ὑπό", "G"): ({"debaixo", "sob", "abaixo"}, {"por", "pelo", "pela", "pelos", "pelas", "de"},
                   "ὑπό + genitivo ('por', agente) glosada como 'debaixo de'"),
}
CRASE = {"κἀγώ": ({"eu", "me", "mim", "também", "nós"}, "κἀγώ (= καί + ἐγώ) sem 'eu/me/mim/também'"),
         "κἀκεῖ": ({"ali", "lá", "aí", "também", "e"}, "κἀκεῖ (= καί + ἐκεῖ) sem 'ali/lá'"),
         "κἀκεῖθεν": ({"dali", "daí", "ali", "lá", "depois", "e"}, "κἀκεῖθεν sem 'e dali'"),
         "κἀκεῖνος": (PRON["3"] | {"aquele", "aquela", "aqueles", "aquelas", "este", "esta", "estes", "também",
                                   "esse", "essa", "o", "a", "os", "as", "e", "outro", "outros", "isto"},
                      "κἀκεῖνος sem 'e aquele/ele'")}


def caso_seguinte(vs, i):
    for w in vs[i + 1:i + 4]:
        pos, parse = grk(w[MORF])
        if parse[4] in "NGDAV" and parse[4] != "-":
            return parse[4]
    return None


def chk_grego(d, M, ws):
    por_verso = defaultdict(list)
    for w in ws:
        if w[LING] == "G":
            por_verso[(w[LIV], w[CAP], w[VER])].append(w)
    for k, vs in por_verso.items():
        for i, w in enumerate(vs):
            g = w[GL]
            if not g:
                continue
            ts = toks(g)
            tset = set(ts)
            pos, parse = grk(w[MORF])
            lema = w[LEMA] or ""
            # GRG-01: artigo
            if pos == "RA":
                fora = [t for t in ts if t not in ART_OK]
                if fora:
                    M.w(w, "GRG-01", "aviso", f"artigo com glosa que não é artigo/preposição: '{g}'")
                elif parse[5] == "P" and not (tset - {"de", "a", "em", "que", "para", "por", "com"}) is False and \
                        tset <= {"o", "a", "do", "da", "ao", "à", "no", "na", "pelo", "pela"}:
                    M.w(w, "GRG-01", "info", f"artigo plural com glosa no singular: '{g}'")
                continue
            # GRG-11: negação
            if lema in NEG_G:
                ok = NEGACAO | ({"porventura", "acaso", "que", "senão", "para"} if lema in ("μή", "μήτε") else set()) \
                    | ({"porventura", "acaso"} if lema in ("οὐ", "οὐχί") else set())
                if not (tset & ok):
                    M.w(w, "GRG-11", "aviso", f"negação {lema} sem 'não/nem/nenhum' na glosa: '{g}'")
                continue
            # GRG-12: conjunções e partículas
            if lema in PART_G and not (tset & PART_G[lema]):
                M.w(w, "GRG-12", "aviso" if lema in ("ἵνα", "ὅτι", "γάρ", "ἀλλά") else "info",
                    f"{lema} com glosa '{g}'")
                continue
            # TXG-03: crase
            if lema in CRASE:
                ok, msg = CRASE[lema]
                if not (tset & ok):
                    M.w(w, "TXG-03", "aviso", f"{msg}: '{g}'")
                continue
            # GRG-10: preposição × caso
            if pos == "P" and lema in ("διά", "μετά", "ὑπό"):
                caso = caso_seguinte(vs, i)
                regra = PREP_CASO.get((lema, caso))
                if regra:
                    errado, certo, msg = regra
                    if tset & errado and not (tset & certo):
                        M.w(w, "GRG-10", "aviso", f"{msg}: '{g}'")
                continue
            # GRG-13: pronomes pessoais
            if lema in ("ἐγώ", "σύ", "αὐτός") and pos.startswith("R"):
                alvo = {"ἐγώ": ("1s", "1p"), "σύ": ("2s", "2p"), "αὐτός": ("3",)}[lema]
                proprio = set().union(*(PRON[a] for a in alvo)) | ({"nos"} if lema == "ἐγώ" else set())
                outros = set().union(*(v for kk, v in PRON.items() if kk not in alvo))
                if lema == "αὐτός":
                    proprio |= PRON_AMBIG | {"mesmo", "mesma", "mesmos", "mesmas", "próprio", "própria", "próprios"}
                if (tset & outros) and not (tset & proprio):
                    M.w(w, "GRG-13", "aviso", f"{lema} ({parse[0] if parse[0] != '-' else 'pron.'}) com glosa de outra pessoa: '{g}'")
                continue
            # GRG-05: pessoa do verbo (1ª pl.)
            if pos == "V" and parse[3] in "ISOD" and parse[0] == "1" and parse[5] == "P":
                if not any(t.endswith(("mos", "mo")) or t in ("nós", "nos") for t in ts):
                    M.w(w, "GRG-05", "aviso", f"verbo 1ª pl. sem forma de 'nós' na glosa: '{g}'")
            # GRG-04: plural
            if pos == "N" and parse[5] == "P" and not lema[:1].isupper():
                cont = conteudo(ts)
                if cont and not any(t.endswith("s") for t in ts) and lema not in ("οὐρανός",):
                    M.w(w, "GRG-04", "info", f"substantivo plural com glosa no singular: '{g}'")


# ================================================================== G. consistência
GL_OK = re.compile(r"^-?[^\W\d_]+(?:[’']?[^\W\d_]+)*(?:-(?:[^\W\d_]+(?:[’'][^\W\d_]+)*|\[obj\]))*$|^\[obj\]$|"
                   r"^[^\W\d_]+(?:-[^\W\d_]+)*-\[obj\](?:-[^\W\d_]+)*$", re.U)


def chk_estilo(d, M, ws):
    for w in ws:
        g = w[GL]
        if not g:
            continue
        if " " in g or "--" in g or g.endswith("-") or not GL_OK.match(g):
            M.w(w, "CON-04", "erro", f"glosa fora do estilo (espaço, pontuação, hífen solto): '{g}'")
            continue
        partes = g.split("-")
        for t in partes:
            if t and not t.isupper() and not t.islower() and not (t[0].isupper() and t[1:].islower()):
                M.w(w, "CON-04", "aviso", f"maiúsculas no meio da palavra: '{g}'")
                break
        ts = toks(g)
        if any(a == b for a, b in zip(ts, ts[1:])):
            M.w(w, "CON-04", "aviso", f"palavra repetida na glosa: '{g}'")
        if len(g) > 40 or len(ts) > 6:
            M.w(w, "CON-04", "aviso", f"glosa longa demais ({len(ts)} palavras): '{g}'")


def chk_consistencia(d, M, ws, livros_escopo):
    """CON-01 (mesma forma + morfologia no livro) e CON-02 (mesmo Strong na Bíblia)."""
    marcados = set()
    grupos = defaultdict(list)
    for w in d.palavras:
        if w[LIV] in livros_escopo and w[GL] and w[GF] != "manual" and not eh_nome_proprio(w):
            p = grk(w[MORF])[0] if w[LING] == "G" else heb_segs(w[MORF])[2][:1]
            if p in ("N", "V", "A"):
                grupos[(w[LIV], forma_norm(w), w[MORF])].append(w)
    for k, g_ws in grupos.items():
        n = len(g_ws)
        if n < 4:
            continue
        cont = Counter(w[GL].lower() for w in g_ws)
        maj, nmaj = cont.most_common(1)[0]
        if nmaj / n < 0.5:
            continue
        st_maj = stems_conteudo(maj)
        freq_st = Counter(s for w in g_ws for s in stems_conteudo(w[GL]))
        for w in g_ws:
            gl = w[GL].lower()
            if gl == maj or cont[gl] / n > 0.2:
                continue
            st = stems_conteudo(gl)
            if not st or not st_maj:
                continue
            if st & st_maj or any(freq_st[s] / n >= 0.15 for s in st):
                continue
            marcados.add(w[ID])
            M.w(w, "CON-01", "aviso", f"'{w[GL]}' destoa da glosa usual '{maj}' ({nmaj}/{n}) desta forma no livro")
    # CON-02: por Strong, na Bíblia inteira (só palavras de conteúdo)
    por_strong = defaultdict(list)
    for w in d.palavras:
        if not w[GL] or not w[STR] or eh_nome_proprio(w):
            continue
        p = grk(w[MORF])[0] if w[LING] == "G" else heb_segs(w[MORF])[2][:1]
        if p in ("N", "V", "A"):
            por_strong[w[STR]].append(w)
    for s, g_ws in por_strong.items():
        n = len(g_ws)
        if n < 20:
            continue
        freq = Counter()
        for w in g_ws:
            freq.update(stems_conteudo(w[GL]))
        top, ntop = freq.most_common(1)[0] if freq else (None, 0)
        if ntop / n < 0.6:
            continue
        polissemico = sum(1 for x, k in freq.items() if k / n >= 0.03) >= 4
        for w in g_ws:
            if w[ID] in marcados or w[LIV] not in livros_escopo or w[GF] == "manual":
                continue
            st = stems_conteudo(w[GL])
            if st and all(freq[x] / n < 0.01 for x in st):
                M.w(w, "CON-02", "info" if polissemico else "aviso", f"glosa rara '{w[GL]}' para {s} (usual: '{top}…', {ntop}/{n})")


# ================================================================== H. nomes próprios
def nome_dominante(g_ws):
    c = Counter()
    for w in g_ws:
        ns = nomes_da_glosa(w[GL])
        if ns:
            c[ns[0]] += 1
    return c


def chk_nomes(d, M, ws, livros_escopo):
    # FAT-01: nome da glosa aparece no versículo da BLIVRE
    for w in ws:
        if not w[GL] or not eh_nome_proprio(w):
            continue
        ns = nomes_da_glosa(w[GL])
        bl = d.tokset_blivre((w[LIV], w[CAP], w[VER]))
        if not ns:
            if not any(t[:1].isupper() for t in w[GL].split("-")):
                M.w(w, "FAT-01", "info", f"nome próprio com glosa em minúsculas: '{w[GL]}'")
            continue
        falta = [x for x in ns if sem_acento(x.lower()) not in bl]
        if falta:
            M.w(w, "FAT-01", "aviso", f"nome '{falta[0]}' não aparece no versículo da BLIVRE")
    # FAT-02: mesmo Strong de nome próprio → mesmo nome
    por_strong = defaultdict(list)
    for w in d.palavras:
        if w[GL] and w[STR] and eh_nome_proprio(w):
            por_strong[w[STR]].append(w)
    dom = {}
    for s, g_ws in por_strong.items():
        c = nome_dominante(g_ws)
        if not c:
            continue
        top, ntop = c.most_common(1)[0]
        dom[s] = (top, ntop, len(g_ws))
        n = sum(c.values())
        if n < 5 or ntop / n < 0.7:
            continue
        for w in g_ws:
            if w[LIV] not in livros_escopo:
                continue
            ns = nomes_da_glosa(w[GL])
            if ns and top not in ns and c[ns[0]] / n <= 0.1 and stem(ns[0])[:3] != stem(top)[:3]:
                M.w(w, "FAT-02", "aviso", f"{s} glosado '{ns[0]}'; no resto da Bíblia é '{top}' ({ntop}/{n})")
    # GRG-15 / CRG-05: nome grego de origem hebraica × nome no AT
    vistos = set()
    for w in d.palavras:
        if w[LING] != "G" or not w[STR] or w[STR] in vistos or w[STR] not in dom or w[LIV] not in livros_escopo:
            continue
        vistos.add(w[STR])
        der = (d.lexico.get(w[STR]) or [None] * 10)[5] or ""
        m = re.search(r"of Hebrew origin \(H0*(\d+)\)", der)
        if not m:
            continue
        h = "H" + m.group(1)
        if h not in dom:
            continue
        gn, hn = dom[w[STR]][0], dom[h][0]
        if sem_acento(gn.lower()) == sem_acento(hn.lower()):
            continue
        indecl = not re.search(r"[ςνυ]$", sem_acento(w[LEMA] or ""))  # Ἀβραάμ, Δαυίδ
        cod = "GRG-15" if indecl else "CRG-05"
        if w[STR] in ("G2424",):  # Ἰησοῦς ← Josué: diferença esperada
            continue
        M.w(w, cod, "aviso" if stem(gn)[:3] != stem(hn)[:3] else "info",
            f"{w[LEMA]} glosado '{gn}' no NT; {h} é '{hn}' no AT")


# ================================================================== I. cruzamentos
PARALELOS_AT = [
    (("PSA", 18, 1, 18, 50), ("2SA", 22, 1, 22, 51)),
    (("PSA", 14, 1, 14, 7), ("PSA", 53, 1, 53, 6)),
    (("PSA", 40, 13, 40, 17), ("PSA", 70, 1, 70, 5)),
    (("PSA", 108, 1, 108, 5), ("PSA", 57, 7, 57, 11)),
    (("PSA", 108, 6, 108, 13), ("PSA", 60, 5, 60, 12)),
    (("1CH", 16, 8, 16, 22), ("PSA", 105, 1, 105, 15)),
    (("1CH", 16, 23, 16, 33), ("PSA", 96, 1, 96, 13)),
    (("ISA", 36, 1, 39, 8), ("2KI", 18, 13, 20, 19)),
    (("JER", 52, 1, 52, 34), ("2KI", 24, 18, 25, 30)),
    (("GEN", 36, 10, 36, 43), ("1CH", 1, 35, 1, 54)),
    (("EZR", 2, 1, 2, 70), ("NEH", 7, 6, 7, 73)),
    (("EXO", 20, 1, 20, 17), ("DEU", 5, 6, 5, 21)),
    (("MIC", 4, 1, 4, 3), ("ISA", 2, 2, 2, 4)),
    (("OBA", 1, 1, 1, 9), ("JER", 49, 7, 49, 22)),
    (("2SA", 7, 1, 7, 29), ("1CH", 17, 1, 17, 27)),
    (("1KI", 8, 12, 8, 53), ("2CH", 6, 1, 6, 42)),
]
PARALELOS_NT = [
    (("2PE", 2, 1, 2, 22), ("JUD", 1, 3, 1, 18)),
]


def trecho(d, t):
    b, c1, v1, c2, v2 = t
    return [w for w in d.palavras if w[LIV] == b and (c1, v1) <= (w[CAP], w[VER]) <= (c2, v2)]


def chk_paralelos(d, M, livros_escopo):
    for lista, cod in ((PARALELOS_AT, "CRZ-02"), (PARALELOS_NT, "CRZ-03")):
        for a, b in lista:
            if a[0] not in livros_escopo and b[0] not in livros_escopo:
                continue
            wa, wb = trecho(d, a), trecho(d, b)
            if not wa or not wb:
                continue
            sa = [(forma_norm(w), w[MORF]) for w in wa]
            sb = [(forma_norm(w), w[MORF]) for w in wb]
            sm = SequenceMatcher(None, sa, sb, autojunk=False)
            for bl in sm.get_matching_blocks():
                if bl.size < 3:
                    continue
                for i in range(bl.size):
                    x, y = wa[bl.a + i], wb[bl.b + i]
                    if not x[GL] or not y[GL] or x[GL].lower() == y[GL].lower():
                        continue
                    sx, sy = stems_conteudo(x[GL]), stems_conteudo(y[GL])
                    if (sx or sy) and not (sx & sy):
                        msg = f"'{y[GL]}' × '{x[GL]}' em {ref(x)} (mesmo original)"
                        M.w(y, cod, "aviso", msg)
                        M.w(x, cod, "aviso", f"'{x[GL]}' × '{y[GL]}' em {ref(y)} (mesmo original)")


EQUIV = [("H7307", "G4151", "espírito"), ("H8451", "G3551", "lei"), ("H2617", "G1656", "misericórdia"),
         ("H1285", "G1242", "aliança"), ("H6662", "G1342", "justo"), ("H5315", "G5590", "alma"),
         ("H3820", "G2588", "coração"), ("H3519", "G1391", "glória"), ("H7965", "G1515", "paz"),
         ("H3444", "G4991", "salvação"), ("H6944", "G40", "santo"), ("H4397", "G32", "anjo")]
CRG02 = {"G5008", "G2891", "G5", "G2188", "G1682", "G2982", "G4518", "G3134", "G4461", "G281", "G5614",
         "G239", "G2878", "G3126", "G1115", "G2786"}


def chk_pontes(d, M, livros_escopo):
    por_strong = defaultdict(list)
    alvos = {s for e in EQUIV for s in e[:2]} | CRG02
    for w in d.palavras:
        if w[STR] in alvos and w[GL]:
            por_strong[w[STR]].append(w)

    def dominante(s):
        c = Counter()
        for w in por_strong.get(s, []):
            c.update(stems_conteudo(w[GL]))
        return c

    for h, g, esperado in EQUIV:
        ch, cg = dominante(h), dominante(g)
        if not ch or not cg or not por_strong[g]:
            continue
        th = {s for s, _ in ch.most_common(3)}
        tg = {s for s, _ in cg.most_common(3)}
        w = por_strong[g][0]
        if w[LIV] not in livros_escopo:
            continue
        if not (th & tg):
            M.w(w, "CRZ-05", "aviso", f"{h} ↔ {g}: glosas sem família comum ({sorted(th)} × {sorted(tg)}); esperado '{esperado}'")
        elif stem(esperado) not in (th | tg):
            M.w(w, "CRZ-05", "info", f"{h} ↔ {g}: '{esperado}' não está entre as glosas mais comuns")
    # CRG-02: palavras aramaicas/hebraicas transliteradas no NT
    for s in CRG02:
        g_ws = por_strong.get(s, [])
        if not g_ws:
            continue
        c = dominante(s)
        if not c:
            continue
        top, ntop = c.most_common(1)[0]
        for w in g_ws:
            if w[LIV] in livros_escopo and len(g_ws) >= 2 and not (stems_conteudo(w[GL]) & {top}) and \
                    all(c[x] / len(g_ws) < 0.2 for x in stems_conteudo(w[GL])):
                M.w(w, "CRG-02", "aviso", f"transliteração {w[LEMA]} glosada '{w[GL]}' (usual '{top}…')")
    # ARM-07: verbete aramaico "corresponding to H####" com glosa da mesma família do hebraico
    por_str_a = defaultdict(list)
    for w in d.palavras:
        if w[LING] == "A" and w[STR] and w[GL]:
            por_str_a[w[STR]].append(w)
    for s, g_ws in por_str_a.items():
        e = d.lexico.get(s)
        if not e:
            continue
        der = e[5] or ""
        m = re.search(r"corresponding to H0*(\d+)", der)
        if m:
            h = "H" + m.group(1)
            th = set()
            for t, n in d.trad.get(h, {}).items():
                th |= {stem(x) for x in conteudo(toks(t))}
            if not th:
                continue
            ca = Counter()
            for w in g_ws:
                ca.update(stems_conteudo(w[GL]))
            if not ca:
                continue
            ta = {x for x, _ in ca.most_common(2)}
            w = g_ws[0]
            if w[LIV] in livros_escopo and not (ta & th) and len(g_ws) >= 2:
                M.w(w, "ARM-07", "info", f"aramaico {s} glosado {sorted(ta)}; o hebraico {h} é traduzido {sorted(th)[:4]}")
        # ARM-06: verbete do Strong precisa ser o aramaico
        if s[1:].isdigit() and "(Aramaic)" not in der and "Chaldee" not in der and not (e[2] and heb_segs(g_ws[0][MORF])[2].startswith("Np")):
            for w in g_ws:
                if w[LIV] in livros_escopo:
                    M.w(w, "ARM-06", "info", f"palavra aramaica com verbete {s} sem marca '(Aramaic)'")
                    break
    # ARM-10: Jr 10:11, as duas grafias de "terra"
    if "JER" in livros_escopo:
        ws = d.por_verso.get(("JER", 10, 11), [])
        terra = [w for w in ws if w[STR] in ("H778", "H772")]
        gl = {tuple(sorted(stems_conteudo(w[GL]))) for w in terra if w[GL]}
        if len(gl) > 1:
            M.add("JER", 10, 11, None, "ARM-10", "aviso",
                  "as duas grafias de 'terra' com glosas diferentes: " + ", ".join(w[GL] for w in terra))


def chk_apoio(d, M, ws):
    """CRZ-01: glosa sem apoio no alinhamento e sem nenhuma palavra presente no versículo da BLIVRE."""
    for w in ws:
        if w[GF] not in ("lexico", "parcial") or not w[GL]:
            continue
        st = stems_conteudo(w[GL])
        if not st:
            continue
        bl = {stem(x) for x in d.tokset_blivre((w[LIV], w[CAP], w[VER]))}
        if not (st & bl):
            M.w(w, "CRZ-01", "info", f"glosa '{w[GL]}' (fonte {w[GF]}) sem palavra correspondente na BLIVRE do versículo")


def chk_grego_strong(d, M, ws):
    for w in ws:
        if w[LING] != "G":
            continue
        if w[SF] == "aprox":
            e = d.lexico.get(w[STR] or "")
            M.w(w, "LXG-02", "aviso", f"lema {w[LEMA]} ligado a {w[STR]} ({e[2] if e else '?'}) por semelhança")


# ================================================================== saída
def escrever(M, d, escopo, t0):
    os.makedirs(OUT, exist_ok=True)
    ordem = d.ordem
    marcas = sorted(M.lista, key=lambda m: (ordem.get(m["livro"], 999), m["cap"], m["vers"] if m["vers"] is not None else 0,
                                           m["palavra_id"] or 0, m["codigo"]))
    with open(os.path.join(OUT, "marcas.json"), "w", encoding="utf8") as f:
        f.write("[\n" + ",\n".join(json.dumps(m, ensure_ascii=False) for m in marcas) + "\n]\n")
    por_cap = defaultdict(Counter)
    for m in marcas:
        por_cap[(m["livro"], m["cap"])][m["nivel"]] += 1
    with open(os.path.join(OUT, "resumo.tsv"), "w", encoding="utf8") as f:
        f.write("livro\tcap\tn_erros\tn_avisos\tn_info\n")
        for (b, c) in sorted(por_cap, key=lambda k: (ordem.get(k[0], 999), k[1])):
            n = por_cap[(b, c)]
            f.write(f"{b}\t{c}\t{n['erro']}\t{n['aviso']}\t{n['info']}\n")
    por_cod = defaultdict(Counter)
    exemplos = defaultdict(list)
    por_livro = defaultdict(Counter)
    for m in marcas:
        por_cod[m["codigo"]][m["nivel"]] += 1
        por_livro[m["livro"]][m["nivel"]] += 1
        if len(exemplos[m["codigo"]]) < 3 and (not exemplos[m["codigo"]] or
                                               exemplos[m["codigo"]][-1]["livro"] != m["livro"] or len(marcas) < 50):
            exemplos[m["codigo"]].append(m)
    for m in marcas:  # completa exemplos quando o código só aparece num livro
        if len(exemplos[m["codigo"]]) < 3 and m not in exemplos[m["codigo"]]:
            exemplos[m["codigo"]].append(m)
    textos = {}
    pids = {m["palavra_id"] for es in exemplos.values() for m in es if m["palavra_id"]}
    for w in d.palavras:
        if w[ID] in pids:
            textos[w[ID]] = w
    abrev = {r[1]: r[3] for r in d.livros}
    esc = "Bíblia inteira" if escopo == (None, None) else " ".join(str(x) for x in escopo if x is not None)
    L = [f"# Relatório de revisão automática — {esc}", "",
         f"Gerado por `scripts/revisar.py` em {time.strftime('%Y-%m-%d %H:%M')} ({time.time() - t0:.0f}s). "
         f"Catálogo: `docs/REVISOES.md`.", "",
         f"**Total:** {len(marcas)} marcas — "
         f"{sum(c['erro'] for c in por_cod.values())} erros, {sum(c['aviso'] for c in por_cod.values())} avisos, "
         f"{sum(c['info'] for c in por_cod.values())} informativas.", "",
         "## Totais por código", "", "| Código | Erros | Avisos | Info | Total |", "|---|---:|---:|---:|---:|"]
    for cod in sorted(por_cod):
        c = por_cod[cod]
        L.append(f"| {cod} | {c['erro']} | {c['aviso']} | {c['info']} | {sum(c.values())} |")
    L += ["", "## Totais por livro", "", "| Livro | Erros | Avisos | Info |", "|---|---:|---:|---:|"]
    for b in sorted(por_livro, key=lambda k: ordem.get(k, 999)):
        c = por_livro[b]
        L.append(f"| {b} | {c['erro']} | {c['aviso']} | {c['info']} |")
    L += ["", "## Exemplos por código", ""]
    for cod in sorted(exemplos):
        L.append(f"### {cod}")
        L.append("")
        for m in exemplos[cod]:
            w = textos.get(m["palavra_id"])
            pal = f" — `{w[TXT]}` ({w[STR]}, {w[MORF]})" if w else ""
            L.append(f"- {abrev.get(m['livro'], m['livro'])} {m['cap']}:{m['vers']} [{m['nivel']}]{pal}: {m['msg']}")
        L.append("")
    with open(os.path.join(OUT, "relatorio.md"), "w", encoding="utf8") as f:
        f.write("\n".join(L))
    return por_cod


def main(argv):
    t0 = time.time()
    livro = argv[0].upper() if argv else None
    cap = int(argv[1]) if len(argv) > 1 else None
    db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    d = Dados(db)
    if livro and livro not in d.ordem:
        sys.exit(f"livro desconhecido: {livro} (use os códigos de `consulta.py livros`)")
    escopo = (livro, cap)
    M = Marcas(escopo)
    livros_escopo = {livro} if livro else set(d.ordem)
    ws = [w for w in d.palavras if (livro is None or w[LIV] == livro) and (cap is None or w[CAP] == cap)]

    etapas = [
        ("texto-base", lambda: chk_texto_base(d, M, livros_escopo)),
        ("unicode", lambda: chk_unicode(d, M, ws)),
        ("versículos", lambda: chk_versos_e_capitulos(d, M, livros_escopo)),
        ("aramaico", lambda: chk_aramaico(d, M, ws)),
        ("versificação", lambda: chk_versificacao(d, M, livros_escopo)),
        ("deslocamento", lambda: chk_deslocamento(d, M, livros_escopo)),
        ("cobertura/léxico", lambda: chk_lexico(d, M, chk_cobertura(d, M, ws))),
        ("gramática hebraica", lambda: chk_gramatica_h(d, M, ws)),
        ("números e nomes divinos", lambda: chk_numeros_e_nomes_divinos(d, M, ws)),
        ("grego", lambda: (chk_grego(d, M, ws), chk_grego_strong(d, M, ws))),
        ("estilo", lambda: chk_estilo(d, M, ws)),
        ("consistência", lambda: chk_consistencia(d, M, ws, livros_escopo)),
        ("nomes", lambda: chk_nomes(d, M, ws, livros_escopo)),
        ("paralelos", lambda: chk_paralelos(d, M, livros_escopo)),
        ("pontes", lambda: chk_pontes(d, M, livros_escopo)),
        ("apoio", lambda: chk_apoio(d, M, ws)),
    ]
    tempos = []
    for nome, f in etapas:
        t = time.time()
        f()
        tempos.append((nome, time.time() - t))
    por_cod = escrever(M, d, escopo, t0)
    print(f"{len(ws)} palavras revisadas em {time.time() - t0:.1f}s; {len(M.lista)} marcas → {os.path.relpath(OUT, ROOT)}/")
    if os.environ.get("REVISAR_TEMPOS"):
        for nome, t in tempos:
            print(f"  {nome:<26}{t:6.1f}s")
    print(f"{'código':<8} {'erro':>6} {'aviso':>6} {'info':>6}  {'% palavras':>10}")
    for cod in sorted(por_cod):
        c = por_cod[cod]
        pct = 100 * sum(c.values()) / max(1, len(ws))
        print(f"{cod:<8} {c['erro']:>6} {c['aviso']:>6} {c['info']:>6}  {pct:9.2f}%")
    tot = Counter()
    for c in por_cod.values():
        tot.update(c)
    print(f"{'total':<8} {tot['erro']:>6} {tot['aviso']:>6} {tot['info']:>6}")


if __name__ == "__main__":
    main(sys.argv[1:])
