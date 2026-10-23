"""Portuguese: the words of a gloss, stems, stop words and the verb forms the checks compare."""

from interlinear.text import strip_marks


# ------------------------------------------------------------------ português
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
    r = strip_marks(singular(t))[:4]  # prefixo: criou/criar/criado → cri; santo/santa → sant
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
