import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useRecipes, useScaleRecipe, useIngredients } from "../hooks/useApi";
import { exportRecipe } from "../utils/exports";

const CATEGORIES = [
  { value: "soap", label: "Soap", icon: "🧼" },
  { value: "lotion", label: "Lotion", icon: "🧴" },
  { value: "lip_balm", label: "Lip Balm", icon: "💄" },
  { value: "candle", label: "Candle", icon: "🕯️" },
  { value: "other", label: "Other", icon: "✨" },
];

const CAT_STYLE = {
  soap:    { bg: "#38BDF833", text: "#0369A1" },
  lotion:  { bg: "#4ADE8040", text: "#15803D" },
  lip_balm:{ bg: "#FB923C44", text: "#C2410C" },
  candle:  { bg: "#F59E0B44", text: "#B45309" },
  other:   { bg: "#A78BFA44", text: "#6D28D9" },
};

export default function RecipesPage() {
  const navigate = useNavigate();
  const { data: recipes = [], isLoading } = useRecipes();
  const { data: ingredients = [] } = useIngredients({ stock: true });
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [scaleModal, setScaleModal] = useState(null);

  const filtered = useMemo(() => recipes.filter(r =>
    (catFilter === "all" || r.category === catFilter) &&
    (showArchived || !r.is_archived) &&
    (!search || r.name.toLowerCase().includes(search.toLowerCase()))
  ), [recipes, catFilter, showArchived, search]);

  const costPerUnit = (recipe) => {
    if (!recipe.ingredients?.length || !recipe.yield_count) return null;
    const total = (recipe.ingredients || []).reduce((sum, ri) => {
      const ing = ingredients.find(i => i.id === ri.ingredient_id);
      return sum + (ing?.cost_per_unit || ri.cost_per_unit || 0) * Number(ri.amount);
    }, 0);
    return total / recipe.yield_count;
  };

  if (isLoading) return <Shell><div style={S.loading}>Loading recipes…</div></Shell>;

  return (
    <Shell>
      <div style={S.header}>
        <div>
          <h1 style={S.pageTitle}>Recipes</h1>
          <p style={S.pageSub}>{recipes.filter(r => !r.is_archived).length} active formulas in your library</p>
        </div>
        <Btn onClick={() => navigate("/recipes/new")}>+ New Recipe</Btn>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipes…" style={{ ...S.input, width: 240 }} />
        <div style={{ display: "flex", gap: 6 }}>
          <Chip label="All" active={catFilter === "all"} onClick={() => setCatFilter("all")} />
          {CATEGORIES.map(c => (
            <Chip key={c.value} label={`${c.icon} ${c.label}`} active={catFilter === c.value} onClick={() => setCatFilter(c.value)} />
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#5C3D1A", cursor: "pointer", marginLeft: "auto" }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <EmptyState onAdd={() => navigate("/recipes/new")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {filtered.map(r => (
            <RecipeCard key={r.id} recipe={r} cpu={costPerUnit(r)}
              onEdit={() => navigate(`/recipes/${r.id}/edit`)}
              onScale={() => setScaleModal(r)}
              onExport={() => exportRecipe(r)}
              onBatch={() => navigate(`/batches/new?recipe=${r.id}`)}
            />
          ))}
        </div>
      )}

      {scaleModal && <ScaleModal recipe={scaleModal} ingredients={ingredients} onClose={() => setScaleModal(null)} onBatch={(id) => { setScaleModal(null); navigate(`/batches/new?recipe=${id}`); }} />}
    </Shell>
  );
}

// ─── Recipe Card ──────────────────────────────────────────────────────────────

