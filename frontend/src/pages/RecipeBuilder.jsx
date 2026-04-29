import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRecipe, useCreateRecipe, useUpdateRecipe, useIngredients } from "../hooks/useApi";
import toast from "react-hot-toast";

const PHASES = {
  soap: ["oils", "water", "lye", "fragrance", "colorant", "additive"],
  lotion: ["water_phase", "oil_phase", "cool_down", "fragrance", "preservative"],
  lip_balm: ["wax", "oils", "fragrance", "additive"],
  candle: ["wax", "fragrance", "dye", "additive"],
  default: ["phase_a", "phase_b", "cool_down", "additive"],
};

const CATEGORIES = [
  { value: "soap", label: "Cold/Hot Process Soap" },
  { value: "lotion", label: "Lotion / Cream" },
  { value: "lip_balm", label: "Lip Balm" },
  { value: "candle", label: "Candle" },
  { value: "other", label: "Other" },
];

const UNITS = ["g", "ml", "oz", "lb", "tsp", "tbsp", "%"];

export default function RecipeBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const cloneId = searchParams.get("clone");

  const { data: existingRecipe, isLoading } = useRecipe(id);
  const { data: cloneRecipe, isLoading: isCloneLoading } = useRecipe(!isEdit ? cloneId : null);
  const { data: allIngredients = [] } = useIngredients({ stock: true });
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();

  const [form, setForm] = useState({
    name: "",
    category: "soap",
    description: "",
    yield_amount: 1000,
    yield_unit: "g",
    yield_count: 12,
    notes: "",
  });

  const [ingredients, setIngredients] = useState([]);
  const [ingSearch, setIngSearch] = useState("");
  const [showIngPicker, setShowIngPicker] = useState(false);
  const [activePhase, setActivePhase] = useState(null);
  const [cloneApplied, setCloneApplied] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (existingRecipe && isEdit) {
      setForm({
        name: existingRecipe.name,
        category: existingRecipe.category || "soap",
        description: existingRecipe.description || "",
        yield_amount: existingRecipe.yield_amount,
        yield_unit: existingRecipe.yield_unit,
        yield_count: existingRecipe.yield_count,
        notes: existingRecipe.notes || "",
      });
      setIngredients(existingRecipe.ingredients || []);
    }
  }, [existingRecipe, isEdit]);

  useEffect(() => {
    if (isEdit || cloneApplied || !cloneRecipe) return;
    setForm({
      name: cloneRecipe.name ? `${cloneRecipe.name} (Copy)` : "",
      category: cloneRecipe.category || "soap",
      description: cloneRecipe.description || "",
      yield_amount: cloneRecipe.yield_amount ?? 1000,
      yield_unit: cloneRecipe.yield_unit || "g",
      yield_count: cloneRecipe.yield_count ?? 12,
      notes: cloneRecipe.notes || "",
    });
    setIngredients((cloneRecipe.ingredients || []).map((ing, idx) => ({ ...ing, sort_order: idx })));
    setCloneApplied(true);
  }, [isEdit, cloneApplied, cloneRecipe]);

  const phases = PHASES[form.category] || PHASES.default;
  const totalWeight = ingredients.reduce((s, i) => s + Number(i.amount || 0), 0);

  const totalCost = useMemo(() => ingredients.reduce((sum, ri) => {
    const ing = allIngredients.find(i => i.id === ri.ingredient_id);
    return sum + (ing?.cost_per_unit || 0) * Number(ri.amount || 0);
  }, 0), [ingredients, allIngredients]);

  const costPerUnit = form.yield_count ? totalCost / form.yield_count : null;

  const filteredIngredients = allIngredients.filter(i =>
    !ingSearch || i.name.toLowerCase().includes(ingSearch.toLowerCase())
  );

  const addIngredient = (ing, phase) => {
    setIngredients(prev => [...prev, {
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      inci_name: ing.inci_name,
      amount: 100,
      unit: "g",
      phase: phase || phases[0],
      sort_order: prev.length,
    }]);
    setShowIngPicker(false);
    setIngSearch("");
  };

  const addCustomLine = (phase) => {
    const name = window.prompt("Label for this line (e.g. Distilled Water, NaOH):");
    if (!name?.trim()) return;
    const t = name.trim();
    setIngredients((prev) => [
      ...prev,
      {
        ingredient_id: null,
        ingredient_name: t,
        line_name: t,
        inci_name: "",
        amount: 100,
        unit: "g",
        phase: phase || phases[0],
        sort_order: prev.length,
      },
    ]);
  };

  const updateIngredient = (idx, field, val) => {
    setIngredients(prev => prev.map((i, n) => n === idx ? { ...i, [field]: val } : i));
  };

  const removeIngredient = (idx) => {
    setIngredients(prev => prev.filter((_, n) => n !== idx));
  };

  const moveIngredient = (idx, dir) => {
    const next = [...ingredients];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setIngredients(next.map((i, n) => ({ ...i, sort_order: n })));
  };

  const handleSave = async () => {
    for (const row of ingredients) {
      if (!row.ingredient_id && !(row.line_name || row.ingredient_name || "").trim()) {
        toast.error("Each line needs an ingredient or a custom label.");
        return;
      }
    }
    const payload = {
      ...form,
      ingredients: ingredients.map((i, n) => {
        const base = {
          amount: Number(i.amount),
          unit: i.unit,
          phase: i.phase,
          sort_order: n,
          notes: i.notes,
        };
        if (i.ingredient_id) {
          return { ...base, ingredient_id: i.ingredient_id };
        }
        const ln = (i.line_name || i.ingredient_name || "").trim();
        return { ...base, line_name: ln };
      }),
    };

    try {
      if (isEdit) {
        await updateRecipe.mutateAsync({ id, ...payload });
      } else {
        const recipe = await createRecipe.mutateAsync(payload);
        navigate(`/recipes/${recipe.id}`);
        return;
      }
      navigate(`/recipes/${id}`);
    } catch {}
  };

  if (isLoading || (!isEdit && cloneId && isCloneLoading)) return <div style={styles.loading}>Loading recipe…</div>;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{isEdit ? "Edit Recipe" : "New Recipe"}</h1>
          {isEdit && <p style={styles.sub}>Version {existingRecipe?.version} · last saved {existingRecipe?.updated_at ? new Date(existingRecipe.updated_at).toLocaleDateString() : "—"}</p>}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate(-1)} style={styles.btnSecondary}>Cancel</button>
          <button onClick={handleSave} disabled={createRecipe.isPending || updateRecipe.isPending} style={styles.btnPrimary}>
            {createRecipe.isPending || updateRecipe.isPending ? "Saving…" : "💾 Save Recipe"}
          </button>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Left: Meta */}
        <div style={{ gridColumn: "1 / 2" }}>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Details</h3>

            <Field label="Recipe Name *">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Classic Lavender Cold Process…" style={styles.input} />
            </Field>

            <Field label="Category">
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={styles.input}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>

            <Field label="Description">
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe this formula…" style={{ ...styles.input, resize: "vertical" }} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", gap: 10 }}>
              <Field label="Batch Yield">
                <input type="number" value={form.yield_amount} onChange={e => setForm(f => ({ ...f, yield_amount: e.target.value }))} style={styles.input} />
              </Field>
              <Field label="Unit">
                <select value={form.yield_unit} onChange={e => setForm(f => ({ ...f, yield_unit: e.target.value }))} style={styles.input}>
                  {["g", "ml", "oz", "lb"].map(u => <option key={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="Unit Count">
                <input type="number" value={form.yield_count} onChange={e => setForm(f => ({ ...f, yield_count: e.target.value }))} placeholder="12 bars…" style={styles.input} />
              </Field>
            </div>

            <Field label="Notes">
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Process notes, cure time, tips…" style={{ ...styles.input, resize: "vertical" }} />
            </Field>
          </div>

          {/* Cost Summary */}
          <div style={{ ...styles.card, marginTop: 16 }}>
            <h3 style={styles.sectionTitle}>Cost Summary</h3>
            <div style={styles.costRow}><span>Total ingredients</span><strong>{totalWeight.toFixed(1)}{form.yield_unit}</strong></div>
            <div style={styles.costRow}><span>Total batch cost</span><strong>${totalCost.toFixed(2)}</strong></div>
            <div style={styles.costRow}><span>Cost per unit</span><strong style={{ color: "#16A34A" }}>${costPerUnit ? costPerUnit.toFixed(2) : "—"}</strong></div>
            <div style={styles.costRow}><span>Suggested retail (3×)</span><strong>${costPerUnit ? (costPerUnit * 3).toFixed(2) : "—"}</strong></div>
          </div>
        </div>

        {/* Right: Ingredients */}
        <div style={{ gridColumn: "2 / 3" }}>
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={styles.sectionTitle}>Ingredients</h3>
              <button onClick={() => { setActivePhase(phases[0]); setShowIngPicker(true); }} style={styles.btnPrimary}>
                + Add Ingredient
              </button>
            </div>

            {phases.map(phase => {
              const phaseIngs = ingredients.filter(i => i.phase === phase);
              if (phaseIngs.length === 0 && !ingredients.some(i => i.phase === phase)) return null;
              return (
                <div key={phase} style={{ marginBottom: 20 }}>
                  <div style={styles.phaseHeader}>
                    <span>{phase.replace(/_/g, " ").toUpperCase()}</span>
                    <span style={{ display: "flex", gap: 8 }}>
                      {form.category === "soap" && (
                        <button type="button" onClick={() => addCustomLine(phase)} style={{ ...styles.phaseAddBtn, color: "#B45309" }}>
                          + custom line
                        </button>
                      )}
                      <button type="button" onClick={() => { setActivePhase(phase); setShowIngPicker(true); }} style={styles.phaseAddBtn}>+ add</button>
                    </span>
                  </div>

                  {phaseIngs.length === 0 && (
                    <div style={styles.emptyPhase} onClick={() => { setActivePhase(phase); setShowIngPicker(true); }}>
                      Click to add ingredients to this phase
                    </div>
                  )}

                  {phaseIngs.map((ri, phaseIdx) => {
                    const globalIdx = ingredients.findIndex(i => i === ri);
                    const ing = ri.ingredient_id ? allIngredients.find(i => i.id === ri.ingredient_id) : null;
                    const pct = totalWeight ? ((Number(ri.amount) / totalWeight) * 100).toFixed(1) : 0;
                    const lineCost = ing?.cost_per_unit ? ing.cost_per_unit * Number(ri.amount) : null;

                    return (
                      <div key={globalIdx} style={styles.ingredientRow}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>
                            {ri.ingredient_name}
                            {!ri.ingredient_id && (
                              <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#B45309" }}>CUSTOM</span>
                            )}
                          </div>
                          {ri.inci_name && <div style={{ fontSize: 11, color: "#5C3D1A", marginTop: 1 }}>{ri.inci_name}</div>}
                        </div>
                        <span style={styles.pct}>{pct}%</span>
                        <input type="number" value={ri.amount} min="0" step="0.1"
                          onChange={e => updateIngredient(globalIdx, "amount", e.target.value)}
                          style={styles.amountInput} />
                        <select value={ri.unit} onChange={e => updateIngredient(globalIdx, "unit", e.target.value)} style={styles.unitSelect}>
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                        {lineCost && <span style={styles.lineCost}>${lineCost.toFixed(2)}</span>}
                        <div style={{ display: "flex", gap: 2 }}>
                          <button onClick={() => moveIngredient(globalIdx, -1)} style={styles.iconBtn}>↑</button>
                          <button onClick={() => moveIngredient(globalIdx, 1)} style={styles.iconBtn}>↓</button>
                          <button onClick={() => removeIngredient(globalIdx)} style={{ ...styles.iconBtn, color: "#B5603C" }}>×</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {ingredients.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#5C3D1A", fontSize: 14 }}>
                No ingredients yet. Click "Add Ingredient" to get started.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ingredient Picker Modal */}
      {showIngPicker && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3>Add to {activePhase?.replace(/_/g, " ")}</h3>
              <button onClick={() => setShowIngPicker(false)} style={styles.closeBtn}>×</button>
            </div>
            <div style={{ padding: "0 20px 12px" }}>
              <input autoFocus value={ingSearch} onChange={e => setIngSearch(e.target.value)} placeholder="Search ingredients…" style={{ ...styles.input, width: "100%" }} />
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto", padding: "0 20px 20px" }}>
              {filteredIngredients.map(ing => (
                <div key={ing.id} onClick={() => addIngredient(ing, activePhase)}
                  style={styles.ingPickerRow}
                  onMouseEnter={e => e.currentTarget.style.background = "#FFF0DC"}
                  onMouseLeave={e => e.currentTarget.style.background = "#FFFFFF"}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{ing.name}</div>
                    {ing.inci_name && <div style={{ fontSize: 11, color: "#5C3D1A" }}>{ing.inci_name}</div>}
                  </div>
                  <div style={{ textAlign: "right", fontSize: 12, color: "#C2410C" }}>
                    {ing.cost_per_unit && <div>${ing.cost_per_unit.toFixed(4)}/{ing.unit}</div>}
                    <div style={{ color: ing.stock_on_hand < 100 ? "#EA580C" : "#16A34A", fontWeight: 700 }}>{ing.stock_on_hand?.toLocaleString()}{ing.unit} in stock</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#C2410C", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const styles = {
  page: { padding: "32px 40px", maxWidth: 1200, margin: "0 auto" },
  loading: { padding: 40, color: "#5C3D1A" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  title: { fontSize: 28, fontFamily: "'Playfair Display'" },
  sub: { fontSize: 13, color: "#5C3D1A", marginTop: 4 },
  grid: { display: "grid", gridTemplateColumns: "380px 1fr", gap: 20 },
  card: { background: "#FFFFFF", borderRadius: 16, border: "1px solid #E8C48A", padding: 24 },
  sectionTitle: { fontSize: 17, fontFamily: "'Playfair Display'", marginBottom: 16 },
  input: { width: "100%", background: "#FFFFFF", border: "1px solid #E8C48A", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#1A1410", outline: "none", fontFamily: "inherit" },
  btnPrimary: { background: "#EA580C", color: "#FFFFFF", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 12px rgba(234, 88, 12, 0.4)" },
  btnSecondary: { background: "#FFF0DC", color: "#3D2914", border: "1px solid #E8C48A", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  costRow: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #FFF0DC", fontSize: 14, color: "#3D2914" },
  phaseHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#5C3D1A", marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid #FFF0DC" },
  phaseAddBtn: { background: "none", border: "none", cursor: "pointer", color: "#16A34A", fontSize: 12, fontWeight: 700, fontFamily: "inherit" },
  emptyPhase: { padding: "12px 0", fontSize: 13, color: "#5C3D1A", cursor: "pointer", opacity: 0.6, fontStyle: "italic" },
  ingredientRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#FFFFFF", borderRadius: 8, marginBottom: 4 },
  pct: { fontSize: 11, color: "#5C3D1A", width: 36, textAlign: "right", flexShrink: 0 },
  amountInput: { width: 80, background: "#FFFCF7", border: "1px solid #E8C48A", borderRadius: 6, padding: "4px 8px", fontSize: 13, fontFamily: "'JetBrains Mono'", textAlign: "right", outline: "none" },
  unitSelect: { width: 54, background: "#FFFCF7", border: "1px solid #E8C48A", borderRadius: 6, padding: "4px 4px", fontSize: 12, outline: "none" },
  lineCost: { fontSize: 12, color: "#16A34A", width: 44, textAlign: "right", flexShrink: 0 },
  iconBtn: { background: "none", border: "none", cursor: "pointer", color: "#5C3D1A", fontSize: 16, lineHeight: 1, padding: "2px 4px" },
  overlay: { position: "fixed", inset: 0, background: "rgba(26,20,16,0.55)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#FFFCF7", borderRadius: 20, border: "1px solid #E8C48A", width: 480, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(26,20,16,0.28)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 12px", borderBottom: "1px solid #E8C48A" },
  closeBtn: { background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#5C3D1A", lineHeight: 1 },
  ingPickerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 4, background: "#FFFFFF", transition: "background 0.1s" },
};
