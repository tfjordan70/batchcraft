import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBatches, useCreateBatch, useRecipes, useBatchTraceability } from "../hooks/useApi";
import { exportBatches, exportBatchTraceability } from "../utils/exports";

const STATUS = {
  planned:     { label: "Planned",     bg: "#E8D5B4",   text: "#4A380C" },
  in_progress: { label: "In Progress", bg: "#6B9DC222", text: "#306080" },
  complete:    { label: "Complete",    bg: "#8FAF7E22", text: "#4E7A3C" },
  failed:      { label: "Failed",      bg: "#C97B5A22", text: "#8F4A2C" },
};

export default function BatchesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: batches = [], isLoading } = useBatches();
  const { data: recipes = [] } = useRecipes();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(searchParams.get("new") === "1");
  const [traceModal, setTraceModal] = useState(null);

  const filtered = useMemo(() => batches.filter(b =>
    (statusFilter === "all" || b.status === statusFilter) &&
    (!search || b.batch_number.toLowerCase().includes(search.toLowerCase()) ||
      (b.recipe_name || "").toLowerCase().includes(search.toLowerCase()))
  ), [batches, statusFilter, search]);

  const counts = useMemo(() => Object.fromEntries(
    ["planned", "in_progress", "complete", "failed"].map(s => [s, batches.filter(b => b.status === s).length])
  ), [batches]);

  if (isLoading) return <Shell><div style={S.loading}>Loading batches…</div></Shell>;

  return (
    <Shell>
      <div style={S.header}>
        <div>
          <h1 style={S.pageTitle}>Batches</h1>
          <p style={S.pageSub}>Production log & traceability</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="secondary" onClick={() => exportBatches(filtered)}>↓ Export CSV</Btn>
          <Btn onClick={() => setShowNew(true)}>+ Log Batch</Btn>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {Object.entries(STATUS).map(([key, cfg]) => (
          <div key={key} onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
            style={{ padding: "14px 18px", background: statusFilter === key ? cfg.bg : "rgba(255,255,255,0.8)", border: `1px solid ${statusFilter === key ? cfg.text + "40" : "#E8D5B4"}`, borderRadius: 12, cursor: "pointer", transition: "all 0.15s" }}>
            <div style={{ fontSize: 24, fontFamily: "'Playfair Display'", fontWeight: 700, color: cfg.text }}>{counts[key] || 0}</div>
            <div style={{ fontSize: 12, color: "#8B6914", marginTop: 2 }}>{cfg.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search batch # or recipe…" style={{ ...S.input, width: 280 }} />
        <div style={{ display: "flex", gap: 6 }}>
          <Chip label="All" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
          {Object.entries(STATUS).map(([k, v]) => (
            <Chip key={k} label={v.label} active={statusFilter === k} onClick={() => setStatusFilter(k)} />
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr style={{ background: "#F3EAD6" }}>
              {["Batch #", "Recipe", "Status", "Scale", "Yield", "Units", "Date", "Actions"].map(h => <TH key={h}>{h}</TH>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "50px", textAlign: "center", color: "#8B6914", fontSize: 14 }}>
                {batches.length === 0 ? "No batches yet — log your first production run" : "No batches match your filter"}
              </td></tr>
            )}
            {filtered.map(b => {
              const st = STATUS[b.status] || STATUS.planned;
              return (
                <tr key={b.id} style={{ borderTop: "1px solid #F3EAD6", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FDFBF7"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, fontWeight: 600, color: "#4A380C" }}>{b.batch_number}</span>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 14, fontWeight: 500, maxWidth: 200 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.recipe_name || <span style={{ color: "#8B6914", fontStyle: "italic" }}>No recipe</span>}</div>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: st.bg, color: st.text }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px", fontFamily: "'JetBrains Mono'", fontSize: 13, color: "#6B5010" }}>
                    {b.scale_factor ? `${Number(b.scale_factor).toFixed(2)}×` : "1×"}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#4A380C" }}>
                    {b.yield_actual ? <span style={{ fontFamily: "'JetBrains Mono'" }}>{Number(b.yield_actual).toFixed(0)}{b.yield_unit}</span> : <span style={{ color: "#8B691460" }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#4A380C" }}>
                    {b.unit_count ?? <span style={{ color: "#8B691460" }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#8B6914" }}>
                    {b.made_at ? new Date(b.made_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : <span style={{ color: "#8B691460" }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {b.status === "planned" && <Btn small variant="secondary" onClick={() => navigate(`/batches/${b.id}/complete`)}>Start</Btn>}
                      {b.status === "in_progress" && <Btn small onClick={() => navigate(`/batches/${b.id}/complete`)}>✓ Complete</Btn>}
                      {b.status === "complete" && <Btn small variant="secondary" onClick={() => setTraceModal(b)}>Trace</Btn>}
                      <Btn small variant="ghost" onClick={() => {}}>View</Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showNew && <NewBatchModal recipes={recipes} onClose={() => setShowNew(false)} onCreated={(batch) => { setShowNew(false); navigate(`/batches/${batch.id}/complete`); }} />}
      {traceModal && <TraceabilityModal batch={traceModal} onClose={() => setTraceModal(null)} />}
    </Shell>
  );
}

// ─── New Batch Modal ──────────────────────────────────────────────────────────

function NewBatchModal({ recipes, onClose, onCreated }) {
  const createBatch = useCreateBatch();
  const [recipeId, setRecipeId] = useState("");
  const [scaleFactor, setScaleFactor] = useState(1);
  const [batchNumber, setBatchNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("in_progress");

  const selectedRecipe = recipes.find(r => r.id === recipeId);

  const handleCreate = async () => {
    try {
      const batch = await createBatch.mutateAsync({
        recipe_id: recipeId || undefined,
        scale_factor: Number(scaleFactor),
        batch_number: batchNumber || undefined,
        status,
        notes,
      });
      onCreated(batch);
    } catch {}
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(46,34,8,0.4)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#FAF6ED", borderRadius: 20, border: "1px solid #E8D5B4", width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(46,34,8,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #E8D5B4" }}>
          <h3 style={{ fontSize: 18, fontFamily: "'Playfair Display'" }}>Start New Batch</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#8B6914" }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          <Field label="Recipe">
            <select value={recipeId} onChange={e => setRecipeId(e.target.value)} style={S.input}>
              <option value="">— Select a recipe —</option>
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>

          {selectedRecipe && (
            <div style={{ padding: "10px 14px", background: "#F3EAD6", borderRadius: 10, marginBottom: 14, fontSize: 13, color: "#4A380C" }}>
              Base yield: {selectedRecipe.yield_amount}{selectedRecipe.yield_unit} · {selectedRecipe.yield_count} units
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Scale Factor">
              <input type="number" step="0.5" min="0.25" value={scaleFactor} onChange={e => setScaleFactor(e.target.value)} style={{ ...S.input, fontFamily: "'JetBrains Mono'", fontSize: 16 }} />
            </Field>
            <Field label="Status">
              <select value={status} onChange={e => setStatus(e.target.value)} style={S.input}>
                <option value="planned">Planned</option>
                <option value="in_progress">Start Now</option>
              </select>
            </Field>
          </div>

          {selectedRecipe && (
            <div style={{ padding: "10px 14px", background: "#EDF5E9", borderRadius: 10, marginBottom: 14, fontSize: 13, color: "#4E7A3C" }}>
              Scaled yield: ~{(Number(selectedRecipe.yield_amount) * scaleFactor).toFixed(0)}{selectedRecipe.yield_unit} · ~{Math.round(Number(selectedRecipe.yield_count) * scaleFactor)} units
            </div>
          )}

          <Field label="Batch # (auto-generated if blank)">
            <input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="BC-20250425-0001" style={S.input} />
          </Field>
          <Field label="Notes">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...S.input, resize: "vertical" }} placeholder="Starting notes…" />
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn onClick={handleCreate} disabled={createBatch.isPending}>
              {createBatch.isPending ? "Creating…" : status === "in_progress" ? "🧪 Start Batch" : "📋 Plan Batch"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Traceability Modal ───────────────────────────────────────────────────────

function TraceabilityModal({ batch, onClose }) {
  const { data: trace, isLoading } = useBatchTraceability(batch.id);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(46,34,8,0.4)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#FAF6ED", borderRadius: 20, border: "1px solid #E8D5B4", width: "100%", maxWidth: 620, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(46,34,8,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #E8D5B4", position: "sticky", top: 0, background: "#FAF6ED" }}>
          <div>
            <h3 style={{ fontSize: 18, fontFamily: "'Playfair Display'" }}>Traceability Report</h3>
            <p style={{ fontSize: 12, color: "#8B6914", marginTop: 2, fontFamily: "'JetBrains Mono'" }}>{batch.batch_number}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {trace && <Btn small variant="secondary" onClick={() => exportBatchTraceability(batch, trace)}>↓ CSV</Btn>}
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#8B6914" }}>×</button>
          </div>
        </div>
        <div style={{ padding: 24 }}>
          {isLoading ? <div style={S.loading}>Loading traceability data…</div> : trace ? (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#8B6914", textTransform: "uppercase", marginBottom: 8 }}>Batch Info</div>
                <InfoRow label="Recipe" value={batch.recipe_name} />
                <InfoRow label="Made" value={batch.made_at ? new Date(batch.made_at).toLocaleString() : "—"} />
                <InfoRow label="Yield" value={batch.yield_actual ? `${batch.yield_actual} ${batch.yield_unit}` : "—"} />
                <InfoRow label="Units" value={batch.unit_count || "—"} />
              </div>

              {trace.recipe_snapshot && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#8B6914", textTransform: "uppercase", marginBottom: 8 }}>
                    Recipe Snapshot (v{trace.recipe_snapshot.version})
                  </div>
                  <div style={{ background: "#F3EAD6", borderRadius: 10, padding: 12, fontSize: 12, color: "#4A380C", fontFamily: "'JetBrains Mono'" }}>
                    Locked at time of batch — changes to the recipe after this date don't affect this record.
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#8B6914", textTransform: "uppercase", marginBottom: 8 }}>Ingredients Used</div>
                {(trace.ingredients_used || []).map((bi, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: i % 2 === 0 ? "#FDFBF7" : "transparent", borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{bi.ingredient_name}</div>
                      {bi.lot_number && <div style={{ fontSize: 11, color: "#8B6914", fontFamily: "'JetBrains Mono'", marginTop: 2 }}>Lot: {bi.lot_number}</div>}
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 600 }}>{Number(bi.amount_used).toFixed(2)} {bi.unit}</span>
                  </div>
                ))}
                {(trace.ingredients_used || []).length === 0 && <p style={{ color: "#8B6914", fontSize: 13 }}>No ingredient usage recorded for this batch.</p>}
              </div>
            </>
          ) : <p style={{ color: "#8B6914" }}>No traceability data found.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F3EAD6", fontSize: 14 }}>
      <span style={{ color: "#8B6914" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#6B5010", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function Shell({ children }) { return <div style={{ padding: "32px 40px" }}>{children}</div>; }

function TH({ children }) {
  return <th style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8B6914", fontFamily: "'DM Sans'", whiteSpace: "nowrap" }}>{children}</th>;
}

function Chip({ label, active, onClick }) {
  return <button onClick={onClick} style={{ padding: "5px 12px", borderRadius: 16, border: "1px solid", fontSize: 12, fontWeight: 500, cursor: "pointer", borderColor: active ? "#6B5010" : "#E8D5B4", background: active ? "#6B5010" : "transparent", color: active ? "#FDFBF7" : "#6B5010", fontFamily: "inherit" }}>{label}</button>;
}

function Btn({ children, onClick, variant = "primary", small, disabled }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 8, fontFamily: "'DM Sans'", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", border: "none", transition: "all 0.15s", fontSize: small ? 12 : 14, padding: small ? "6px 11px" : "9px 18px", opacity: disabled ? 0.6 : 1 };
  const variants = { primary: { background: "#6B5010", color: "#FDFBF7" }, secondary: { background: "#F3EAD6", color: "#4A380C", border: "1px solid #E8D5B4" }, ghost: { background: "transparent", color: "#6B5010" } };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

const S = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  pageTitle: { fontSize: 28, fontFamily: "'Playfair Display'" },
  pageSub: { fontSize: 14, color: "#8B6914", marginTop: 4 },
  loading: { padding: 40, color: "#8B6914", fontSize: 14 },
  tableWrap: { background: "rgba(255,255,255,0.85)", borderRadius: 16, border: "1px solid #E8D5B4", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  input: { width: "100%", background: "#FDFBF7", border: "1px solid #E8D5B4", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#2E2208", outline: "none", fontFamily: "inherit" },
};
