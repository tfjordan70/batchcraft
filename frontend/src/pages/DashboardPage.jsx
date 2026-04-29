import { Link, useNavigate } from "react-router-dom";
import { useDashboard } from "../hooks/useApi";

const STATUS = {
  planned: { label: "Planned", bg: "#FDE68A", text: "#92400E" },
  in_progress: { label: "In progress", bg: "#7DD3FC55", text: "#0369A1" },
  complete: { label: "Complete", bg: "#86EFAC55", text: "#15803D" },
  failed: { label: "Failed", bg: "#FED7AA", text: "#C2410C" },
};

function formatShortDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isFetching } = useDashboard();

  if (isLoading) {
    return (
      <Shell>
        <div style={S.loading}>Loading your workshop…</div>
      </Shell>
    );
  }

  if (isError || !data) {
    return (
      <Shell>
        <div style={S.errorBox}>
          <p style={{ margin: 0, fontWeight: 600 }}>Could not load the dashboard.</p>
          <button type="button" onClick={() => refetch()} style={S.retryBtn}>Try again</button>
        </div>
      </Shell>
    );
  }

  const {
    recipe_count = 0,
    batch_count = 0,
    ingredient_count = 0,
    batches_by_status = {},
    open_batch_count = 0,
    batches_completed_week = 0,
    recent_batches = [],
    low_stock_alerts = [],
    low_stock_threshold = 50,
  } = data;

  const hasWork = recipe_count > 0 || batch_count > 0;

  return (
    <Shell>
      <div style={S.header}>
        <div>
          <h1 style={S.pageTitle}>Dashboard</h1>
          <p style={S.pageSub}>
            {isFetching && !isLoading ? "Refreshing… · " : null}
            At-a-glance stats, recent batches, and inventory that needs attention.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Btn variant="secondary" onClick={() => refetch()} small>Refresh</Btn>
          <Btn variant="secondary" onClick={() => navigate("/batches?new=1")}>+ Log batch</Btn>
          <Btn onClick={() => navigate("/recipes/new")}>+ New recipe</Btn>
        </div>
      </div>

      {/* KPI row */}
      <div style={S.kpiGrid}>
        <KpiCard
          label="Active recipes"
          value={recipe_count}
          hint="Not archived"
          onClick={() => navigate("/recipes")}
        />
        <KpiCard
          label="Total batches"
          value={batch_count}
          hint="All time"
          onClick={() => navigate("/batches")}
        />
        <KpiCard
          label="Open batches"
          value={open_batch_count}
          hint="Planned + in progress"
          accent={open_batch_count > 0 ? "#0369A1" : undefined}
          onClick={() => navigate("/batches")}
        />
        <KpiCard
          label="Completed (7 days)"
          value={batches_completed_week}
          hint="Marked complete"
          accent="#15803D"
          onClick={() => navigate("/batches")}
        />
      </div>

      {/* Status strip */}
      <div style={S.statusStrip}>
        <span style={S.statusStripLabel}>Batch pipeline</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(STATUS).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => navigate("/batches")}
              style={{
                padding: "6px 12px",
                borderRadius: 10,
                border: `1px solid ${cfg.text}33`,
                background: cfg.bg,
                color: cfg.text,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {cfg.label}: <strong>{batches_by_status[key] ?? 0}</strong>
            </button>
          ))}
        </div>
      </div>

      {!hasWork && (
        <div style={S.emptyHero}>
          <div style={{ fontSize: 20, fontFamily: "'Playfair Display'", fontWeight: 700, color: "#1A1410", marginBottom: 8 }}>
            Welcome to your workshop
          </div>
          <p style={{ margin: 0, color: "#5C3D1A", fontSize: 15, lineHeight: 1.5, maxWidth: 520 }}>
            Add a few <Link to="/ingredients" style={S.inlineLink}>ingredients</Link>, create your first{" "}
            <Link to="/recipes/new" style={S.inlineLink}>recipe</Link>, then{" "}
            <Link to="/batches?new=1" style={S.inlineLink}>log a batch</Link> to see activity here.
          </p>
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn onClick={() => navigate("/ingredients")}>Ingredients</Btn>
            <Btn variant="secondary" onClick={() => navigate("/calculators/soap")}>Soap calculator</Btn>
          </div>
        </div>
      )}

      <div style={S.twoCol}>
        {/* Recent batches */}
        <section style={S.card}>
          <div style={S.cardHead}>
            <h2 style={S.cardTitle}>Recent batches</h2>
            <Link to="/batches" style={S.cardLink}>View all →</Link>
          </div>
          {recent_batches.length === 0 ? (
            <p style={S.muted}>No batches yet. Log one from the Batches page.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr style={{ background: "#FFF0DC" }}>
                    <th style={S.th}>Batch</th>
                    <th style={S.th}>Recipe</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_batches.map((b) => {
                    const st = STATUS[b.status] || STATUS.planned;
                    return (
                      <tr
                        key={b.id}
                        onClick={() => navigate("/batches")}
                        style={{ cursor: "pointer", borderBottom: "1px solid #FFF0DC" }}
                      >
                        <td style={S.td}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{b.batch_number}</span>
                          {b.soap_name && (
                            <div style={{ fontSize: 12, color: "#5C3D1A", marginTop: 2 }}>{b.soap_name}</div>
                          )}
                        </td>
                        <td style={S.td}>{b.recipe_name || "—"}</td>
                        <td style={S.td}>
                          <span style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            background: st.bg,
                            color: st.text,
                          }}>{st.label}</span>
                        </td>
                        <td style={{ ...S.td, color: "#5C3D1A", fontSize: 13 }}>{formatShortDate(b.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Low stock */}
        <section style={S.card}>
          <div style={S.cardHead}>
            <h2 style={S.cardTitle}>Low stock</h2>
            <span style={S.badge}>{low_stock_alerts.length}</span>
          </div>
          <p style={{ ...S.muted, marginTop: 0, marginBottom: 14 }}>
            Active ingredients below <strong>{low_stock_threshold}</strong> {ingredient_count ? `units (${ingredient_count} SKUs tracked)` : "units"}.
          </p>
          {low_stock_alerts.length === 0 ? (
            <p style={S.muted}>Nothing flagged. You are in good shape.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {low_stock_alerts.map(({ ingredient, stock }) => (
                <li
                  key={ingredient.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: "1px solid #FFF0DC",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "#1A1410" }}>{ingredient.name}</div>
                    {ingredient.category && (
                      <div style={{ fontSize: 12, color: "#5C3D1A", marginTop: 2 }}>{ingredient.category}</div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#C2410C" }}>
                      {Number(stock).toFixed(1)} <span style={{ fontWeight: 600, color: "#5C3D1A" }}>{ingredient.unit || "g"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/ingredients")}
                      style={S.textBtn}
                    >
                      Receive stock
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: 14 }}>
            <Link to="/ingredients" style={S.cardLink}>Manage ingredients →</Link>
          </div>
        </section>
      </div>
    </Shell>
  );
}

function KpiCard({ label, value, hint, accent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "18px 20px",
        background: "#FFFFFF",
        border: "1px solid #E8C48A",
        borderRadius: 14,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "box-shadow 0.15s, border-color 0.15s",
        boxShadow: "0 2px 8px rgba(26, 20, 16, 0.04)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#5C3D1A" }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontFamily: "'Playfair Display'", fontWeight: 700, color: accent || "#1A1410", marginTop: 6, lineHeight: 1 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: "#8B6914", marginTop: 6 }}>{hint}</div>}
    </button>
  );
}

function Shell({ children }) {
  return <div style={{ padding: "32px 40px", maxWidth: 1200 }}>{children}</div>;
}

function Btn({ children, onClick, variant = "primary", small }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    fontFamily: "'DM Sans'",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    transition: "all 0.15s",
    fontSize: small ? 12 : 14,
    padding: small ? "6px 11px" : "9px 18px",
  };
  const variants = {
    primary: { background: "#EA580C", color: "#FFFFFF", boxShadow: "0 2px 12px rgba(234, 88, 12, 0.35)" },
    secondary: { background: "#FFF0DC", color: "#3D2914", border: "2px solid #E8C48A" },
  };
  return (
    <button type="button" onClick={onClick} style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  );
}

const S = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 },
  pageTitle: { fontSize: 28, fontFamily: "'Playfair Display'", margin: 0 },
  pageSub: { fontSize: 14, color: "#5C3D1A", marginTop: 6, maxWidth: 560 },
  loading: { padding: 40, color: "#5C3D1A", fontSize: 15 },
  errorBox: {
    padding: 24,
    background: "#FFF1EB",
    border: "2px solid #FDBA74",
    borderRadius: 14,
    color: "#9A3412",
  },
  retryBtn: {
    marginTop: 12,
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "#EA580C",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 14,
    marginBottom: 20,
  },
  statusStrip: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
    padding: "14px 18px",
    background: "#FFFFFF",
    border: "1px solid #E8C48A",
    borderRadius: 14,
  },
  statusStripLabel: { fontSize: 12, fontWeight: 700, color: "#5C3D1A", textTransform: "uppercase", letterSpacing: "0.08em" },
  emptyHero: {
    marginBottom: 28,
    padding: "28px 24px",
    background: "linear-gradient(135deg, #FFF8F0 0%, #FFFFFF 100%)",
    border: "1px solid #E8C48A",
    borderRadius: 16,
  },
  inlineLink: { color: "#C2410C", fontWeight: 700 },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
    gap: 22,
    alignItems: "start",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid #E8C48A",
    borderRadius: 16,
    padding: "20px 22px 22px",
    boxShadow: "0 2px 12px rgba(26, 20, 16, 0.05)",
  },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardTitle: { margin: 0, fontSize: 18, fontFamily: "'Playfair Display'", fontWeight: 700, color: "#1A1410" },
  cardLink: { fontSize: 13, fontWeight: 600, color: "#C2410C", textDecoration: "none" },
  badge: {
    minWidth: 26,
    height: 26,
    padding: "0 8px",
    borderRadius: 999,
    background: "#FFF1EB",
    color: "#C2410C",
    fontSize: 13,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  muted: { color: "#5C3D1A", fontSize: 14, lineHeight: 1.5 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: {
    padding: "10px 12px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#5C3D1A",
    whiteSpace: "nowrap",
  },
  td: { padding: "12px", verticalAlign: "top" },
  textBtn: {
    marginTop: 4,
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 12,
    fontWeight: 600,
    color: "#C2410C",
    cursor: "pointer",
    fontFamily: "inherit",
    textDecoration: "underline",
  },
};
