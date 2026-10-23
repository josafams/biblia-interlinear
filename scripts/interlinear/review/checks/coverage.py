"""C. Coverage of glosses and lexicon."""

import re

from interlinear.review.words import ENGLISH, toks


# ================================================================== C. cobertura
def check_coverage(d, M, ws):
    used = {}
    for w in ws:
        g = w.gloss
        if not g or not g.strip() or w.gloss_source == "sem":
            M.w(w, "COB-01", "erro", "palavra sem glosa")
        elif w.gloss_source == "parcial":
            M.w(w, "COB-01", "aviso", f"glosa só do prefixo/partícula: '{g}'")
        k = w.strong
        if not k:
            M.w(w, "COB-02", "erro", f"sem número de Strong (lema {w.lemma})")
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
