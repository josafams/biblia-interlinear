#!/usr/bin/env python3
"""Revisões automáticas do catálogo docs/REVISOES.md sobre build/biblia.sqlite (só leitura).

Roda as verificações automatizáveis sem rede e sem IA: integridade do texto-base (comparando
com os arquivos de sources/, quando presentes), versificação, cobertura, gramática × glosa
(hebraico, aramaico e grego), consistência, léxico, nomes, números e cruzamentos entre passagens
paralelas. Cada marca tem o código do catálogo e um nível: 'erro', 'aviso' ou 'info'.

Saídas em build/review/: marks.json, summary.tsv, report.md; totais por código no terminal.

Uso: python3 scripts/review.py [LIVRO [CAP]]      (ex.: GEN · GEN 1 · JHN 3)
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
from pathlib import Path

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB = os.path.join(ROOT, "build", "biblia.sqlite")
SOURCES_DIR = os.path.join(ROOT, "sources")
OUT = os.path.join(ROOT, "build", "review")

sys.path.insert(0, os.path.dirname(__file__))
try:
    from books import BOOKS  # (código, OSIS morphhb, TAHOT, scrollmapper, MorphGNT, nome, abrev)
except Exception:  # pragma: no cover
    BOOKS = []

# campos da tabela palavras
ID, BOOK, CAP, VER, POS, LING, TXT, LEMMA, STR, PREF, MORPH_COL, REF, GL, GF, SF = range(15)

LEVELS = ("erro", "aviso", "info")


# ------------------------------------------------------------------ português
def without_accent(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


TOKEN_PT = re.compile(r"[^\W\d_]+", re.U)


def toks(gloss):
    return [t for t in (gloss or "").lower().split("-") if t]


ARTICLES = set(["o", "a", "os", "as"])
DETERMINERS = ARTICLES | set(
    [
        "do",
        "da",
        "dos",
        "das",
        "no",
        "na",
        "nos",
        "nas",
        "ao",
        "à",
        "aos",
        "às",
        "pelo",
        "pela",
        "pelos",
        "pelas",
        "um",
        "uma",
        "uns",
        "umas",
        "num",
        "numa",
        "dum",
        "duma",
        "este",
        "esta",
        "estes",
        "estas",
        "isto",
        "esse",
        "essa",
        "esses",
        "essas",
        "isso",
        "aquele",
        "aquela",
        "aqueles",
        "aquelas",
        "aquilo",
        "deste",
        "desta",
        "destes",
        "destas",
        "disto",
        "neste",
        "nesta",
        "nestes",
        "nestas",
        "nisto",
        "desse",
        "dessa",
        "desses",
        "dessas",
        "nesse",
        "nessa",
        "daquele",
        "daquela",
        "daqueles",
        "daquelas",
        "daquilo",
        "naquele",
        "naquela",
        "naqueles",
        "naquelas",
        "naquilo",
        "àquele",
        "àquela",
        "àqueles",
        "àquelas",
        "que",
        "qual",
        "quais",
        "quem",
    ]
)
PREPOSITIONS = set(
    [
        "de",
        "em",
        "a",
        "para",
        "por",
        "com",
        "sem",
        "sob",
        "sobre",
        "entre",
        "contra",
        "até",
        "desde",
        "perante",
        "ante",
        "após",
        "segundo",
        "conforme",
        "diante",
        "dentro",
        "fora",
        "junto",
        "acima",
        "abaixo",
        "debaixo",
        "através",
        "durante",
        "mediante",
        "trás",
        "atrás",
        "frente",
        "perto",
        "longe",
        "pra",
        "pro",
    ]
)
CONTRACTIONS = set(
    [
        "do",
        "da",
        "dos",
        "das",
        "no",
        "na",
        "nos",
        "nas",
        "ao",
        "à",
        "aos",
        "às",
        "pelo",
        "pela",
        "pelos",
        "pelas",
        "num",
        "numa",
        "dum",
        "duma",
        "nele",
        "nela",
        "neles",
        "nelas",
        "dele",
        "dela",
        "deles",
        "delas",
        "deste",
        "desta",
        "destes",
        "destas",
        "disto",
        "neste",
        "nesta",
        "nestes",
        "nestas",
        "nisto",
        "desse",
        "dessa",
        "nesse",
        "nessa",
        "daquele",
        "daquela",
        "naquele",
        "naquela",
        "àquele",
        "àquela",
        "daí",
        "dali",
        "daqui",
        "donde",
        "aonde",
        "comigo",
        "contigo",
        "consigo",
        "conosco",
        "convosco",
    ]
)
CONJUNCTIONS = set(
    [
        "e",
        "mas",
        "porém",
        "pois",
        "porque",
        "que",
        "então",
        "ou",
        "nem",
        "contudo",
        "todavia",
        "também",
        "logo",
        "portanto",
        "assim",
        "ora",
        "quando",
        "se",
        "porquanto",
        "embora",
        "ainda",
        "senão",
        "enquanto",
        "como",
        "antes",
        "sim",
        "certamente",
        "depois",
        "tanto",
        "quer",
        "até",
        "mesmo",
        "entretanto",
        "conforme",
        "segundo",
        "visto",
        "já",
        "agora",
        "eis",
    ]
)
PRON = {
    "1s": set(["eu", "me", "mim", "meu", "minha", "meus", "minhas", "comigo"]),
    "1p": set(["nós", "nosso", "nossa", "nossos", "nossas", "conosco"]),
    "2s": set(["tu", "te", "ti", "teu", "tua", "teus", "tuas", "contigo"]),
    "2p": set(["vós", "vos", "vosso", "vossa", "vossos", "vossas", "convosco"]),
    "3": set(
        [
            "ele",
            "ela",
            "eles",
            "elas",
            "lhe",
            "lhes",
            "seu",
            "sua",
            "seus",
            "suas",
            "dele",
            "dela",
            "deles",
            "delas",
            "nele",
            "nela",
            "neles",
            "nelas",
            "si",
            "consigo",
            "lo",
            "la",
            "los",
            "las",
            "lho",
            "lha",
        ]
    ),
}
PRON_AMBIG = set(["o", "a", "os", "as", "no", "na", "nos", "nas", "se", "mesmo", "mesma", "próprio", "própria"])
PRON_ALL = set().union(*PRON.values()) | PRON_AMBIG
STOP = DETERMINERS | PREPOSITIONS | CONTRACTIONS | CONJUNCTIONS | PRON_ALL | {"não"}
NEGATION = set(["não", "nem", "nenhum", "nenhuma", "nenhuns", "nenhumas", "nunca", "jamais", "ninguém", "nada", "sem", "tampouco"])
NUMBERS = set(
    [
        "um",
        "uma",
        "dois",
        "duas",
        "três",
        "quatro",
        "cinco",
        "seis",
        "sete",
        "oito",
        "nove",
        "dez",
        "onze",
        "doze",
        "treze",
        "catorze",
        "quatorze",
        "quinze",
        "dezesseis",
        "dezasseis",
        "dezessete",
        "dezassete",
        "dezoito",
        "dezenove",
        "dezanove",
        "vinte",
        "trinta",
        "quarenta",
        "cinquenta",
        "cinqüenta",
        "sessenta",
        "setenta",
        "oitenta",
        "noventa",
        "cem",
        "cento",
        "duzentos",
        "duzentas",
        "trezentos",
        "trezentas",
        "quatrocentos",
        "quatrocentas",
        "quinhentos",
        "quinhentas",
        "seiscentos",
        "seiscentas",
        "setecentos",
        "setecentas",
        "oitocentos",
        "oitocentas",
        "novecentos",
        "novecentas",
        "mil",
        "milhares",
        "milhão",
        "milhões",
        "dezenas",
        "centenas",
    ]
)
STRONG_NUMBERS = NUMBERS - {"um", "uma"}
ORDINALS = {
    o + f
    for o in [
        "primeir",
        "segund",
        "terceir",
        "quart",
        "quint",
        "sext",
        "sétim",
        "oitav",
        "non",
        "décim",
        "vigésim",
        "trigésim",
        "quadragésim",
        "quinquagésim",
        "sexagésim",
        "septuagésim",
        "octogésim",
        "nonagésim",
        "centésim",
        "milésim",
    ]
    for f in ("o", "a", "os", "as")
} | {"ambos", "ambas", "dobro", "dobrado", "dupla", "duplo", "metade", "par", "vezes", "vez"}
ENGLISH = set(
    [
        "the",
        "and",
        "of",
        "unto",
        "shall",
        "thou",
        "thee",
        "thy",
        "thine",
        "his",
        "which",
        "with",
        "from",
        "that",
        "this",
        "they",
        "them",
        "said",
        "lord",
        "was",
        "not",
        "have",
        "hath",
        "ye",
        "you",
        "your",
        "its",
        "who",
        "whom",
        "upon",
        "into",
        "out",
        "all",
        "by",
        "men",
        "god",
        "king",
        "people",
        "land",
        "day",
        "house",
        "word",
        "were",
        "their",
        "there",
        "what",
        "when",
        "where",
        "shalt",
    ]
)


# Verbos irregulares: radical(is) + terminações; cada forma aponta para a família (SER junta ser/estar/haver/ir).
_T_PRES = ["o", "es", "e", "emos", "eis", "em", ""]
_FORMS = {
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
for _k, _v in _FORMS.items():
    for _f in _v.split():
        IRREG_MAP.setdefault(_f, _k)


def singular(t):
    if t.endswith("us"):
        return t
    for a, b in (("ões", "ão"), ("ães", "ão"), ("ãos", "ão"), ("ns", "m"), ("res", "r"), ("zes", "z"), ("ses", "s")):
        if t.endswith(a) and len(t) > len(a):
            return t[: -len(a)] + b
    if t.endswith("s") and len(t) > 3:
        return t[:-1]
    return t


def _root(t):
    t = t.lower()
    if t in IRREG_MAP:
        return IRREG_MAP[t]
    r = without_accent(singular(t))[:4]  # prefixo: criou/criar/criado → cri; santo/santa → sant
    return r[:3] if len(r) == 4 and r[3] in "aeiou" else r


# sinônimos que a BLIVRE alterna para a mesma palavra original (não contam como glosa divergente)
SYNONYMS = """aconteceu sucedeu sobreveio | homem humano pessoa gente | terra país chão solo | casa família palácio
| espírito vento fôlego hálito sopro | entrar chegar | porta portão | maldade iniquidade perversidade culpa
| alheio estranho estrangeiro | escuridão trevas | todo tudo | lutar combater guerrear | sair proceder
| responder dizer falar perguntar | lealdade bondade misericórdia benignidade | povo nação gente | servo escravo
| oferta oferenda | ira furor raiva | coração ânimo mente | olhar ver observar considerar | mulher esposa
| fazer cometer agir executar realizar praticar obrar obra | pôr colocar | celebrar oferecer"""
_parent = {}


def _find(x):
    while _parent.get(x, x) != x:
        x = _parent[x]
    return x


for _group in SYNONYMS.split("|"):
    _rs = [_root(p) for p in _group.split()]
    for _r in _rs[1:]:
        _parent[_find(_r)] = _find(_rs[0])
SIN_STEM = {r: _find(r).upper() for r in list(_parent) + [_find(r) for r in _parent]}


def stem(t):
    """Raiz aproximada de uma palavra portuguesa: verbos irregulares, plural, terminações verbais, sinônimos."""
    r = _root(t)
    return SIN_STEM.get(r, r)


def content(ts):
    return [t for t in ts if t not in STOP and not t.startswith("[")]


def content_stems(gloss):
    # a set: a Counter fed with it must get it sorted, or most_common breaks ties differently on each run
    return {stem(t) for t in content(toks(gloss))}


# ------------------------------------------------------------------ morfologia
def heb_segs(morph):
    """'HC/Vqw3ms' → (lingua, prefixos, raiz, sufixos)."""
    if not morph:
        return "", [], "", []
    segs = morph[1:].split("/")
    suf = [s for s in segs if s.startswith("S")]
    non_suffix = [s for s in segs if not s.startswith("S")]
    if len(non_suffix) > 1 and non_suffix[-1] == "Td" and morph[0] == "A":  # artigo enfático aramaico, posposto
        non_suffix = non_suffix[:-1]
    root = non_suffix[-1] if non_suffix else ""
    return morph[0], non_suffix[:-1], root, suf


def grk(morph):
    """'V-3AAI-S--' → ('V', '3AAI-S--'); 'N-----NSM-' → ('N', '----NSM-')."""
    if not morph or "-" not in morph:
        return morph or "", ""
    pos, parse = morph.split("-", 1)
    return pos, parse.ljust(8, "-")


def is_proper_name(w):
    if w[LING] == "G":
        return grk(w[MORPH_COL])[0] == "N" and (w[LEMMA] or "")[:1].isupper()
    return heb_segs(w[MORPH_COL])[2].startswith("Np")


def gloss_names(g):
    return [t for t in (g or "").split("-") if t[:1].isupper() and t not in ("SENHOR", "DEUS", "Deus", "Senhor")]


CANTILLATION = re.compile(r"[\u0591-\u05AF\u05BD\u05C0\u05C3\u05C4\u05C5]")


def norm_form(w):
    t = unicodedata.normalize("NFD", w[TXT] or "")
    if w[LING] == "G":
        t = "".join(c for c in t if unicodedata.category(c)[0] in "LM").lower()
        return unicodedata.normalize("NFC", t)
    return CANTILLATION.sub("", t)


def consonantal(t):
    t = unicodedata.normalize("NFD", t)
    return "".join(c for c in t if unicodedata.category(c)[0] == "L").lower().replace("ς", "σ")


# ------------------------------------------------------------------ marcas
class Marks:
    def __init__(self, book_scope):
        self.lst = []
        self.book_scope = book_scope
        self.seen = set()

    def inside(self, book, cap):
        lv, cp = self.book_scope
        return (lv is None or book == lv) and (cp is None or cap == cp)

    def add(self, book, cap, vers, pid, code, level, msg):
        if not self.inside(book, cap):
            return
        k = (pid, code, book, cap, vers, msg if pid is None else "")
        if k in self.seen:
            return
        self.seen.add(k)
        self.lst.append({"book": book, "chapter": cap, "verse": vers, "word_id": pid, "code": code, "level": level, "msg": msg})

    def w(self, w, code, level, msg):
        self.add(w[BOOK], w[CAP], w[VER], w[ID], code, level, msg)


def ref(w):
    return f"{w[BOOK]} {w[CAP]}:{w[VER]}"


# ------------------------------------------------------------------ dados
class Data:
    def __init__(self, db):
        self.books = [r for r in db.execute("SELECT book_order, code, name, abbrev, testament FROM books ORDER BY book_order")]
        self.order = {r[1]: r[0] for r in self.books}
        self.testament = {r[1]: r[4] for r in self.books}
        self.verses = {}
        for b, c, v, t, ed, note in db.execute("SELECT book, chapter, verse, blivre, edition, note FROM verses"):
            self.verses[(b, c, v)] = (t or "", ed, note)
        self.words = db.execute(
            "SELECT id, book, chapter, verse, pos, language, text, lemma, strong, prefixes, morph, "
            "ref_orig, gloss, gloss_source, strong_source FROM words"
        ).fetchall()
        self.words.sort(key=lambda w: (self.order.get(w[BOOK], 999), w[CAP], w[VER], w[POS]))
        self.by_verse = defaultdict(list)
        for w in self.words:
            self.by_verse[(w[BOOK], w[CAP], w[VER])].append(w)
        self.lexicon = {
            r[0]: r
            for r in db.execute(
                "SELECT entry_key, language, lemma, xlit, pron_en, derivation_en, def_en, kjv_en, gloss_en, def_pt FROM lexicon"
            )
        }
        self.transl = defaultdict(Counter)
        for ch, t, n in db.execute("SELECT entry_key, translation, n FROM translations"):
            self.transl[ch][t] += n
        self._tokset = {}

    def tokset_blivre(self, k):
        s = self._tokset.get(k)
        if s is None:
            t = self.verses.get(k, ("",))[0]
            s = {without_accent(x.lower()) for x in TOKEN_PT.findall(t)}
            self._tokset[k] = s
        return s


# ================================================================== A. integridade do texto-base
def hebrew_source(osis):
    """{(cap, vers) originais: [(texto, ketiv?, qere)]} lido do morphhb."""
    fname = os.path.join(SOURCES_DIR, f"morphhb/wlc/{osis}.xml")
    if not os.path.exists(fname):
        return None
    x = Path(fname).read_text(encoding="utf8")
    res = {}
    for vid, body_parts in re.findall(r'<verse osisID="([^"]+)">(.*?)</verse>', x, re.S):
        _, c, v = vid.split(".")
        ws = []
        for m in re.finditer(r"<w ([^>]*)>(.*?)</w>|<note\b.*?</note>", body_parts, re.S):
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


def greek_source(fname):
    file_path = os.path.join(SOURCES_DIR, f"sblgnt/{fname}-morphgnt.txt")
    if not os.path.exists(file_path):
        return None
    res = defaultdict(list)
    lines = list(Path(file_path).read_text(encoding="utf8").splitlines(keepends=True))
    sup = os.path.join(ROOT, "data", f"greek_supplement_{fname}.txt")
    if os.path.exists(sup):
        lines += [ln for ln in Path(sup).read_text(encoding="utf8").splitlines(keepends=True) if ln.strip() and not ln.startswith("#")]
    for line in lines:
        p = line.rstrip("\n").split(" ")
        if len(p) >= 4:
            res[(int(p[0][2:4]), int(p[0][4:6]))].append([p[3], False, None])
    return res


def check_base_text(d, M, scope_books):
    book_info = {row[0]: row for row in BOOKS}
    for book in scope_books:
        row = book_info.get(book)
        if not row:
            continue
        nt = d.testament.get(book) == "NT"
        src = greek_source(row[4]) if nt and row[4] else (hebrew_source(row[1]) if row[1] else None)
        code_count, cod_hash = ("TXG-01", "TXG-01") if nt else ("TXT-01", "TXT-02")
        if src is None:
            M.add(book, 1, 1, None, code_count, "info", "fonte original ausente em sources/; contagem não conferida")
            continue
        db_orig = defaultdict(list)
        for w in d.words:
            if w[BOOK] != book or not w[REF]:
                continue
            cv, n = w[REF].split(".")
            c, v = cv.split(":")
            db_orig[(int(c), int(v))].append((int(n), w))
        for k in sorted(set(src) | set(db_orig)):
            ws = sorted(db_orig.get(k, []))
            source = src.get(k, [])
            target = ws[0][1] if ws else None
            loc = (target[CAP], target[VER]) if target else k
            if not M.inside(book, loc[0]):
                continue
            if len(ws) != len(source):
                M.add(
                    book,
                    loc[0],
                    loc[1],
                    None,
                    code_count,
                    "erro",
                    f"{len(ws)} palavras no banco × {len(source)} na fonte (original {k[0]}:{k[1]})",
                )
                continue
            if [n for n, _ in ws] != list(range(1, len(ws) + 1)):
                M.add(book, loc[0], loc[1], None, code_count, "erro", f"numeração das palavras com buraco ({k[0]}:{k[1]})")
            if consonantal("".join(w[TXT] for _, w in ws)) != consonantal("".join(f[0] for f in source)):
                M.add(book, loc[0], loc[1], None, cod_hash, "erro", f"texto consonantal difere da fonte (original {k[0]}:{k[1]})")
            elif not nt:
                for (_, w), f in zip(ws, source, strict=False):
                    if f[1]:
                        q = f" (Qere {f[2]})" if f[2] else ""
                        M.w(w, "TXT-04", "aviso", f"forma escrita (Ketiv) {w[TXT]} no texto; a lida{q} não está registrada")


HEB_OK = re.compile(r"^[\u0591-\u05C7\u05D0-\u05EA\u05F0-\u05F4\u034F\u200D/]+$")
GRC_LETTER = re.compile(r"[\u0370-\u03FF\u1F00-\u1FFF]")
GRC_OK = re.compile(r"^[\u0370-\u03FF\u1F00-\u1FFF\u0300-\u036F.,;\u00B7\u0387\u2019\u02BC'\u1FBD\u2014]+$")
ACRONYMS = re.compile(r"[⸀-⸏⟦⟧\[\]()0-9]")


def check_unicode(d, M, ws):
    not_nfc = Counter()
    example = {}
    acronyms = defaultdict(list)
    for w in ws:
        t = w[TXT] or ""
        if t != unicodedata.normalize("NFC", t):
            not_nfc[(w[BOOK], w[LING] == "G")] += 1
            example.setdefault((w[BOOK], w[LING] == "G"), w)
        if w[LING] == "G":
            if ACRONYMS.search(t):
                acronyms[(w[BOOK], w[CAP])].append(w)
            letters = "".join(GRC_LETTER.findall(unicodedata.normalize("NFC", t)))
            if "ς" in letters[:-1]:
                M.w(w, "TXG-02", "erro", f"sigma final no meio da palavra: {t}")
            elif len(letters) > 1 and letters[-1] == "σ" and "’" not in t:
                M.w(w, "TXG-02", "aviso", f"sigma medial no fim da palavra: {t}")
            if not GRC_OK.match(ACRONYMS.sub("", t)):
                M.w(w, "TXG-02", "erro", f"caractere fora do permitido: {t!r}")
        else:
            if not HEB_OK.match(t):
                M.w(w, "TXT-03", "erro", f"caractere fora do permitido: {t!r}")
    for (book, cap), wds_in_verse in acronyms.items():
        signs = "".join(sorted({c for w in wds_in_verse for c in ACRONYMS.findall(w[TXT])}))
        M.add(
            book,
            cap,
            wds_in_verse[0][VER],
            None,
            "TXG-02",
            "aviso",
            f"{len(wds_in_verse)} palavras com sinais do aparato crítico ({signs}) no texto grego; ex.: {wds_in_verse[0][TXT]}",
        )
    for (book, greek), n in not_nfc.items():
        w = example[(book, greek)]
        M.add(
            book,
            w[CAP],
            w[VER],
            None,
            "TXG-02" if greek else "TXT-03",
            "info",
            f"{n} palavras fora da forma NFC (ordem dos sinais da fonte preservada)",
        )


def check_verses_and_chapters(d, M, scope_books):
    caps = defaultdict(lambda: defaultdict(set))
    for b, c, v in d.verses:
        caps[b][c].add(v)
    for b, c, v in d.by_verse:
        caps[b][c].add(v)
    for b in scope_books:
        cs = sorted(caps[b])
        for i, c in enumerate(cs, 1):
            if c != i and i <= (cs[-1] if cs else 0):
                M.add(b, c, 1, None, "TXT-05", "erro", f"capítulo {i} ausente (numeração pula para {c})")
                break
        for c in cs:
            vs = sorted(v for v in caps[b][c] if v > 0)
            missing = sorted(set(range(1, vs[-1] + 1)) - set(vs)) if vs else []
            if missing:
                M.add(b, c, missing[0], None, "TXT-05", "erro", f"versículo(s) ausente(s): {missing[:8]}")
        for k, ws in d.by_verse.items():
            if k[0] != b:
                continue
            ps = [w[POS] for w in ws]
            if ps != list(range(1, len(ps) + 1)):
                M.add(b, k[1], k[2], None, "TXT-05", "erro", "posições das palavras repetidas ou com buraco")


ARAMAIC = [("GEN", 31, 47, 31, 47), ("JER", 10, 11, 10, 11), ("EZR", 4, 8, 6, 18), ("EZR", 7, 12, 7, 26), ("DAN", 2, 4, 7, 28)]


def in_aramaic(b, c, v):
    return any(b == lb and (c1, v1) <= (c, v) <= (c2, v2) for lb, c1, v1, c2, v2 in ARAMAIC)


def check_aramaic(d, M, ws):
    by_verse = defaultdict(list)
    for w in ws:
        if w[LING] == "G":
            continue
        by_verse[(w[BOOK], w[CAP], w[VER])].append(w)
        lang = (w[MORPH_COL] or "?")[:1]
        if (w[LING] == "A") != (lang == "A"):
            M.w(w, "ARM-02", "erro", f"língua {w[LING]} × morfologia {w[MORPH_COL]}")
    for k, vs in by_verse.items():
        inside = in_aramaic(*k)
        aram = [w for w in vs if w[LING] == "A"]
        if not inside:
            for w in aram:
                M.w(w, "ARM-01", "erro", "palavra aramaica fora dos trechos aramaicos conhecidos")
            continue
        if k == ("GEN", 31, 47):
            if len(aram) != 2:
                M.add(*k, None, "ARM-01", "erro", f"Gn 31:47 deveria ter 2 palavras aramaicas, tem {len(aram)}")
            continue
        if k == ("DAN", 2, 4):
            idx = [i for i, w in enumerate(vs) if w[LING] == "A"]
            if not idx or any(w[LING] == "H" for w in vs[idx[0] :]):
                M.add(*k, None, "ARM-01", "erro", "troca hebraico → aramaico em Dn 2:4b fora do lugar")
            continue
        for w in vs:
            if w[LING] == "H":
                M.w(w, "ARM-01", "aviso", "palavra marcada como hebraica dentro de trecho aramaico")
        if not aram:
            M.add(*k, None, "TXT-06", "aviso", "versículo de trecho aramaico sem palavras aramaicas")


# ================================================================== B. versificação e alinhamento
ALG01 = {
    ("MAT", 17, 21),
    ("MAT", 18, 11),
    ("MAT", 23, 14),
    ("MRK", 7, 16),
    ("MRK", 9, 44),
    ("MRK", 9, 46),
    ("MRK", 11, 26),
    ("MRK", 15, 28),
    ("LUK", 17, 36),
    ("LUK", 23, 17),
    ("JHN", 5, 4),
    ("ACT", 8, 37),
    ("ACT", 15, 34),
    ("ACT", 24, 7),
    ("ACT", 28, 29),
    ("ROM", 16, 24),
}
ALG02 = [
    ("MAT", 6, 13, 6, 13, "Mt 6:13b (doxologia do Pai-Nosso)"),
    ("1JN", 5, 7, 5, 8, "1Jo 5:7–8 (Comma Johanneum)"),
    ("MRK", 16, 9, 16, 20, "Mc 16:9–20 (final longo de Marcos)"),
    ("JHN", 7, 53, 8, 11, "Jo 7:53–8:11 (a mulher adúltera)"),
]
KNOWN_OT = {("NEH", 7, 68): "Ne 7:68 não existe no Texto Massorético (vem da tradição grega/latina)"}
# Diferenças de numeração do NT aplicadas pelo corpus: (livro, ref original) → (cap, vers) de exibição
ALG03 = [("2CO", "13:12.6", 13, 13), ("2CO", "13:13.1", 13, 14), ("ACT", "19:40.22", 19, 41), ("3JN", "1:15.1", 1, 14)]


def check_versification(d, M, scope_books):
    for (b, c, v), (t, _ed, note) in d.verses.items():
        if b not in scope_books:
            continue
        nt = d.testament.get(b) == "NT"
        if note == "sem-original":
            if b == "PSA" and v == 0:
                M.add(b, c, v, None, "ALN-04", "aviso", "título do salmo na BLIVRE sem título no hebraico")
            elif nt and (b, c, v) in ALG01:
                M.add(b, c, v, None, "ALG-01", "info", "versículo ausente do texto crítico (lista conhecida); exibir com nota")
            elif nt and any(b == lb and (c1, v1) <= (c, v) <= (c2, v2) for lb, c1, v1, c2, v2, _ in ALG02):
                M.add(b, c, v, None, "ALG-02", "aviso", "trecho com tratamento editorial especial sem texto grego")
            elif (b, c, v) in KNOWN_OT:
                M.add(b, c, v, None, "ALN-02", "info", KNOWN_OT[(b, c, v)])
            else:
                M.add(
                    b,
                    c,
                    v,
                    None,
                    "ALG-01" if nt else "ALN-01",
                    "erro" if nt else "aviso",
                    "versículo da BLIVRE sem texto original correspondente",
                )
        if note == "sem-blivre" or not t.strip():
            if b == "PSA" and v == 0:
                M.add(b, c, v, None, "ALN-04", "aviso", "título hebraico do salmo sem título na BLIVRE")
            else:
                M.add(b, c, v, None, "ALN-05", "erro", "versículo da BLIVRE vazio")
        else:
            prev = d.verses.get((b, c, v - 1))
            if prev and prev[0].strip() and prev[0].strip() == t.strip():
                M.add(b, c, v, None, "ALN-05", "erro", f"texto da BLIVRE repete o v. {v - 1}")
    for k in d.by_verse:
        if k[0] in scope_books and k not in d.verses:
            M.add(*k, None, "ALN-05", "erro", "palavras originais num versículo inexistente na tabela versos")
    # ALG-02: trechos conhecidos e versículos em que a BLIVRE é bem mais longa que o grego
    for lb, c1, v1, c2, v2, name in ALG02:
        if lb in scope_books:
            ks = [k for k in d.verses if k[0] == lb and (c1, v1) <= k[1:] <= (c2, v2)]
            if ks:
                k = min(ks)
                M.add(*k, None, "ALG-02", "aviso", f"{name}: marcar trecho de tratamento especial")
    for b in scope_books:
        ratios = []
        item_list = []
        for k, ws in d.by_verse.items():
            if k[0] != b:
                continue
            nb = len(TOKEN_PT.findall(d.verses.get(k, ("",))[0]))
            if ws and nb:
                ratios.append(nb / len(ws))
                item_list.append((k, nb, len(ws)))
        if len(ratios) < 10:
            continue
        median = sorted(ratios)[len(ratios) // 2]
        nt = d.testament.get(b) == "NT"
        for k, nb, no in item_list:
            expected = no * median
            if nb > 2.3 * expected and nb - expected >= 14:
                M.add(
                    *k,
                    None,
                    "ALG-02" if nt else "ALN-03",
                    "aviso",
                    f"BLIVRE com {nb} palavras para {no} no original (esperado ~{expected:.0f}): trecho a mais?",
                )
            elif nb < 0.4 * expected and expected - nb >= 14:
                M.add(
                    *k,
                    None,
                    "ALG-02" if nt else "ALN-03",
                    "aviso",
                    f"BLIVRE com {nb} palavras para {no} no original (esperado ~{expected:.0f}): trecho faltando?",
                )
    # ALN-02 / ALN-04: versículo de exibição que junta mais de um versículo original
    for k, vs in d.by_verse.items():
        if k[0] not in scope_books:
            continue
        origs = []
        for w in vs:
            o = w[REF].split(".")[0] if w[REF] else None
            if o and o not in origs:
                origs.append(o)
        if len(origs) < 2:
            continue
        b, c, v = k
        if b == "PSA" and v == 1 and (b, c, 0) in d.by_verse:
            M.add(
                b,
                c,
                v,
                None,
                "ALN-04",
                "erro",
                f"título do salmo ocupa dois versículos hebraicos; a 2ª parte ({origs[0]}) caiu no v. 1 junto com {origs[1]}",
            )
        else:
            M.add(
                b,
                c,
                v,
                None,
                "ALG-03" if d.testament.get(b) == "NT" else "ALN-02",
                "info",
                f"versículo junta {len(origs)} versículos originais ({', '.join(origs)})",
            )
    # ALG-03 / ALN-02: mapa de versificação aplicado e ordem do texto original preservada
    by_ref = {}
    for w in d.words:
        if w[BOOK] in ("2CO", "ACT", "3JN") and w[BOOK] in scope_books:
            by_ref[(w[BOOK], w[REF])] = w
    for b, r, c, v in ALG03:
        if b in scope_books:
            w = by_ref.get((b, r))
            if not w or (w[CAP], w[VER]) != (c, v):
                M.add(b, c, v, None, "ALG-03", "erro", f"palavra original {r} não está em {c}:{v} (mapa de versificação)")
    last_by_book = {}
    for w in d.words:
        if w[BOOK] not in scope_books or not w[REF]:
            continue
        cv, n = w[REF].split(".")
        c, v = cv.split(":")
        o = (int(c), int(v), int(n))
        p = last_by_book.get(w[BOOK])
        if p and o < p[0] and w[BOOK] != "PSA":
            M.w(w, "ALG-03" if w[LING] == "G" else "ALN-02", "erro", f"ordem do original quebrada: {w[REF]} depois de {p[1]}")
        last_by_book[w[BOOK]] = (o, w[REF])


def check_offset(d, M, scope_books):
    """ALN-03: as traduções usuais das palavras combinam mais com o versículo vizinho da BLIVRE."""
    transl = {}
    for ch, c in d.transl.items():
        tot = sum(c.values())
        s = set()
        for t, n in c.items():
            if n / tot >= 0.02:
                s |= {stem(x) for x in content(toks(t))}
        if s:
            transl[ch] = s
    stems_v = {}

    def sv(k):
        s = stems_v.get(k)
        if s is None:
            s = stems_v[k] = {stem(x) for x in d.tokset_blivre(k)}
        return s

    def score(ws, k):
        if k not in d.verses or not d.verses[k][0]:
            return 0
        s = sv(k)
        return sum(1 for t in ws if t & s) / len(ws)

    for k, ws in d.by_verse.items():
        if k[0] not in scope_books:
            continue
        tally = []
        for w in ws:
            if w[LING] == "G":
                p = grk(w[MORPH_COL])[0]
            else:
                p = heb_segs(w[MORPH_COL])[2][:1]
            if p in ("N", "V", "A") and not is_proper_name(w):
                ch = w[STR] or ("G:" + w[LEMMA])
                if ch in transl:
                    tally.append(transl[ch])
        if len(tally) < 5:
            continue
        own = score(tally, k)
        if own > 0.4:
            continue
        b, c, v = k
        neighbors = [(score(tally, (b, c, v + dv)), v + dv) for dv in (-1, 1)]
        best, vv = max(neighbors)
        if best >= 0.6 and best >= own + 0.3:
            M.add(
                b, c, v, None, "ALN-03", "aviso", f"glosas combinam mais com o v. {vv} da BLIVRE ({best:.0%}) que com o próprio ({own:.0%})"
            )


# ================================================================== C. cobertura
def check_coverage(d, M, ws):
    used = {}
    for w in ws:
        g = w[GL]
        if not g or not g.strip() or w[GF] == "sem":
            M.w(w, "COB-01", "erro", "palavra sem glosa")
        elif w[GF] == "parcial":
            M.w(w, "COB-01", "aviso", f"glosa só do prefixo/partícula: '{g}'")
        k = w[STR]
        if not k:
            M.w(w, "COB-02", "erro", f"sem número de Strong (lema {w[LEMMA]})")
            continue
        if k not in d.lexicon:
            M.w(w, "COB-02", "erro", f"{k} não existe no léxico")
            continue
        used.setdefault(k, w)
        ts = toks(g)
        en = [t for t in ts if t in ENGLISH]
        if en:
            M.w(w, "COB-07", "aviso", f"palavra em inglês na glosa: '{g}'")
    return used


def check_lexicon(d, M, used):
    for k, w in used.items():
        e = d.lexicon[k]
        if not (e[9] or "").strip():
            M.w(w, "COB-02", "info", f"verbete {k} ({e[2]}) sem definição em português (def_pt)")
        if k[1:].isdigit() and not ((e[6] or "").strip() and (e[7] or "").strip() and (e[5] or "").strip()):
            missing = [n for n, v in (("origem", e[5]), ("significado", e[6]), ("traduções KJV", e[7])) if not (v or "").strip()]
            M.w(w, "COB-03", "aviso", f"verbete {k} sem {', '.join(missing)} (nem em inglês)")
        if not (e[3] or "").strip():
            M.w(w, "LEX-05", "erro", f"verbete {k} sem transliteração")
        elif re.search(r"[^\w\s'ʼʽ\-\.,·()ʾʿ]", e[3]):
            M.w(w, "LEX-05", "aviso", f"transliteração de {k} com caractere estranho: {e[3]!r}")
        if not (e[4] or "").strip() and e[1] == "H":
            M.w(w, "COB-04", "aviso", f"verbete {k} sem pronúncia")
        derivation = e[5] or ""
        for lt, num in re.findall(r"\b([HG])0*(\d+)\b", derivation):
            target = lt + num
            if target not in d.lexicon:
                hint = (
                    f" (provavelmente H{num})"
                    if lt == "G" and int(num) > 5624
                    else " (número que o próprio Strong pulou)"
                    if lt == "G" and (int(num) == 2717 or 3203 <= int(num) <= 3302)
                    else ""
                )
                M.w(w, "LEX-03", "erro", f"{k} cita {target}, que não existe no léxico{hint}")
            elif (
                re.search(r"\b" + k[0] + "0*" + k[1:] + r"\b", d.lexicon[target][5] or "")
                and target != k
                and "from" in derivation
                and "from" in (d.lexicon[target][5] or "")
            ):
                M.w(w, "LEX-03", "aviso", f"derivação circular: {k} ↔ {target}")
        if k.startswith("G") and k[1:].isdigit():
            n = int(k[1:])
            if n > 5624 or n == 2717 or 3203 <= n <= 3302:
                M.w(w, "LXG-01", "erro", f"{k} fora da numeração válida de Strong")


# ================================================================== D. gramática × glosa (hebraico/aramaico)
CONJ_H = CONJUNCTIONS | {"e"}
PREP_B = set(
    [
        "em",
        "no",
        "na",
        "nos",
        "nas",
        "num",
        "numa",
        "com",
        "por",
        "pelo",
        "pela",
        "pelos",
        "pelas",
        "entre",
        "dentro",
        "sobre",
        "quando",
        "ao",
        "aos",
        "à",
        "às",
        "durante",
        "contra",
        "nele",
        "nela",
        "neles",
        "nelas",
        "mediante",
        "diante",
        "perante",
        "comigo",
        "contigo",
        "consigo",
        "conosco",
        "convosco",
        "sob",
        "enquanto",
    ]
)
PREP_L = set(
    [
        "para",
        "a",
        "ao",
        "aos",
        "à",
        "às",
        "de",
        "do",
        "da",
        "dos",
        "das",
        "lhe",
        "lhes",
        "por",
        "pelo",
        "pela",
        "pelos",
        "pelas",
        "em",
        "no",
        "na",
        "nos",
        "nas",
        "contra",
        "sobre",
        "até",
        "quanto",
        "segundo",
        "me",
        "te",
        "nos",
        "vos",
        "se",
        "mim",
        "ti",
        "si",
        "dele",
        "dela",
        "deles",
        "delas",
        "comigo",
        "contigo",
        "consigo",
        "conosco",
        "convosco",
        "que",
        "como",
        "diante",
        "perante",
        "entre",
        "ele",
        "ela",
        "eles",
        "elas",
        "com",
    ]
)
PREP_K = set(
    [
        "como",
        "conforme",
        "segundo",
        "qual",
        "assim",
        "quando",
        "quase",
        "cerca",
        "semelhante",
        "tal",
        "tais",
        "igual",
        "iguais",
        "quanto",
        "mesmo",
        "modo",
        "ao",
        "logo",
        "enquanto",
        "depois",
        "apenas",
    ]
)
PREP_M = set(
    [
        "de",
        "do",
        "da",
        "dos",
        "das",
        "desde",
        "dentre",
        "que",
        "deste",
        "desta",
        "dele",
        "dela",
        "deles",
        "delas",
        "daquele",
        "daquela",
        "por",
        "pelo",
        "pela",
        "pelos",
        "pelas",
        "fora",
        "mais",
        "sem",
        "dali",
        "daí",
        "daqui",
        "donde",
        "após",
        "depois",
    ]
)
PART_H = {
    "H3808": (NEGATION | {"senão", "sim"}, "partícula negativa לֹא sem 'não/nem/nenhum'"),
    "H408": (NEGATION, "partícula negativa אַל sem 'não/nem/nenhum'"),
    "H2009": ({"eis", "olha", "olhai", "vede", "veja", "vê", "aqui", "ei-lo", "ei-la", "se", "agora"}, "הִנֵּה sem 'eis'"),
    "H3588": (
        CONJUNCTIONS | {"ainda", "verdade", "verdadeiramente", "certo", "quando", "porquanto", "visto", "senão", "mas"},
        "כִּי sem 'que/porque/pois/quando'",
    ),
}
# palavras em que o sufixo faz parte do sentido lexical (Adonai "Senhor", kol "todos", levad "sozinho",
# ein/yesh/od/hinneh + sufixo)
SUF_LEXICAL = {"H136", "H3605", "H905", "H369", "H3426", "H5750", "H2009", "H2005", "H413"}
PLURAL_ONLY = {"H136", "H6440", "H4325", "H8064", "H430", "H2416", "H7356", "H5271", "H2208", "H2205", "H1170"}


def check_grammar_h(d, M, ws):
    for w in ws:
        if w[LING] == "G" or not w[MORPH_COL] or not w[GL]:
            continue
        lang, pre, root, suf = heb_segs(w[MORPH_COL])
        ts = toks(w[GL])
        tset = set(ts)
        g = w[GL]
        manual = w[GF] == "manual"
        # GRA-12: partícula de objeto
        if w[STR] == "H853":
            if "[obj]" not in tset and not (tset & PRON_ALL) and not (tset & CONTRACTIONS):
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
        for p, conj, name in (("b", PREP_B, "בְּ"), ("l", PREP_L, "לְ"), ("k", PREP_K, "כְּ"), ("m", PREP_M, "מִן")):
            if p in prefs and not (tset & conj) and not (root.startswith("V") and root[2:3] == "c"):
                M.w(w, "GRA-03", "aviso" if p in ("k",) else "info", f"preposição {name} prefixada sem equivalente: '{g}'")
        # GRA-02: artigo
        if (
            ("d" in prefs or any(s == "Rd" for s in pre) or root == "Rd")
            and lang == "H"
            and (
                not (tset & (DETERMINERS | CONTRACTIONS))
                and not gloss_names(g)
                and "SENHOR" not in g
                and not root.startswith("Vr")
                and not root.startswith("Vs")
            )
        ):
            M.w(w, "GRA-02", "info", f"artigo ה sem artigo na glosa: '{g}'")
        # GRA-04: sufixo pronominal
        for s in suf:
            if not s.startswith("Sp") or len(s) < 5 or w[STR] in SUF_LEXICAL or (root.startswith("V") and root[2:3] == "c"):
                continue
            person, num = s[2], s[4]
            target = "3" if person == "3" else person + ("s" if num == "s" else "p")
            if not (tset & PRON_ALL) and not (tset & CONTRACTIONS) and not any(t.endswith(("-lo", "-la")) for t in ts):
                M.w(w, "GRA-04", "aviso", f"sufixo pronominal {s[2:]} sem pronome/possessivo na glosa: '{g}'")
            else:
                others = set().union(*(v for k, v in PRON.items() if k != target))
                if (
                    (tset & others)
                    and not (tset & PRON[target])
                    and not (target == "1p" and "nos" in tset)
                    and not (target == "3" and tset & PRON_AMBIG)
                ):
                    M.w(w, "GRA-04", "aviso", f"sufixo {s[2:]} mas glosa com pronome de outra pessoa: '{g}'")
        # GRA-05: pessoa do verbo (1ª e 2ª do plural, verbos finitos)
        if root.startswith("V") and len(root) >= 6 and root[2] in "pqiwhjv":
            person, num = root[3], root[5]
            if person == "1" and num == "p" and not any(t.endswith(("mos", "mo")) or t in ("nós", "nos") for t in ts):
                M.w(w, "GRA-05", "aviso", f"verbo 1ª pl. ({root}) sem forma de 'nós' na glosa: '{g}'")
        # GRA-07: infinitivo construto com ל
        if root.startswith("V") and len(root) >= 3 and root[2] == "c" and "l" in prefs and w[STR] != "H559":
            if not (tset & {"para", "a", "de", "ao", "à", "por", "que", "até", "quando", "se", "em"}) and not any(
                t.endswith(("ar", "er", "ir", "or")) for t in ts
            ):
                M.w(w, "GRA-07", "info", f"infinitivo com ל sem 'para/a + infinitivo': '{g}'")
        # GRA-10: plural
        if root.startswith("Nc") and len(root) >= 5 and root[3] == "p" and w[STR] not in PLURAL_ONLY and not manual:
            tally = content(ts)
            if tally and not any(t.endswith("s") for t in ts) and not gloss_names(g):
                M.w(w, "GRA-10", "info", f"substantivo plural com glosa no singular: '{g}'")
        # ARM-03: estado enfático do aramaico
        if lang == "A" and root.startswith("N") and root.endswith("d") and root[1] != "p":
            if not (tset & (DETERMINERS | CONTRACTIONS | PRON_ALL)):
                M.w(w, "ARM-03", "info", f"estado enfático sem artigo na glosa: '{g}'")
        # ARM-04: partícula דִּי
        if (
            lang == "A"
            and w[STR] == "H1768"
            and not (
                tset
                & (
                    {
                        "que",
                        "qual",
                        "quais",
                        "quem",
                        "porque",
                        "pois",
                        "de",
                        "do",
                        "da",
                        "dos",
                        "das",
                        "quando",
                        "cujo",
                        "cuja",
                        "cujos",
                        "cujas",
                        "onde",
                        "como",
                        "para",
                    }
                    | DETERMINERS
                )
            )
        ):
            M.w(w, "ARM-04", "aviso", f"partícula דִּי com glosa '{g}'")


MEASURES = {
    "H520": ("côvad",),
    "H8255": ("siclo",),
    "H374": ("efa",),
    "H1969": ("him", "hin"),
    "H3734": ("coro",),
    "H6016": ("ômer", "gômer", "feixe"),
    "H1324": ("bato",),
    "H4488": ("mina", "libra"),
    "H7341": ("larg",),
    "H753": ("compr", "longo", "longa", "dura", "extens", "prolong"),
    "H1092": ("beca", "meio"),
}


def check_numbers_and_divine_names(d, M, ws):
    for w in ws:
        g = w[GL]
        if not g:
            continue
        ts = toks(g)
        tset = set(ts)
        k = (w[BOOK], w[CAP], w[VER])
        # FAT-03: números da glosa presentes na BLIVRE
        strongs = [t for t in ts if t in STRONG_NUMBERS]
        if strongs:
            bl = d.tokset_blivre(k)
            missing = [t for t in strongs if without_accent(t) not in bl]
            if missing:
                M.w(w, "FAT-03", "aviso", f"número '{missing[0]}' da glosa não aparece no versículo da BLIVRE")
        if w[LING] != "G":
            root = heb_segs(w[MORPH_COL])[2]
            if (
                root.startswith("Ac")
                and w[STR] not in ("H259",)
                and not (tset & NUMBERS)
                and not (tset & ORDINALS)
                and not any(t.startswith(("centuri", "dezen", "milhar", "centen")) for t in ts)
            ):
                M.w(w, "FAT-03", "aviso", f"numeral cardinal ({w[STR]}) sem número na glosa: '{g}'")
        # FAT-09: medidas e unidades
        if w[STR] in MEASURES and not any(t.startswith(MEASURES[w[STR]]) for t in ts):
            M.w(w, "FAT-09", "aviso", f"medida {w[STR]} glosada '{g}' (esperado {'/'.join(MEASURES[w[STR]])}…)")
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
ART_OK = DETERMINERS | CONTRACTIONS | PREPOSITIONS | PRON_ALL | {"que", "quem", "qual", "quais", "coisas", "aquilo", "aquele", "aqueles"}
PART_G = {
    "καί": CONJUNCTIONS | {"inclusive", "nem"},
    "δέ": CONJUNCTIONS | {"entretanto", "enquanto", "porém", "ora", "outro", "outros", "uns", "uma", "um"},
    "γάρ": CONJUNCTIONS | {"verdade", "realmente", "certo", "porquanto"},
    "οὖν": CONJUNCTIONS | {"isso", "isto", "pois", "portanto", "então", "logo"},
    "ἀλλά": CONJUNCTIONS | {"contrário", "senão"},
    "ἵνα": CONJUNCTIONS | {"para", "a", "fim", "de", "afim"},
    "ὅτι": CONJUNCTIONS | {"pois", "visto", "porquanto", "como"},
}
NEG_G = {
    "οὐ",
    "μή",
    "οὐδέ",
    "μηδέ",
    "οὐδείς",
    "μηδείς",
    "οὔτε",
    "μήτε",
    "οὐκέτι",
    "μηκέτι",
    "οὔπω",
    "μήπω",
    "οὐχί",
    "οὐδαμῶς",
    "οὐθείς",
    "μηθείς",
    "οὐδέποτε",
    "μηδέποτε",
}
PREP_CASE = {  # (lema, caso): (glosas que indicam o outro caso, sem as do próprio caso)
    ("διά", "A"): (
        {"meio", "através"},
        {"causa", "razão", "isso", "motivo", "porque", "porquanto"},
        "διά + acusativo ('por causa de') glosada como 'por meio de'",
    ),
    ("διά", "G"): (
        {"causa", "razão", "motivo"},
        {"meio", "através", "pelo", "pela", "por", "pelos", "pelas", "durante", "entre", "de", "em"},
        "διά + genitivo ('por meio de') glosada como 'por causa de'",
    ),
    ("μετά", "A"): (
        {"com", "conosco", "comigo", "contigo", "convosco", "consigo"},
        {"depois", "após", "passados", "passado", "dentro", "em"},
        "μετά + acusativo ('depois de') glosada como 'com'",
    ),
    ("μετά", "G"): (
        {"depois", "após"},
        {"com", "conosco", "comigo", "contigo", "convosco", "consigo", "entre"},
        "μετά + genitivo ('com') glosada como 'depois de'",
    ),
    ("ὑπό", "A"): (
        {"pelo", "pela", "pelos", "pelas"},
        {"debaixo", "sob", "abaixo"},
        "ὑπό + acusativo ('debaixo de') glosada como agente 'por'",
    ),
    ("ὑπό", "G"): (
        {"debaixo", "sob", "abaixo"},
        {"por", "pelo", "pela", "pelos", "pelas", "de"},
        "ὑπό + genitivo ('por', agente) glosada como 'debaixo de'",
    ),
}
CRASIS = {
    "κἀγώ": ({"eu", "me", "mim", "também", "nós"}, "κἀγώ (= καί + ἐγώ) sem 'eu/me/mim/também'"),
    "κἀκεῖ": ({"ali", "lá", "aí", "também", "e"}, "κἀκεῖ (= καί + ἐκεῖ) sem 'ali/lá'"),
    "κἀκεῖθεν": ({"dali", "daí", "ali", "lá", "depois", "e"}, "κἀκεῖθεν sem 'e dali'"),
    "κἀκεῖνος": (
        PRON["3"]
        | {
            "aquele",
            "aquela",
            "aqueles",
            "aquelas",
            "este",
            "esta",
            "estes",
            "também",
            "esse",
            "essa",
            "o",
            "a",
            "os",
            "as",
            "e",
            "outro",
            "outros",
            "isto",
        },
        "κἀκεῖνος sem 'e aquele/ele'",
    ),
}


def next_case(vs, i):
    for w in vs[i + 1 : i + 4]:
        pos, parse = grk(w[MORPH_COL])
        if parse[4] in "NGDAV" and parse[4] != "-":
            return parse[4]
    return None


def check_greek(d, M, ws):
    by_verse = defaultdict(list)
    for w in ws:
        if w[LING] == "G":
            by_verse[(w[BOOK], w[CAP], w[VER])].append(w)
    for _k, vs in by_verse.items():
        for i, w in enumerate(vs):
            g = w[GL]
            if not g:
                continue
            ts = toks(g)
            tset = set(ts)
            pos, parse = grk(w[MORPH_COL])
            lemma = w[LEMMA] or ""
            # GRG-01: artigo
            if pos == "RA":
                outside = [t for t in ts if t not in ART_OK]
                if outside:
                    M.w(w, "GRG-01", "aviso", f"artigo com glosa que não é artigo/preposição: '{g}'")
                elif (
                    parse[5] == "P"
                    and (tset - {"de", "a", "em", "que", "para", "por", "com"}) is not False
                    and tset <= {"o", "a", "do", "da", "ao", "à", "no", "na", "pelo", "pela"}
                ):
                    M.w(w, "GRG-01", "info", f"artigo plural com glosa no singular: '{g}'")
                continue
            # GRG-11: negação
            if lemma in NEG_G:
                ok = (
                    NEGATION
                    | ({"porventura", "acaso", "que", "senão", "para"} if lemma in ("μή", "μήτε") else set())
                    | ({"porventura", "acaso"} if lemma in ("οὐ", "οὐχί") else set())
                )
                if not (tset & ok):
                    M.w(w, "GRG-11", "aviso", f"negação {lemma} sem 'não/nem/nenhum' na glosa: '{g}'")
                continue
            # GRG-12: conjunções e partículas
            if lemma in PART_G and not (tset & PART_G[lemma]):
                M.w(w, "GRG-12", "aviso" if lemma in ("ἵνα", "ὅτι", "γάρ", "ἀλλά") else "info", f"{lemma} com glosa '{g}'")
                continue
            # TXG-03: crase
            if lemma in CRASIS:
                ok, msg = CRASIS[lemma]
                if not (tset & ok):
                    M.w(w, "TXG-03", "aviso", f"{msg}: '{g}'")
                continue
            # GRG-10: preposição × caso
            if pos == "P" and lemma in ("διά", "μετά", "ὑπό"):
                case = next_case(vs, i)
                rule = PREP_CASE.get((lemma, case))
                if rule:
                    wrong, right, msg = rule
                    if tset & wrong and not (tset & right):
                        M.w(w, "GRG-10", "aviso", f"{msg}: '{g}'")
                continue
            # GRG-13: pronomes pessoais
            if lemma in ("ἐγώ", "σύ", "αὐτός") and pos.startswith("R"):
                target = {"ἐγώ": ("1s", "1p"), "σύ": ("2s", "2p"), "αὐτός": ("3",)}[lemma]
                proper = set().union(*(PRON[a] for a in target)) | ({"nos"} if lemma == "ἐγώ" else set())
                others = set().union(*(v for kk, v in PRON.items() if kk not in target))
                if lemma == "αὐτός":
                    proper |= PRON_AMBIG | {"mesmo", "mesma", "mesmos", "mesmas", "próprio", "própria", "próprios"}
                if (tset & others) and not (tset & proper):
                    M.w(w, "GRG-13", "aviso", f"{lemma} ({parse[0] if parse[0] != '-' else 'pron.'}) com glosa de outra pessoa: '{g}'")
                continue
            # GRG-05: pessoa do verbo (1ª pl.)
            if pos == "V" and parse[3] in "ISOD" and parse[0] == "1" and parse[5] == "P":
                if not any(t.endswith(("mos", "mo")) or t in ("nós", "nos") for t in ts):
                    M.w(w, "GRG-05", "aviso", f"verbo 1ª pl. sem forma de 'nós' na glosa: '{g}'")
            # GRG-04: plural
            if pos == "N" and parse[5] == "P" and not lemma[:1].isupper():
                tally = content(ts)
                if tally and not any(t.endswith("s") for t in ts) and lemma not in ("οὐρανός",):
                    M.w(w, "GRG-04", "info", f"substantivo plural com glosa no singular: '{g}'")


# ================================================================== G. consistência
GL_OK = re.compile(
    r"^-?[^\W\d_]+(?:[’']?[^\W\d_]+)*(?:-(?:[^\W\d_]+(?:[’'][^\W\d_]+)*|\[obj\]))*$|^\[obj\]$|"
    r"^[^\W\d_]+(?:-[^\W\d_]+)*-\[obj\](?:-[^\W\d_]+)*$",
    re.U,
)


def check_style(d, M, ws):
    for w in ws:
        g = w[GL]
        if not g:
            continue
        if " " in g or "--" in g or g.endswith("-") or not GL_OK.match(g):
            M.w(w, "CON-04", "erro", f"glosa fora do estilo (espaço, pontuação, hífen solto): '{g}'")
            continue
        pieces = g.split("-")
        for t in pieces:
            if t and not t.isupper() and not t.islower() and not (t[0].isupper() and t[1:].islower()):
                M.w(w, "CON-04", "aviso", f"maiúsculas no meio da palavra: '{g}'")
                break
        ts = toks(g)
        if any(a == b for a, b in zip(ts, ts[1:], strict=False)):
            M.w(w, "CON-04", "aviso", f"palavra repetida na glosa: '{g}'")
        if len(g) > 40 or len(ts) > 6:
            M.w(w, "CON-04", "aviso", f"glosa longa demais ({len(ts)} palavras): '{g}'")


def check_consistency(d, M, ws, scope_books):
    """CON-01 (mesma forma + morfologia no livro) e CON-02 (mesmo Strong na Bíblia)."""
    marked = set()
    groups = defaultdict(list)
    for w in d.words:
        if w[BOOK] in scope_books and w[GL] and w[GF] != "manual" and not is_proper_name(w):
            p = grk(w[MORPH_COL])[0] if w[LING] == "G" else heb_segs(w[MORPH_COL])[2][:1]
            if p in ("N", "V", "A"):
                groups[(w[BOOK], norm_form(w), w[MORPH_COL])].append(w)
    for _k, g_ws in groups.items():
        n = len(g_ws)
        if n < 4:
            continue
        tally = Counter(w[GL].lower() for w in g_ws)
        majority, n_majority = tally.most_common(1)[0]
        if n_majority / n < 0.5:
            continue
        st_maj = content_stems(majority)
        freq_st = Counter(s for w in g_ws for s in sorted(content_stems(w[GL])))
        for w in g_ws:
            gl = w[GL].lower()
            if gl == majority or tally[gl] / n > 0.2:
                continue
            st = content_stems(gl)
            if not st or not st_maj:
                continue
            if st & st_maj or any(freq_st[s] / n >= 0.15 for s in st):
                continue
            marked.add(w[ID])
            M.w(w, "CON-01", "aviso", f"'{w[GL]}' destoa da glosa usual '{majority}' ({n_majority}/{n}) desta forma no livro")
    # CON-02: por Strong, na Bíblia inteira (só palavras de conteúdo)
    by_strong = defaultdict(list)
    for w in d.words:
        if not w[GL] or not w[STR] or is_proper_name(w):
            continue
        p = grk(w[MORPH_COL])[0] if w[LING] == "G" else heb_segs(w[MORPH_COL])[2][:1]
        if p in ("N", "V", "A"):
            by_strong[w[STR]].append(w)
    for s, g_ws in by_strong.items():
        n = len(g_ws)
        if n < 20:
            continue
        freq = Counter()
        for w in g_ws:
            freq.update(sorted(content_stems(w[GL])))
        top, ntop = freq.most_common(1)[0] if freq else (None, 0)
        if ntop / n < 0.6:
            continue
        polysemous = sum(1 for x, k in freq.items() if k / n >= 0.03) >= 4
        for w in g_ws:
            if w[ID] in marked or w[BOOK] not in scope_books or w[GF] == "manual":
                continue
            st = content_stems(w[GL])
            if st and all(freq[x] / n < 0.01 for x in st):
                M.w(w, "CON-02", "info" if polysemous else "aviso", f"glosa rara '{w[GL]}' para {s} (usual: '{top}…', {ntop}/{n})")


# ================================================================== H. nomes próprios
def dominant_name(g_ws):
    c = Counter()
    for w in g_ws:
        ns = gloss_names(w[GL])
        if ns:
            c[ns[0]] += 1
    return c


def check_names(d, M, ws, scope_books):
    # FAT-01: nome da glosa aparece no versículo da BLIVRE
    for w in ws:
        if not w[GL] or not is_proper_name(w):
            continue
        ns = gloss_names(w[GL])
        bl = d.tokset_blivre((w[BOOK], w[CAP], w[VER]))
        if not ns:
            if not any(t[:1].isupper() for t in w[GL].split("-")):
                M.w(w, "FAT-01", "info", f"nome próprio com glosa em minúsculas: '{w[GL]}'")
            continue
        missing = [x for x in ns if without_accent(x.lower()) not in bl]
        if missing:
            M.w(w, "FAT-01", "aviso", f"nome '{missing[0]}' não aparece no versículo da BLIVRE")
    # FAT-02: mesmo Strong de nome próprio → mesmo nome
    by_strong = defaultdict(list)
    for w in d.words:
        if w[GL] and w[STR] and is_proper_name(w):
            by_strong[w[STR]].append(w)
    dominant_by_key = {}
    for s, g_ws in by_strong.items():
        c = dominant_name(g_ws)
        if not c:
            continue
        top, ntop = c.most_common(1)[0]
        dominant_by_key[s] = (top, ntop, len(g_ws))
        n = sum(c.values())
        if n < 5 or ntop / n < 0.7:
            continue
        for w in g_ws:
            if w[BOOK] not in scope_books:
                continue
            ns = gloss_names(w[GL])
            if ns and top not in ns and c[ns[0]] / n <= 0.1 and stem(ns[0])[:3] != stem(top)[:3]:
                M.w(w, "FAT-02", "aviso", f"{s} glosado '{ns[0]}'; no resto da Bíblia é '{top}' ({ntop}/{n})")
    # GRG-15 / CRG-05: nome grego de origem hebraica × nome no AT
    seen = set()
    for w in d.words:
        if w[LING] != "G" or not w[STR] or w[STR] in seen or w[STR] not in dominant_by_key or w[BOOK] not in scope_books:
            continue
        seen.add(w[STR])
        derivation = (d.lexicon.get(w[STR]) or [None] * 10)[5] or ""
        m = re.search(r"of Hebrew origin \(H0*(\d+)\)", derivation)
        if not m:
            continue
        h = "H" + m.group(1)
        if h not in dominant_by_key:
            continue
        gn, hn = dominant_by_key[w[STR]][0], dominant_by_key[h][0]
        if without_accent(gn.lower()) == without_accent(hn.lower()):
            continue
        indecl = not re.search(r"[ςνυ]$", without_accent(w[LEMMA] or ""))  # Ἀβραάμ, Δαυίδ
        cod = "GRG-15" if indecl else "CRG-05"
        if w[STR] in ("G2424",):  # Ἰησοῦς ← Josué: diferença esperada
            continue
        M.w(w, cod, "aviso" if stem(gn)[:3] != stem(hn)[:3] else "info", f"{w[LEMMA]} glosado '{gn}' no NT; {h} é '{hn}' no AT")


# ================================================================== I. cruzamentos
PARALLELS_OT = [
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
PARALLELS_NT = [
    (("2PE", 2, 1, 2, 22), ("JUD", 1, 3, 1, 18)),
]


def snippet(d, t):
    b, c1, v1, c2, v2 = t
    return [w for w in d.words if w[BOOK] == b and (c1, v1) <= (w[CAP], w[VER]) <= (c2, v2)]


def check_parallels(d, M, scope_books):
    for lst, cod in ((PARALLELS_OT, "CRZ-02"), (PARALLELS_NT, "CRZ-03")):
        for a, b in lst:
            if a[0] not in scope_books and b[0] not in scope_books:
                continue
            wa, wb = snippet(d, a), snippet(d, b)
            if not wa or not wb:
                continue
            sa = [(norm_form(w), w[MORPH_COL]) for w in wa]
            sb = [(norm_form(w), w[MORPH_COL]) for w in wb]
            sm = SequenceMatcher(None, sa, sb, autojunk=False)
            for bl in sm.get_matching_blocks():
                if bl.size < 3:
                    continue
                for i in range(bl.size):
                    x, y = wa[bl.a + i], wb[bl.b + i]
                    if not x[GL] or not y[GL] or x[GL].lower() == y[GL].lower():
                        continue
                    sx, sy = content_stems(x[GL]), content_stems(y[GL])
                    if (sx or sy) and not (sx & sy):
                        msg = f"'{y[GL]}' × '{x[GL]}' em {ref(x)} (mesmo original)"
                        M.w(y, cod, "aviso", msg)
                        M.w(x, cod, "aviso", f"'{x[GL]}' × '{y[GL]}' em {ref(y)} (mesmo original)")


EQUIV = [
    ("H7307", "G4151", "espírito"),
    ("H8451", "G3551", "lei"),
    ("H2617", "G1656", "misericórdia"),
    ("H1285", "G1242", "aliança"),
    ("H6662", "G1342", "justo"),
    ("H5315", "G5590", "alma"),
    ("H3820", "G2588", "coração"),
    ("H3519", "G1391", "glória"),
    ("H7965", "G1515", "paz"),
    ("H3444", "G4991", "salvação"),
    ("H6944", "G40", "santo"),
    ("H4397", "G32", "anjo"),
]
CRG02 = {
    "G5008",
    "G2891",
    "G5",
    "G2188",
    "G1682",
    "G2982",
    "G4518",
    "G3134",
    "G4461",
    "G281",
    "G5614",
    "G239",
    "G2878",
    "G3126",
    "G1115",
    "G2786",
}


def check_bridges(d, M, scope_books):
    by_strong = defaultdict(list)
    targets = {s for e in EQUIV for s in e[:2]} | CRG02
    for w in d.words:
        if w[STR] in targets and w[GL]:
            by_strong[w[STR]].append(w)

    def dominant(s):
        c = Counter()
        for w in by_strong.get(s, []):
            c.update(sorted(content_stems(w[GL])))
        return c

    for h, g, expected in EQUIV:
        ch, cg = dominant(h), dominant(g)
        if not ch or not cg or not by_strong[g]:
            continue
        th = {s for s, _ in ch.most_common(3)}
        tg = {s for s, _ in cg.most_common(3)}
        w = by_strong[g][0]
        if w[BOOK] not in scope_books:
            continue
        if not (th & tg):
            M.w(w, "CRZ-05", "aviso", f"{h} ↔ {g}: glosas sem família comum ({sorted(th)} × {sorted(tg)}); esperado '{expected}'")
        elif stem(expected) not in (th | tg):
            M.w(w, "CRZ-05", "info", f"{h} ↔ {g}: '{expected}' não está entre as glosas mais comuns")
    # CRG-02: palavras aramaicas/hebraicas transliteradas no NT
    for s in CRG02:
        g_ws = by_strong.get(s, [])
        if not g_ws:
            continue
        c = dominant(s)
        if not c:
            continue
        top, ntop = c.most_common(1)[0]
        for w in g_ws:
            if (
                w[BOOK] in scope_books
                and len(g_ws) >= 2
                and not (content_stems(w[GL]) & {top})
                and all(c[x] / len(g_ws) < 0.2 for x in content_stems(w[GL]))
            ):
                M.w(w, "CRG-02", "aviso", f"transliteração {w[LEMMA]} glosada '{w[GL]}' (usual '{top}…')")
    # ARM-07: verbete aramaico "corresponding to H####" com glosa da mesma família do hebraico
    by_str_a = defaultdict(list)
    for w in d.words:
        if w[LING] == "A" and w[STR] and w[GL]:
            by_str_a[w[STR]].append(w)
    for s, g_ws in by_str_a.items():
        e = d.lexicon.get(s)
        if not e:
            continue
        derivation = e[5] or ""
        m = re.search(r"corresponding to H0*(\d+)", derivation)
        if m:
            h = "H" + m.group(1)
            th = set()
            for t, _n in d.transl.get(h, {}).items():
                th |= {stem(x) for x in content(toks(t))}
            if not th:
                continue
            ca = Counter()
            for w in g_ws:
                ca.update(sorted(content_stems(w[GL])))
            if not ca:
                continue
            ta = {x for x, _ in ca.most_common(2)}
            w = g_ws[0]
            if w[BOOK] in scope_books and not (ta & th) and len(g_ws) >= 2:
                M.w(w, "ARM-07", "info", f"aramaico {s} glosado {sorted(ta)}; o hebraico {h} é traduzido {sorted(th)[:4]}")
        # ARM-06: verbete do Strong precisa ser o aramaico
        if (
            s[1:].isdigit()
            and "(Aramaic)" not in derivation
            and "Chaldee" not in derivation
            and not (e[2] and heb_segs(g_ws[0][MORPH_COL])[2].startswith("Np"))
        ):
            for w in g_ws:
                if w[BOOK] in scope_books:
                    M.w(w, "ARM-06", "info", f"palavra aramaica com verbete {s} sem marca '(Aramaic)'")
                    break
    # ARM-10: Jr 10:11, as duas grafias de "terra"
    if "JER" in scope_books:
        ws = d.by_verse.get(("JER", 10, 11), [])
        land_words = [w for w in ws if w[STR] in ("H778", "H772")]
        gl = {tuple(sorted(content_stems(w[GL]))) for w in land_words if w[GL]}
        if len(gl) > 1:
            M.add(
                "JER",
                10,
                11,
                None,
                "ARM-10",
                "aviso",
                "as duas grafias de 'terra' com glosas diferentes: " + ", ".join(w[GL] for w in land_words),
            )


def check_support(d, M, ws):
    """CRZ-01: glosa sem apoio no alinhamento e sem nenhuma palavra presente no versículo da BLIVRE."""
    for w in ws:
        if w[GF] not in ("lexico", "parcial") or not w[GL]:
            continue
        st = content_stems(w[GL])
        if not st:
            continue
        bl = {stem(x) for x in d.tokset_blivre((w[BOOK], w[CAP], w[VER]))}
        if not (st & bl):
            M.w(w, "CRZ-01", "info", f"glosa '{w[GL]}' (fonte {w[GF]}) sem palavra correspondente na BLIVRE do versículo")


def check_greek_strong(d, M, ws):
    for w in ws:
        if w[LING] != "G":
            continue
        if w[SF] == "aprox":
            e = d.lexicon.get(w[STR] or "")
            M.w(w, "LXG-02", "aviso", f"lema {w[LEMMA]} ligado a {w[STR]} ({e[2] if e else '?'}) por semelhança")


# ================================================================== saída
def write_out(M, d, book_scope, t0):
    os.makedirs(OUT, exist_ok=True)
    order = d.order
    marks = sorted(
        M.lst,
        key=lambda m: (order.get(m["book"], 999), m["chapter"], m["verse"] if m["verse"] is not None else 0, m["word_id"] or 0, m["code"]),
    )
    with open(os.path.join(OUT, "marks.json"), "w", encoding="utf8") as f:
        f.write("[\n" + ",\n".join(json.dumps(m, ensure_ascii=False) for m in marks) + "\n]\n")
    by_chapter = defaultdict(Counter)
    for m in marks:
        by_chapter[(m["book"], m["chapter"])][m["level"]] += 1
    with open(os.path.join(OUT, "summary.tsv"), "w", encoding="utf8") as f:
        f.write("livro\tcap\tn_erros\tn_avisos\tn_info\n")
        for b, c in sorted(by_chapter, key=lambda k: (order.get(k[0], 999), k[1])):
            n = by_chapter[(b, c)]
            f.write(f"{b}\t{c}\t{n['erro']}\t{n['aviso']}\t{n['info']}\n")
    by_code = defaultdict(Counter)
    examples = defaultdict(list)
    by_book = defaultdict(Counter)
    for m in marks:
        by_code[m["code"]][m["level"]] += 1
        by_book[m["book"]][m["level"]] += 1
        if len(examples[m["code"]]) < 3 and (not examples[m["code"]] or examples[m["code"]][-1]["book"] != m["book"] or len(marks) < 50):
            examples[m["code"]].append(m)
    for m in marks:  # completa exemplos quando o código só aparece num livro
        if len(examples[m["code"]]) < 3 and m not in examples[m["code"]]:
            examples[m["code"]].append(m)
    texts = {}
    pids = {m["word_id"] for es in examples.values() for m in es if m["word_id"]}
    for w in d.words:
        if w[ID] in pids:
            texts[w[ID]] = w
    abbrev = {r[1]: r[3] for r in d.books}
    esc = "Bíblia inteira" if book_scope == (None, None) else " ".join(str(x) for x in book_scope if x is not None)
    L = [
        f"# Relatório de revisão automática — {esc}",
        "",
        f"Gerado por `scripts/review.py` em {time.strftime('%Y-%m-%d %H:%M')} ({time.time() - t0:.0f}s). Catálogo: `docs/REVISOES.md`.",
        "",
        f"**Total:** {len(marks)} marcas — "
        f"{sum(c['erro'] for c in by_code.values())} erros, {sum(c['aviso'] for c in by_code.values())} avisos, "
        f"{sum(c['info'] for c in by_code.values())} informativas.",
        "",
        "## Totais por código",
        "",
        "| Código | Erros | Avisos | Info | Total |",
        "|---|---:|---:|---:|---:|",
    ]
    for cod in sorted(by_code):
        c = by_code[cod]
        L.append(f"| {cod} | {c['erro']} | {c['aviso']} | {c['info']} | {sum(c.values())} |")
    L += ["", "## Totais por livro", "", "| Livro | Erros | Avisos | Info |", "|---|---:|---:|---:|"]
    for b in sorted(by_book, key=lambda k: order.get(k, 999)):
        c = by_book[b]
        L.append(f"| {b} | {c['erro']} | {c['aviso']} | {c['info']} |")
    L += ["", "## Exemplos por código", ""]
    for cod in sorted(examples):
        L.append(f"### {cod}")
        L.append("")
        for m in examples[cod]:
            w = texts.get(m["word_id"])
            wd = f" — `{w[TXT]}` ({w[STR]}, {w[MORPH_COL]})" if w else ""
            L.append(f"- {abbrev.get(m['book'], m['book'])} {m['chapter']}:{m['verse']} [{m['level']}]{wd}: {m['msg']}")
        L.append("")
    with open(os.path.join(OUT, "report.md"), "w", encoding="utf8") as f:
        f.write("\n".join(L))
    return by_code


def main(argv):
    t0 = time.time()
    book = argv[0].upper() if argv else None
    cap = int(argv[1]) if len(argv) > 1 else None
    db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    d = Data(db)
    if book and book not in d.order:
        sys.exit(f"livro desconhecido: {book} (use os códigos de `query.py books`)")
    book_scope = (book, cap)
    M = Marks(book_scope)
    scope_books = {book} if book else set(d.order)
    ws = [w for w in d.words if (book is None or w[BOOK] == book) and (cap is None or w[CAP] == cap)]

    steps = [
        ("texto-base", lambda: check_base_text(d, M, scope_books)),
        ("unicode", lambda: check_unicode(d, M, ws)),
        ("versículos", lambda: check_verses_and_chapters(d, M, scope_books)),
        ("aramaico", lambda: check_aramaic(d, M, ws)),
        ("versificação", lambda: check_versification(d, M, scope_books)),
        ("deslocamento", lambda: check_offset(d, M, scope_books)),
        ("cobertura/léxico", lambda: check_lexicon(d, M, check_coverage(d, M, ws))),
        ("gramática hebraica", lambda: check_grammar_h(d, M, ws)),
        ("números e nomes divinos", lambda: check_numbers_and_divine_names(d, M, ws)),
        ("grego", lambda: (check_greek(d, M, ws), check_greek_strong(d, M, ws))),
        ("estilo", lambda: check_style(d, M, ws)),
        ("consistência", lambda: check_consistency(d, M, ws, scope_books)),
        ("nomes", lambda: check_names(d, M, ws, scope_books)),
        ("paralelos", lambda: check_parallels(d, M, scope_books)),
        ("pontes", lambda: check_bridges(d, M, scope_books)),
        ("apoio", lambda: check_support(d, M, ws)),
    ]
    times = []
    for name, f in steps:
        t = time.time()
        f()
        times.append((name, time.time() - t))
    by_code = write_out(M, d, book_scope, t0)
    print(f"{len(ws)} palavras revisadas em {time.time() - t0:.1f}s; {len(M.lst)} marcas → {os.path.relpath(OUT, ROOT)}/")
    if os.environ.get("REVISAR_TEMPOS"):
        for name, t in times:
            print(f"  {name:<26}{t:6.1f}s")
    print(f"{'código':<8} {'erro':>6} {'aviso':>6} {'info':>6}  {'% palavras':>10}")
    for cod in sorted(by_code):
        c = by_code[cod]
        pct = 100 * sum(c.values()) / max(1, len(ws))
        print(f"{cod:<8} {c['erro']:>6} {c['aviso']:>6} {c['info']:>6}  {pct:9.2f}%")
    tot = Counter()
    for c in by_code.values():
        tot.update(c)
    print(f"{'total':<8} {tot['erro']:>6} {tot['aviso']:>6} {tot['info']:>6}")


if __name__ == "__main__":
    main(sys.argv[1:])
