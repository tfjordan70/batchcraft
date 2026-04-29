import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useBatches,
  useCreateBatch,
  useRecipes,
  useBatchTraceability,
  useBatch,
  useUpdateBatch,
  useMarkBatchCureComplete,
  useClearBatchCureComplete,
  useUploadBatchImage,
  useDeleteBatchImage,
} from "../hooks/useApi";
import api from "../utils/api";
import toast from "react-hot-toast";
import { exportBatches, exportBatchTraceability } from "../utils/exports";

const STATUS = {
  planned:     { label: "Planned",     bg: "#FDE68A",   text: "#92400E" },
  in_progress: { label: "In Progress", bg: "#7DD3FC55", text: "#0369A1" },
  complete:    { label: "Complete",    bg: "#86EFAC55", text: "#15803D" },
  failed:      { label: "Failed",      bg: "#FED7AA",   text: "#C2410C" },
};

function formatCureSummary(b) {
  if (b.cure_complete_at) return "Cure done";
  if (b.cure_ready_from && b.cure_ready_until) {
    const a = new Date(b.cure_ready_from);
    const z = new Date(b.cure_ready_until);
    return `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${z.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return "—";
}

function isoToDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function datetimeLocalToIso(s) {
  if (!s || !String(s).trim()) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function BatchesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: batches = [], isLoading } = useBatches();
  const { data: recipes = [] } = useRecipes();
  const requestedRecipeId = searchParams.get("recipe") || "";
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(searchParams.get("new") === "1");
  const [traceModal, setTraceModal] = useState(null);
  const [editBatchId, setEditBatchId] = useState(null);
  const markCure = useMarkBatchCureComplete();
  const clearCure = useClearBatchCureComplete();

  useEffect(() => {
    setShowNew(searchParams.get("new") === "1");
  }, [searchParams]);

  const filtered = useMemo(() => batches.filter(b =>
    (statusFilter === "all" || b.status === statusFilter) &&
    (!search || b.batch_number.toLowerCase().includes(search.toLowerCase()) ||
      (b.recipe_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (b.soap_name || "").toLowerCase().includes(search.toLowerCase()))
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
            style={{ padding: "14px 18px", background: statusFilter === key ? cfg.bg : "#FFFFFF", border: `1px solid ${statusFilter === key ? cfg.text + "40" : "#E8C48A"}`, borderRadius: 12, cursor: "pointer", transition: "all 0.15s" }}>
            <div style={{ fontSize: 24, fontFamily: "'Playfair Display'", fontWeight: 700, color: cfg.text }}>{counts[key] || 0}</div>
            <div style={{ fontSize: 12, color: "#5C3D1A", marginTop: 2 }}>{cfg.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search batch #, listing name, or recipe…" style={{ ...S.input, width: 320 }} />
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
            <tr style={{ background: "#FFF0DC" }}>
              {["Batch #", "Listing name", "Recipe", "Status", "Scale", "Yield", "Units", "Cure", "Made", "Actions"].map(h => <TH key={h}>{h}</TH>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ padding: "50px", textAlign: "center", color: "#5C3D1A", fontSize: 14 }}>
                {batches.length === 0 ? "No batches yet — log your first production run" : "No batches match your filter"}
              </td></tr>
            )}
            {filtered.map(b => {
              const st = STATUS[b.status] || STATUS.planned;
              return (
                <tr key={b.id} style={{ borderTop: "1px solid #FFF0DC", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FFFFFF"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, fontWeight: 600, color: "#3D2914" }}>{b.batch_number}</span>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, maxWidth: 140, color: "#3D2914" }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.soap_name || ""}>
                      {b.soap_name || <span style={{ color: "#5C3D1A60" }}>—</span>}
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 14, fontWeight: 500, maxWidth: 200 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.recipe_name || <span style={{ color: "#5C3D1A", fontStyle: "italic" }}>No recipe</span>}</div>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: st.bg, color: st.text }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px", fontFamily: "'JetBrains Mono'", fontSize: 13, color: "#C2410C" }}>
                    {b.scale_factor ? `${Number(b.scale_factor).toFixed(2)}×` : "1×"}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#3D2914" }}>
                    {b.yield_actual ? <span style={{ fontFamily: "'JetBrains Mono'" }}>{Number(b.yield_actual).toFixed(0)}{b.yield_unit}</span> : <span style={{ color: "#5C3D1A60" }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#3D2914" }}>
                    {b.unit_count ?? <span style={{ color: "#5C3D1A60" }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#5C3D1A", maxWidth: 130 }} title={b.cure_ready_from && b.cure_ready_until ? `${b.cure_ready_from} → ${b.cure_ready_until}` : ""}>
                    {formatCureSummary(b)}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#5C3D1A" }}>
                    {b.made_at ? new Date(b.made_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : <span style={{ color: "#5C3D1A60" }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {b.status === "planned" && <Btn small variant="secondary" onClick={() => navigate(`/batches/${b.id}/complete`)}>Start</Btn>}
                      {b.status === "in_progress" && <Btn small onClick={() => navigate(`/batches/${b.id}/complete`)}>✓ Complete</Btn>}
                      {b.status === "complete" && <Btn small variant="secondary" onClick={() => setTraceModal(b)}>Trace</Btn>}
                      {b.status === "complete" && !b.cure_complete_at && (
                        <Btn small onClick={() => markCure.mutate(b.id)} disabled={markCure.isPending}>Cure done</Btn>
                      )}
                      {b.status === "complete" && b.cure_complete_at && (
                        <Btn small variant="secondary" onClick={() => clearCure.mutate(b.id)} disabled={clearCure.isPending}>Reopen cure</Btn>
                      )}
                      <Btn small variant="ghost" onClick={() => setEditBatchId(b.id)}>Edit</Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showNew && (
        <NewBatchModal
          recipes={recipes}
          initialRecipeId={requestedRecipeId}
          onClose={() => setShowNew(false)}
          onCreated={(batch) => { setShowNew(false); navigate(`/batches/${batch.id}/complete`); }}
        />
      )}
      {editBatchId && <EditBatchModal batchId={editBatchId} recipes={recipes} onClose={() => setEditBatchId(null)} />}
      {traceModal && <TraceabilityModal batch={traceModal} onClose={() => setTraceModal(null)} />}
    </Shell>
  );
}

// ─── New Batch Modal ──────────────────────────────────────────────────────────

function NewBatchModal({ recipes, initialRecipeId, onClose, onCreated }) {
  const createBatch = useCreateBatch();
  const [recipeId, setRecipeId] = useState("");
  const [scaleFactor, setScaleFactor] = useState(1);
  const [batchNumber, setBatchNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("in_progress");

  useEffect(() => {
    if (!initialRecipeId) return;
    if (recipes.some((r) => r.id === initialRecipeId)) {
      setRecipeId(initialRecipeId);
    }
  }, [initialRecipeId, recipes]);

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
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,20,16,0.55)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#FFFCF7", borderRadius: 20, border: "1px solid #E8C48A", width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(26,20,16,0.28)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #E8C48A" }}>
          <h3 style={{ fontSize: 18, fontFamily: "'Playfair Display'" }}>Start New Batch</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#5C3D1A" }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          <Field label="Recipe">
            <select value={recipeId} onChange={e => setRecipeId(e.target.value)} style={S.input}>
              <option value="">— Select a recipe —</option>
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>

          {selectedRecipe && (
            <div style={{ padding: "10px 14px", background: "#FFF0DC", borderRadius: 10, marginBottom: 14, fontSize: 13, color: "#3D2914" }}>
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

// ─── Batch images (JWT via axios → blob URL) ─────────────────────────────────

function AuthenticatedBatchImage({ batchId, imageId, alt }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    setUrl(null);
    const ctrl = { cancelled: false };
    let objectUrl;
    (async () => {
      try {
        const r = await api.get(`/batches/${batchId}/images/${imageId}/file`, { responseType: "blob" });
        if (ctrl.cancelled) return;
        objectUrl = URL.createObjectURL(r.data);
        if (ctrl.cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setUrl(objectUrl);
      } catch {
        if (!ctrl.cancelled) setUrl(null);
      }
    })();
    return () => {
      ctrl.cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [batchId, imageId]);
  if (!url) {
    return <div style={{ width: 88, height: 88, background: "#FFF0DC", borderRadius: 10, flexShrink: 0 }} />;
  }
  return <img src={url} alt={alt || ""} style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 10, border: "1px solid #E8C48A", flexShrink: 0 }} />;
}

function BatchImagesBlock({ batchId, images }) {
  const uploadImg = useUploadBatchImage();
  const delImg = useDeleteBatchImage();
  const [imgCaption, setImgCaption] = useState("");

  const onPickFiles = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    try {
      for (const file of files) {
        await uploadImg.mutateAsync({ batchId, file, caption: imgCaption.trim(), notify: false });
      }
      toast.success(files.length === 1 ? "Image added" : `${files.length} images added`);
      setImgCaption("");
    } catch {
      /* toast from hook */
    }
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "#C2410C", marginBottom: 6 }}>Photos (bar, packaging, …)</div>
      <p style={{ fontSize: 12, color: "#5C3D1A", marginBottom: 10 }}>JPEG / PNG / WebP / GIF, up to 8MB each.</p>
      <Field label="Caption for next upload(s) (optional)">
        <input value={imgCaption} onChange={(e) => setImgCaption(e.target.value)} placeholder="e.g. Cut bars, Shrink band" style={S.input} />
      </Field>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" multiple onChange={onPickFiles} disabled={uploadImg.isPending} style={{ fontSize: 13, marginBottom: 12 }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {(images || []).map((im) => (
          <div key={im.id} style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 100 }}>
            <AuthenticatedBatchImage batchId={batchId} imageId={im.id} alt={im.caption} />
            {im.caption ? <span style={{ fontSize: 11, color: "#5C3D1A", lineHeight: 1.3 }}>{im.caption}</span> : null}
            <button type="button" onClick={() => delImg.mutate({ batchId, imageId: im.id })} disabled={delImg.isPending} style={{ fontSize: 11, color: "#C2410C", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Edit Batch Modal ─────────────────────────────────────────────────────────

function EditBatchModal({ batchId, recipes, onClose }) {
  const { data: detail, isLoading } = useBatch(batchId);
  const updateBatch = useUpdateBatch();
  const [recipeId, setRecipeId] = useState("");
  const [scaleFactor, setScaleFactor] = useState(1);
  const [batchNumber, setBatchNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("planned");
  const [yieldActual, setYieldActual] = useState("");
  const [yieldUnit, setYieldUnit] = useState("g");
  const [unitCount, setUnitCount] = useState("");
  const [soapName, setSoapName] = useState("");
  const [cureStartedAt, setCureStartedAt] = useState("");
  const [cureWeeksMin, setCureWeeksMin] = useState("");
  const [cureWeeksMax, setCureWeeksMax] = useState("");

  useEffect(() => {
    if (!detail) return;
    setRecipeId(detail.recipe_id || "");
    setScaleFactor(detail.scale_factor ?? 1);
    setBatchNumber(detail.batch_number || "");
    setNotes(detail.notes || "");
    setStatus(detail.status || "planned");
    setYieldActual(detail.yield_actual != null ? String(detail.yield_actual) : "");
    setYieldUnit(detail.yield_unit || "g");
    setUnitCount(detail.unit_count != null ? String(detail.unit_count) : "");
    setSoapName(detail.soap_name || "");
    setCureStartedAt(isoToDatetimeLocalValue(detail.cure_started_at));
    setCureWeeksMin(detail.cure_weeks_min != null ? String(detail.cure_weeks_min) : "");
    setCureWeeksMax(detail.cure_weeks_max != null ? String(detail.cure_weeks_max) : "");
  }, [detail?.id]);

  const isComplete = detail?.status === "complete";
  const selectedRecipe = recipes.find((r) => r.id === recipeId);

  const parseOptionalWeek = (s) => {
    const t = String(s || "").trim();
    if (!t) return null;
    const n = Number(t);
    if (Number.isNaN(n) || n < 0) return NaN;
    return n;
  };

  const handleSave = async () => {
    if (!detail) return;
    const wmin = parseOptionalWeek(cureWeeksMin);
    const wmax = parseOptionalWeek(cureWeeksMax);
    if (Number.isNaN(wmin) || Number.isNaN(wmax)) {
      toast.error("Cure weeks must be numbers (e.g. 4 and 6), or left blank.");
      return;
    }
    const y = yieldActual.trim() === "" ? null : Number(yieldActual);
    const u = unitCount.trim() === "" ? null : parseInt(unitCount, 10);
    if (yieldActual.trim() !== "" && Number.isNaN(y)) return;
    if (unitCount.trim() !== "" && Number.isNaN(u)) return;

    const meta = {
      soap_name: soapName.trim() || null,
      cure_started_at: datetimeLocalToIso(cureStartedAt),
      cure_weeks_min: wmin,
      cure_weeks_max: wmax,
      notes: notes || null,
      yield_actual: y,
      yield_unit: yieldUnit || "g",
      unit_count: u,
    };

    try {
      if (isComplete) {
        await updateBatch.mutateAsync({ id: batchId, ...meta });
      } else {
        if (!batchNumber.trim()) return;
        await updateBatch.mutateAsync({
          id: batchId,
          ...meta,
          batch_number: batchNumber.trim(),
          recipe_id: recipeId || null,
          scale_factor: Number(scaleFactor),
          status,
        });
      }
      onClose();
    } catch {
      /* toast from hook */
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,20,16,0.55)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#FFFCF7", borderRadius: 20, border: "1px solid #E8C48A", width: "100%", maxWidth: 720, maxHeight: "min(92vh, 900px)", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(26,20,16,0.28)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #E8C48A", flexShrink: 0 }}>
          <h3 style={{ fontSize: 18, fontFamily: "'Playfair Display'" }}>{isComplete ? "Edit batch (completed)" : "Edit batch"}</h3>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#5C3D1A" }}>×</button>
        </div>
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          {isLoading || !detail ? (
            <div style={S.loading}>Loading…</div>
          ) : (
            <>
              {isComplete && (
                <p style={{ fontSize: 13, color: "#5C3D1A", marginBottom: 16, lineHeight: 1.5 }}>
                  Recipe, batch number, and scale stay locked. You can update listing name, cure schedule, photos, notes, and yield.
                </p>
              )}
              <Field label="Soap / listing name (what you sell it as)">
                <input value={soapName} onChange={(e) => setSoapName(e.target.value)} placeholder="e.g. Cedar & Charcoal" style={S.input} />
              </Field>
              <Field label="Cure start (when bars went on the rack)">
                <input type="datetime-local" value={cureStartedAt} onChange={(e) => setCureStartedAt(e.target.value)} style={S.input} />
                <p style={{ fontSize: 11, color: "#5C3D1A", marginTop: 6 }}>When you complete production, this defaults to the completion time until you change it.</p>
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Cure window — min (weeks)">
                  <input type="number" step="0.5" min="0" value={cureWeeksMin} onChange={(e) => setCureWeeksMin(e.target.value)} placeholder="4" style={{ ...S.input, fontFamily: "'JetBrains Mono'" }} />
                </Field>
                <Field label="Cure window — max (weeks)">
                  <input type="number" step="0.5" min="0" value={cureWeeksMax} onChange={(e) => setCureWeeksMax(e.target.value)} placeholder="6" style={{ ...S.input, fontFamily: "'JetBrains Mono'" }} />
                </Field>
              </div>
              {detail.cure_ready_from && detail.cure_ready_until && (
                <div style={{ padding: "10px 14px", background: "#EDF5E9", borderRadius: 10, marginBottom: 14, fontSize: 13, color: "#365314" }}>
                  Estimated ready window:{" "}
                  <strong>{new Date(detail.cure_ready_from).toLocaleString()}</strong>
                  {" "}–{" "}
                  <strong>{new Date(detail.cure_ready_until).toLocaleString()}</strong>
                  {" "}(from saved cure start + weeks; save again after edits to refresh.)
                </div>
              )}
              {!isComplete && (
                <>
                  <Field label="Recipe">
                    <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)} style={S.input}>
                      <option value="">— No recipe —</option>
                      {recipes.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </Field>
                  {selectedRecipe && (
                    <div style={{ padding: "10px 14px", background: "#FFF0DC", borderRadius: 10, marginBottom: 14, fontSize: 13, color: "#3D2914" }}>
                      Base yield: {selectedRecipe.yield_amount}{selectedRecipe.yield_unit} · {selectedRecipe.yield_count} units
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Scale factor">
                      <input type="number" step="0.5" min="0.25" value={scaleFactor} onChange={(e) => setScaleFactor(e.target.value)} style={{ ...S.input, fontFamily: "'JetBrains Mono'", fontSize: 16 }} />
                    </Field>
                    <Field label="Status">
                      <select value={status} onChange={(e) => setStatus(e.target.value)} style={S.input}>
                        <option value="planned">Planned</option>
                        <option value="in_progress">In progress</option>
                        <option value="failed">Failed</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Batch #">
                    <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} style={S.input} />
                  </Field>
                </>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Yield (actual)">
                  <input value={yieldActual} onChange={(e) => setYieldActual(e.target.value)} placeholder="optional" style={{ ...S.input, fontFamily: "'JetBrains Mono'" }} />
                </Field>
                <Field label="Yield unit">
                  <input value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value)} style={S.input} />
                </Field>
              </div>
              <Field label="Unit count">
                <input value={unitCount} onChange={(e) => setUnitCount(e.target.value)} placeholder="optional" style={{ ...S.input, fontFamily: "'JetBrains Mono'" }} />
              </Field>
              <Field label="Notes">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...S.input, resize: "vertical" }} />
              </Field>
              <BatchImagesBlock batchId={batchId} images={detail.images || []} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
                <Btn type="button" onClick={handleSave} disabled={updateBatch.isPending}>
                  {updateBatch.isPending ? "Saving…" : "Save"}
                </Btn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Traceability Modal ───────────────────────────────────────────────────────

function TraceabilityModal({ batch, onClose }) {
  const { data: trace, isLoading } = useBatchTraceability(batch.id);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,20,16,0.55)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#FFFCF7", borderRadius: 20, border: "1px solid #E8C48A", width: "100%", maxWidth: 620, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(26,20,16,0.28)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #E8C48A", position: "sticky", top: 0, background: "#FFFCF7" }}>
          <div>
            <h3 style={{ fontSize: 18, fontFamily: "'Playfair Display'" }}>Traceability Report</h3>
            <p style={{ fontSize: 12, color: "#5C3D1A", marginTop: 2, fontFamily: "'JetBrains Mono'" }}>{batch.batch_number}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {trace && <Btn small variant="secondary" onClick={() => exportBatchTraceability(batch, trace)}>↓ CSV</Btn>}
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#5C3D1A" }}>×</button>
          </div>
        </div>
        <div style={{ padding: 24 }}>
          {isLoading ? <div style={S.loading}>Loading traceability data…</div> : trace ? (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#5C3D1A", textTransform: "uppercase", marginBottom: 8 }}>Batch Info</div>
                <InfoRow label="Recipe" value={batch.recipe_name} />
                {batch.soap_name ? <InfoRow label="Listing name" value={batch.soap_name} /> : null}
                <InfoRow label="Made" value={batch.made_at ? new Date(batch.made_at).toLocaleString() : "—"} />
                <InfoRow label="Yield" value={batch.yield_actual ? `${batch.yield_actual} ${batch.yield_unit}` : "—"} />
                <InfoRow label="Units" value={batch.unit_count || "—"} />
              </div>

              {trace.recipe_snapshot && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#5C3D1A", textTransform: "uppercase", marginBottom: 8 }}>
                    Recipe Snapshot (v{trace.recipe_snapshot.version})
                  </div>
                  <div style={{ background: "#FFF0DC", borderRadius: 10, padding: 12, fontSize: 12, color: "#3D2914", fontFamily: "'JetBrains Mono'" }}>
                    Locked at time of batch — changes to the recipe after this date don't affect this record.
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#5C3D1A", textTransform: "uppercase", marginBottom: 8 }}>Ingredients Used</div>
                {(trace.ingredients_used || []).map((bi, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: i % 2 === 0 ? "#FFFFFF" : "transparent", borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{bi.ingredient_name}</div>
                      {bi.lot_number && <div style={{ fontSize: 11, color: "#5C3D1A", fontFamily: "'JetBrains Mono'", marginTop: 2 }}>Lot: {bi.lot_number}</div>}
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 600 }}>{Number(bi.amount_used).toFixed(2)} {bi.unit}</span>
                  </div>
                ))}
                {(trace.ingredients_used || []).length === 0 && <p style={{ color: "#5C3D1A", fontSize: 13 }}>No ingredient usage recorded for this batch.</p>}
              </div>
            </>
          ) : <p style={{ color: "#5C3D1A" }}>No traceability data found.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #FFF0DC", fontSize: 14 }}>
      <span style={{ color: "#5C3D1A" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#C2410C", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function Shell({ children }) { return <div style={{ padding: "32px 40px" }}>{children}</div>; }

function TH({ children }) {
  return <th style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#5C3D1A", fontFamily: "'DM Sans'", whiteSpace: "nowrap" }}>{children}</th>;
}

function Chip({ label, active, onClick }) {
  return <button onClick={onClick} style={{ padding: "5px 12px", borderRadius: 16, border: "1px solid", fontSize: 12, fontWeight: 500, cursor: "pointer", borderColor: active ? "#C2410C" : "#E8C48A", background: active ? "#C2410C" : "transparent", color: active ? "#FFFFFF" : "#C2410C", fontFamily: "inherit" }}>{label}</button>;
}

function Btn({ children, onClick, variant = "primary", small, disabled }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 8, fontFamily: "'DM Sans'", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", border: "none", transition: "all 0.15s", fontSize: small ? 12 : 14, padding: small ? "6px 11px" : "9px 18px", opacity: disabled ? 0.6 : 1 };
  const variants = { primary: { background: "#EA580C", color: "#FFFFFF", boxShadow: "0 2px 12px rgba(234, 88, 12, 0.35)" }, secondary: { background: "#FFF0DC", color: "#3D2914", border: "2px solid #E8C48A" }, ghost: { background: "transparent", color: "#C2410C", fontWeight: 700 } };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

const S = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  pageTitle: { fontSize: 28, fontFamily: "'Playfair Display'" },
  pageSub: { fontSize: 14, color: "#5C3D1A", marginTop: 4 },
  loading: { padding: 40, color: "#5C3D1A", fontSize: 14 },
  tableWrap: { background: "#FFFFFF", borderRadius: 16, border: "1px solid #E8C48A", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  input: { width: "100%", background: "#FFFFFF", border: "1px solid #E8C48A", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#1A1410", outline: "none", fontFamily: "inherit" },
};
