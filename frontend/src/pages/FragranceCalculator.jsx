import { useState, useMemo } from "react";
import { useIngredients } from "../hooks/useApi";

// IFRA 49th Amendment category limits (simplified)
// Category 4 = leave-on (lotion), 5 = diluted (body wash), 9 = rinse-off (soap), 11 = candle
const PRODUCT_TYPES = [
  {
    id: "cold_process_soap",
    label: "Cold Process Soap",
    icon: "🧼",
    category: "rinse_off",
    typical_pct: 3.0,
    max_pct: 6.0,
    notes: "IFRA Category 9. Most fragrance houses recommend 3% for CP soap. Some FOs accelerate trace.",
    tips: ["Test at 1 oz PPO (per pound of oils)", "Some FOs discolor soap — check supplier notes", "Strong FOs like mint or cinnamon may need lower usage"],
  },
  {
    id: "lotion_cream",
    label: "Lotion / Cream",
    icon: "🧴",
    category: "leave_on",
    typical_pct: 1.0,
    max_pct: 2.0,
    notes: "IFRA Category 4 (leave-on skin products). Lower usage than rinse-off.",
    tips: ["Add at cool-down phase below 40°C to preserve scent", "Citrus EOs fade quickly — consider fixatives", "Sensitizing EOs (clove, cinnamon) keep under 0.5%"],
  },
  {
    id: "lip_balm",
    label: "Lip Balm",
    icon: "💄",
    category: "lip",
    typical_pct: 0.5,
    max_pct: 1.0,
    notes: "Ingestion risk — IFRA Category 1. Very restricted. Use lip-safe fragrance oils only.",
    tips: ["Only use IFRA Category 1 approved fragrances", "Many EOs are NOT lip safe (peppermint needs dilution)", "Test with 0.1–0.25% first"],
  },
  {
    id: "body_scrub",
    label: "Body Scrub",
    icon: "🌿",
    category: "rinse_off",
    typical_pct: 2.0,
    max_pct: 4.0,
    notes: "IFRA Category 9 (rinse-off). Similar to soap but product sits on skin briefly.",
    tips: ["Consider FO skin safety at higher concentrations", "Exfoliants can affect scent throw"],
  },
  {
    id: "candle",
    label: "Candle",
    icon: "🕯️",
    category: "air",
    typical_pct: 10.0,
    max_pct: 12.0,
    notes: "No IFRA skin limit but wax type affects max FO load. Soy: 6–10%, Paraffin: 10–12%, Coconut: up to 12%.",
    tips: ["Never exceed wax manufacturer's max FO load", "Always do burn testing", "Hot throw vs cold throw — test both"],
  },
  {
    id: "room_spray",
    label: "Room / Linen Spray",
    icon: "💨",
    category: "air",
    typical_pct: 5.0,
    max_pct: 20.0,
    notes: "IFRA Category 11 (air freshener). Diluted in alcohol (isopropyl or perfumer's alcohol).",
    tips: ["Typical: 10–20% FO in perfumer's alcohol", "Add a solubilizer if using water", "Test sprayer nozzle compatibility"],
  },
  {
    id: "shampoo_bar",
    label: "Shampoo Bar",
    icon: "🧖",
    category: "rinse_off",
    typical_pct: 2.0,
    max_pct: 3.0,
    notes: "IFRA Category 6 (hair products, rinse-off). Similar restrictions to rinse-off skin.",
    tips: ["Scalp is more sensitive than skin", "Avoid strong sensitizers", "Citrus notes work well in shampoos"],
  },
];

const SENSITIZERS = [
  { name: "Cinnamon (Bark EO)", limit: 0.1, warning: "high" },
  { name: "Clove Bud EO", limit: 0.5, warning: "high" },
  { name: "Lemongrass EO", limit: 0.7, warning: "medium" },
  { name: "Ylang Ylang EO", limit: 1.5, warning: "medium" },
  { name: "Jasmine Absolute", limit: 2.0, warning: "medium" },
  { name: "Tea Tree EO", limit: 1.0, warning: "medium" },
  { name: "Peppermint EO (lip)", limit: 0.5, warning: "high", lipOnly: true },
];

