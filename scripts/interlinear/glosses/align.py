"""Aligning the units with the Bíblia Livre words (eflomal, both directions, grow-diag-final-and); the
alignment is saved in data/alignment/ so the glosses stay stable."""

import gzip
import hashlib
import os
import time
from pathlib import Path

from interlinear.paths import ROOT
from interlinear.text import norm_greek

TMP = os.path.join(ROOT, "build", "alignment")


# ------------------------------------------------------------- simetrização
NEIGHBORS = [(-1, 0), (0, -1), (1, 0), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]


def gdfa(fwd, rev):
    a = fwd & rev
    u = fwd | rev
    al_s = {i for i, _ in a}
    al_t = {j for _, j in a}
    changed = True
    while changed:
        changed = False
        for i, j in sorted(a):
            for di, dj in NEIGHBORS:
                n = (i + di, j + dj)
                if n in u and n not in a and (n[0] not in al_s or n[1] not in al_t):
                    a.add(n)
                    al_s.add(n[0])
                    al_t.add(n[1])
                    changed = True
    for i, j in sorted(u):
        if (i, j) not in a and i not in al_s and j not in al_t:
            a.add((i, j))
            al_s.add(i)
            al_t.add(j)
    return a


def read_links(fname):
    out = []
    for line in Path(fname).read_text(encoding="utf8").splitlines(keepends=True):
        s = set()
        for pair in line.split():
            i, j = pair.split("-")
            s.add((int(i), int(j)))
        out.append(s)
    return out


def align_corpus(item_list, name):
    os.makedirs(TMP, exist_ok=True)
    src = [" ".join(u[2] for u in it[4] if u[1] != "fora") or "_" for it in item_list]
    trg = [" ".join(norm_greek(tk[0]) for tk in it[3]) or "_" for it in item_list]
    fwd = os.path.join(TMP, f"{name}.fwd")
    rev = os.path.join(TMP, f"{name}.rev")
    # O eflomal é aleatório: o alinhamento fica salvo em data/alignment/ para as glosas serem estáveis.
    # Só é refeito se o texto de entrada mudar ou com REALINHAR=1.
    saved = os.path.join(ROOT, "data", "alignment", f"{name}.links.gz")
    signature = hashlib.sha256(("\n".join(src) + "\0" + "\n".join(trg)).encode()).hexdigest()
    pairs = None
    if os.path.exists(saved) and os.environ.get("REALINHAR") != "1":
        with gzip.open(saved, "rt", encoding="utf8") as f:
            if f.readline().strip() == signature:
                pairs = [tuple(ln.rstrip("\n").split("\t")) for ln in f]
        if pairs is None:
            print(f"  {name}: o texto mudou desde o último alinhamento; refazendo")
    if pairs is None:
        if os.environ.get("ADOTAR") == "1" and os.path.exists(fwd) and os.path.exists(rev):
            print(f"  {name}: adotando o último alinhamento de {os.path.relpath(TMP, ROOT)}")
        else:
            t0 = time.time()
            import eflomal  # only to align again (GPL tool, slow to load)

            al = eflomal.Aligner(model=3, n_samplers=2)
            al.align(src, trg, links_filename_fwd=fwd, links_filename_rev=rev, quiet=True)
            print(f"  eflomal {name}: {len(src)} versículos em {time.time() - t0:.0f}s")
        fw = Path(fwd).read_text(encoding="utf8").split("\n")[: len(src)]
        rv = Path(rev).read_text(encoding="utf8").split("\n")[: len(src)]
        pairs = list(zip(fw, rv, strict=False))
        os.makedirs(os.path.dirname(saved), exist_ok=True)
        with gzip.open(saved, "wt", encoding="utf8", compresslevel=9) as f:
            f.write(signature + "\n")
            f.writelines(f"{a}\t{b}\n" for a, b in pairs)
    else:
        print(f"  {name}: alinhamento salvo reaproveitado ({os.path.relpath(saved, ROOT)})")

    def _links(line):
        return {tuple(map(int, p.split("-"))) for p in line.split()}

    links = []
    for it, (a, b) in zip(item_list, ((_links(x), _links(y)) for x, y in pairs), strict=False):
        idx = [ui for ui, u in enumerate(it[4]) if u[1] != "fora"]  # índice no alinhamento → unidade
        links.append({(idx[i], j) for i, j in gdfa(a, b) if i < len(idx) and j < len(it[3])})
    return links
