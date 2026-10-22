import { describe, expect, test } from "vitest";
import { decodeMorph, shortMorph } from "../../src/lib/morph";

describe("decodeMorph", () => {
  test.each([
    ["HVqp3ms", false, "verbo qal perfeito 3ª masc. sing."],
    ["HR/Ncfsa", false, "preposição + substantivo fem. sing. absoluto"],
    ["HTd/Ncmpa", false, "artigo + substantivo masc. plural absoluto"],
    ["HNcmpa", false, "substantivo masc. plural absoluto"],
    ["HNpm", false, "nome próprio masc."],
    ["HC/Vqw3ms", false, "conjunção + verbo qal imperfeito consecutivo 3ª masc. sing."],
    ["HNcfsc/Sp3ms", false, "substantivo fem. sing. construto + sufixo 3ª masc. sing."],
    ["AVqp3ms", false, "aramaico: verbo qal perfeito 3ª masc. sing."],
    ["V-3AAI-S--", true, "verbo aoristo ativo indicativo 3ª pessoa sing."],
    ["N-----NSF-", true, "substantivo nominativo fem. sing."],
    ["RA-----NSM-", true, "artigo nominativo masc. sing."]
  ])("%s", (code, greek, expected) => expect(decodeMorph(code, greek)).toBe(expected));
});

describe("shortMorph", () => {
  test.each([
    ["verbo aoristo ativo indicativo 3ª pessoa sing.", "verbo aor."],
    ["substantivo nominativo fem. sing.", "subst. nom."],
    ["preposição + substantivo fem. sing. absoluto", "prep. subst."],
    ["aramaico: verbo qal perfeito 3ª masc. sing.", "verbo qal"],
    ["nome próprio masc.", "nome próprio"],
    ["", ""]
  ])("%s", (full, expected) => expect(shortMorph(full)).toBe(expected));
});
