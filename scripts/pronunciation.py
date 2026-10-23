#!/usr/bin/env python3
"""Pronúncia aproximada dos lemas hebraicos e gregos, escrita para quem fala
português do Brasil.

    from pronunciation import pron_hebrew, pron_greek
    pron_hebraico("el-o-heem'")   # -> "e-lo-HIM"
    pron_grego("λόγος")           # -> "LO-gos"

    python3 scripts/pronunciation.py  # roda os testes (Gênesis 1, palavras do NT
                                  # e varredura de todo o léxico do banco)

Convenções da saída (as mesmas nas duas línguas)
------------------------------------------------
- Sílabas separadas por hífen; a sílaba tônica vai em MAIÚSCULAS.
  Palavra sem marca de tonicidade (monossílabo hebraico sem acento no Strong,
  proclítica ou enclítica grega sem acento) fica toda em minúsculas.
- Expressões de várias palavras saem com as palavras separadas por espaço.
- "rr" = som gutural de "carro" (ח/כ no hebraico, χ no grego).
- "h" é sempre aspirado, como no inglês "house" (ה; espírito áspero do grego).
- "ch" = como em "chave" (ש).
- "th" = θ grego (como no inglês "think"); no hebraico o "th" do Strong vira "t".
- "k" para o c duro; "g" é sempre duro, por isso antes de e/i escreve-se "gu"
  (גּ antes de e/i, γ antes de e/i: "gue", "gui").
- ê, ô = vogais fechadas; é = e aberto.
- "ts" = צ (como em "tsunami"); "z", "f", "v" como no português.

Hebraico — pron_hebraico(pron_strong)
-------------------------------------
Parte da pronúncia do dicionário Strong, escrita em convenção inglesa
("aw-mar'", "el-o-heem'"), com o apóstrofo marcando a sílaba tônica.
É um porte fiel de pron_pt/pron_syllable/PRON_OVERRIDES do antigo scripts/build.rb (protótipo de Gênesis 1):
  aw → a, ay → ê, ee → i, oo → u, "e" mudo do inglês (ale → êl, bene → bin,
  ore → or), eh → é no fim da palavra ou na sílaba tônica (e no meio), sh → ch,
  kh → rr, th → t, ph → f, y → i, e ressilabação à portuguesa
  (el-o-heem → e-lo-HIM).
Correções gerais acrescentadas ao porte (não alteram Gênesis 1):
  - pron vazio/None → None;
  - várias palavras ("bayth haw-rawn'") são tratadas uma a uma;
  - alternativas ("x or y") → só a primeira; texto entre parênteses some;
  - apóstrofo no meio da sílaba também separa sílabas (o'fel → O-fel,
    rah'am → RA-am), exceto antes de "ee" final, que forma ditongo
    (ab-o'ee → a-BOI); "ah'ee"/"ah'-ee" no fim → "ai" (oo-zah'-ee → u-ZAI);
  - pedaços com mais de uma sílaba sem hífen são divididos
    (chawnawn' → rra-NAN, arawm' → a-RAM);
  - "''" (acento secundário do Strong) não vira maiúscula; apóstrofo no
    começo da palavra é ignorado;
  - "e" mudo também depois de vogal longa (booce → bus, sayte → sêt) e antes
    de "s" final (tsates → tsêts); "c" vira "s" antes de e/i e "k" no resto;
    "ch" do Strong (= ח) → rr; "gh" → g (gu antes de e/i); "q" → k;
    "uw" → u; "oh" antes de consoante → o; "ai" → ê (akh-air' → a-RRÊR);
    "-gue" final → g; "-oe" final → o;
  - verbete sem nenhuma marca de tonicidade: cada palavra de 2+ sílabas é
    acentuada na última, ou na penúltima quando a última tem "e"/"i" breve
    (padrão segolado: bah-yith → BA-it, meh-theg → MÉ-teg). Se o verbete
    tem alguma marca, as palavras sem marca ficam átonas (estado construto).
Limitação conhecida: "s" entre vogais continua "s" (a-SA para "aw-saw'"),
como no build.rb, para não mudar a saída já publicada de Gênesis 1.

Grego — pron_grego(lema)
------------------------
Pronúncia erasmiana/koiné aproximada, a partir das letras e acentos do lema:
  α a · ε e · η ê · ι i · ο o · ω ô · υ i
  ditongos: αι ai · ει ei · οι oi · υι ui · αυ au · ευ eu · ηυ êu · ου u
  (trema separa: Μωϋσῆς → mô-i-SÊS; iota subscrito é mudo)
  β b · γ g (γγ ng, γκ nk, γξ nks, γχ nrr) · δ d · ζ z · θ th · κ k · λ l
  μ m · ν n · ξ ks · π p · ρ r · σ/ς s · τ t · φ f · χ rr · ψ ps
  espírito áspero → "h" (ἁμαρτία → ha-mar-TI-a; em ῥ não se escreve).
  χ antes de consoante vira "k" (Χριστός → kris-TOS, τέχνη → TEK-nê), porque
  "rr" seguido de consoante não se lê em português.
Tônica: a sílaba com acento agudo, grave ou circunflexo (o primeiro, se houver
mais de um). Sem acento (εἰ, ἐστι), a palavra fica em minúsculas.
Divisão silábica: vogal + vogal se separam (θε-ός); uma consoante entre vogais
vai para a sílaba seguinte (λό-γος); num grupo de consoantes só a última vai
para a seguinte (ἁ-μαρ-τί-α, πίσ-τις, δόξ-α → DOK-sa), salvo oclusiva + λ/ρ,
que ficam juntas (ἐκ-κλη-σί-α, ἄν-θρω-πος); consoantes dobradas se separam
(ἄλ-λος). Como o hífen já marca o começo de cada sílaba, o σ entre vogais é
escrito com um "s" só no começo da sílaba (ek-klê-SI-a, i-ê-SUS).
Parênteses, hífens e apóstrofos de elisão do lema são ignorados, mantendo as
letras (οὕτω(ς) → HU-tôs). Palavra sem vogal (o numeral χξϛ) é lida pelos
nomes das letras.
"""

