import { useState, useMemo } from "react";
import toast from "react-hot-toast";
import { useIngredients, useCreateIngredient, useUpdateIngredient, useAddLot, useInventoryTransactions, useIngredientLookup } from "../hooks/useApi";
import { exportIngredients } from "../utils/exports";

const CATEGORIES = [
  { value: "oil", label: "Oil" },
  { value: "butter", label: "Butter" },
  { value: "lye", label: "Lye" },
  { value: "liquid", label: "Liquid" },
  { value: "wax", label: "Wax" },
  { value: "fragrance", label: "Fragrance" },
  { value: "emulsifier", label: "Emulsifier" },
  { value: "additive", label: "Additive" },
  { value: "colorant", label: "Colorant" },
  { value: "preservative", label: "Preservative" },
  { value: "other", label: "Other" },
];

const CAT_COLORS = {
  oil: "#15803D", butter: "#C2410C", lye: "#0369A1", liquid: "#0284C7",
  wax: "#EA580C", fragrance: "#C2410C", emulsifier: "#15803D",
  additive: "#EA580C", colorant: "#7C3AED", preservative: "#0369A1", other: "#EA580C",
};

const CAT_BG = {
  oil: "#BBF7D055", butter: "#FFEDD555", lye: "#E0F2FE", liquid: "#E0F2FE",
  wax: "#FFEDD5", fragrance: "#FFEDD5", emulsifier: "#BBF7D055",
  additive: "#FFEDD5", colorant: "#EDE9FE", preservative: "#E0F2FE", other: "#FFEDD5",
};

