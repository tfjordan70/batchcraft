/**
 * SoapCalc-style bar quality numbers (per 100% of that oil), weighted by recipe %.
 * Ranges align with SOAP_QUALITY_RANGES in LyeCalculator / RecipeDetailsPage.
 */

export const SOAP_QUALITY_RANGES = {
  hardness: { min: 29, max: 54, label: "Hardness", desc: "How hard the bar is" },
  cleansing: { min: 12, max: 22, label: "Cleansing", desc: "Removes oils/dirt" },
  conditioning: { min: 44, max: 69, label: "Conditioning", desc: "Skin feel" },
  bubbly: { min: 14, max: 46, label: "Bubbly", desc: "Big fluffy bubbles" },
  creamy: { min: 16, max: 48, label: "Creamy", desc: "Stable lather" },
};

/** @type {Record<string, { hardness: number; cleansing: number; conditioning: number; bubbly: number; creamy: number }>} */
const OIL_STATS = {
  "coconut oil": { hardness: 79, cleansing: 67, conditioning: 4, bubbly: 67, creamy: 11 },
  "palm oil": { hardness: 50, cleansing: 0, conditioning: 19, bubbly: 1, creamy: 35 },
  "olive oil": { hardness: 18, cleansing: 0, conditioning: 82, bubbly: 0, creamy: 19 },
  "castor oil": { hardness: 12, cleansing: 0, conditioning: 90, bubbly: 69, creamy: 15 },
  "shea butter": { hardness: 45, cleansing: 0, conditioning: 54, bubbly: 0, creamy: 20 },
  "sweet almond": { hardness: 19, cleansing: 0, conditioning: 77, bubbly: 0, creamy: 23 },
  "sunflower oil": { hardness: 19, cleansing: 0, conditioning: 77, bubbly: 0, creamy: 7 },
  "avocado oil": { hardness: 23, cleansing: 0, conditioning: 72, bubbly: 0, creamy: 25 },
  "cocoa butter": { hardness: 54, cleansing: 0, conditioning: 6, bubbly: 0, creamy: 32 },
  "palm kernel": { hardness: 79, cleansing: 67, conditioning: 4, bubbly: 67, creamy: 11 },
  lard: { hardness: 44, cleansing: 0, conditioning: 18, bubbly: 0, creamy: 25 },
  tallow: { hardness: 45, cleansing: 0, conditioning: 0, bubbly: 0, creamy: 24 },
  "hemp seed": { hardness: 19, cleansing: 0, conditioning: 77, bubbly: 0, creamy: 7 },
  "jojoba oil": { hardness: 5, cleansing: 0, conditioning: 90, bubbly: 0, creamy: 50 },
  "mango butter": { hardness: 45, cleansing: 0, conditioning: 54, bubbly: 0, creamy: 20 },
  "rice bran oil": { hardness: 25, cleansing: 0, conditioning: 69, bubbly: 0, creamy: 23 },
  "argan oil": { hardness: 19, cleansing: 0, conditioning: 80, bubbly: 0, creamy: 7 },
  "babassu oil": { hardness: 85, cleansing: 67, conditioning: 4, bubbly: 67, creamy: 11 },
  "grapeseed oil": { hardness: 15, cleansing: 0, conditioning: 77, bubbly: 0, creamy: 8 },
  "apricot kernel": { hardness: 19, cleansing: 0, conditioning: 77, bubbly: 0, creamy: 23 },
};

const KEYS = Object.keys(OIL_STATS);

function matchOilStats(ingredientName) {
  const n = (ingredientName || "").toLowerCase();
  for (const key of KEYS) {
    if (n.includes(key)) return OIL_STATS[key];
  }
  return null;
}

/** Rough g from amount + unit (oils only; best-effort). */
function amountToGrams(amount, unit) {
  const a = Number(amount) || 0;
  const u = (unit || "g").toLowerCase();
  if (u === "g") return a;
  if (u === "kg") return a * 1000;
  if (u === "oz") return a * 28.3495;
  if (u === "lb") return a * 453.592;
  if (u === "ml") return a * 0.92;
  if (u === "tbsp" || u === "tsp") return null;
  if (u === "%") return null;
  return a;
}

const NON_OIL_PHASES = new Set(["lye", "fragrance", "colorant", "additive"]);

/**
 * @param {Array<{ ingredient_name?: string; amount?: number; unit?: string; phase?: string }>} ingredients
 * @returns {{ hardness: number; cleansing: number; conditioning: number; bubbly: number; creamy: number; matchedWeight: number; totalWeight: number } | null}
 */
export function computeSoapBarQualities(ingredients) {
  if (!ingredients?.length) return null;

  const hasOilsPhase = ingredients.some((i) => i.phase === "oils");
  const rows = ingredients.filter((i) => {
    if (hasOilsPhase) return i.phase === "oils";
    if (i.phase && NON_OIL_PHASES.has(i.phase)) return false;
    return true;
  });

  let oilPhaseGrams = 0;
  let matchedGrams = 0;
  const weighted = { hardness: 0, cleansing: 0, conditioning: 0, bubbly: 0, creamy: 0 };

  for (const ri of rows) {
    const g = amountToGrams(ri.amount, ri.unit);
    if (g == null || g <= 0) continue;
    oilPhaseGrams += g;
    const stats = matchOilStats(ri.ingredient_name);
    if (!stats) continue;
    matchedGrams += g;
    weighted.hardness += g * stats.hardness;
    weighted.cleansing += g * stats.cleansing;
    weighted.conditioning += g * stats.conditioning;
    weighted.bubbly += g * stats.bubbly;
    weighted.creamy += g * stats.creamy;
  }

  if (matchedGrams <= 0) return null;

  const avg = (sum) => Math.round(sum / matchedGrams);
  return {
    hardness: avg(weighted.hardness),
    cleansing: avg(weighted.cleansing),
    conditioning: avg(weighted.conditioning),
    bubbly: avg(weighted.bubbly),
    creamy: avg(weighted.creamy),
    matchedWeight: matchedGrams,
    totalOilWeight: oilPhaseGrams,
  };
}
