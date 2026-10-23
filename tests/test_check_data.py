"""Testes das regras de scripts/check_data.py, com arquivos de data/ montados numa pasta temporária."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import check_data  # noqa: E402


def write(base, name, text):
    p = base / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf8")
    return p


def test_the_real_data_has_no_errors():
    assert check_data.check_all().errors == []


def test_tsv_counts_columns_and_header(tmp_path):
    R = check_data.Report()
    f = write(tmp_path, "x.tsv", "key\torigin\tmeaning\nH1\tpai\tpai\textra\n\nH2\t\t\n")
    rows = check_data.tsv(R, f, ["key", "origin", "meaning"])
    assert [n for n, _ in rows] == [4]
    assert any("linha 2: 4 colunas" in e for e in R.errors)
    R2 = check_data.Report()
    assert check_data.tsv(R2, f, ["chave"]) == []
    assert "cabeçalho deve ser: chave" in R2.errors[0]


def test_questions_rules(tmp_path):
    write(
        tmp_path,
        "questions/RUT.tsv",
        "chapter\tkind\tverses\tstrong\tquestion\n"
        "1\tobservation\t1-5\t\tO que aconteceu?\n"
        "1\tinterpretation\t\t\tPor que ela ficou\n"  # sem ?
        "1\toriginal\t16\t\tO que significa?\n"  # sem Strong
        "9\tapplication\t\t\tE nós?\n",  # capítulo fora de Rute
    )
    R = check_data.Report()
    check_data.check_questions(R, tmp_path)
    text = "\n".join(R.errors)
    assert "linha 3: a pergunta deve terminar com ?" in text
    assert "linha 4: pergunta sobre a língua original precisa do número Strong" in text
    assert "linha 5: capítulo '9' fora do livro (1 a 4)" in text
    assert "capítulo 1: falta uma pergunta do tipo application" in text


def test_lexicon_pt_keys(tmp_path):
    write(tmp_path, "lexicon_pt/a.tsv", "key\torigin\tmeaning\nH430\tx\tDeus\nX1\tx\ty\n")
    write(tmp_path, "lexicon_pt/b.tsv", "key\torigin\tmeaning\nH430\tx\tDeus\nG25\tx\t \n")
    R = check_data.Report()
    check_data.check_lexicon_pt(R, tmp_path)
    text = "\n".join(R.errors)
    assert "chave inválida 'X1'" in text
    assert "H430 repetido (também em a.tsv)" in text
    assert "G25 sem significado" in text


def test_gloss_corrections_need_a_valid_place(tmp_path):
    write(
        tmp_path,
        "corrections/glosses.tsv",
        "ref\tpos\toriginal\tgloss\treviewer\tnote\nJHN 22:1\t1\tx\ty\t\t\nJHN 1:1\t0\tx\ty\t\t\nJHN 1:1\t2\t\tno princípio\t\t\n",
    )
    R = check_data.Report()
    kept = check_data.check_gloss_corrections(R, tmp_path)
    text = "\n".join(R.errors)
    assert "referência inválida 'JHN 22:1'" in text
    assert "posição deve ser um número a partir de 1" in text
    assert "glosa vazia ou com espaço" in text
    assert len(kept) == 1
    assert R.warns  # sem a palavra original: só um aviso


def test_rules_tables(tmp_path):
    write(tmp_path, "rules/pt_words.tsv", "# comentário\nclass\tword\narticle\to\narticle\to\n")
    write(tmp_path, "rules/pt_irregular_verbs.tsv", "family\tform\nSER\tsou\n")
    write(tmp_path, "rules/pt_synonyms.tsv", "palavras\nterra país\n")
    R = check_data.Report()
    check_data.check_rules(R, tmp_path)
    text = "\n".join(R.errors)
    assert "pt_words.tsv: repetido: article o" in text
    assert "pt_synonyms.tsv: cabeçalho deve ser: words" in text
    assert "rare_glosses.tsv: arquivo faltando" in text
