import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useIngredients, useCreateRecipe } from "../hooks/useApi";
import { useAuthStore } from "../store/authStore";
import { computeSoapBarQualities, SOAP_QUALITY_RANGES } from "../utils/soapQualities";
import toast from "react-hot-toast";

// Built-in SAP values when an oil is not in the DB — aligned with SoapCalc oil chart
// (same numbers as https://github.com/mikewolfd/soap-calc data/oils.json).
// Names must match `backend/data/soapcalc_oils.json` / `flask import-soapcalc-oils` so DB rows merge (green ● DB).
const DEFAULT_OILS = [
  { name: "Coconut Oil, 76 deg",   sap_naoh: 0.183, sap_koh: 0.257, category: "oil" },
  { name: "Palm Oil",              sap_naoh: 0.142, sap_koh: 0.199, category: "oil" },
  { name: "Olive Oil",             sap_naoh: 0.135, sap_koh: 0.19, category: "oil" },
  { name: "Castor Oil",            sap_naoh: 0.128, sap_koh: 0.18, category: "oil" },
  { name: "Shea Butter",           sap_naoh: 0.128, sap_koh: 0.179, category: "butter" },
  { name: "Sweet Almond Oil",      sap_naoh: 0.139, sap_koh: 0.195, category: "oil" },
  { name: "Sunflower Oil",         sap_naoh: 0.135, sap_koh: 0.189, category: "oil" },
  { name: "Avocado Oil",           sap_naoh: 0.133, sap_koh: 0.186, category: "oil" },
  { name: "Cocoa Butter",          sap_naoh: 0.138, sap_koh: 0.194, category: "butter" },
  { name: "Palm Kernel Oil",       sap_naoh: 0.176, sap_koh: 0.247, category: "oil" },
  { name: "Lard, Pig Tallow (Manteca)", sap_naoh: 0.141, sap_koh: 0.198, category: "oil" },
  { name: "Tallow Beef",           sap_naoh: 0.143, sap_koh: 0.2, category: "oil" },
  { name: "Hemp Seed Oil",         sap_naoh: 0.138, sap_koh: 0.193, category: "oil" },
  { name: "Jojoba Oil",            sap_naoh: 0.066, sap_koh: 0.092, category: "oil" },
  { name: "Mango Butter",          sap_naoh: 0.136, sap_koh: 0.191, category: "butter" },
  { name: "Rice Bran Oil",         sap_naoh: 0.133, sap_koh: 0.187, category: "oil" },
  { name: "Argan Oil",             sap_naoh: 0.136, sap_koh: 0.191, category: "oil" },
  { name: "Babassu Oil",           sap_naoh: 0.175, sap_koh: 0.245, category: "oil" },
];