import re
import unicodedata
from pathlib import Path

# ===========================================================================
# Hebraico
# ===========================================================================

PRON_OVERRIDES = {
    "khah'-ee": "RRAI",  # חַי
    "haw-yaw": "ha-IA",  # הָיָה (o Strong não marca a tônica)
    "baw-kar": "ba-KAR",
    "ates": "ÊTS",  # עֵץ
    "eh'seb": "É-sev",  # עֵשֶׂב
    "bo": "bô",
    "law-hem'": "la-HEM",
    "law-kem'": "la-KEM",
}

_PT_VOWEL = re.compile(r"[aeiouéê]")
_MUTE_V = {"a": "ê", "e": "i", "i": "ai", "o": "o", "u": "u"}
# "e" mudo final do inglês (regra do build.rb)
_MUTE_E = re.compile(r"\A([^aeiou]*)([aeiou])([^aeiouwyh]{1,2})e\Z")
# extensões: depois de vogal longa (booce, sayte) e com "s" final (tsates)
_MUTE_E_LONG = re.compile(r"\A([^aeiou]*)(aw|ay|ee|oo|ow)([^aeiouwyh]{1,2})e\Z")
_MUTE_ES = re.compile(r"\A([^aeiou]*)([aeiou])([^aeiouwyh]{1,2})es\Z")


def _syllable_he(syl, final):
    """Porte de pron_syllable (build.rb), com as extensões do "e" mudo."""
    # dígrafos consonantais viram marcadores de 1 caractere antes da regra do "e" mudo
    s = syl.lower().replace("sh", "§").replace("kh", "®").replace("th", "t").replace("ph", "f")
    m = _MUTE_E.match(s)
    if m:
        s = m.group(1) + _MUTE_V[m.group(2)] + m.group(3)
    elif _MUTE_E_LONG.match(s):
        m = _MUTE_E_LONG.match(s)
        s = m.group(1) + m.group(2) + m.group(3)
    elif _MUTE_ES.match(s):
        m = _MUTE_ES.match(s)
        s = m.group(1) + _MUTE_V[m.group(2)] + m.group(3) + "s"
    s = s.replace("aw", "a").replace("ay", "ê").replace("ee", "i").replace("oo", "u")
    # "eh" final de palavra = e aberto; no meio da palavra, e breve
    s = re.sub(r"eh(?![aeiou])", "é" if final else "e", s)
    s = re.sub(r"ah(?![aeiou])", "a", s)
    s = re.sub(r"oh(?![aeiou])", "o", s)
    s = s.replace("§", "ch").replace("®", "rr")
    s = re.sub(r"\Ayi", "i", s, count=1)
    s = re.sub(r"\Ay", "i", s, count=1)
    s = s.replace("y", "i")
    return re.sub(r"g(?=[eiéê])", "gu", s)


