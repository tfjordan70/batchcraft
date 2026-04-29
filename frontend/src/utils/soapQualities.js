/**
 * SoapCalc-style bar quality numbers: blend fatty acids by oil weight, then
 * apply the same sums as soapcalc.net (see Classic Bells "Soapcalc numbers").
 *
 * Oil fatty acid profiles: MIT-licensed dataset from
 * https://github.com/mikewolfd/soap-calc (data/oils.json), bundled as
 * ../data/soapcalcOils.json (saponifiable oils only).
 */

import soapcalcOils from "../data/soapcalcOils.json";

export const SOAP_QUALITY_RANGES = {
  hardness: { min: 29, max: 54, label: "Hardness", desc: "How hard the bar is" },
  cleansing: { min: 12, max: 22, label: "Cleansing", desc: "Removes oils/dirt" },
  conditioning: { min: 44, max: 69, label: "Conditioning", desc: "Skin feel" },
  bubbly: { min: 14, max: 46, label: "Bubbly", desc: "Big fluffy bubbles" },
  creamy: { min: 16, max: 48, label: "Creamy", desc: "Stable lather" },
};

/** @typedef {{ lauric: number; myristic: number; palmitic: number; stearic: number; ricinoleic: number; oleic: number; linoleic: number; linolenic: number }} FattyAcidProfile */

/** Longest oil names first so "Palm Kernel Oil" wins over "Palm Oil". */
const OILS_BY_NAME_LEN = [...soapcalcOils].sort((a, b) => b.name.length - a.name.length);

function faByExactSoapcalcName(exactName) {
  const o = soapcalcOils.find((x) => x.name === exactName);
  return o ? { ...o.fatty_acids } : null;
}

/**
 * Word-order / label synonyms: catalog names often differ from SoapCalc's list
 * (e.g. "Beef Tallow" vs "Tallow Beef"). Test on normalizeMatchString output.
 * @type {Array<{ test: (n: string) => boolean; exactSoapcalcName: string }>}
 */
