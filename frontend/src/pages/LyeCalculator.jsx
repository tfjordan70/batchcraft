import { useState, useMemo } from "react";
import { useIngredients } from "../hooks/useApi";

// Built-in SAP values for common oils (fallback when not in DB)
const DEFAULT_OILS = [
  { name: "Coconut Oil (76°)",     sap_naoh: 0.190, sap_koh: 0.267, category: "oil" },
  { name: "Palm Oil",              sap_naoh: 0.141, sap_koh: 0.198, category: "oil" },
  { name: "Olive Oil",             sap_naoh: 0.134, sap_koh: 0.188, category: "oil" },
  { name: "Castor Oil",            sap_naoh: 0.128, sap_koh: 0.180, category: "oil" },
  { name: "Shea Butter",           sap_naoh: 0.128, sap_koh: 0.180, category: "butter" },
  { name: "Sweet Almond Oil",      sap_naoh: 0.136, sap_koh: 0.191, category: "oil" },
  { name: "Sunflower Oil",         sap_naoh: 0.134, sap_koh: 0.188, category: "oil" },
  { name: "Avocado Oil",           sap_naoh: 0.133, sap_koh: 0.187, category: "oil" },
  { name: "Cocoa Butter",          sap_naoh: 0.137, sap_koh: 0.192, category: "butter" },
  { name: "Palm Kernel Oil",       sap_naoh: 0.183, sap_koh: 0.257, category: "oil" },
  { name: "Lard",                  sap_naoh: 0.138, sap_koh: 0.194, category: "oil" },
  { name: "Tallow (Beef)",         sap_naoh: 0.140, sap_koh: 0.196, category: "oil" },
  { name: "Hemp Seed Oil",         sap_naoh: 0.135, sap_koh: 0.190, category: "oil" },
  { name: "Jojoba Oil",            sap_naoh: 0.069, sap_koh: 0.097, category: "oil" },
  { name: "Mango Butter",          sap_naoh: 0.128, sap_koh: 0.180, category: "butter" },
  { name: "Rice Bran Oil",         sap_naoh: 0.128, sap_koh: 0.180, category: "oil" },
  { name: "Argan Oil",             sap_naoh: 0.136, sap_koh: 0.191, category: "oil" },
  { name: "Babassu Oil",           sap_naoh: 0.175, sap_koh: 0.245, category: "oil" },
];

const SOAP_QUALITY_RANGES = {
  hardness:    { min: 29, max: 54, label: "Hardness",     desc: "How hard the bar is" },
  cleansing:   { min: 12, max: 22, label: "Cleansing",    desc: "Removes oils/dirt" },
  conditioning:{ min: 44, max: 69, label: "Conditioning", desc: "Skin feel" },
  bubbly:      { min: 14, max: 46, label: "Bubbly",       desc: "Big fluffy bubbles" },
  creamy:      { min: 16, max: 48, label: "Creamy",       desc: "Stable lather" },
};

