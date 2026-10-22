// Morphology codes (OSHB for Hebrew/Aramaic, MorphGNT/Robinson for Greek) decoded into words of the locale.
import { t, tryT } from "../i18n";

const label = (group: string, code: string | undefined) => (code ? tryT(`morph.${group}.${code}`) : undefined);
const join = (parts: (string | undefined)[]) => parts.filter(Boolean).join(" ");

// person, gender and number at the start of a Hebrew code tail ("3ms", "2fp")
function personGenderNumber(tail: string) {
  const m = tail.match(/^([123])?([mfcb])?([spd])?/) || [];
  return join([label("person", m[1]), label("he.gender", m[2]), label("he.number", m[3])]);
}

function decodeHebrewPart(p: string): string {
  const particle = label("he.particle", p);
  if (particle) return particle;
  const k = p[0];
  if (k === "V") {
    const [, s, ty, ...rest] = p;
    const out = `${t("morph.verb")} ${label("he.stem", s) || s} ${label("he.type", ty) || ty}`;
    return join([out, personGenderNumber(rest.join(""))]).trim();
  }
  if (k === "N" || k === "A") {
    const group = k === "N" ? "he.noun" : "he.adjective";
    const base = label(group, p[1]) || t(`morph.${group}.other`);
    const tail = p.slice(2);
    return join([base, label("he.gender", tail[0]), label("he.number", tail[1]), label("he.state", tail[2])]);
  }
  if (k === "P") return t("morph.pronoun");
  if (k === "S") return `${t("morph.suffix")} ${personGenderNumber(p.slice(2))}`;
  if (k === "T") return t("morph.particle");
  return p;
}

function decodeGreek(m: string) {
  const [pos, p = ""] = m.split(/-(.*)/s);
  const out = [label("grc.pos", pos) || pos];
  if (p[1] && p[1] !== "-") out.push(label("grc.tense", p[1])!, label("grc.voice", p[2])!, label("grc.mood", p[3])!);
  if (p[0] && p[0] !== "-") out.push(`${label("person", p[0])} ${t("morph.person_word")}`);
  out.push(label("grc.case", p[4])!, label("grc.gender", p[6])!, label("grc.number", p[5])!, label("grc.degree", p[7])!);
  return join(out);
}

/** The full grammar of a word, as in the lexicon entry ("verbo qal perfeito 3ª masc. sing."). */
export function decodeMorph(morph: string, greek: boolean) {
  if (greek) return decodeGreek(morph);
  const lang = morph[0] === "A" ? t("morph.aramaic_prefix") : "";
  return lang + morph.slice(1).split("/").map(decodeHebrewPart).join(" + ");
}

/** The short grammar on the Study card ("verbo aor.", "subst. nom."), taken from the full one. */
export function shortMorph(full: string | null | undefined) {
  const short = (w: string) => tryT(`morph.short.${w}`);
  const verb = t("morph.verb");
  const words = String(full || "")
    .replace(new RegExp("^" + t("morph.aramaic_prefix")), "")
    .split(/[\s+]+/);
  const pos = words.find(w => short(w) || w === verb);
  if (!pos) return words.slice(0, 2).join(" ");
  const rest = words.slice(words.indexOf(pos) + 1).find(w => short(w) && short(w) !== short(pos));
  return join([pos === verb ? verb : short(pos), rest ? short(rest) : ""]);
}