function RecipeCard({ recipe, cpu, onEdit, onScale, onExport, onBatch }) {
  const [hovered, setHovered] = useState(false);
  const cat = CAT_STYLE[recipe.category] || CAT_STYLE.other;
  const catMeta = CATEGORIES.find(c => c.value === recipe.category);

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 18, border: "1px solid #E8C48A", overflow: "hidden", transition: "all 0.2s", boxShadow: hovered ? "0 10px 32px rgba(194,65,12,0.16)" : "0 2px 8px rgba(194,65,12,0.08)", transform: hovered ? "translateY(-2px)" : "none" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>

      {/* Color bar */}
      <div style={{ height: 4, background: cat.text, opacity: 0.6 }} />

      <div style={{ padding: "18px 20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: cat.bg, color: cat.text }}>
            {catMeta?.icon} {catMeta?.label || recipe.category}
          </span>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono'", color: "#5C3D1A", background: "#FFF0DC", padding: "2px 7px", borderRadius: 4 }}>v{recipe.version}</span>
        </div>

        <h3 style={{ fontSize: 17, fontFamily: "'Playfair Display'", lineHeight: 1.3, marginBottom: 8, marginTop: 0 }}>
          <Link to={`/recipes/${recipe.id}`} style={{ color: "inherit", textDecoration: "none" }} onClick={e => e.stopPropagation()}>
            {recipe.name}
          </Link>
        </h3>

        {recipe.description && (
          <p style={{ fontSize: 13, color: "#5C3D1A", lineHeight: 1.5, marginBottom: 14, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {recipe.description}
          </p>
        )}

        {/* Stats row */}
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#C2410C", marginBottom: 16, flexWrap: "wrap" }}>
          {recipe.yield_amount && <Stat icon="⚖️" label={`${recipe.yield_amount}${recipe.yield_unit}`} />}
          {recipe.yield_count && <Stat icon="📦" label={`${recipe.yield_count} units`} />}
          {cpu != null && <Stat icon="💰" label={`$${cpu.toFixed(2)}/unit`} color="#16A34A" />}
          {cpu != null && <Stat icon="🏷️" label={`$${(cpu * 3).toFixed(2)} retail`} color="#5C3D1A" />}
        </div>

        {/* Ingredients preview */}
        {recipe.ingredients?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
            {recipe.ingredients.slice(0, 5).map(ri => (
              <span key={ri.id} style={{ fontSize: 11, padding: "2px 7px", background: "#FFF0DC", borderRadius: 4, color: "#3D2914" }}>{ri.ingredient_name}</span>
            ))}
            {recipe.ingredients.length > 5 && (
              <span style={{ fontSize: 11, padding: "2px 7px", background: "#E8C48A", borderRadius: 4, color: "#C2410C" }}>+{recipe.ingredients.length - 5} more</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, borderTop: "1px solid #FFF0DC", paddingTop: 14 }}>
          <Btn small onClick={onBatch}>🧪 Batch</Btn>
          <Btn small variant="secondary" onClick={onScale}>⚖️ Scale</Btn>
          <Btn small variant="ghost" onClick={onEdit}>Edit</Btn>
          <Btn small variant="ghost" onClick={onExport} style={{ marginLeft: "auto" }}>↓</Btn>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, color }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 3, color: color || "#C2410C" }}>
      {icon} {label}
    </span>
  );
}

// ─── Scale Modal ──────────────────────────────────────────────────────────────

function ScaleModal({ recipe, ingredients, onClose, onBatch }) {
  const scaleRecipe = useScaleRecipe();
  const [mode, setMode] = useState("yield");
  const [targetYield, setTargetYield] = useState(recipe.yield_amount || 1000);
  const [unitCount, setUnitCount] = useState(recipe.yield_count || 12);
  const [factor, setFactor] = useState(1);
  const [result, setResult] = useState(null);

  const sf = mode === "yield" ? targetYield / recipe.yield_amount
    : mode === "units" ? unitCount / recipe.yield_count
    : factor;

  const handleScale = async () => {
    const params = mode === "yield" ? { target_yield: targetYield }
      : mode === "units" ? { unit_count: unitCount }
      : { scale_factor: factor };
    try {
      const data = await scaleRecipe.mutateAsync({ id: recipe.id, ...params });
      setResult(data);
    } catch {}
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,20,16,0.55)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#FFFCF7", borderRadius: 20, border: "1px solid #E8C48A", width: "100%", maxWidth: 640, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(26,20,16,0.28)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #E8C48A" }}>
          <h3 style={{ fontSize: 18, fontFamily: "'Playfair Display'" }}>⚖️ Scale: {recipe.name}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#5C3D1A" }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          {/* Mode tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[["yield", "By Yield"], ["units", "By Units"], ["factor", "By Factor"]].map(([m, l]) => (
              <button key={m} onClick={() => { setMode(m); setResult(null); }} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid", cursor: "pointer", fontSize: 13, fontWeight: 500, borderColor: mode === m ? "#C2410C" : "#E8C48A", background: mode === m ? "#C2410C" : "transparent", color: mode === m ? "#fff" : "#C2410C", fontFamily: "inherit" }}>{l}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#C2410C", marginBottom: 4 }}>
                {mode === "yield" ? `Target yield (${recipe.yield_unit})` : mode === "units" ? "Number of units" : "Scale factor"}
              </label>
              <input type="number" step={mode === "factor" ? "0.1" : "1"} min="0.1"
                value={mode === "yield" ? targetYield : mode === "units" ? unitCount : factor}
                onChange={e => { setResult(null); mode === "yield" ? setTargetYield(Number(e.target.value)) : mode === "units" ? setUnitCount(Number(e.target.value)) : setFactor(Number(e.target.value)); }}
                style={{ ...S.input, fontSize: 20, padding: "10px 14px", fontFamily: "'JetBrains Mono'" }} />
            </div>
            <Btn onClick={handleScale} disabled={scaleRecipe.isPending}>{scaleRecipe.isPending ? "…" : "Calculate"}</Btn>
          </div>

          {/* Quick preview even before Calculate */}
          <div style={{ padding: "10px 14px", background: "#FFF0DC", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#3D2914" }}>
            Scale factor: <strong>{sf.toFixed(3)}×</strong> · Approx yield: <strong>{(Number(recipe.yield_amount || 0) * sf).toFixed(1)}{recipe.yield_unit}</strong> · Units: <strong>~{Math.round(Number(recipe.yield_count || 0) * sf)}</strong>
          </div>

          {/* Results */}
          {result && (
            <div>
              {result.ingredients.map(ri => {
                const ing = ingredients.find(i => i.id === ri.ingredient_id);
                const hasEnough = ing ? ing.stock_on_hand >= ri.amount_scaled : true;
                return (
                  <div key={ri.ingredient_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: hasEnough ? "#FFFFFF" : "#FFF0EB", borderRadius: 8, marginBottom: 4, border: `1px solid ${hasEnough ? "#FFF0DC" : "#C97B5A40"}` }}>
                    <div>
                      <span style={{ fontSize: 14 }}>{ri.ingredient_name}</span>
                      {!hasEnough && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#B5603C" }}>⚠️ LOW STOCK</span>}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 13, alignItems: "center" }}>
                      {ri.line_cost && <span style={{ color: "#16A34A", fontWeight: 700 }}>${ri.line_cost.toFixed(2)}</span>}
                      <span style={{ fontFamily: "'JetBrains Mono'", fontWeight: 600, color: hasEnough ? "#3D2914" : "#B5603C" }}>{Number(ri.amount_scaled).toFixed(2)} {ri.unit}</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 16, padding: "14px 16px", background: "#1A1410", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "rgba(255,252,247,0.92)", fontSize: 14 }}>
                  Total: <strong style={{ color: "#FFFFFF" }}>${result.total_cost?.toFixed(2)}</strong>
                  {result.cost_per_unit && <span> · <strong style={{ color: "#4ADE80" }}>${result.cost_per_unit.toFixed(2)}/unit</strong></span>}
                </span>
                <Btn onClick={() => onBatch(recipe.id)}>🧪 Start This Batch</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 40px", background: "#FFFFFF", borderRadius: 20, border: "2px dashed #E8C48A", boxShadow: "0 4px 24px rgba(194, 65, 12, 0.1)" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
      <h3 style={{ fontSize: 22, fontFamily: "'Playfair Display'", marginBottom: 8 }}>No recipes yet</h3>
      <p style={{ color: "#5C3D1A", marginBottom: 24, fontSize: 14 }}>Create your first formula to get started</p>
      <Btn onClick={onAdd}>+ Create First Recipe</Btn>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Shell({ children }) { return <div style={{ padding: "32px 40px" }}>{children}</div>; }

function Chip({ label, active, onClick }) {
  return <button onClick={onClick} style={{ padding: "5px 12px", borderRadius: 16, border: "1px solid", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s", borderColor: active ? "#C2410C" : "#E8C48A", background: active ? "#C2410C" : "transparent", color: active ? "#FFFFFF" : "#C2410C", fontFamily: "inherit" }}>{label}</button>;
}

function Btn({ children, onClick, variant = "primary", small, disabled, style: extra }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 8, fontFamily: "'DM Sans'", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", border: "none", transition: "all 0.15s", fontSize: small ? 12 : 14, padding: small ? "6px 11px" : "9px 18px", opacity: disabled ? 0.6 : 1, ...extra };
  const variants = { primary: { background: "#EA580C", color: "#FFFFFF", boxShadow: "0 2px 12px rgba(234, 88, 12, 0.4)" }, secondary: { background: "#FFF0DC", color: "#3D2914", border: "2px solid #E8C48A" }, ghost: { background: "transparent", color: "#C2410C", fontWeight: 700 } };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

const S = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  pageTitle: { fontSize: 28, fontFamily: "'Playfair Display'" },
  pageSub: { fontSize: 14, color: "#5C3D1A", marginTop: 4 },
  loading: { padding: 40, color: "#5C3D1A" },
  input: { width: "100%", background: "#FFFFFF", border: "1px solid #E8C48A", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#1A1410", outline: "none", fontFamily: "inherit" },
};