def _tokens_en(s):
    """Divide uma sílaba do Strong (sem apóstrofo) em núcleos vocálicos (V)
    e consoantes (C), na convenção inglesa do dicionário."""
    toks, i, n = [], 0, len(s)
    while i < n:
        c, two = s[i], s[i : i + 2]
        nxt = s[i + 2] if i + 2 < n else ""
        if two in ("aw", "ow", "ee", "oo") or (two == "ay" and (not nxt or nxt not in "aeiou")):
            toks.append(("V", two))
            i += 2
        elif c in "aeiou":
            if i + 1 < n and s[i + 1] == "h" and (not nxt or nxt not in "aeiouy"):
                toks.append(("V", two))  # ah, eh, oh (h só alonga a vogal)
                i += 2
            else:
                toks.append(("V", c))
                i += 1
        elif c == "y" and (i + 1 >= n or s[i + 1] not in "aeiou") and (not toks or toks[-1][0] == "C"):
            toks.append(("V", c))
            i += 1
        elif two in ("sh", "kh", "th", "ph", "ts"):
            toks.append(("C", two))
            i += 2
        else:
            toks.append(("C", c))
            i += 1

    # "e" mudo final (ale, booce, tsates) não é núcleo: junta-se às consoantes
    def silent(k):
        return (
            k >= 2
            and toks[k] == ("V", "e")
            and toks[k - 1][0] == "C"
            and toks[k - 1][1] not in "wyh"
            and (toks[k - 2][0] == "V" or (k >= 3 and toks[k - 2][0] == "C" and toks[k - 2][1] not in "wyh" and toks[k - 3][0] == "V"))
        )

    last = len(toks) - 1
    if last >= 2 and silent(last):
        toks[last] = ("C", "e")
    elif last >= 3 and toks[last] == ("C", "s") and silent(last - 1):
        toks[last - 1] = ("C", "e")
    return toks


def _split_en(s):
    """Divide em sílabas um pedaço do Strong que ficou sem hífen
    ("chawnawn" → ["chaw", "nawn"]). Pedaço de uma sílaba volta inteiro."""
    toks = _tokens_en(s)
    nuc = [k for k, t in enumerate(toks) if t[0] == "V"]
    if len(nuc) < 2:
        return [s]
    cuts = []
    for a, b in zip(nuc, nuc[1:], strict=False):
        ncons = b - a - 1
        if ncons == 0:
            # vogal + "ee" final forma ditongo (oee → oi, aee → ai)
            if toks[b][1] == "ee" and b == len(toks) - 1:
                continue
            cuts.append(b)
        else:
            cuts.append(b - 1)  # a última consoante vai para a sílaba seguinte
    if not cuts:
        return [s]
    chunks, start_offset = [], 0
    for c in cuts:
        chunks.append("".join(t[1] for t in toks[start_offset:c]))
        start_offset = c
    chunks.append("".join(t[1] for t in toks[start_offset:]))
    return chunks


def _normalize_he(pron):
    p = pron.lower()
    p = re.sub(r"[’`´ʼ]", "'", p)
    p = re.split(r"\s+or\s+|[,;]", p)[0]  # só a primeira alternativa
    p = re.sub(r"\([^)]*\)", " ", p)  # "(with enclitic)"
    p = p.replace("kch", "kh")
    p = re.sub(r"(?<!s)ch", "kh", p)  # "ch" do Strong = ח
    p = p.replace("gh", "g").replace("q", "k").replace("uw", "oo").replace("ck", "k")
    p = re.sub(r"c(?=[eiy])", "s", p).replace("c", "k")
    p = re.sub(r"h{2,}", "h", p)
    p = re.sub(r"(?<=[aeiou])gue(?=['\- ]|\Z)", "g", p)  # maw-gogue' → maw-gog'
    p = re.sub(r"oe(?=['\- ]|\Z)", "o", p)  # yakh-doe' → yakh-do'
    p = p.replace("ai", "ay")  # akh-air' → akh-ayr'
    p = re.sub(r"[^a-z'\- ]", "", p)
    return p.strip()


