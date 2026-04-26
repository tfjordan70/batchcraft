import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRecipe } from "../hooks/useApi";
import { emailRecipe, printRecipe, smsRecipe } from "../utils/recipeShare";
import { computeSoapBarQualities, SOAP_QUALITY_RANGES } from "../utils/soapQualities";
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
  const { data: recipe, isLoading, isError } = useRecipe(id);
  const ingList = recipe?.ingredients;
  const soapQualities = useMemo(
    () => (recipe?.category === "soap" && ingList?.length ? computeSoapBarQualities(ingList) : null),
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
        <div style={{ ...styles.card, marginTop: 20, background: "#1A1410", borderColor: "#3D2914" }}>
          <h2 style={{ ...styles.sectionTitle, color: "#FFFCF7" }}>Soap bar qualities</h2>
          <p style={{ fontSize: 12, color: "rgba(255,252,247,0.55)", marginTop: -8, marginBottom: 16, lineHeight: 1.45 }}>
            Estimated from oil names and amounts (oils phase only when present). Typical target ranges are shown under each bar.
          </p>
          {!soapQualities ? (
            <p style={{ fontSize: 14, color: "rgba(255,252,247,0.65)" }}>
              Add recognizable oils (e.g. coconut, olive, shea) in the <strong style={{ color: "#FFFCF7" }}>oils</strong> phase to see quality estimates.
            </p>
          ) : (
            <>
              {Object.entries(SOAP_QUALITY_RANGES).map(([key, meta]) => (
                <SoapQualityBarLight key={key} label={meta.label} value={soapQualities[key]} min={meta.min} max={meta.max} hint={meta.desc} />
              ))}
              {soapQualities.totalOilWeight > soapQualities.matchedWeight && (
                <p style={{ fontSize: 11, color: "rgba(255,252,247,0.45)", marginTop: 12 }}>
                  Some oil-phase ingredients were not matched to the built-in oil library; those grams are excluded from the estimate.
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
        <button type="button" onClick={() => navigate(`/batches/new?recipe=${id}`)} style={styles.btnPrimary}>
          🧪 Start batch
        </button>
      </div>
    </div>
  );
}

function SoapQualityBarLight({ label, value, min, max, hint }) {
  const inRange = value >= min && value <= max;
  const barW = Math.min(100, Math.max(0, value));
  return (
    <div style={{ marginBottom: 14 }} title={hint}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,252,247,0.65)", marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: inRange ? "#8FAF7E" : "#FDBA74", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
          {value} {inRange ? "✓" : "!"}
        </span>
      </div>
      <div style={{ height: 6, background: "rgba(255,252,247,0.12)", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            width: `${barW}%`,
            height: "100%",
            background: inRange ? "#6D9B58" : "#C97B5A",
            borderRadius: 3,
            transition: "width 0.35s",
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,252,247,0.35)", marginTop: 3 }}>typical range: {min}–{max}</div>
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
