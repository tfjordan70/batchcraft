import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRecipe, useDeleteRecipe } from "../hooks/useApi";
import { emailRecipe, printRecipe, smsRecipe } from "../utils/recipeShare";
import {
  computeSoapBarQualities,
  computeSoapRecipeSolutionStats,
  SOAP_QUALITY_RANGES,
} from "../utils/soapQualities";
import toast from "react-hot-toast";

const UI = {
  page: "#FFFCF7",
  card: "#FFFFFF",
  border: "#E8C48A",
  ink: "#1A1410",
  muted: "#5C3D1A",
  accent: "#EA580C",
  accentDark: "#C2410C",
};

const CATEGORY_LABELS = {
  soap: "Soap",
  lotion: "Lotion / Cream",
  lip_balm: "Lip Balm",
  candle: "Candle",
  other: "Other",
};

function humanizePhase(phase) {
  if (!phase) return "Ingredients";
  return phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RecipeDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: recipe, isLoading, isError, refetch, isFetching } = useRecipe(id);
  const deleteRecipe = useDeleteRecipe();
  const ingList = recipe?.ingredients;
  const soapQualities = useMemo(
    () => (recipe?.category === "soap" && ingList?.length ? computeSoapBarQualities(ingList) : null),
    [recipe?.category, ingList]
  );
  const soapSolution = useMemo(
    () => (recipe?.category === "soap" && ingList?.length ? computeSoapRecipeSolutionStats(ingList) : null),
    [recipe?.category, ingList]
  );

  const handlePrint = () => {
    if (!recipe) return;
    const ok = printRecipe(recipe, { appName: "BatchCraft" });
    if (!ok) toast.error("Pop-up blocked — allow pop-ups to print this recipe.");
  };

  const handleEmail = () => {
    if (!recipe) return;
    emailRecipe(recipe);
  };

  const handleSms = () => {
    if (!recipe) return;
    smsRecipe(recipe);
  };

  const handleReloadRecipe = async () => {
    const result = await refetch();
    if (result.isError) {
      toast.error("Could not refresh recipe.");
      return;
    }
    toast.success("Recipe reloaded from the server.");
  };

  const handleDeleteRecipe = async () => {
    if (!recipe) return;
    const ok = window.confirm(
      `Delete “${recipe.name}”? This cannot be undone. Past batches stay in your history but will no longer be linked to this recipe.`
    );
    if (!ok) return;
    try {
      await deleteRecipe.mutateAsync(recipe.id);
      navigate("/recipes");
    } catch {
      /* toast from hook */
    }
  };

  if (isLoading) {
    return <div style={{ ...styles.shell, color: UI.muted }}>Loading recipe…</div>;
  }
  if (isError || !recipe) {
    return (
      <div style={styles.shell}>
        <p style={{ color: UI.muted }}>Recipe not found.</p>
        <button type="button" onClick={() => navigate("/recipes")} style={styles.btnSecondary}>
          Back to recipes
        </button>
      </div>
    );
  }

  const catLabel = CATEGORY_LABELS[recipe.category] || recipe.category || "—";
  const ings = recipe.ingredients || [];
  const total = ings.reduce((s, i) => s + Number(i.amount || 0), 0);
  const byPhase = new Map();
  for (const ri of ings) {
    const p = ri.phase || "_default";
    if (!byPhase.has(p)) byPhase.set(p, []);
    byPhase.get(p).push(ri);
  }

  return (
    <div style={styles.shell}>
      <div style={styles.topBar}>
        <button type="button" onClick={() => navigate("/recipes")} style={styles.linkBtn}>
          ← Recipes
        </button>
        <div style={styles.actions}>
          <button type="button" onClick={handlePrint} style={styles.btnGhost}>
            🖨 Print
          </button>
          <button type="button" onClick={handleEmail} style={styles.btnGhost}>
            ✉ Email
          </button>
          <button type="button" onClick={handleSms} style={styles.btnGhost}>
            💬 SMS
          </button>
          <button type="button" onClick={() => navigate(`/recipes/${id}/edit`)} style={styles.btnPrimary}>
            Edit
          </button>
          <button type="button" onClick={() => navigate(`/recipes/new?clone=${id}`)} style={styles.btnSecondary}>
            Clone
          </button>
          <button
            type="button"
            onClick={handleDeleteRecipe}
            disabled={deleteRecipe.isPending}
            style={{ ...styles.btnDanger, opacity: deleteRecipe.isPending ? 0.65 : 1 }}
          >
            {deleteRecipe.isPending ? "…" : "Delete"}
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.badgeRow}>
          <span style={styles.catBadge}>{catLabel}</span>
          <span style={styles.ver}>v{recipe.version}</span>
          {recipe.is_archived && <span style={styles.archived}>Archived</span>}
        </div>
        <h1 style={styles.title}>{recipe.name}</h1>

        <div style={styles.metaRow}>
          {recipe.yield_amount != null && (
            <span>
              ⚖️ Yield <strong>{recipe.yield_amount}{recipe.yield_unit}</strong>
              {recipe.yield_count != null && (
                <>
                  {" "}
                  · <strong>{recipe.yield_count}</strong> units
                </>
              )}
            </span>
          )}
        </div>

        {recipe.description && (
          <p style={styles.description}>{recipe.description}</p>
        )}

        <div style={styles.shareRow}>
          <span style={styles.shareLabel}>Share</span>
          <button type="button" onClick={handlePrint} style={styles.btnSecondary}>
            Print
          </button>
          <button type="button" onClick={handleEmail} style={styles.btnSecondary}>
            Email
          </button>
          <button type="button" onClick={handleSms} style={styles.btnSecondary}>
            SMS
          </button>
        </div>
      </div>

      <div style={{ ...styles.card, marginTop: 20 }}>
        <h2 style={styles.sectionTitle}>Ingredients</h2>
        {ings.length === 0 ? (
          <p style={{ color: UI.muted, fontSize: 14 }}>No ingredients in this recipe yet.</p>
        ) : (
          [...byPhase.entries()].map(([phase, list]) => (
            <div key={phase} style={{ marginBottom: 20 }}>
              <div style={styles.phaseTitle}>{phase === "_default" ? "Ingredients" : humanizePhase(phase)}</div>
              <ul style={styles.ingList}>
                {list.map((ri) => {
                  const pct = total ? ((Number(ri.amount) / total) * 100).toFixed(1) : null;
                  return (
                    <li key={ri.id} style={styles.ingItem}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{ri.ingredient_name}</span>
                        {ri.inci_name && (
                          <span style={{ fontSize: 12, color: UI.muted, marginLeft: 6 }}>{ri.inci_name}</span>
                        )}
                      </div>
                      <div style={styles.ingAmount}>
                        {pct != null && <span style={styles.pct}>{pct}%</span>}
                        <span style={styles.mono}>
                          {ri.amount} {ri.unit}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      {recipe.category === "soap" && (
        <div style={{ ...styles.card, marginTop: 20, borderColor: "#D4BC94", background: "#FFFBF5" }}>
          <div style={styles.qualitiesHeader}>
            <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>Soap bar qualities</h2>
            <button
              type="button"
              onClick={handleReloadRecipe}
              disabled={isFetching}
              title="Fetches the latest saved recipe from the server. Bar qualities always follow the ingredients shown on this page."
              style={{
                ...styles.btnSecondary,
                opacity: isFetching ? 0.65 : 1,
                cursor: isFetching ? "wait" : "pointer",
              }}
            >
              {isFetching ? "Reloading…" : "Reload recipe"}
            </button>
          </div>
          <p style={{ fontSize: 13, color: "#5C4A3D", marginTop: 12, marginBottom: 18, lineHeight: 1.5 }}>
            Same fatty-acid math as SoapCalc.net (MIT soap-calc oil list): blend lauric…linolenic by <strong>oil-phase</strong>{" "}
            weights (including legacy rows with no phase when other lines use <strong>oils</strong> / <strong>water</strong> /{" "}
            <strong>lye</strong> phases), then hardness, cleansing, conditioning, bubbly, and creamy use SoapCalc’s sums
            on that blend. Water and lye lines do not change bar numbers. Typical ranges under each bar. Use{" "}
            <strong>Reload recipe</strong> after edits elsewhere.
          </p>
          {soapSolution && (soapSolution.waterG > 0 || soapSolution.lyeG > 0) && (
            <div
              style={{
                marginBottom: 18,
                padding: "12px 14px",
                background: "rgba(124, 45, 18, 0.06)",
                borderRadius: 10,
                border: "1px solid #E8C48A",
                fontSize: 13,
                color: "#3D2914",
                lineHeight: 1.55,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6, color: "#7C2D12" }}>Lye solution (from recipe lines)</div>
              {soapSolution.waterPctOfOils != null && (
                <div>
                  Water as % of oil weight:{" "}
                  <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{soapSolution.waterPctOfOils.toFixed(1)}%</strong>{" "}
                  <span style={{ color: UI.muted }}>(water ÷ oils)</span>
                </div>
              )}
              {soapSolution.waterToLyeMassRatio != null && (
                <div style={{ marginTop: 4 }}>
                  Water : lye <span style={{ color: UI.muted }}>(mass)</span>:{" "}
                  <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {soapSolution.waterToLyeMassRatio.toFixed(2)} : 1
                  </strong>
                  <span style={{ color: UI.muted }}> — e.g. 1.75 : 1 means 1.75 parts water per 1 part lye by weight</span>
                </div>
              )}
              {soapSolution.waterPctOfOils == null && soapSolution.waterToLyeMassRatio == null && (
                <span style={{ color: UI.muted }}>Add <strong>water</strong> and <strong>lye</strong> phases (e.g. from Soap Calculator) to show ratios here.</span>
              )}
            </div>
          )}
          {!soapQualities ? (
            <p style={{ fontSize: 14, color: "#3D2914" }}>
              Add oils or fats in an <strong>oils</strong> (or <strong>oil_phase</strong> / <strong>fat</strong>) phase with recognizable names (e.g. coconut, olive, shea, tallow) to see quality estimates.
            </p>
          ) : (
            <>
              {Object.entries(SOAP_QUALITY_RANGES).map(([key, meta]) => (
                <SoapQualityBar key={key} label={meta.label} value={soapQualities[key]} min={meta.min} max={meta.max} hint={meta.desc} />
              ))}
              {soapQualities.totalOilWeight > soapQualities.matchedWeight && (
                <p style={{ fontSize: 12, color: "#7A5C45", marginTop: 14, lineHeight: 1.45 }}>
                  Some oil-phase ingredients were not matched to the SoapCalc-style oil list. Their weight still counts in the batch, but they are treated as 0% for every fatty acid, which lowers the quality numbers versus SoapCalc if those oils are in your calculator recipe.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {recipe.notes && (
        <div style={{ ...styles.card, marginTop: 20 }}>
          <h2 style={styles.sectionTitle}>Notes</h2>
          <p style={{ whiteSpace: "pre-wrap", fontSize: 14, color: UI.ink, lineHeight: 1.55 }}>{recipe.notes}</p>
        </div>
      )}

      <div style={styles.bottomActions}>
        <button type="button" onClick={() => navigate(`/batches?new=1&recipe=${id}`)} style={styles.btnPrimary}>
          🧪 Start batch
        </button>
      </div>
    </div>
  );
}

function SoapQualityBar({ label, value, min, max, hint }) {
  const inRange = value >= min && value <= max;
  const barW = Math.min(100, Math.max(0, value));
  return (
    <div style={{ marginBottom: 16 }} title={hint}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 14, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: "#1A1410" }}>{label}</span>
        <span
          style={{
            color: inRange ? "#15803D" : "#C2410C",
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {value} {inRange ? "✓" : "!"}
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: "#E8D8C4",
          borderRadius: 4,
          overflow: "hidden",
          border: "1px solid #D4BC94",
        }}
      >
        <div
          style={{
            width: `${barW}%`,
            height: "100%",
            background: inRange ? "#22C55E" : "#EA580C",
            borderRadius: 3,
            transition: "width 0.35s",
          }}
        />
      </div>
      <div style={{ fontSize: 12, color: "#6B5346", marginTop: 5, fontWeight: 500 }}>
        Typical range: {min}–{max}
      </div>
    </div>
  );
}

const styles = {
  shell: { padding: "32px 40px", maxWidth: 800, margin: "0 auto" },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: UI.accentDark,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    padding: 0,
  },
  actions: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  btnGhost: {
    background: "transparent",
    border: "none",
    color: UI.accentDark,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
    padding: "6px 10px",
    borderRadius: 8,
  },
  btnPrimary: {
    background: UI.accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "9px 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 2px 12px rgba(234, 88, 12, 0.4)",
  },
  btnDanger: {
    background: "transparent",
    color: "#B91C1C",
    border: "2px solid #FECACA",
    borderRadius: 8,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnSecondary: {
    background: "#FFF0DC",
    color: "#3D2914",
    border: "1px solid #E8C48A",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  card: {
    background: UI.card,
    borderRadius: 16,
    border: `1px solid ${UI.border}`,
    padding: 24,
    boxShadow: "0 2px 8px rgba(194, 65, 12, 0.08)",
  },
  badgeRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" },
  catBadge: {
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 999,
    background: "#FFF0DC",
    color: UI.accentDark,
  },
  ver: { fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: UI.muted },
  archived: { fontSize: 11, fontWeight: 700, color: "#B5603C" },
  title: { fontSize: 28, fontFamily: "'Playfair Display', serif", margin: 0, lineHeight: 1.25 },
  metaRow: { fontSize: 14, color: UI.muted, marginTop: 12 },
  description: { fontSize: 15, color: UI.muted, lineHeight: 1.55, marginTop: 16, marginBottom: 0 },
  shareRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
    paddingTop: 20,
    borderTop: "1px solid #FFF0DC",
    flexWrap: "wrap",
  },
  shareLabel: { fontSize: 12, fontWeight: 700, color: UI.muted, marginRight: 4 },
  sectionTitle: { fontSize: 18, fontFamily: "'Playfair Display', serif", margin: "0 0 16px" },
  qualitiesHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 0,
  },
  phaseTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    color: UI.muted,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: "1px solid #FFF0DC",
  },
  ingList: { listStyle: "none", margin: 0, padding: 0 },
  ingItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: "10px 0",
    borderBottom: "1px solid #FFF0DC",
    fontSize: 14,
  },
  ingAmount: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  pct: { fontSize: 12, color: UI.muted, width: 40, textAlign: "right" },
  mono: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 },
  bottomActions: { marginTop: 28 },
};