def _word_he(w, default_stress=True):
    """Uma palavra do Strong ("el-o-heem'") → "e-lo-HIM".
    tonica_padrao: acentuar pela heurística se a palavra vier sem marca."""
    if w in PRON_OVERRIDES:
        return PRON_OVERRIDES[w]
    # "''" marca acento secundário; só conta se não houver acento principal
    if re.search(r"(?<!')'(?!')", w):
        w = w.replace("''", "")
    else:
        w = w.replace("''", "'")
    w = re.sub(r"(^|-)'+", r"\1", w)  # apóstrofo no começo de sílaba
    w = re.sub(r"-{2,}", "-", w).strip("-")
    if not w:
        return ""
    # vogal tônica + "ee" final átono = ditongo (oo-zah'-ee → u-ZAI, go'-ee → GOI)
    w = re.sub(r"(ah|o|oo|ay)'-ee\Z", r"\1'ee", w)
    w = re.sub(r"([aeo])h('?)ee(?=\Z|-)", r"\1\2ee", w)  # ah'ee → a'ee (→ ai)
    # apóstrofo no meio também separa sílabas (o'fel → o'-fel), menos antes do "ee" do ditongo
    w = re.sub(r"'(?!ee(?:\Z|-))(?=[a-z])", "'-", w)

    raw = []  # (sílaba do Strong, tônica?)
    for p in [x for x in w.split("-") if x]:
        stressed = "'" in p
        subs = _split_en(p.replace("'", ""))
        for k, sp in enumerate(subs):
            raw.append((sp, stressed and k == len(subs) - 1))

    if default_stress and len(raw) >= 2 and not any(t for _, t in raw):
        # sem marca de tonicidade: última sílaba, ou penúltima se a última tem e/i breve
        latest = [t[1] for t in _tokens_en(raw[-1][0]) if t[0] == "V"]
        k = len(raw) - 2 if latest in (["e"], ["i"]) else len(raw) - 1
        raw[k] = (raw[k][0], True)

    n = len(raw)
    parts = []
    for i, (p, stressed) in enumerate(raw):
        syl = _syllable_he(p, final=(i == n - 1))
        # e aberto quando tônico no meio da palavra (eh'-rets → É-rets)
        if stressed and "eh" in p and i < n - 1:
            syl = re.sub(r"\A([^aeiou]*?(?:gu)?i?)e(?=[^aeiou]*\Z)", r"\1é", syl, count=1)
        parts.append([syl, stressed])
    # ressilabação à moda do português: consoante final passa para a sílaba
    # seguinte quando esta começa por vogal (el-o-heem → e-lo-him)
    for i in range(n - 1):
        cur, nxt = parts[i][0], parts[i + 1][0]
        if not _PT_VOWEL.match(nxt):
            continue
        m = re.search(r"(rr|ch|[^aeiouéê])\Z", cur)
        if not m or len(cur) <= len(m.group(0)):
            continue
        coda = m.group(0)
        parts[i][0] = cur[: -len(coda)]
        parts[i + 1][0] = coda + nxt
    return "-".join(s.upper() if t else s for s, t in parts if s)


def pron_hebrew(pron_strong):
    """Pronúncia do Strong em convenção inglesa → grafia portuguesa com a
    tônica em maiúsculas ("aw-mar'" → "a-MAR"). Devolve None se vazia."""
    if pron_strong is None:
        return None
    if pron_strong in PRON_OVERRIDES:
        return PRON_OVERRIDES[pron_strong]
    p = _normalize_he(pron_strong)
    if not p:
        return None
    # Em expressões com alguma palavra marcada, as sem marca ficam átonas
    # (em geral estado construto: "bayth haw-rawn'" → bêt ha-RAN).
    pattern = "'" not in p
    out = " ".join(x for x in (_word_he(w, pattern) for w in p.split()) if x)
    return out or None


# ===========================================================================
# Grego
# ===========================================================================