export default function IngredientsPage() {
  const { data: ingredients = [], isLoading } = useIngredients({ stock: true });
  const createIngredient = useCreateIngredient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [lotModal, setLotModal] = useState(null);       // ingredient object
  const [ledgerModal, setLedgerModal] = useState(null); // ingredient object
  const [editModal, setEditModal] = useState(null);

  const filtered = useMemo(() => ingredients.filter(i =>
    (catFilter === "all" || i.category === catFilter) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.inci_name || "").toLowerCase().includes(search.toLowerCase()))
  ), [ingredients, catFilter, search]);

  const lowStockCount = ingredients.filter(i => i.stock_on_hand < 200).length;

  if (isLoading) return <PageShell><div style={S.loading}>Loading ingredients…</div></PageShell>;

  return (
    <PageShell>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.pageTitle}>Ingredients</h1>
          <p style={S.pageSub}>
            {ingredients.length} raw materials · {lowStockCount > 0 && <span style={{ color: "#B5603C", fontWeight: 600 }}>{lowStockCount} low stock</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="secondary" onClick={() => exportIngredients(ingredients)}>↓ Export CSV</Btn>
          <Btn onClick={() => setShowAdd(true)}>+ Add Ingredient</Btn>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or INCI…"
          style={{ ...S.input, width: 260 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <FilterChip label="All" active={catFilter === "all"} onClick={() => setCatFilter("all")} />
          {CATEGORIES.map(c => (
            <FilterChip key={c.value} label={c.label} active={catFilter === c.value} onClick={() => setCatFilter(c.value)} />
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr style={{ background: "#FFF0DC" }}>
              {["Ingredient / INCI", "Category", "Supplier", "Cost / unit", "SAP NaOH", "Stock", "Actions"].map(h => (
                <TH key={h}>{h}</TH>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#5C3D1A", fontSize: 14 }}>No ingredients found</td></tr>
            )}
            {filtered.map(ing => {
              const low = ing.stock_on_hand < 200;
              const critical = ing.stock_on_hand < 50;
              return (
                <tr key={ing.id} style={{ borderTop: "1px solid #FFF0DC", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FFFFFF"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{ing.name}</div>
                    {ing.inci_name && <div style={{ fontSize: 11, color: "#5C3D1A", marginTop: 2 }}>{ing.inci_name}</div>}
                    {ing.cas_number && <div style={{ fontSize: 10, color: "#5C3D1A80", marginTop: 1, fontFamily: "'JetBrains Mono'" }}>CAS {ing.cas_number}</div>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <CatBadge cat={ing.category} />
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#C2410C" }}>{ing.supplier || <span style={{ opacity: 0.4 }}>—</span>}</td>
                  <td style={{ padding: "13px 16px", fontFamily: "'JetBrains Mono'", fontSize: 13, color: "#4E7A3C" }}>
                    {ing.cost_per_unit != null ? `$${Number(ing.cost_per_unit).toFixed(4)}/${ing.unit}` : <span style={{ opacity: 0.4 }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px", fontFamily: "'JetBrains Mono'", fontSize: 12, color: "#C2410C" }}>
                    {ing.sap_value_naoh != null ? Number(ing.sap_value_naoh).toFixed(4) : <span style={{ opacity: 0.4 }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div>
                        <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 15, fontWeight: 700, color: critical ? "#B5603C" : low ? "#C97B5A" : "#1A1410" }}>
                          {Number(ing.stock_on_hand).toLocaleString()}
                          <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>{ing.unit}</span>
                        </div>
                        {critical && <div style={{ fontSize: 10, fontWeight: 700, color: "#B5603C", letterSpacing: "0.06em" }}>CRITICAL</div>}
                        {!critical && low && <div style={{ fontSize: 10, fontWeight: 600, color: "#C97B5A", letterSpacing: "0.06em" }}>LOW</div>}
                      </div>
                      <StockBar value={ing.stock_on_hand} critical={critical} low={low} />
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn variant="sage" small onClick={() => setLotModal(ing)}>+ Lot</Btn>
                      <Btn variant="ghost" small onClick={() => setEditModal(ing)}>Edit</Btn>
                      <Btn variant="ghost" small onClick={() => setLedgerModal(ing)}>Ledger</Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showAdd && <AddIngredientModal onClose={() => setShowAdd(false)} onCreate={createIngredient} />}
      {editModal && <EditIngredientModal ingredient={editModal} onClose={() => setEditModal(null)} />}
      {lotModal && <ReceiveLotModal ingredient={lotModal} onClose={() => setLotModal(null)} />}
      {ledgerModal && <LedgerModal ingredient={ledgerModal} onClose={() => setLedgerModal(null)} />}
    </PageShell>
  );
}

// ─── Stock bar ────────────────────────────────────────────────────────────────

function StockBar({ value, low, critical }) {
  const max = 5000;
  const pct = Math.min(100, (value / max) * 100);
  const color = critical ? "#B5603C" : low ? "#C97B5A" : "#6D9B58";
  return (
    <div style={{ width: 48, height: 4, background: "#E8C48A", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.3s" }} />
    </div>
  );
}

// ─── Add / Edit Modals ────────────────────────────────────────────────────────

function AddIngredientModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", inci_name: "", category: "oil", unit: "g", cost_per_unit: "", supplier: "", cas_number: "", sap_value_naoh: "", sap_value_koh: "", max_usage_pct: "", notes: "", safety_notes: "" });
  const [supplierHint, setSupplierHint] = useState("");
  const [saving, setSaving] = useState(false);
  const lookup = useIngredientLookup();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const applyLookup = (data) => {
    const hint = supplierHint.trim();
    const supplierFromHint = hint && !/^https?:\/\//i.test(hint) ? hint : "";
    const urlNote = hint && /^https?:\/\//i.test(hint) ? `Product page: ${hint}` : "";
    setForm(f => ({
      ...f,
      inci_name: data.inci_name != null ? data.inci_name : f.inci_name,
      category: data.category || f.category,
      unit: data.unit || "g",
      cost_per_unit: data.cost_per_unit != null ? String(data.cost_per_unit) : f.cost_per_unit,
      supplier: (data.supplier && data.supplier.trim()) || supplierFromHint || f.supplier,
      cas_number: data.cas_number != null ? data.cas_number : f.cas_number,
      sap_value_naoh: data.sap_value_naoh != null ? String(data.sap_value_naoh) : f.sap_value_naoh,
      sap_value_koh: data.sap_value_koh != null ? String(data.sap_value_koh) : f.sap_value_koh,
      max_usage_pct: data.max_usage_pct != null ? String(data.max_usage_pct) : f.max_usage_pct,
      notes: [urlNote, data.notes, f.notes].filter(Boolean).join("\n\n"),
    }));
  };

  const handleAiLookup = async () => {
    if (!form.name.trim()) return;
    try {
      const data = await lookup.mutateAsync({
        name: form.name.trim(),
        supplier_or_website: supplierHint.trim() || undefined,
      });
      applyLookup(data);
      toast.success("AI suggestions applied — review fields before saving");
    } catch {
      /* toast from hook */
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form };
      ["cost_per_unit", "sap_value_naoh", "sap_value_koh", "max_usage_pct"].forEach(k => {
        payload[k] = form[k] !== "" ? Number(form[k]) : null;
      });
      await onCreate.mutateAsync(payload);
      onClose();
    } catch {} finally { setSaving(false); }
  };

  return (
    <Modal title="Add Ingredient" onClose={onClose} width={640}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Name *" span={2}><input value={form.name} onChange={e => set("name", e.target.value)} style={S.input} placeholder="Coconut Oil (76°)" autoFocus /></Field>
        <div style={{ gridColumn: "1 / -1", padding: "16px 18px", marginBottom: 4, background: "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 50%, #E0F2FE 100%)", borderRadius: 14, border: "3px solid #EA580C", boxShadow: "0 4px 20px rgba(234, 88, 12, 0.2)" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#C2410C", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden>✨</span> Look up with AI (ChatGPT)
          </div>
          <p style={{ fontSize: 13, color: "#431407", margin: "0 0 14px", lineHeight: 1.5, fontWeight: 500 }}>
            Add a supplier name or product page URL for context, then fill cost per gram, SAP (NaOH & KOH), CAS, and max usage when possible. <strong>Always verify</strong> against your SDS or supplier.
          </p>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#9A3412", marginBottom: 6 }}>Supplier or website (optional)</label>
          <input value={supplierHint} onChange={e => setSupplierHint(e.target.value)} style={{ ...S.input, marginBottom: 12, borderWidth: 2, borderColor: "#FDBA74" }} placeholder="e.g. Bramble Berry, or paste a product https://…" />
          <Btn onClick={handleAiLookup} disabled={lookup.isPending || !form.name.trim()}>
            {lookup.isPending ? "Looking up…" : "Run AI lookup & fill fields"}
          </Btn>
        </div>
        <Field label="INCI Name"><input value={form.inci_name} onChange={e => set("inci_name", e.target.value)} style={S.input} placeholder="Cocos Nucifera Oil" /></Field>
        <Field label="Category">
          <select value={form.category} onChange={e => set("category", e.target.value)} style={S.input}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Unit">
          <select value={form.unit} onChange={e => set("unit", e.target.value)} style={S.input}>
            {["g", "ml", "oz", "lb"].map(u => <option key={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Cost per unit ($)"><input type="number" step="0.0001" value={form.cost_per_unit} onChange={e => set("cost_per_unit", e.target.value)} style={S.input} placeholder="0.0045 / g" /></Field>
        <Field label="Supplier (saved on ingredient)" span={2}><input value={form.supplier} onChange={e => set("supplier", e.target.value)} style={S.input} placeholder="Bramble Berry, Bulk Apothecary…" /></Field>
        <Field label="CAS Number"><input value={form.cas_number} onChange={e => set("cas_number", e.target.value)} style={S.input} placeholder="8001-31-8" /></Field>
        <Field label="Max Usage %"><input type="number" step="0.1" value={form.max_usage_pct} onChange={e => set("max_usage_pct", e.target.value)} style={S.input} placeholder="3.0" /></Field>
        <Field label="SAP Value (NaOH)"><input type="number" step="0.001" value={form.sap_value_naoh} onChange={e => set("sap_value_naoh", e.target.value)} style={S.input} placeholder="0.190" /></Field>
        <Field label="SAP Value (KOH)"><input type="number" step="0.001" value={form.sap_value_koh} onChange={e => set("sap_value_koh", e.target.value)} style={S.input} placeholder="0.267" /></Field>
        <Field label="Notes" span={2}><textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} style={{ ...S.input, resize: "vertical" }} /></Field>
        <Field label="Safety Notes" span={2}><textarea value={form.safety_notes} onChange={e => set("safety_notes", e.target.value)} rows={2} style={{ ...S.input, resize: "vertical" }} placeholder="Handle with gloves, caustic, etc." /></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={saving || !form.name.trim()}>{saving ? "Saving…" : "Add Ingredient"}</Btn>
      </div>
    </Modal>
  );
}

function EditIngredientModal({ ingredient, onClose }) {
  const updateIngredient = useUpdateIngredient();
  const [form, setForm] = useState({ ...ingredient });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    try {
      await updateIngredient.mutateAsync({ id: ingredient.id, ...form });
      onClose();
    } catch {}
  };

  return (
    <Modal title={`Edit: ${ingredient.name}`} onClose={onClose} width={580}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Name" span={2}><input value={form.name || ""} onChange={e => set("name", e.target.value)} style={S.input} /></Field>
        <Field label="INCI Name"><input value={form.inci_name || ""} onChange={e => set("inci_name", e.target.value)} style={S.input} /></Field>
        <Field label="Category">
          <select value={form.category || "other"} onChange={e => set("category", e.target.value)} style={S.input}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Cost per unit ($)"><input type="number" step="0.0001" value={form.cost_per_unit || ""} onChange={e => set("cost_per_unit", e.target.value)} style={S.input} /></Field>
        <Field label="Supplier"><input value={form.supplier || ""} onChange={e => set("supplier", e.target.value)} style={S.input} /></Field>
        <Field label="SAP NaOH"><input type="number" step="0.001" value={form.sap_value_naoh || ""} onChange={e => set("sap_value_naoh", e.target.value)} style={S.input} /></Field>
        <Field label="SAP KOH"><input type="number" step="0.001" value={form.sap_value_koh || ""} onChange={e => set("sap_value_koh", e.target.value)} style={S.input} /></Field>
        <Field label="Notes" span={2}><textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} rows={2} style={{ ...S.input, resize: "vertical" }} /></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={updateIngredient.isPending}>{updateIngredient.isPending ? "Saving…" : "Save Changes"}</Btn>
      </div>
    </Modal>
  );
}

// ─── Receive Lot Modal ────────────────────────────────────────────────────────

function ReceiveLotModal({ ingredient, onClose }) {
  const addLot = useAddLot();
  const [form, setForm] = useState({ lot_number: "", supplier_lot: "", quantity_received: "", cost_per_unit: ingredient.cost_per_unit || "", purchased_at: new Date().toISOString().slice(0, 10), expiry_date: "", notes: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const totalCost = form.quantity_received && form.cost_per_unit
    ? (Number(form.quantity_received) * Number(form.cost_per_unit)).toFixed(2) : null;

  const handleSave = async () => {
    try {
      await addLot.mutateAsync({ ingredientId: ingredient.id, ...form, quantity_received: Number(form.quantity_received), cost_per_unit: form.cost_per_unit ? Number(form.cost_per_unit) : undefined });
      onClose();
    } catch {}
  };

  return (
    <Modal title={`Receive Lot: ${ingredient.name}`} onClose={onClose} width={480}>
      <div style={{ padding: "10px 14px", background: "#FFF0DC", borderRadius: 10, marginBottom: 20, fontSize: 13, color: "#3D2914" }}>
        Current stock: <strong>{Number(ingredient.stock_on_hand).toLocaleString()} {ingredient.unit}</strong>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Your Lot #"><input value={form.lot_number} onChange={e => set("lot_number", e.target.value)} style={S.input} placeholder="LOT-2025-001" /></Field>
        <Field label="Supplier Lot #"><input value={form.supplier_lot} onChange={e => set("supplier_lot", e.target.value)} style={S.input} /></Field>
        <Field label={`Quantity received (${ingredient.unit}) *`}>
          <input type="number" step="0.01" value={form.quantity_received} onChange={e => set("quantity_received", e.target.value)} style={{ ...S.input, fontFamily: "'JetBrains Mono'", fontSize: 16 }} placeholder="1000" autoFocus />
        </Field>
        <Field label="Cost per unit ($)"><input type="number" step="0.0001" value={form.cost_per_unit} onChange={e => set("cost_per_unit", e.target.value)} style={S.input} /></Field>
        <Field label="Purchase date"><input type="date" value={form.purchased_at} onChange={e => set("purchased_at", e.target.value)} style={S.input} /></Field>
        <Field label="Expiry date"><input type="date" value={form.expiry_date} onChange={e => set("expiry_date", e.target.value)} style={S.input} /></Field>
        <Field label="Notes" span={2}><textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} style={{ ...S.input, resize: "vertical" }} placeholder="COA#, batch source, etc." /></Field>
      </div>
      {totalCost && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "#EDF5E9", borderRadius: 10, fontSize: 13, color: "#4E7A3C" }}>
          Total purchase cost: <strong>${totalCost}</strong>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="sage" onClick={handleSave} disabled={addLot.isPending || !form.quantity_received}>
          {addLot.isPending ? "Saving…" : "✓ Receive Lot"}
        </Btn>
      </div>
    </Modal>
  );
}

// ─── Ledger Modal ─────────────────────────────────────────────────────────────

function LedgerModal({ ingredient, onClose }) {
  const { data: transactions = [], isLoading } = useInventoryTransactions(ingredient.id);
  const running = [...transactions].reverse().reduce((acc, t, i) => {
    const prev = i === 0 ? 0 : acc[i - 1].running;
    acc.push({ ...t, running: prev + Number(t.quantity_delta) });
    return acc;
  }, []).reverse();

  const REASON_COLORS = { purchase: "#4E7A3C", batch_use: "#B5603C", adjustment: "#4A7FA8", waste: "#C97B5A", return: "#6D9B58" };

  return (
    <Modal title={`Inventory Ledger: ${ingredient.name}`} onClose={onClose} width={660}>
      <div style={{ marginBottom: 16, padding: "10px 14px", background: "#FFF0DC", borderRadius: 10, display: "flex", justifyContent: "space-between", fontSize: 14 }}>
        <span>Current stock on hand</span>
        <strong style={{ fontFamily: "'JetBrains Mono'" }}>{Number(ingredient.stock_on_hand).toLocaleString()} {ingredient.unit}</strong>
      </div>
      {isLoading ? <div style={S.loading}>Loading…</div> : (
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#FFF0DC", position: "sticky", top: 0 }}>
                {["Date", "Reason", "Change", "Running Total", "Note"].map(h => <TH key={h} small>{h}</TH>)}
              </tr>
            </thead>
            <tbody>
              {running.map(t => (
                <tr key={t.id} style={{ borderTop: "1px solid #FFF0DC" }}>
                  <td style={{ padding: "8px 12px", color: "#C2410C" }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: (REASON_COLORS[t.reason] || "#5C3D1A") + "22", color: REASON_COLORS[t.reason] || "#5C3D1A" }}>
                      {t.reason}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", fontFamily: "'JetBrains Mono'", fontWeight: 700, color: Number(t.quantity_delta) >= 0 ? "#4E7A3C" : "#B5603C" }}>
                    {Number(t.quantity_delta) >= 0 ? "+" : ""}{Number(t.quantity_delta).toFixed(2)}
                  </td>
                  <td style={{ padding: "8px 12px", fontFamily: "'JetBrains Mono'", color: "#3D2914" }}>{Number(t.running).toFixed(2)} {ingredient.unit}</td>
                  <td style={{ padding: "8px 12px", color: "#5C3D1A", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.notes || "—"}</td>
                </tr>
              ))}
              {running.length === 0 && <tr><td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#5C3D1A" }}>No transactions yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function PageShell({ children }) {
  return <div style={{ padding: "32px 40px" }}>{children}</div>;
}

function CatBadge({ cat }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: CAT_BG[cat] || "#5C3D1A22", color: CAT_COLORS[cat] || "#C2410C" }}>
      {CATEGORIES.find(c => c.value === cat)?.label || cat}
    </span>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: "5px 12px", borderRadius: 16, border: "1px solid", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s", borderColor: active ? "#C2410C" : "#E8C48A", background: active ? "#C2410C" : "transparent", color: active ? "#FFFFFF" : "#C2410C" }}>
      {label}
    </button>
  );
}

function TH({ children, small }) {
  return <th style={{ padding: small ? "8px 12px" : "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#5C3D1A", fontFamily: "'DM Sans'", whiteSpace: "nowrap" }}>{children}</th>;
}

function Field({ label, children, span }) {
  return (
    <div style={{ gridColumn: span === 2 ? "1 / -1" : undefined, marginBottom: 2 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#C2410C", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children, width = 560 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,20,16,0.55)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#FFFCF7", borderRadius: 20, border: "1px solid #E8C48A", width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(26,20,16,0.28)", animation: "slideIn 0.2s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #E8C48A", position: "sticky", top: 0, background: "#FFFCF7", zIndex: 1 }}>
          <h3 style={{ fontSize: 18, fontFamily: "'Playfair Display'" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#5C3D1A", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", small, disabled }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, fontFamily: "'DM Sans'", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", border: "none", transition: "all 0.15s", fontSize: small ? 12 : 14, padding: small ? "5px 10px" : "9px 18px", opacity: disabled ? 0.6 : 1 };
  const variants = {
    primary: { background: "#EA580C", color: "#FFFFFF", boxShadow: "0 2px 12px rgba(234, 88, 12, 0.35)" },
    secondary: { background: "#FFF0DC", color: "#3D2914", border: "1px solid #E8C48A" },
    ghost: { background: "transparent", color: "#C2410C" },
    sage: { background: "#6D9B58", color: "#fff" },
    danger: { background: "#B5603C", color: "#fff" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

const S = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  pageTitle: { fontSize: 28, fontFamily: "'Playfair Display'" },
  pageSub: { fontSize: 14, color: "#5C3D1A", marginTop: 4 },
  loading: { padding: "40px", color: "#5C3D1A", fontSize: 14 },
  tableWrap: { background: "#FFFFFF", borderRadius: 16, border: "1px solid #E8C48A", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  input: { width: "100%", background: "#FFFFFF", border: "1px solid #E8C48A", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#1A1410", outline: "none", fontFamily: "inherit" },
};
