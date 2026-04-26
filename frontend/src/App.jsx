import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import RecipeBuilder from "./pages/RecipeBuilder";
import BatchCompletion from "./pages/BatchCompletion";

import IngredientsPage from "./pages/IngredientsPage";
import RecipesPage from "./pages/RecipesPage";
import RecipeDetailsPage from "./pages/RecipeDetailsPage";
import BatchesPage from "./pages/BatchesPage";
import LyeCalculator from "./pages/LyeCalculator";
import FragranceCalculator from "./pages/FragranceCalculator";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const UI = {
  page: "#FFFCF7",
  card: "#FFFFFF",
  border: "#E8C48A",
  ink: "#1A1410",
  muted: "#5C3D1A",
  accent: "#EA580C",
  accentDark: "#C2410C",
  sidebar: "#7C2D12",
  sidebarActive: "rgba(255, 252, 247, 0.22)",
  sidebarText: "#FFFAF5",
  sidebarTextMuted: "rgba(255, 250, 245, 0.78)",
  sidebarTextDim: "rgba(255, 248, 240, 0.55)",
  sageDot: "#4ADE80",
};

// ─── Auth Guard ───────────────────────────────────────────────────────────────

function RequireAuth({ children }) {
  const token = useAuthStore(s => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// ─── Sidebar Nav ──────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "◈", exact: true },
  { to: "/recipes", label: "Recipes", icon: "📋" },
  { to: "/batches", label: "Batches", icon: "🧪" },
  { to: "/ingredients", label: "Ingredients", icon: "🌿" },
  { to: "/inventory", label: "Inventory", icon: "📦" },
  { to: "/calculators/lye", label: "Lye Calc", icon: "⚗️" },
  { to: "/calculators/fragrance", label: "Fragrance Calc", icon: "🌸" },
];

function Sidebar() {
  const { user, tenant, logout } = useAuthStore();
  const location = useLocation();

  return (
    <aside style={{
      width: 220, background: `linear-gradient(180deg, ${UI.sidebar} 0%, #5C2410 100%)`,
      display: "flex", flexDirection: "column",
      position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100,
      boxShadow: "4px 0 24px rgba(124, 45, 18, 0.35)",
    }}>
      <div style={{ padding: "28px 20px 24px" }}>
        <div style={{ fontFamily: "'Playfair Display'", fontSize: 22, color: UI.sidebarText, letterSpacing: "-0.5px", fontWeight: 700 }}>BatchCraft</div>
        <div style={{ fontSize: 11, color: UI.sidebarTextDim, marginTop: 4, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>
          {tenant?.name || "Loading…"}
        </div>
      </div>

      <nav style={{ flex: 1, padding: "0 10px" }}>
        {NAV_ITEMS.map(({ to, label, icon, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink key={to} to={to} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                borderRadius: 10, marginBottom: 3, cursor: "pointer",
                background: active ? UI.sidebarActive : "transparent",
                color: active ? UI.sidebarText : UI.sidebarTextMuted,
                fontSize: 14, fontWeight: active ? 700 : 500,
                transition: "all 0.15s",
                border: active ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
              }}>
                <span style={{ fontSize: 17 }}>{icon}</span>
                {label}
                {active && <div style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: 3, background: UI.sageDot, boxShadow: "0 0 8px #4ADE80" }} />}
              </div>
            </NavLink>
          );
        })}
      </nav>

      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.18)" }}>
        <div style={{ fontSize: 12, color: UI.sidebarTextDim, fontWeight: 600 }}>Logged in as</div>
        <div style={{ fontSize: 14, color: UI.sidebarText, fontWeight: 600, marginTop: 4 }}>
          {user?.name} · {user?.role}
        </div>
        <button onClick={logout} style={{
          marginTop: 12, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 8, padding: "8px 12px", fontSize: 13, color: UI.sidebarTextMuted,
          cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit", fontWeight: 600,
        }}>Sign out</button>
      </div>
    </aside>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function AppShell({ children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, minHeight: "100vh", background: UI.page }}>
        {children}
      </main>
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [mode, setMode] = useState("login"); // login | register
  const [businessName, setBusinessName] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setLoading(true); setError("");
    try {
      if (mode === "login") {
        await login(email, password, tenantSlug);
      } else {
        await register({ email, password, name, business_name: businessName });
      }
      navigate("/");
    } catch (e) {
      setError(e.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: UI.page, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{
        width: 400, background: UI.card, borderRadius: 20, border: `2px solid ${UI.border}`,
        padding: 40, boxShadow: "0 12px 48px rgba(194, 65, 12, 0.15)",
      }}>
        <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 30, marginBottom: 6, color: UI.ink, fontWeight: 700 }}>BatchCraft</h1>
        <p style={{ fontSize: 15, color: UI.muted, marginBottom: 28, fontWeight: 500 }}>{mode === "login" ? "Sign in to your workshop" : "Create your workspace"}</p>

        {mode === "register" && (
          <>
            <Field label="Your Name"><input value={name} onChange={e => setName(e.target.value)} style={inputStyle} /></Field>
            <Field label="Business Name"><input value={businessName} onChange={e => setBusinessName(e.target.value)} style={inputStyle} /></Field>
          </>
        )}
        <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} /></Field>
        <Field label="Password"><input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} onKeyDown={e => e.key === "Enter" && handleSubmit()} /></Field>
        {mode === "login" && (
          <Field label="Workspace (optional)"><input value={tenantSlug} onChange={e => setTenantSlug(e.target.value)} placeholder="your-business-name" style={inputStyle} /></Field>
        )}

        {error && <div style={{ background: "#FFF1EB", border: "2px solid #FDBA74", borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "#9A3412", marginBottom: 16, fontWeight: 600 }}>{error}</div>}

        <button onClick={handleSubmit} disabled={loading} style={{
          width: "100%", background: UI.accent, color: "#FFFFFF", border: "none", borderRadius: 12, padding: "14px",
          fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 16,
          boxShadow: "0 4px 14px rgba(234, 88, 12, 0.45)",
        }}>
          {loading ? "…" : mode === "login" ? "Sign In" : "Create Account"}
        </button>
        <p style={{ fontSize: 14, color: UI.muted, textAlign: "center", fontWeight: 500 }}>
          {mode === "login" ? "New to BatchCraft? " : "Already have an account? "}
          <button onClick={() => setMode(m => m === "login" ? "register" : "login")} style={{ background: "none", border: "none", color: UI.accentDark, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: UI.muted, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "#FFFFFF", border: `2px solid ${UI.border}`, borderRadius: 10, padding: "11px 14px",
  fontSize: 15, color: UI.ink, outline: "none", fontFamily: "inherit", fontWeight: 500,
};

// ─── Placeholder pages (replace with full implementations) ────────────────────

const Placeholder = ({ title }) => (
  <div style={{ padding: "40px", color: UI.muted, fontFamily: "'Playfair Display'", fontSize: 26, fontWeight: 600 }}>
    {title} <span style={{ fontSize: 15, fontFamily: "'DM Sans'", fontWeight: 500, color: UI.accent }}>(coming soon)</span>
  </div>
);

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, background: "#1A1410", color: "#FFFAF5" },
            success: { iconTheme: { primary: "#4ADE80", secondary: "#1A1410" } },
            error: { iconTheme: { primary: "#FB923C", secondary: "#1A1410" } },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <RequireAuth>
              <AppShell>
                <Routes>
                  <Route path="/" element={<Placeholder title="Dashboard" />} />
                  <Route path="/recipes" element={<RecipesPage />} />
                  <Route path="/recipes/new" element={<RecipeBuilder />} />
                  <Route path="/recipes/:id/edit" element={<RecipeBuilder />} />
                  <Route path="/recipes/:id" element={<RecipeDetailsPage />} />
                  <Route path="/batches" element={<BatchesPage />} />
                  <Route path="/batches/:id/complete" element={<BatchCompletion />} />
                  <Route path="/ingredients" element={<IngredientsPage />} />
                  <Route path="/inventory" element={<IngredientsPage />} />
                  <Route path="/calculators/lye" element={<LyeCalculator />} />
                  <Route path="/calculators/fragrance" element={<FragranceCalculator />} />
                </Routes>
              </AppShell>
            </RequireAuth>
          } />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