export default function LyeCalculator() {
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
    { oilName: "Coconut Oil (76°)", amount: 300 },
    { oilName: "Olive Oil",         amount: 400 },
    { oilName: "Shea Butter",        amount: 150 },
    { oilName: "Castor Oil",         amount: 50 },
  ]);
  const [lyeType, setLyeType] = useState("naoh");  // naoh | koh
  const [kohPurity, setKohPurity] = useState(90);   // % purity for KOH
  const [superFat, setSuperFat] = useState(5);
  const [waterPct, setWaterPct] = useState(38);     // % of oils
  const [search, setSearch] = useState("");

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

    const waterAmount = totalOil * (waterPct / 100);
    const lyeConc = (lyeAdjusted / (lyeAdjusted + waterAmount)) * 100;
    const totalBatch = totalOil + lyeAdjusted + waterAmount;

    // Rough soap quality from fatty acid composition (simplified)
    const hardnessPct = (oils.reduce((s, o) => {
      const oil = oilLibrary.find(l => l.name === o.oilName);
      if (!oil) return s;
      const isHard = ["Coconut Oil", "Palm Oil", "Palm Kernel", "Cocoa Butter", "Shea", "Mango", "Tallow", "Lard", "Babassu"].some(n => oil.name.includes(n));
      return s + (isHard ? Number(o.amount) : 0);
    }, 0) / totalOil) * 100;

    return {
      lyeNeeded: lyeAdjusted,
      waterAmount,
      lyeConc,
      totalBatch,
      hardnessPct: Math.round(hardnessPct),
      warnings: [
        lyeConc > 40 && "⚠️ High lye concentration — water discount may cause issues for beginners",
        lyeConc < 25 && "ℹ️ Very low concentration — bars may take longer to unmold",
        hardnessPct > 60 && "⚠️ High saturated fats — bar may be too hard or brittle",
        hardnessPct < 20 && "ℹ️ Low saturated fats — bar may be soft, extend cure time",
      ].filter(Boolean),
    };
  }, [oils, lyeType, kohPurity, superFat, waterPct, totalOil, oilLibrary]);

  const filteredLibrary = oilLibrary.filter(o =>
    !search || o.name.toLowerCase().includes(search.toLowerCase())
  );

  const currentOilNames = new Set(oils.map(o => o.oilName));

  return (
    <div style={{ padding: "32px 40px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontFamily: "'Playfair Display'" }}>Lye Calculator</h1>
        <p style={{ color: "#8B6914", fontSize: 14, marginTop: 4 }}>Calculate NaOH or KOH for cold process & hot process soap</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>

        {/* Left: Oil Phase */}
        <div>
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={S.sectionTitle}>Oil Phase</h3>
              <span style={{ fontSize: 13, color: "#8B6914" }}>Total: <strong style={{ fontFamily: "'JetBrains Mono'" }}>{totalOil.toFixed(1)}g</strong></span>
            </div>

            {/* Oil rows */}
            {oils.map((o, idx) => {
              const oil = oilLibrary.find(l => l.name === o.oilName);
              const pct = totalOil ? ((Number(o.amount) / totalOil) * 100).toFixed(1) : 0;
              const lyeContrib = oil ? (lyeType === "naoh" ? oil.sap_naoh : oil.sap_koh) * Number(o.amount) * (1 - superFat / 100) : 0;
              return (
                <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, padding: "10px 12px", background: "#FDFBF7", borderRadius: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{o.oilName}</div>
                    {oil && <div style={{ fontSize: 11, color: "#8B6914", marginTop: 1 }}>SAP {lyeType === "naoh" ? oil.sap_naoh.toFixed(4) : oil.sap_koh.toFixed(4)} · lye contrib: {lyeContrib.toFixed(2)}g</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "#8B6914", width: 36, textAlign: "right" }}>{pct}%</span>
                    <input type="number" value={o.amount} min="0" step="10"
                      onChange={e => updateAmount(idx, e.target.value)}
                      style={{ width: 80, background: "#FAF6ED", border: "1px solid #E8D5B4", borderRadius: 7, padding: "6px 8px", fontSize: 14, fontFamily: "'JetBrains Mono'", textAlign: "right", outline: "none" }} />
                    <span style={{ fontSize: 12, color: "#8B6914" }}>g</span>
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
                <div style={{ background: "white", border: "1px solid #E8D5B4", borderRadius: 10, maxHeight: 200, overflowY: "auto" }}>
                  {filteredLibrary.filter(o => !currentOilNames.has(o.name)).slice(0, 8).map(o => (
                    <div key={o.name} onClick={() => addOil(o.name)}
                      style={{ padding: "9px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #F3EAD6", fontSize: 14 }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F3EAD6"}
                      onMouseLeave={e => e.currentTarget.style.background = "white"}>
                      <span>{o.name} {o.fromDB && <span style={{ fontSize: 10, color: "#6D9B58" }}>● DB</span>}</span>
                      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, color: "#8B6914" }}>{lyeType === "naoh" ? o.sap_naoh.toFixed(4) : o.sap_koh.toFixed(4)}</span>
                    </div>
                  ))}
                  {filteredLibrary.filter(o => !currentOilNames.has(o.name)).length === 0 && (
                    <div style={{ padding: "12px 14px", fontSize: 13, color: "#8B6914" }}>No oils found</div>
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
                  <button key={v} onClick={() => setLyeType(v)} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: "2px solid", cursor: "pointer", textAlign: "center", borderColor: lyeType === v ? "#4A7FA8" : "#E8D5B4", background: lyeType === v ? "#4A7FA822" : "transparent", color: lyeType === v ? "#306080" : "#6B5010", fontFamily: "inherit" }}>
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
              <input type="range" min="0" max="20" step="1" value={superFat} onChange={e => setSuperFat(Number(e.target.value))} style={{ width: "100%", accentColor: "#6B5010" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8B6914", marginTop: 2 }}>
                <span>0% (max clean)</span><span>20% (max moisture)</span>
              </div>
            </div>

            {/* Water */}
            <div>
              <label style={S.label}>
                Water % of oils: <strong style={{ fontFamily: "'JetBrains Mono'" }}>{waterPct}%</strong>
              </label>
              <input type="range" min="25" max="50" step="1" value={waterPct} onChange={e => setWaterPct(Number(e.target.value))} style={{ width: "100%", accentColor: "#6B5010" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8B6914", marginTop: 2 }}>
                <span>25% (water discount)</span><span>50% (full water)</span>
              </div>
            </div>
          </div>

          {/* Results */}
          {results ? (
            <div style={{ background: "#2E2208", borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontSize: 18, fontFamily: "'Playfair Display'", color: "#FAF6ED", marginBottom: 20 }}>Results</h3>

              {[
                { label: lyeType === "naoh" ? "NaOH (Lye)" : `KOH (${kohPurity}% pure)`, value: `${results.lyeNeeded.toFixed(2)} g`, accent: "#6B9DC2" },
                { label: "Distilled Water", value: `${results.waterAmount.toFixed(2)} g`, accent: "#6B9DC2" },
                { label: "Lye Concentration", value: `${results.lyeConc.toFixed(1)}%`, accent: results.lyeConc > 40 ? "#C97B5A" : results.lyeConc < 28 ? "#6B9DC2" : "#8FAF7E" },
                { label: "Total Oil Weight", value: `${totalOil.toFixed(1)} g`, accent: "#8B6914" },
                { label: "Total Batch Weight", value: `${results.totalBatch.toFixed(1)} g`, accent: "#FAF6ED" },
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

              {/* Soap quality estimate */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(250,246,237,0.15)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(250,246,237,0.4)", textTransform: "uppercase", marginBottom: 10 }}>Estimated Bar Quality</div>
                <QualityBar label="Hardness" value={results.hardnessPct} min={29} max={54} />
              </div>
            </div>
          ) : (
            <div style={{ background: "#F3EAD6", borderRadius: 16, padding: 24, textAlign: "center", color: "#8B6914", fontSize: 14 }}>
              Add oils above to see lye calculations
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
  card: { background: "rgba(255,255,255,0.85)", borderRadius: 16, border: "1px solid #E8D5B4", padding: 24 },
  sectionTitle: { fontSize: 18, fontFamily: "'Playfair Display'", marginBottom: 16 },
  label: { display: "block", fontSize: 13, fontWeight: 500, color: "#6B5010", marginBottom: 6 },
  input: { width: "100%", background: "#FDFBF7", border: "1px solid #E8D5B4", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#2E2208", outline: "none", fontFamily: "inherit" },
};
