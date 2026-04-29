import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBatch, useRecipe, useIngredients, useCompleteBatch } from "../hooks/useApi";

const STEPS = ["review", "ingredients", "yield", "confirm"];
const STEP_LABELS = ["Review Recipe", "Record Usage", "Actual Yield", "Confirm"];

export default function BatchCompletion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: batch, isLoading: batchLoading } = useBatch(id);
  const { data: recipe } = useRecipe(batch?.recipe_id);
  const { data: ingredients = [] } = useIngredients({ stock: true });
  const completeBatch = useCompleteBatch();

  const [step, setStep] = useState(0);
  const [usage, setUsage] = useState({});       // recipe line id → usage row
  const [yield_actual, setYieldActual] = useState("");
  const [unit_count, setUnitCount] = useState("");
  const [notes, setNotes] = useState("");

  if (batchLoading) return <div style={styles.loading}>Loading batch…</div>;
  if (!batch) return <div style={styles.loading}>Batch not found</div>;

  const sf = batch.scale_factor || 1;
  const recipeIngs = recipe?.ingredients || [];

  const initUsage = () => {
    if (Object.keys(usage).length === 0 && recipeIngs.length > 0) {
      const init = {};
      recipeIngs.forEach((ri) => {
        init[ri.id] = {
          recipe_line_id: ri.id,
          ingredient_id: ri.ingredient_id,
          ingredient_name: ri.ingredient_name,
          amount: (Number(ri.amount) * sf).toFixed(2),
          unit: ri.unit,
          lot_id: "",
        };
      });
      setUsage(init);
    }
  };

  const updateUsage = (lineId, field, val) => {
    setUsage((prev) => ({ ...prev, [lineId]: { ...prev[lineId], [field]: val } }));
  };

  const handleComplete = async () => {
    try {
      await completeBatch.mutateAsync({
        id,
        yield_actual: Number(yield_actual),
        unit_count: unit_count ? Number(unit_count) : undefined,
        notes,
        ingredients: Object.values(usage)
          .filter((u) => u.ingredient_id)
          .map((u) => ({
            ingredient_id: u.ingredient_id,
            lot_id: u.lot_id || undefined,
            amount_used: Number(u.amount),
            unit: u.unit,
          })),
      });
      navigate("/batches");
    } catch {}
  };

  const totalCost = Object.values(usage).reduce((sum, u) => {
    if (!u.ingredient_id) return sum;
    const ing = ingredients.find((i) => i.id === u.ingredient_id);
    return sum + (ing?.cost_per_unit || 0) * Number(u.amount || 0);
  }, 0);

  return (
    <div style={styles.page}>
      {/* Progress Steps */}
      <div style={styles.stepBar}>
        {STEP_LABELS.map((label, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ ...styles.stepDot, background: i <= step ? "#C2410C" : "#E8C48A", color: i <= step ? "#FFFCF7" : "#5C3D1A" }}>{i + 1}</div>
            <span style={{ fontSize: 13, fontWeight: i === step ? 600 : 400, color: i <= step ? "#3D2914" : "#5C3D1A" }}>{label}</span>
            {i < STEP_LABELS.length - 1 && <div style={styles.stepLine} />}
          </div>
        ))}
      </div>

      <div style={styles.card}>
        {/* Step 0: Review */}
        {step === 0 && (
          <div>
            <h2 style={styles.stepTitle}>Review Batch</h2>
            <p style={{ color: "#5C3D1A", marginBottom: 24, fontSize: 14 }}>Confirm you're completing the right batch before recording ingredient usage.</p>
            <InfoRow label="Batch #" value={<span style={{ fontFamily: "'JetBrains Mono'", fontWeight: 600 }}>{batch.batch_number}</span>} />
            <InfoRow label="Recipe" value={batch.recipe_name} />
            <InfoRow label="Scale Factor" value={`${sf}× (${(sf * 100).toFixed(0)}% of base recipe)`} />
            <InfoRow label="Expected Yield" value={recipe ? `${(recipe.yield_amount * sf).toFixed(0)}${recipe.yield_unit}` : "—"} />
            <InfoRow label="Expected Units" value={recipe?.yield_count ? Math.round(recipe.yield_count * sf) : "—"} />
            {batch.notes && <InfoRow label="Notes" value={batch.notes} />}

            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontSize: 16, fontFamily: "'Playfair Display'", marginBottom: 12 }}>Scaled Ingredient List</h3>
              {recipeIngs.map((ri) => (
                <div key={ri.id} style={styles.ingRow}>
                  <span style={{ fontSize: 14 }}>{ri.ingredient_name}</span>
                  <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 600, color: "#C2410C" }}>
                    {(Number(ri.amount) * sf).toFixed(2)} {ri.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Ingredient Usage */}
        {step === 1 && (
          <div>
            <h2 style={styles.stepTitle}>Record Actual Usage</h2>
            <p style={{ color: "#5C3D1A", marginBottom: 24, fontSize: 14 }}>
              Adjust amounts if actuals differed from the recipe. For catalog ingredients, select the lot used for traceability.
              Custom lines (lye, water, etc.) are not deducted from inventory.
            </p>
            {recipeIngs.map((ri) => {
              const u = usage[ri.id] || {};
              const ing = ri.ingredient_id ? ingredients.find((i) => i.id === ri.ingredient_id) : null;
              const expectedAmt = (Number(ri.amount) * sf).toFixed(2);
              const actualAmt = Number(u.amount || expectedAmt);
              const diff = actualAmt - Number(expectedAmt);
              const isCustom = !ri.ingredient_id;
              return (
                <div key={ri.id} style={styles.usageCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{ri.ingredient_name}</div>
                      <div style={{ fontSize: 12, color: "#5C3D1A" }}>Expected: {expectedAmt} {ri.unit}</div>
                      {isCustom && (
                        <div style={{ fontSize: 11, color: "#B45309", marginTop: 6, fontWeight: 600 }}>
                          Label-only line — not deducted from inventory. Adjust amount for your records only.
                        </div>
                      )}
                    </div>
                    {ing && (
                      <div style={{ fontSize: 12, color: "#6D9B58", textAlign: "right" }}>
                        {ing.stock_on_hand.toLocaleString()} {ing.unit} in stock
                      </div>
                    )}
                  </div>
                  {!isCustom && (
                    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10 }}>
                      <div>
                        <label style={styles.fieldLabel}>Actual amount ({ri.unit})</label>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="number"
                            value={u.amount ?? expectedAmt}
                            step="0.01"
                            onChange={(e) => updateUsage(ri.id, "amount", e.target.value)}
                            style={{ ...styles.input, fontFamily: "'JetBrains Mono'" }}
                          />
                          {Math.abs(diff) > 0.01 && (
                            <span style={{ fontSize: 11, color: diff > 0 ? "#B5603C" : "#6D9B58", whiteSpace: "nowrap" }}>
                              {diff > 0 ? "+" : ""}
                              {diff.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label style={styles.fieldLabel}>Lot used (for traceability)</label>
                        <select value={u.lot_id || ""} onChange={(e) => updateUsage(ri.id, "lot_id", e.target.value)} style={styles.input}>
                          <option value="">No lot selected</option>
                          {(ing?.lots || []).map((lot) => (
                            <option key={lot.id} value={lot.id}>
                              {lot.lot_number || `Lot ${lot.id.slice(0, 6)}`}
                              {lot.expiry_date ? ` (exp ${new Date(lot.expiry_date).toLocaleDateString()})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  {isCustom && (
                    <div>
                      <label style={styles.fieldLabel}>Recorded amount ({ri.unit})</label>
                      <input
                        type="number"
                        value={u.amount ?? expectedAmt}
                        step="0.01"
                        onChange={(e) => updateUsage(ri.id, "amount", e.target.value)}
                        style={{ ...styles.input, fontFamily: "'JetBrains Mono'", maxWidth: 160 }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ marginTop: 16, padding: "12px 16px", background: "#FFF0DC", borderRadius: 10, fontSize: 13, color: "#3D2914" }}>
              Estimated ingredient cost: <strong>${totalCost.toFixed(2)}</strong>
            </div>
          </div>
        )}

        {/* Step 2: Actual Yield */}
        {step === 2 && (
          <div>
            <h2 style={styles.stepTitle}>Record Actual Yield</h2>
            <p style={{ color: "#5C3D1A", marginBottom: 24, fontSize: 14 }}>How much did the batch actually produce?</p>
            <div style={{ maxWidth: 400 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={styles.fieldLabel}>Actual yield ({recipe?.yield_unit || "g"})</label>
                <input type="number" value={yield_actual} onChange={e => setYieldActual(e.target.value)}
                  placeholder={recipe ? String((recipe.yield_amount * sf).toFixed(0)) : ""}
                  style={{ ...styles.input, fontSize: 20, padding: "12px 16px", fontFamily: "'JetBrains Mono'" }} />
                {recipe && yield_actual && (
                  <div style={{ fontSize: 12, color: "#5C3D1A", marginTop: 4 }}>
                    {((Number(yield_actual) / (recipe.yield_amount * sf)) * 100).toFixed(1)}% of expected yield
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={styles.fieldLabel}>Number of units produced</label>
                <input type="number" value={unit_count} onChange={e => setUnitCount(e.target.value)}
                  placeholder={recipe?.yield_count ? String(Math.round(recipe.yield_count * sf)) : ""}
                  style={{ ...styles.input, fontSize: 20, padding: "12px 16px", fontFamily: "'JetBrains Mono'" }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={styles.fieldLabel}>Batch notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
                  placeholder="Temperatures, trace time, any issues, cure date…"
                  style={{ ...styles.input, resize: "vertical" }} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div>
            <h2 style={styles.stepTitle}>Confirm & Complete</h2>
            <p style={{ color: "#5C3D1A", marginBottom: 24, fontSize: 14 }}>
              Completing this batch will deduct the recorded ingredient amounts from your inventory.
            </p>
            <div style={{ background: "#FFF0DC", borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <InfoRow label="Batch #" value={batch.batch_number} />
              <InfoRow label="Recipe" value={batch.recipe_name} />
              <InfoRow label="Actual yield" value={yield_actual ? `${yield_actual} ${recipe?.yield_unit}` : "Not recorded"} />
              <InfoRow label="Units produced" value={unit_count || "Not recorded"} />
              <InfoRow label="Ingredient cost" value={`$${totalCost.toFixed(2)}`} />
              {unit_count && totalCost && (
                <InfoRow label="Cost per unit" value={`$${(totalCost / Number(unit_count)).toFixed(2)}`} />
              )}
            </div>
            <div style={{ background: "#FFF0EB", border: "1px solid #C97B5A40", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#8F4A2C", marginBottom: 24 }}>
              ⚠️ This action will permanently deduct ingredient quantities from inventory and cannot be undone.
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
          <button onClick={() => step === 0 ? navigate("/batches") : setStep(s => s - 1)}
            style={styles.btnSecondary}>{step === 0 ? "Cancel" : "← Back"}</button>
          <button
            onClick={() => {
              if (step === 1) initUsage();
              if (step === STEPS.length - 1) { handleComplete(); return; }
              setStep(s => s + 1);
              if (step === 0) initUsage();
            }}
            disabled={completeBatch.isPending}
            style={{ ...styles.btnPrimary, background: step === STEPS.length - 1 ? "#16A34A" : "#EA580C" }}>
            {step === STEPS.length - 1
              ? (completeBatch.isPending ? "Completing…" : "✓ Complete Batch")
              : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #E8C48A", fontSize: 14 }}>
      <span style={{ color: "#5C3D1A" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  page: { padding: "32px 40px", maxWidth: 860, margin: "0 auto" },
  loading: { padding: 40, color: "#5C3D1A" },
  stepBar: { display: "flex", alignItems: "center", gap: 8, marginBottom: 28, flexWrap: "wrap" },
  stepDot: { width: 28, height: 28, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 },
  stepLine: { width: 32, height: 2, background: "#E8C48A" },
  card: { background: "#FFFFFF", borderRadius: 16, border: "1px solid #E8C48A", padding: 32 },
  stepTitle: { fontSize: 22, fontFamily: "'Playfair Display'", marginBottom: 8 },
  ingRow: { display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#FFFFFF", borderRadius: 8, marginBottom: 4 },
  usageCard: { background: "#FFFFFF", border: "1px solid #E8C48A", borderRadius: 10, padding: 16, marginBottom: 12 },
  fieldLabel: { display: "block", fontSize: 12, fontWeight: 500, color: "#C2410C", marginBottom: 4 },
  input: { width: "100%", background: "#FFFCF7", border: "1px solid #E8C48A", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#1A1410", outline: "none", fontFamily: "inherit" },
  btnPrimary: { background: "#EA580C", color: "#FFFFFF", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 12px rgba(234, 88, 12, 0.4)" },
  btnSecondary: { background: "#FFF0DC", color: "#3D2914", border: "1px solid #E8C48A", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
};