const SYNONYM_TO_SOAPCALC_NAME = [
  {
    test: (n) =>
      /\bcoconut\b/.test(n) &&
      (/\b76\b/.test(n) || /\(76/.test(n) || n.includes("76 deg") || n.includes("76 degree")),
    exactSoapcalcName: "Coconut Oil, 76 deg",
  },
  {
    test: (n) => /\btallow\b/.test(n) && /\bbeef\b/.test(n) && !/\b(goat|deer|bear|sheep|mutton)\b/.test(n),
    exactSoapcalcName: "Tallow Beef",
  },
  {
    test: (n) => /\bpomace\b/.test(n) && /\bolive\b/.test(n),
    exactSoapcalcName: "Olive Oil pomace",
  },
  {
    test: (n) => /\bmanteca\b/.test(n) || /\bpig\s+tallow\b/.test(n) || (/\blard\b/.test(n) && /\bpig\b/.test(n)),
    exactSoapcalcName: "Lard, Pig Tallow (Manteca)",
  },
  {
    test: (n) => /\b(?:pko|pk)\b/.test(n) && /\b(?:palm|kernel)\b/.test(n),
    exactSoapcalcName: "Palm Kernel Oil",
  },
  {
    test: (n) => /\bapricot\b/.test(n) && /\bkernel\b/.test(n),
    exactSoapcalcName: "Apricot Kernel Oil",
  },
];

/** Overrides before synonym + library scan. */
const SPECIAL_FA = [
  {
    test: (n) => (n.includes("fractionated") || /\bmct\b/.test(n)) && n.includes("coconut"),
    fa: { lauric: 99, myristic: 1, palmitic: 0, stearic: 0, ricinoleic: 0, oleic: 0, linoleic: 0, linolenic: 0 },
  },
];

function normalizeMatchString(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[°]/g, "")
    .replace(/,/g, " ")
    .replace(/-/g, " ")
    .replace(/[()/_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * If no SoapCalc oil name is a substring of the ingredient, infer from common keywords.
 * Order matters (e.g. palm kernel before palm).
 * @param {string} n normalized ingredient or INCI string
 * @returns {FattyAcidProfile | null}
 */
function keywordFallbackFa(n) {
  if (!n) return null;
  if (/\bbabassu\b/.test(n)) return faByExactSoapcalcName("Babassu Oil");
  if (/\bpalm\b/.test(n) && /\bkernel\b/.test(n)) return faByExactSoapcalcName("Palm Kernel Oil");
  if ((n.includes("fractionated") || /\bmct\b/.test(n)) && /\bcoconut\b/.test(n)) {
    return faByExactSoapcalcName("Coconut Oil, fractionated");
  }
  if (/\bcoconut\b/.test(n) && !n.includes("butter")) return faByExactSoapcalcName("Coconut Oil, 76 deg");
  if (n.includes("pomace") && /\bolive\b/.test(n)) return faByExactSoapcalcName("Olive Oil pomace");
  if (/\bolive\b/.test(n)) return faByExactSoapcalcName("Olive Oil");
  if (/\bpalm\b/.test(n)) return faByExactSoapcalcName("Palm Oil");
  if (/\bcocoa\b/.test(n) && /\bbutter\b/.test(n)) return faByExactSoapcalcName("Cocoa Butter");
  if (/\bmango\b/.test(n) && (/\bbutter\b/.test(n) || /\bseed\b/.test(n))) return faByExactSoapcalcName("Mango Seed Butter");
  if (/\bshea\b/.test(n) && n.includes("fractionated")) return faByExactSoapcalcName("Shea Oil, fractionated");
  if (/\bshea\b/.test(n)) return faByExactSoapcalcName("Shea Butter");
  if (/\bcastor\b/.test(n)) return faByExactSoapcalcName("Castor Oil");
  if (/\bsunflower\b/.test(n) && /\boleic\b/.test(n)) return faByExactSoapcalcName("Sunflower Oil, high oleic");
  if (/\bsunflower\b/.test(n)) return faByExactSoapcalcName("Sunflower Oil");
  if (/\bsweet\b/.test(n) && /\balmond\b/.test(n)) return faByExactSoapcalcName("Almond Oil, sweet");
  if (/\balmond\b/.test(n) && !/\bbitter\b/.test(n)) return faByExactSoapcalcName("Almond Oil, sweet");
  if (/\bhemp\b/.test(n)) return faByExactSoapcalcName("Hemp Oil");
  if (/\bgrapeseed\b/.test(n) || /\bgrape\s+seed\b/.test(n)) return faByExactSoapcalcName("Grapeseed Oil");
  if (/\bjojoba\b/.test(n)) return faByExactSoapcalcName("Jojoba Oil (a Liquid Wax Ester)");
  if (/\brice\b/.test(n) && /\bbran\b/.test(n)) return faByExactSoapcalcName("Rice Bran Oil, refined");
  if (/\bavocado\b/.test(n)) return faByExactSoapcalcName("Avocado Oil");
  if (/\bargan\b/.test(n)) return faByExactSoapcalcName("Argan Oil");
  if (/\bcanola\b/.test(n) && /\boleic\b/.test(n)) return faByExactSoapcalcName("Canola Oil, high oleic");
  if (/\bcanola\b/.test(n) || /\brapeseed\b/.test(n)) return faByExactSoapcalcName("Canola Oil");
  if (/\bsoybean\b/.test(n) || /\bsoy\s+bean\b/.test(n)) return faByExactSoapcalcName("Soybean Oil");
  if (/\bsesame\b/.test(n)) return faByExactSoapcalcName("Sesame Oil");
  if (/\bmacadamia\b/.test(n)) return faByExactSoapcalcName("Macadamia Nut Oil");
  if (/\bhazelnut\b/.test(n)) return faByExactSoapcalcName("Hazelnut Oil");
  if (/\bneem\b/.test(n)) return faByExactSoapcalcName("Neem Seed Oil");
  if (/\btallow\b/.test(n) && !/\b(goat|deer|bear|sheep|mutton)\b/.test(n)) return faByExactSoapcalcName("Tallow Beef");
  if (/\blard\b/.test(n) || /\bmanteca\b/.test(n)) return faByExactSoapcalcName("Lard, Pig Tallow (Manteca)");
  return null;
}

/**
 * Match ingredient text to a SoapCalc-style oil row (longest name wins).
 * @param {string} raw
 * @returns {FattyAcidProfile | null}
 */
function matchFattyAcidsFromText(raw) {
  const n = normalizeMatchString(raw);
  if (!n) return null;
  for (const spec of SPECIAL_FA) {
    if (spec.test(n)) return spec.fa;
  }
  for (const syn of SYNONYM_TO_SOAPCALC_NAME) {
    if (syn.test(n)) {
      const fa = faByExactSoapcalcName(syn.exactSoapcalcName);
      if (fa) return fa;
    }
  }
  const minReverse = 7;
  for (const oil of OILS_BY_NAME_LEN) {
    const on = normalizeMatchString(oil.name);
    if (!on) continue;
    if (n.includes(on)) return { ...oil.fatty_acids };
    if (n.length >= minReverse && on.includes(n)) return { ...oil.fatty_acids };
  }
  return null;
}

/**
 * @param {string | undefined} ingredientName
 * @param {string | undefined} inciName
 * @returns {FattyAcidProfile | null}
 */
function matchOilFattyAcids(ingredientName, inciName) {
  const tryText = (raw) => {
    let fa = matchFattyAcidsFromText(raw);
    if (fa) return fa;
    fa = keywordFallbackFa(normalizeMatchString(raw));
    return fa;
  };
  let fa = tryText(ingredientName);
  if (fa) return fa;
  if (inciName && String(inciName).trim().length >= 8) {
    fa = tryText(inciName);
    if (fa) return fa;
  }
  return null;
}

/**
 * Blend weight: grams when possible, or raw amount for % rows (proportional to other %).
 * @returns {number | null}
 */
function amountToBlendWeight(amount, unit) {
  const a = Number(amount) || 0;
  if (a <= 0) return null;
  const u = (unit || "g").toLowerCase();
  if (u === "%") return a;
  if (u === "g") return a;
  if (u === "kg") return a * 1000;
  if (u === "oz") return a * 28.3495;
  if (u === "lb") return a * 453.592;
  if (u === "ml") return a * 0.92;
  if (u === "tbsp" || u === "tsp") return null;
  return a;
}

const NON_OIL_PHASES = new Set(["water", "lye", "fragrance", "colorant", "additive"]);

/** Phases that count as the fat/oil portion of a soap recipe (SoapCalc “oils” list). */
const OIL_PHASE_KEYS = new Set(["oils", "oil_phase", "oil", "fat", "fats"]);

/** Legacy rows without a phase still behave like SoapCalc’s “Oils” list once water/lye use structured phases. */
const LEGACY_PHASES_AS_OIL = new Set(["", "_default"]);

/**
 * @param {{ ingredient_name?: string; inci_name?: string; phase?: string }} ri
 */
function isLikelyNonFatLine(ri) {
  const n = normalizeMatchString(ri.ingredient_name || "");
  if (!n) return false;
  if (/\bfragrance\b|\bfo\b|\bessential\b|\b eo \b|^eo\b|\bperfume\b/.test(n)) return true;
  if (/\bcolorant\b|\bmica\b|\boxide\b|\btitanium\b/.test(n)) return true;
  if (/\bhydroxide\b|\bnaoh\b|\bkoh\b/.test(n)) return true;
  if (/\b(distill|deionized|di water|lye solution)\b/.test(n) && /\bwater\b/.test(n)) return true;
  return false;
}

/**
 * Ingredient rows that contribute to SoapCalc-style bar qualities (fatty-acid blend).
 * @param {Array<{ ingredient_name?: string; inci_name?: string; amount?: number; unit?: string; phase?: string }>} ingredients
 */
export function getSoapQualitiesOilRows(ingredients) {
  if (!ingredients?.length) return [];
  const hasStructuredOilPhase = ingredients.some((i) => OIL_PHASE_KEYS.has((i.phase || "").toLowerCase()));
  return ingredients.filter((i) => {
    const p = (i.phase || "").toLowerCase();
    if (hasStructuredOilPhase) {
      if (OIL_PHASE_KEYS.has(p)) return true;
      if (LEGACY_PHASES_AS_OIL.has(p) && !isLikelyNonFatLine(i)) return true;
      return false;
    }
    if (i.phase && NON_OIL_PHASES.has(p)) return false;
    return true;
  });
}

/**
 * SoapCalc-style qualities from a blended fatty acid profile (%).
 * @param {FattyAcidProfile} b
 */
function qualitiesFromFattyAcidBlend(b) {
  return {
    hardness: b.lauric + b.myristic + b.palmitic + b.stearic,
    cleansing: b.lauric + b.myristic,
    conditioning: b.oleic + b.linoleic + b.linolenic + b.ricinoleic,
    bubbly: b.lauric + b.myristic + b.ricinoleic,
    creamy: b.palmitic + b.stearic + b.ricinoleic,
  };
}

/**
 * @param {Array<{ ingredient_name?: string; inci_name?: string; amount?: number; unit?: string; phase?: string }>} ingredients
 * @returns {{ hardness: number; cleansing: number; conditioning: number; bubbly: number; creamy: number; matchedWeight: number; totalOilWeight: number } | null}
 */
export function computeSoapBarQualities(ingredients) {
  if (!ingredients?.length) return null;

  const rows = getSoapQualitiesOilRows(ingredients);

  let oilPhaseGrams = 0;
  let matchedGrams = 0;
  /** @type {FattyAcidProfile} */
  const weighted = { lauric: 0, myristic: 0, palmitic: 0, stearic: 0, ricinoleic: 0, oleic: 0, linoleic: 0, linolenic: 0 };

  for (const ri of rows) {
    const g = amountToBlendWeight(ri.amount, ri.unit);
    if (g == null || g <= 0) continue;
    oilPhaseGrams += g;
    const fa = matchOilFattyAcids(ri.ingredient_name, ri.inci_name);
    if (!fa) continue;
    matchedGrams += g;
    weighted.lauric += g * fa.lauric;
    weighted.myristic += g * fa.myristic;
    weighted.palmitic += g * fa.palmitic;
    weighted.stearic += g * fa.stearic;
    weighted.ricinoleic += g * fa.ricinoleic;
    weighted.oleic += g * fa.oleic;
    weighted.linoleic += g * fa.linoleic;
    weighted.linolenic += g * fa.linolenic;
  }

  if (matchedGrams <= 0 || oilPhaseGrams <= 0) return null;

  // Same weighting as SoapCalc’s “Properties From/For” oil list: blend FA by each oil’s mass share of the oil list.
  const inv = 1 / oilPhaseGrams;
  const blend = {
    lauric: weighted.lauric * inv,
    myristic: weighted.myristic * inv,
    palmitic: weighted.palmitic * inv,
    stearic: weighted.stearic * inv,
    ricinoleic: weighted.ricinoleic * inv,
    oleic: weighted.oleic * inv,
    linoleic: weighted.linoleic * inv,
    linolenic: weighted.linolenic * inv,
  };

  const q = qualitiesFromFattyAcidBlend(blend);
  const round = (x) => Math.round(x);

  return {
    hardness: round(q.hardness),
    cleansing: round(q.cleansing),
    conditioning: round(q.conditioning),
    bubbly: round(q.bubbly),
    creamy: round(q.creamy),
    matchedWeight: matchedGrams,
    totalOilWeight: oilPhaseGrams,
  };
}

/**
 * Water % of oils and water:lye (mass) from structured `water` / `lye` phases (e.g. saved from Soap Calculator).
 * @param {Array<{ ingredient_name?: string; amount?: number; unit?: string; phase?: string }>} ingredients
 * @returns {{ waterG: number; lyeG: number; oilG: number; waterPctOfOils: number | null; waterToLyeMassRatio: number | null } | null}
 */
export function computeSoapRecipeSolutionStats(ingredients) {
  if (!ingredients?.length) return null;
  const oilRows = getSoapQualitiesOilRows(ingredients);
  let oilG = 0;
  for (const ri of oilRows) {
    const g = amountToBlendWeight(ri.amount, ri.unit);
    if (g != null && g > 0) oilG += g;
  }
  let waterG = 0;
  let lyeG = 0;
  for (const ri of ingredients) {
    const p = (ri.phase || "").toLowerCase();
    const g = amountToBlendWeight(ri.amount, ri.unit);
    if (g == null || g <= 0) continue;
    if (p === "water") waterG += g;
    else if (p === "lye") lyeG += g;
  }
  if (oilG <= 0 && waterG <= 0 && lyeG <= 0) return null;
  return {
    waterG,
    lyeG,
    oilG,
    waterPctOfOils: oilG > 0 && waterG > 0 ? (waterG / oilG) * 100 : null,
    waterToLyeMassRatio: lyeG > 0 && waterG > 0 ? waterG / lyeG : null,
  };
}