_ACUTE, _GRAVE, _CIRC = "́", "̀", "͂"
_PSILE, _DASIA = "̓", "̔"
_DIAERESIS = "̈"
_ACCENTS = (_ACUTE, _GRAVE, _CIRC)
_VOWELS_G = set("αεηιουω")
_VOWEL_PT = {"α": "a", "ε": "e", "η": "ê", "ι": "i", "ο": "o", "υ": "i", "ω": "ô"}
_DIPHTHONGS = {"αι": "ai", "ει": "ei", "οι": "oi", "υι": "ui", "αυ": "au", "ευ": "eu", "ηυ": "êu", "ου": "u", "ωυ": "ôu"}
_CONS_PT = {
    "β": "b",
    "γ": "g",
    "δ": "d",
    "ζ": "z",
    "θ": "th",
    "κ": "k",
    "λ": "l",
    "μ": "m",
    "ν": "n",
    "π": "p",
    "ρ": "r",
    "σ": "s",
    "τ": "t",
    "φ": "f",
    "χ": "rr",
}
_PLOSIVES = set("πβφτδθκγχ")
_LIQUIDS = set("λρ")
_VARIANTS = {"ς": "σ", "ϲ": "σ", "ϐ": "β", "ϑ": "θ", "ϕ": "φ", "ϰ": "κ", "ϱ": "ρ", "ϖ": "π"}
# nomes das letras, para "palavras" sem vogal (numerais como χξϛ)
_NAMES = {
    "α": "ἄλφα",
    "β": "βῆτα",
    "γ": "γάμμα",
    "δ": "δέλτα",
    "ε": "ἒ ψιλόν",
    "ζ": "ζῆτα",
    "η": "ἦτα",
    "θ": "θῆτα",
    "ι": "ἰῶτα",
    "κ": "κάππα",
    "λ": "λάμβδα",
    "μ": "μῦ",
    "ν": "νῦ",
    "ξ": "ξῖ",
    "ο": "ὂ μικρόν",
    "π": "πῖ",
    "ρ": "ῥῶ",
    "σ": "σίγμα",
    "τ": "ταῦ",
    "υ": "ὖ ψιλόν",
    "φ": "φῖ",
    "χ": "χῖ",
    "ψ": "ψῖ",
    "ω": "ὦ μέγα",
    "ϛ": "στίγμα",
}


def _letters_g(word):
    """Lista de (letra base minúscula, conjunto de diacríticos)."""
    letters = []
    for ch in unicodedata.normalize("NFD", word.lower()):
        if unicodedata.combining(ch):
            if letters:
                letters[-1][1].add(ch)
            continue
        ch = _VARIANTS.get(ch, ch)
        if "α" <= ch <= "ω" or ch == "ϛ":
            letters.append((ch, set()))
    return letters


def _phonemes_g(letters):
    """Agrupa as letras em vogais/ditongos e consoantes simples.
    Cada item: [tipo, texto_pt, tônica, áspero, letra_grega]."""
    item_list, i, n = [], 0, len(letters)
    while i < n:
        b, marks = letters[i]
        if b in _VOWELS_G:
            pair = b + letters[i + 1][0] if i + 1 < n else ""
            if pair in _DIPHTHONGS and _DIAERESIS not in letters[i + 1][1] and not marks & {_ACUTE, _GRAVE, _CIRC, _PSILE, _DASIA}:
                m2 = marks | letters[i + 1][1]
                item_list.append(["V", _DIPHTHONGS[pair], bool(m2 & set(_ACCENTS)), _DASIA in m2, pair])
                i += 2
                continue
            item_list.append(["V", _VOWEL_PT[b], bool(marks & set(_ACCENTS)), _DASIA in marks, b])
        elif b == "ξ":
            item_list += [["C", "k", False, False, "κ"], ["C", "s", False, False, "σ"]]
        elif b == "ψ":
            item_list += [["C", "p", False, False, "π"], ["C", "s", False, False, "σ"]]
        elif b == "ϛ":
            item_list += [["C", "s", False, False, "σ"], ["C", "t", False, False, "τ"]]
        else:
            item_list.append(["C", _CONS_PT[b], False, False, b])
        i += 1
    # γ nasal antes de γ, κ, ξ (κ+σ), χ
    for k in range(len(item_list) - 1):
        if item_list[k][4] == "γ" and item_list[k + 1][4] in ("γ", "κ", "χ"):
            item_list[k][1] = "n"
    # χ antes de consoante (ou no fim) → k
    for k, it in enumerate(item_list):
        if it[4] == "χ" and it[1] == "rr" and (k + 1 >= len(item_list) or item_list[k + 1][0] == "C"):
            it[1] = "k"
    return item_list