export default function FragranceCalculator() {
  const { data: dbIngredients = [] } = useIngredients();
  const fragranceIngredients = dbIngredients.filter(i => i.category === "fragrance");

  const [productType, setProductType] = useState(PRODUCT_TYPES[0]);
  const [batchWeight, setBatchWeight] = useState(1000);
  const [targetPct, setTargetPct] = useState(productType.typical_pct);
  const [selectedFO, setSelectedFO] = useState("");
  const [foEntries, setFoEntries] = useState([]);

  const handleProductChange = (pt) => {
    setProductType(pt);
    setTargetPct(pt.typical_pct);
  };

  const fragranceAmount = useMemo(() => {
    return (batchWeight * targetPct) / 100;
  }, [batchWeight, targetPct]);

  const ouncesPerPound = useMemo(() => {
    const oilWeight = batchWeight * 0.7; // rough oils as 70% of batch
    return (fragranceAmount / oilWeight) * 16;
  }, [fragranceAmount, batchWeight]);

  const isOverMax = targetPct > productType.max_pct;
  const isUnderTypical = targetPct < productType.typical_pct * 0.5;

  const addFO = () => {
    const ing = fragranceIngredients.find(i => i.id === selectedFO);
    if (!ing) return;
    setFoEntries(prev => [...prev, { id: ing.id, name: ing.name, pct: targetPct, cost_per_unit: ing.cost_per_unit }]);
    setSelectedFO("");
  };

  const updateFO = (idx, field, val) => setFoEntries(prev => prev.map((f, i) => i === idx ? { ...f, [field]: val } : f));
  const removeFO = (idx) => setFoEntries(prev => prev.filter((_, i) => i !== idx));

  const totalFOCost = foEntries.reduce((sum, fo) => {
    const amt = batchWeight * fo.pct / 100;
    return sum + (fo.cost_per_unit || 0) * amt;
  }, 0);

  return (
    <div style={{ padding: "32px 40px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontFamily: "'Playfair Display'" }}>Fragrance Calculator</h1>
        <p style={{ color: "#5C3D1A", fontSize: 14, marginTop: 4 }}>IFRA-aware fragrance load calculator for any product type</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, alignItems: "start" }}>

        {/* Left */}
        <div>
          {/* Product type selector */}
          <div style={S.card}>
            <h3 style={S.sectionTitle}>Product Type</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {PRODUCT_TYPES.map(pt => (
                <button key={pt.id} onClick={() => handleProductChange(pt)} style={{ padding: "10px 8px", borderRadius: 10, border: "2px solid", cursor: "pointer", textAlign: "center", fontFamily: "inherit", transition: "all 0.15s", borderColor: productType.id === pt.id ? "#C2410C" : "#E8C48A", background: productType.id === pt.id ? "#C2410C" : "transparent", color: productType.id === pt.id ? "#FFFFFF" : "#3D2914" }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{pt.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{pt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Usage guidance */}
          <div style={{ ...S.card, marginTop: 16, background: "#1A1410", color: "#FFFCF7" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 28 }}>{productType.icon}</span>
              <div>
                <h3 style={{ fontSize: 17, fontFamily: "'Playfair Display'", color: "#FFFCF7" }}>{productType.label}</h3>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(250,246,237,0.12)", color: "rgba(250,246,237,0.7)" }}>{productType.category.replace("_", " ").toUpperCase()}</span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "rgba(250,246,237,0.7)", lineHeight: 1.6, marginBottom: 14 }}>{productType.notes}</p>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(250,246,237,0.4)", textTransform: "uppercase", marginBottom: 8 }}>Pro Tips</div>
              {productType.tips.map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13, color: "rgba(250,246,237,0.65)" }}>
                  <span style={{ color: "#8FAF7E", flexShrink: 0 }}>›</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fragrance blend builder */}
          {fragranceIngredients.length > 0 && (
            <div style={{ ...S.card, marginTop: 16 }}>
              <h3 style={S.sectionTitle}>Fragrance Blend Builder</h3>
              <p style={{ fontSize: 13, color: "#5C3D1A", marginBottom: 16 }}>Track multiple FOs in your blend with individual usage rates.</p>

              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <select value={selectedFO} onChange={e => setSelectedFO(e.target.value)} style={{ ...S.input, flex: 1 }}>
                  <option value="">— Select a fragrance from your inventory —</option>
                  {fragranceIngredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <button onClick={addFO} disabled={!selectedFO} style={{ padding: "8px 16px", background: "#EA580C", color: "#FFFFFF", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, opacity: selectedFO ? 1 : 0.5, boxShadow: "0 2px 10px rgba(234, 88, 12, 0.4)" }}>Add</button>
              </div>

              {foEntries.map((fo, idx) => {
                const amt = batchWeight * fo.pct / 100;
                const cost = fo.cost_per_unit ? fo.cost_per_unit * amt : null;
                return (
                  <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", background: "#FFFFFF", borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{fo.name}</div>
                      {cost && <div style={{ fontSize: 11, color: "#6D9B58" }}>${cost.toFixed(2)} for this batch</div>}
                    </div>
                    <input type="number" value={fo.pct} step="0.1" min="0" max={productType.max_pct}
                      onChange={e => updateFO(idx, "pct", Number(e.target.value))}
                      style={{ width: 64, background: "#FFFCF7", border: "1px solid #E8C48A", borderRadius: 7, padding: "6px 8px", fontSize: 14, fontFamily: "'JetBrains Mono'", textAlign: "right", outline: "none" }} />
                    <span style={{ fontSize: 12, color: "#5C3D1A" }}>%</span>
                    <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono'", color: "#3D2914", width: 60 }}>{amt.toFixed(2)}g</span>
                    <button onClick={() => removeFO(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#B5603C", fontSize: 18, lineHeight: 1 }}>×</button>
                  </div>
                );
              })}

              {foEntries.length > 0 && (
                <div style={{ padding: "12px 14px", background: "#FFF0DC", borderRadius: 10, fontSize: 13, color: "#3D2914", marginTop: 8 }}>
                  Total FO cost: <strong>${totalFOCost.toFixed(2)}</strong> · Combined %: <strong>{foEntries.reduce((s, f) => s + f.pct, 0).toFixed(1)}%</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Calculator */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={S.card}>
            <h3 style={S.sectionTitle}>Batch Settings</h3>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Batch weight (g)</label>
              <input type="number" value={batchWeight} onChange={e => setBatchWeight(Number(e.target.value))} step="100" min="1"
                style={{ ...S.input, fontSize: 20, padding: "10px 14px", fontFamily: "'JetBrains Mono'" }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>
                Fragrance load: <strong style={{ fontFamily: "'JetBrains Mono'", color: isOverMax ? "#B5603C" : "#3D2914" }}>{targetPct}%</strong>
                <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 6, color: "#5C3D1A" }}>(typical: {productType.typical_pct}%)</span>
              </label>
              <input type="range" min="0" max={productType.max_pct * 1.5} step="0.1" value={targetPct}
                onChange={e => setTargetPct(Number(e.target.value))}
                style={{ width: "100%", accentColor: isOverMax ? "#B5603C" : "#C2410C" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5C3D1A", marginTop: 2 }}>
                <span>0%</span>
                <span style={{ color: "#4E7A3C" }}>Typical {productType.typical_pct}%</span>
                <span style={{ color: "#B5603C" }}>Max {productType.max_pct}%</span>
              </div>
            </div>
          </div>

          {/* Results */}
          <div style={{ background: "#1A1410", borderRadius: 16, padding: 24 }}>
            <h3 style={{ fontSize: 18, fontFamily: "'Playfair Display'", color: "#FFFCF7", marginBottom: 20 }}>Results</h3>

            {[
              { label: "Fragrance amount", value: `${fragranceAmount.toFixed(2)} g`, accent: isOverMax ? "#C97B5A" : "#8FAF7E" },
              { label: "In ounces", value: `${(fragranceAmount / 28.35).toFixed(2)} oz`, accent: "rgba(250,246,237,0.7)" },
              { label: "oz per pound of oils (PPO)", value: `${ouncesPerPound.toFixed(2)} oz/lb`, accent: "#6B9DC2" },
              { label: "Remaining batch weight", value: `${(batchWeight - fragranceAmount).toFixed(1)} g`, accent: "rgba(250,246,237,0.5)" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid rgba(250,246,237,0.1)" }}>
                <span style={{ fontSize: 13, color: "rgba(250,246,237,0.6)" }}>{row.label}</span>
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 16, fontWeight: 700, color: row.accent }}>{row.value}</span>
              </div>
            ))}

            {/* Warnings */}
            {isOverMax && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(201,123,90,0.2)", borderRadius: 10, fontSize: 12, color: "#C97B5A" }}>
                ⚠️ {targetPct}% exceeds the recommended maximum of {productType.max_pct}% for {productType.label}. This may cause skin sensitization or product issues.
              </div>
            )}
            {isUnderTypical && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(107,157,194,0.2)", borderRadius: 10, fontSize: 12, color: "#6B9DC2" }}>
                ℹ️ Very low fragrance load. Scent may be faint or undetectable in finished product.
              </div>
            )}
          </div>

          {/* Sensitizer reference */}
          <div style={S.card}>
            <h3 style={{ fontSize: 15, fontFamily: "'Playfair Display'", marginBottom: 12 }}>⚠️ Common Sensitizers</h3>
            <p style={{ fontSize: 12, color: "#5C3D1A", marginBottom: 12 }}>These ingredients have IFRA limits. Stay within limits to avoid skin reactions.</p>
            {SENSITIZERS.filter(s => !s.lipOnly || productType.id === "lip_balm").map(s => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #FFF0DC", fontSize: 12 }}>
                <span>{s.name}</span>
                <span style={{ fontFamily: "'JetBrains Mono'", color: s.warning === "high" ? "#B5603C" : "#C97B5A", fontWeight: 600 }}>
                  max {s.limit}%
                </span>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "#5C3D1A", marginTop: 10, opacity: 0.7 }}>Always verify limits with your FO supplier's IFRA certificate.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  card: { background: "#FFFFFF", borderRadius: 16, border: "1px solid #E8C48A", padding: 24 },
  sectionTitle: { fontSize: 18, fontFamily: "'Playfair Display'", marginBottom: 16 },
  label: { display: "block", fontSize: 13, fontWeight: 500, color: "#C2410C", marginBottom: 6 },
  input: { width: "100%", background: "#FFFFFF", border: "1px solid #E8C48A", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#1A1410", outline: "none", fontFamily: "inherit" },
};