export default function LyeCalculator() {
  const navigate = useNavigate();
  const createRecipe = useCreateRecipe();
  const tenantId = useAuthStore((s) => s.tenant?.id);
  const { data: dbIngredients = [] } = useIngredients();

  // Merge DB ingredients that have SAP values with defaults
  const oilLibrary = useMemo(() => {
    const dbOils = dbIngredients
      .filter(i => i.sap_value_naoh != null)
      .map(i => ({ id: i.id, name: i.name, sap_naoh: Number(i.sap_value_naoh), sap_koh: Number(i.sap_value_koh || i.sap_value_naoh * 1.403), category: i.category, fromDB: true }));
    const defaultNames = new Set(dbOils.map(o => o.name.toLowerCase()));
    const defaults = DEFAULT_OILS.filter(o => !defaultNames.has(o.name.toLowerCase()));
    return [...dbOils, ...defaults].sort((a, b) => a.name.localeCompare(b.name));
  }, [dbIngredients]);

  const [oils, setOils] = useState([
    { oilName: "Coconut Oil, 76 deg", amount: 300 },
    { oilName: "Olive Oil", amount: 400 },
    { oilName: "Shea Butter", amount: 150 },
    { oilName: "Castor Oil", amount: 50 },
  ]);
  const [lyeType, setLyeType] = useState("naoh");  // naoh | koh
  const [kohPurity, setKohPurity] = useState(90);   // % purity for KOH
  const [superFat, setSuperFat] = useState(5);
  /** 'pct' = water as % of total oil weight (SoapCalc water slider). 'ratio' = water = (ratio)×lye by mass, e.g. 1.75:1. */
  const [waterMode, setWaterMode] = useState("pct");
  const [waterPct, setWaterPct] = useState(38);     // % of oils (when waterMode === 'pct')
  const [waterLyeRatio, setWaterLyeRatio] = useState(1.75); // water mass per 1g lye (when waterMode === 'ratio')
  const [search, setSearch] = useState("");
  const [saveName, setSaveName] = useState("");

  const addOil = (name) => { setOils(prev => [...prev, { oilName: name, amount: 100 }]); setSearch(""); };
  const removeOil = (idx) => setOils(prev => prev.filter((_, i) => i !== idx));
  const updateAmount = (idx, val) => setOils(prev => prev.map((o, i) => i === idx ? { ...o, amount: Number(val) } : o));

  const totalOil = oils.reduce((s, o) => s + (Number(o.amount) || 0), 0);

  const results = useMemo(() => {
    if (totalOil === 0) return null;

    let rawLye = oils.reduce((sum, o) => {
      const oil = oilLibrary.find(lib => lib.name === o.oilName);
      if (!oil) return sum;
      const sap = lyeType === "naoh" ? oil.sap_naoh : oil.sap_koh;
      return sum + sap * Number(o.amount);
    }, 0);

    // Apply superfat discount
    const lyeNeeded = rawLye * (1 - superFat / 100);
    // Adjust for KOH purity
    const lyeAdjusted = lyeType === "koh" ? lyeNeeded / (kohPurity / 100) : lyeNeeded;

    const waterAmount =
      waterMode === "ratio"
        ? waterLyeRatio * lyeAdjusted
        : totalOil * (waterPct / 100);
    const equivWaterPct = totalOil > 0 ? (waterAmount / totalOil) * 100 : 0;
    const lyeConc = (lyeAdjusted / (lyeAdjusted + waterAmount)) * 100;
    const totalBatch = totalOil + lyeAdjusted + waterAmount;

    const qualityRows = oils.map((o) => ({
      ingredient_name: o.oilName,
      amount: o.amount,
      unit: "g",
      phase: "oils",
    }));
    const qualities = computeSoapBarQualities(qualityRows);

    return {
      lyeNeeded: lyeAdjusted,
      waterAmount,
      equivWaterPct,
      lyeConc,
      totalBatch,
      qualities,
      warnings: [
        lyeConc > 40 && "⚠️ High lye concentration — water discount may cause issues for beginners",
        lyeConc < 25 && "ℹ️ Very low concentration — bars may take longer to unmold",
        qualities && qualities.hardness > 54 && "⚠️ High hardness estimate — bar may be brittle",
        qualities && qualities.hardness < 29 && "ℹ️ Low hardness estimate — bar may be soft, extend cure time",
      ].filter(Boolean),
    };
  }, [oils, lyeType, kohPurity, superFat, waterMode, waterPct, waterLyeRatio, totalOil, oilLibrary]);

  const filteredLibrary = oilLibrary.filter(o =>
    !search || o.name.toLowerCase().includes(search.toLowerCase())
  );

  const currentOilNames = new Set(oils.map(o => o.oilName));

  const oilsMissingIngredientId = useMemo(() => {
    return oils.filter((o) => {
      const lib = oilLibrary.find((l) => l.name === o.oilName);
      return !lib?.id;
    });
  }, [oils, oilLibrary]);

  const buildCalcNotes = (res) => {
    if (!res) return "";
    const lyeLabel = lyeType === "naoh" ? "NaOH" : `KOH (${kohPurity}% pure)`;
    const waterLine =
      waterMode === "ratio"
        ? `Water: ${waterLyeRatio.toFixed(2)} : 1 (water:lye by mass) → ${res.equivWaterPct.toFixed(1)}% of oil weight`
        : `Water: ${waterPct}% of total oil weight`;
    return [
      "[Soap calculator]",
      `Lye type: ${lyeLabel}`,
      `Superfat: ${superFat}%`,
      waterLine,
      `Total batch weight (oils + lye + water): ~${res.totalBatch.toFixed(1)} g`,
      "Oil, water, and lye are saved as separate recipe lines. Mix and handle lye per your lab SOP.",
    ].join("\n");
  };

  const handleSaveAsRecipe = async () => {
    if (!results || totalOil <= 0) {
      toast.error("Add oils and ensure totals are valid first.");
      return;
    }
    if (oilsMissingIngredientId.length > 0) {
      toast.error("Every oil must exist in Ingredients (with SAP). Add missing oils or import the SoapCalc library.");
      return;
    }
    const name =
      saveName.trim() ||
      `Soap — ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    const lyeLineName =
      lyeType === "naoh"
        ? "Sodium hydroxide (NaOH)"
        : `Potassium hydroxide (KOH, ${kohPurity}% pure)`;
    const ingredients = [
      ...oils.map((o, i) => {
        const lib = oilLibrary.find((l) => l.name === o.oilName);
        return {
          ingredient_id: lib.id,
          amount: Number(o.amount),
          unit: "g",
          phase: "oils",
          sort_order: i,
        };
      }),
      {
        line_name: "Distilled water (lye solution)",
        amount: results.waterAmount,
        unit: "g",
        phase: "water",
        sort_order: oils.length,
      },
      {
        line_name: lyeLineName,
        amount: results.lyeNeeded,
        unit: "g",
        phase: "lye",
        sort_order: oils.length + 1,
      },
    ];
    try {
      const recipe = await createRecipe.mutateAsync({
        name,
        category: "soap",
        description: `Soap formula from calculator — ${totalOil.toFixed(0)} g oils, ~${results.totalBatch.toFixed(0)} g total batch (incl. lye solution).`,
        yield_amount: Math.round(results.totalBatch * 100) / 100,
        yield_unit: "g",
        notes: buildCalcNotes(results),
        ingredients,
      });
      navigate(`/recipes/${recipe.id}`);
    } catch {
      /* toast from hook */
    }
  };

  return (
    <div style={{ padding: "32px 40px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontFamily: "'Playfair Display'" }}>Soap Calculator</h1>
        <p style={{ color: "#5C3D1A", fontSize: 14, marginTop: 4, maxWidth: 720, lineHeight: 1.5 }}>
          Work out NaOH or KOH, water, and bar-quality estimates like SoapCalc. The list can use built-in SAP values for
          oils not in your catalog. <strong>Save as recipe</strong> only works when every oil row matches an entry in{" "}
          <Link to="/ingredients" style={{ color: "#C2410C", fontWeight: 700 }}>
            Ingredients
          </Link>{" "}
          (so recipes tie to inventory and batches). Water and lye save as labeled lines; settings go in notes.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>

        {/* Left: Oil Phase */}
        <div>
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={S.sectionTitle}>Oil Phase</h3>
              <span style={{ fontSize: 13, color: "#5C3D1A" }}>Total: <strong style={{ fontFamily: "'JetBrains Mono'" }}>{totalOil.toFixed(1)}g</strong></span>
            </div>

            {/* Oil rows */}
            {oils.map((o, idx) => {
              const oil = oilLibrary.find(l => l.name === o.oilName);
              const pct = totalOil ? ((Number(o.amount) / totalOil) * 100).toFixed(1) : 0;
              const lyeContrib = oil ? (lyeType === "naoh" ? oil.sap_naoh : oil.sap_koh) * Number(o.amount) * (1 - superFat / 100) : 0;
              return (
                <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, padding: "10px 12px", background: "#FFFFFF", borderRadius: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{o.oilName}</div>
                    {oil && (
                      <div style={{ fontSize: 11, color: "#5C3D1A", marginTop: 1 }}>
                        SAP {lyeType === "naoh" ? oil.sap_naoh.toFixed(4) : oil.sap_koh.toFixed(4)} · lye contrib:{" "}
                        {lyeContrib.toFixed(2)}g
                        {!oil.id && (
                          <span style={{ marginLeft: 8, color: "#B45309", fontWeight: 600 }}>
                            · not in Ingredients —{" "}
                            <Link to="/ingredients" style={{ color: "#B45309" }}>
                              add
                            </Link>{" "}
                            or import oils to save a recipe
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "#5C3D1A", width: 36, textAlign: "right" }}>{pct}%</span>
                    <input type="number" value={o.amount} min="0" step="10"
                      onChange={e => updateAmount(idx, e.target.value)}
                      style={{ width: 80, background: "#FFFCF7", border: "1px solid #E8C48A", borderRadius: 7, padding: "6px 8px", fontSize: 14, fontFamily: "'JetBrains Mono'", textAlign: "right", outline: "none" }} />
                    <span style={{ fontSize: 12, color: "#5C3D1A" }}>g</span>
                    <button onClick={() => removeOil(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#B5603C", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>
                  </div>
                </div>
              );
            })}

            {/* Add oil search */}
            <div style={{ marginTop: 12 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search oils to add…"
                style={{ ...S.input, marginBottom: search ? 8 : 0 }} />
              {search && (
                <div style={{ background: "white", border: "1px solid #E8C48A", borderRadius: 10, maxHeight: 200, overflowY: "auto" }}>
                  {filteredLibrary.filter(o => !currentOilNames.has(o.name)).slice(0, 8).map(o => (
                    <div key={o.name} onClick={() => addOil(o.name)}
                      style={{ padding: "9px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #FFF0DC", fontSize: 14 }}
                      onMouseEnter={e => e.currentTarget.style.background = "#FFF0DC"}
                      onMouseLeave={e => e.currentTarget.style.background = "white"}>
                      <span>{o.name} {o.fromDB && <span style={{ fontSize: 10, color: "#6D9B58" }}>● DB</span>}</span>
                      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, color: "#5C3D1A" }}>{lyeType === "naoh" ? o.sap_naoh.toFixed(4) : o.sap_koh.toFixed(4)}</span>
                    </div>
                  ))}
                  {filteredLibrary.filter(o => !currentOilNames.has(o.name)).length === 0 && (
                    <div style={{ padding: "12px 14px", fontSize: 13, color: "#5C3D1A" }}>No oils found</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Settings + Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Settings */}
          <div style={S.card}>
            <h3 style={S.sectionTitle}>Settings</h3>

            {/* Lye type toggle */}
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Lye Type</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["naoh", "NaOH", "Bar soap"], ["koh", "KOH", "Liquid soap"]].map(([v, label, sub]) => (
                  <button key={v} onClick={() => setLyeType(v)} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: "2px solid", cursor: "pointer", textAlign: "center", borderColor: lyeType === v ? "#0284C7" : "#E8C48A", background: lyeType === v ? "#E0F2FE" : "transparent", color: lyeType === v ? "#0369A1" : "#5C3D1A", fontFamily: "inherit", fontWeight: lyeType === v ? 700 : 600 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{label}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {lyeType === "koh" && (
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>KOH Purity: <strong style={{ fontFamily: "'JetBrains Mono'" }}>{kohPurity}%</strong></label>
                <input type="range" min="85" max="100" step="1" value={kohPurity} onChange={e => setKohPurity(Number(e.target.value))} style={{ width: "100%", accentColor: "#4A7FA8" }} />
              </div>
            )}

            {/* Superfat */}
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>
                Superfat: <strong style={{ fontFamily: "'JetBrains Mono'" }}>{superFat}%</strong>
                <span style={{ fontWeight: 400, marginLeft: 8, opacity: 0.7 }}>{superFat <= 3 ? "full cleanse" : superFat <= 6 ? "balanced" : superFat <= 10 ? "conditioning" : "very rich"}</span>
              </label>
              <input type="range" min="0" max="20" step="1" value={superFat} onChange={e => setSuperFat(Number(e.target.value))} style={{ width: "100%", accentColor: "#EA580C" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5C3D1A", marginTop: 2 }}>
                <span>0% (max clean)</span><span>20% (max moisture)</span>
              </div>
            </div>

            {/* Water: % of oils OR water:lye ratio (SoapCalc-style options) */}
            <div>
              <label style={S.label}>Water in lye solution</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {[
                  ["pct", "% of oil weight", "Like SoapCalc lye water % slider"],
                  ["ratio", "Water : lye", "Parts water per 1 part lye (mass), e.g. 1.75 : 1"],
                ].map(([v, label, sub]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      if (v === waterMode) return;
                      if (v === "ratio" && waterMode === "pct" && results?.lyeNeeded > 0.0001) {
                        setWaterLyeRatio(
                          Math.min(4, Math.max(0.4, results.waterAmount / results.lyeNeeded))
                        );
                      }
                      if (v === "pct" && waterMode === "ratio" && results && totalOil > 0) {
                        setWaterPct(
                          Math.min(50, Math.max(25, Math.round(results.equivWaterPct)))
                        );
                      }
                      setWaterMode(v);
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 8px",
                      borderRadius: 10,
                      border: "2px solid",
                      cursor: "pointer",
                      textAlign: "center",
                      borderColor: waterMode === v ? "#C2410C" : "#E8C48A",
                      background: waterMode === v ? "#FFF0DC" : "transparent",
                      color: "#5C3D1A",
                      fontFamily: "inherit",
                      fontWeight: waterMode === v ? 700 : 600,
                    }}
                  >
                    <div style={{ fontSize: 14 }}>{label}</div>
                    <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2, lineHeight: 1.2 }}>{sub}</div>
                  </button>
                ))}
              </div>

              {waterMode === "pct" && (
                <>
                  <label style={S.label}>
                    Water % of total oils: <strong style={{ fontFamily: "'JetBrains Mono'" }}>{waterPct}%</strong>
                  </label>
                  <input
                    type="range"
                    min="25"
                    max="50"
                    step="1"
                    value={waterPct}
                    onChange={(e) => setWaterPct(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#EA580C" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5C3D1A", marginTop: 2 }}>
                    <span>25% (water discount)</span>
                    <span>50% (full water)</span>
                  </div>
                </>
              )}

              {waterMode === "ratio" && (
                <>
                  <label style={S.label}>
                    Water : lye <span style={{ fontWeight: 500, color: "#5C3D1A" }}>(mass)</span>:{" "}
                    <strong style={{ fontFamily: "'JetBrains Mono'" }}>{waterLyeRatio.toFixed(2)} : 1</strong>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="4"
                    step="0.05"
                    value={waterLyeRatio}
                    onChange={(e) => setWaterLyeRatio(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#0EA5E9" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5C3D1A", marginTop: 2 }}>
                    <span>0.5 (stronger lye solution)</span>
                    <span>4 (more water)</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#7C2D12", marginTop: 8, lineHeight: 1.4 }}>
                    <strong>1.75 : 1</strong> is a common default (1.75 parts water per 1 part NaOH by weight). Adjust for your
                    formula and experience.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Results */}
          {results ? (
            <div style={{ background: "#1A1410", borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontSize: 18, fontFamily: "'Playfair Display'", color: "#FFFCF7", marginBottom: 20 }}>Results</h3>

              {[
                { label: lyeType === "naoh" ? "NaOH (Lye)" : `KOH (${kohPurity}% pure)`, value: `${results.lyeNeeded.toFixed(2)} g`, accent: "#6B9DC2" },
                { label: "Distilled Water", value: `${results.waterAmount.toFixed(2)} g`, accent: "#6B9DC2" },
                ...(results.lyeNeeded > 0.0001
                  ? [
                      {
                        label: "Water : lye (by mass, result)",
                        value: `${(results.waterAmount / results.lyeNeeded).toFixed(2)} : 1`,
                        accent: "#A5D4F0",
                      },
                    ]
                  : []),
                {
                  label: waterMode === "ratio" ? "Equiv. water % of total oils" : "Water % of total oils (input)",
                  value: `${results.equivWaterPct.toFixed(1)}%`,
                  accent: "#A5D4F0",
                },
                { label: "Lye Concentration", value: `${results.lyeConc.toFixed(1)}%`, accent: results.lyeConc > 40 ? "#C97B5A" : results.lyeConc < 28 ? "#6B9DC2" : "#8FAF7E" },
                { label: "Total Oil Weight", value: `${totalOil.toFixed(1)} g`, accent: "#5C3D1A" },
                { label: "Total Batch Weight", value: `${results.totalBatch.toFixed(1)} g`, accent: "#FFFCF7" },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(250,246,237,0.1)" }}>
                  <span style={{ fontSize: 13, color: "rgba(250,246,237,0.6)" }}>{row.label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 18, fontWeight: 700, color: row.accent }}>{row.value}</span>
                </div>
              ))}

              {/* Warnings */}
              {results.warnings.map((w, i) => (
                <div key={i} style={{ marginTop: 12, padding: "8px 12px", background: "rgba(250,246,237,0.08)", borderRadius: 8, fontSize: 12, color: "rgba(250,246,237,0.7)" }}>{w}</div>
              ))}

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(250,246,237,0.15)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(250,246,237,0.45)", textTransform: "uppercase", marginBottom: 10 }}>Save as recipe</div>
                <p style={{ fontSize: 12, color: "rgba(250,246,237,0.65)", margin: "0 0 10px", lineHeight: 1.45 }}>
                  Saves <strong style={{ color: "rgba(250,246,237,0.88)" }}>oils</strong>,{" "}
                  <strong style={{ color: "rgba(250,246,237,0.88)" }}>water</strong>, and{" "}
                  <strong style={{ color: "rgba(250,246,237,0.88)" }}>lye</strong> as recipe lines; calculator settings
                  go in notes.
                </p>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Recipe name (optional)"
                  style={{
                    width: "100%",
                    marginBottom: 10,
                    background: "rgba(26,20,16,0.5)",
                    border: "1px solid rgba(250,246,237,0.2)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 14,
                    color: "#FFFCF7",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                {oilsMissingIngredientId.length > 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#FDE68A",
                      marginBottom: 12,
                      lineHeight: 1.5,
                      padding: "12px 14px",
                      background: "rgba(0,0,0,0.35)",
                      borderRadius: 10,
                      border: "1px solid rgba(251,191,36,0.35)",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6, color: "#FBBF24" }}>Missing from your Ingredients list</div>
                    <p style={{ margin: "0 0 8px", color: "rgba(255,252,247,0.88)" }}>
                      These oils are only using built-in calculator data. To enable <strong>Save as recipe</strong>, each
                      name must exist under{" "}
                      <Link to="/ingredients" style={{ color: "#FDE68A", fontWeight: 700 }}>
                        Ingredients
                      </Link>{" "}
                      (add manually), or import the SoapCalc oil library once:
                    </p>
                    <p style={{ margin: "0 0 6px", fontSize: 11, color: "rgba(255,252,247,0.65)" }}>
                      Still missing: <strong>{oilsMissingIngredientId.map((o) => o.oilName).join(", ")}</strong>
                    </p>
                    <pre
                      style={{
                        margin: 0,
                        padding: "10px 12px",
                        fontSize: 11,
                        lineHeight: 1.4,
                        overflow: "auto",
                        background: "rgba(26,20,16,0.75)",
                        borderRadius: 8,
                        color: "#E0F2FE",
                        fontFamily: "'JetBrains Mono', monospace",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                      }}
                    >
                      {tenantId
                        ? `cd ~/craftbatch-app && docker compose exec backend flask import-soapcalc-oils --tenant-id=${tenantId}`
                        : `cd ~/craftbatch-app && docker compose exec backend flask import-soapcalc-oils --tenant-id=YOUR_TENANT_UUID`}
                    </pre>
                    <p style={{ margin: "8px 0 0", fontSize: 11, color: "rgba(255,252,247,0.55)" }}>
                      Then reload this page (or switch away and back) so the green “DB” badge appears on those oils.
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSaveAsRecipe}
                  disabled={createRecipe.isPending || oilsMissingIngredientId.length > 0}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: oilsMissingIngredientId.length > 0 ? "rgba(250,246,237,0.15)" : "#EA580C",
                    color: oilsMissingIngredientId.length > 0 ? "rgba(250,246,237,0.45)" : "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: oilsMissingIngredientId.length > 0 || createRecipe.isPending ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    boxShadow: oilsMissingIngredientId.length > 0 ? "none" : "0 4px 14px rgba(234, 88, 12, 0.35)",
                  }}
                >
                  {createRecipe.isPending ? "Saving…" : "Save as recipe"}
                </button>
              </div>

              {/* Soap quality estimate */}
              {results.qualities && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(250,246,237,0.15)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(250,246,237,0.4)", textTransform: "uppercase", marginBottom: 10 }}>Estimated Bar Quality</div>
                  {Object.entries(SOAP_QUALITY_RANGES).map(([key, meta]) => (
                    <QualityBar key={key} label={meta.label} value={results.qualities[key]} min={meta.min} max={meta.max} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: "#FFF0DC", borderRadius: 16, padding: 24, textAlign: "center", color: "#5C3D1A", fontSize: 14 }}>
              Add oils above to see lye, water, and bar-quality estimates
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QualityBar({ label, value, min, max }) {
  const inRange = value >= min && value <= max;
  const width = Math.min(100, value);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(250,246,237,0.6)", marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: inRange ? "#8FAF7E" : "#C97B5A" }}>{value}% {inRange ? "✓" : "!"}</span>
      </div>
      <div style={{ height: 6, background: "rgba(250,246,237,0.1)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${width}%`, height: "100%", background: inRange ? "#6D9B58" : "#C97B5A", borderRadius: 3, transition: "width 0.4s" }} />
      </div>
      <div style={{ fontSize: 10, color: "rgba(250,246,237,0.3)", marginTop: 2 }}>ideal: {min}–{max}%</div>
    </div>
  );
}

const S = {
  card: { background: "#FFFFFF", borderRadius: 16, border: "1px solid #E8C48A", padding: 24 },
  sectionTitle: { fontSize: 18, fontFamily: "'Playfair Display'", marginBottom: 16 },
  label: { display: "block", fontSize: 13, fontWeight: 500, color: "#C2410C", marginBottom: 6 },
  input: { width: "100%", background: "#FFFFFF", border: "1px solid #E8C48A", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#1A1410", outline: "none", fontFamily: "inherit" },
};