def _syllables_g(item_list):
    """Divide a sequência de fonemas em sílabas (listas de itens)."""
    nuc = [k for k, it in enumerate(item_list) if it[0] == "V"]
    if not nuc:
        return [item_list]
    cuts = []
    for a, b in zip(nuc, nuc[1:], strict=False):
        group_name = item_list[a + 1 : b]
        if len(group_name) <= 1:
            cuts.append(a + 1)  # θε-ός, λό-γος
            continue
        c1, c2 = group_name[-2][4], group_name[-1][4]
        if c1 in _PLOSIVES and c2 in _LIQUIDS and c1 != c2:
            cuts.append(b - 2)  # ἐκ-κλη-σί-α, ἄν-θρω-πος
        else:
            cuts.append(b - 1)  # ἁ-μαρ-τί-α, πίσ-τις
    syllables, start_offset = [], 0
    for c in cuts:
        syllables.append(item_list[start_offset:c])
        start_offset = c
    syllables.append(item_list[start_offset:])
    return syllables


def _word_g(word):
    letters = _letters_g(word)
    if not letters:
        return ""
    if not any(b in _VOWELS_G for b, _ in letters):
        # numeral ou sigla sem vogal: lê pelos nomes das letras
        return " ".join(pron_greek(_NAMES[b]) for b, _ in letters if b in _NAMES)
    syllables = _syllables_g(_phonemes_g(letters))
    stressed = next((k for k, s in enumerate(syllables) if any(it[2] for it in s)), None)
    result = []
    for k, syllable in enumerate(syllables):
        txt = ""
        for it in syllable:
            if it[0] == "V" and it[3]:
                txt += "h"  # espírito áspero
            txt += it[1]
        txt = re.sub(r"g(?=[eiêé])", "gu", txt)
        result.append(txt.upper() if k == stressed else txt)
    return "-".join(result)


def pron_greek(lemma):
    """Lema grego acentuado → pronúncia aproximada à portuguesa, com a tônica
    em maiúsculas (λόγος → "LO-gos", Ἰησοῦς → "i-ê-SUS")."""
    if not lemma:
        return ""
    verse_text = re.sub(r"[()\[\]\-’'ʼ᾽`]", "", lemma)  # οὕτω(ς) → οὕτως
    return " ".join(x for x in (_word_g(w) for w in verse_text.split()) if x)


# ===========================================================================
# Testes
# ===========================================================================

GREEK_TESTS = {
    # exemplos da especificação
    "λόγος": "LO-gos",
    "θεός": "the-OS",
    "ἀγάπη": "a-GA-pê",
    "Ἰησοῦς": "i-ê-SUS",
    "πνεῦμα": "PNEU-ma",
    "ἐκκλησία": "ek-klê-SI-a",
    "χάρις": "RRA-ris",
    "ψυχή": "psi-RRÊ",
    "οὐρανός": "u-ra-NOS",
    "ἁμαρτία": "ha-mar-TI-a",
    "οὕτω(ς)": "HU-tôs",
    # palavras comuns do NT
    "καί": "KAI",
    "ὁ": "ho",
    "ἐν": "en",
    "εἰμί": "ei-MI",
    "λέγω": "LE-gô",
    "κύριος": "KI-ri-os",
    "ἄνθρωπος": "AN-thrô-pos",
    "Χριστός": "kris-TOS",
    "πίστις": "PIS-tis",
    "υἱός": "hui-OS",
    "πατήρ": "pa-TÊR",
    "ἡμέρα": "hê-ME-ra",
    "γῆ": "GUÊ",
    "βασιλεία": "ba-si-LEI-a",
    "εὐαγγέλιον": "eu-an-GUE-li-on",
    "ἄγγελος": "AN-gue-los",
    "ἀνάγκη": "a-NAN-kê",
    "δόξα": "DOK-sa",
    "ζωή": "zô-Ê",
    "εἰρήνη": "ei-RÊ-nê",
    "σάρξ": "SARKS",
    "μαθητής": "ma-thê-TÊS",
    "ἀπόστολος": "a-POS-to-los",
    "δικαιοσύνη": "di-kai-o-SI-nê",
    "ἀλήθεια": "a-LÊ-thei-a",
    "ἔρχομαι": "ER-rro-mai",
    "γίνομαι": "GUI-no-mai",
    "κόσμος": "KOS-mos",
    "Ἰωάννης": "i-ô-AN-nês",
    "Ἰουδαῖος": "i-u-DAI-os",
    "Μωϋσῆς": "mô-i-SÊS",
    "Ἠσαΐας": "ê-sa-I-as",
    "ἄλλος": "AL-los",
    "παρρησία": "par-rê-SI-a",
    "ἐξουσία": "ek-su-SI-a",
    "ἔσχατος": "ES-rra-tos",
    "τέκνον": "TEK-non",
    "Ἰερουσαλήμ": "i-e-ru-sa-LÊM",
    "σταυρός": "stau-ROS",
    "ἀμήν": "a-MÊN",
    "Παῦλος": "PAU-los",
    "Πέτρος": "PE-tros",
    "ῥῆμα": "RÊ-ma",
    "ὑπέρ": "hi-PER",
    "ποιέω": "poi-E-ô",
    "γυνή": "gui-NÊ",
    "εἰ μή": "ei MÊ",
}


def _tests(root=None):
    import json
    import os
    import sqlite3
    import time

    root = root or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    failures = 0

    print("== Grego: palavras de teste")
    for lemma, expected in GREEK_TESTS.items():
        got = pron_greek(lemma)
        if got != expected:
            failures += 1
            print(f"  FALHA  {lemma}: esperado {expected!r}, obtido {got!r}")
    print(f"  {len(GREEK_TESTS)} palavras, {failures} falha(s)")

    gen1 = os.path.join(root, "build", "gen1.json")
    if os.path.exists(gen1):
        print("== Hebraico: Gênesis 1 (build/gen1.json) contra o build.rb")
        lex = json.loads(Path(gen1).read_text(encoding="utf8"))["lex"]
        f0 = failures
        for strong, v in lex.items():
            got = pron_hebrew(v["pron"])
            if got != v["pron_pt"]:
                failures += 1
                print(f"  FALHA  H{strong} {v['pron']!r}: esperado {v['pron_pt']!r}, obtido {got!r}")
        print(f"  {len(lex)} verbetes, {failures - f0} falha(s)")
    if pron_hebrew("") is not None or pron_hebrew(None) is not None:
        failures += 1
        print("  FALHA  pron vazio deveria dar None")

    db = os.path.join(root, "build", "biblia.sqlite")
    if os.path.exists(db):
        con = sqlite3.connect(db)
        for language, col, func in (("H", "pron_en", pron_hebrew), ("G", "lemma", pron_greek)):
            print(f"== Léxico do banco: lingua='{language}' ({col})")
            t0, n, errors, odd, empties = time.time(), 0, 0, [], 0
            for entry_key, value in con.execute(f"SELECT entry_key, {col} FROM lexicon WHERE language=?", (language,)):  # noqa: S608 (col vem de uma tupla fixa)
                n += 1
                try:
                    out = func(value)
                except Exception as e:  # noqa: BLE001
                    errors += 1
                    print(f"  EXCEÇÃO  {entry_key} {value!r}: {e!r}")
                    continue
                if not out:
                    empties += 1
                elif re.search(r"[^a-zA-ZéêôÉÊÔ\- ]|--|^-|-$|- | -", out):
                    odd.append((entry_key, value, out))
            failures += errors + len(odd)
            for item in odd[:20]:
                print("  ESTRANHO ", *item)
            print(
                f"  {n} verbetes, {errors} exceção(ões), {len(odd)} saída(s) com caracteres "
                f"estranhos, {empties} vazia(s), {time.time() - t0:.1f}s"
            )
    print("OK" if not failures else f"{failures} problema(s)")
    return failures


if __name__ == "__main__":
    import sys

    sys.exit(1 if _tests() else 0)
