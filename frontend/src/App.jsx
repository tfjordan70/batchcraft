import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import RecipeBuilder from "./pages/RecipeBuilder";
import BatchCompletion from "./pages/BatchCompletion";

import IngredientsPage from "./pages/IngredientsPage";
import RecipesPage from "./pages/RecipesPage";
import BatchesPage from "./pages/BatchesPage";
import LyeCalculator from "./pages/LyeCalculator";
import FragranceCalculator from "./pages/FragranceCalculator";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

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
      width: 220, background: "#2E2208", display: "flex", flexDirection: "column",
      position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100,
    }}>
      <div style={{ padding: "28px 20px 24px" }}>
        <div style={{ fontFamily: "'Playfair Display'", fontSize: 22, color: "#FDFBF7", letterSpacing: "-0.5px" }}>BatchCraft</div>
        <div style={{ fontSize: 11, color: "rgba(250,246,237,0.4)", marginTop: 2, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {tenant?.name || "Loading…"}
        </div>
      </div>

      <nav style={{ flex: 1, padding: "0 10px" }}>
        {NAV_ITEMS.map(({ to, label, icon, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink key={to} to={to} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 10, marginBottom: 2, cursor: "pointer",
                background: active ? "rgba(250,246,237,0.12)" : "transparent",
                color: active ? "#FAF6ED" : "rgba(250,246,237,0.55)",
                fontSize: 14, fontWeight: active ? 600 : 400,
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                {label}
                {active && <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: 2, background: "#8FAF7E" }} />}
              </div>
            </NavLink>
          );
        })}
      </nav>

      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(250,246,237,0.1)" }}>
        <div style={{ fontSize: 12, color: "rgba(250,246,237,0.4)" }}>Logged in as</div>
        <div style={{ fontSize: 14, color: "rgba(250,246,237,0.8)", fontWeight: 500, marginTop: 2 }}>
          {user?.name} · {user?.role}
        </div>
        <button onClick={logout} style={{
          marginTop: 10, background: "rgba(250,246,237,0.08)", border: "none",
          borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "rgba(250,246,237,0.5)",
          cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit",
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
      <main style={{ marginLeft: 220, flex: 1, minHeight: "100vh", background: "#FAF6ED" }}>
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
    <div style={{ minHeight: "100vh", background: "#FAF6ED", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: 400, background: "rgba(255,255,255,0.9)", borderRadius: 20, border: "1px solid #E8D5B4", padding: 40, boxShadow: "0 8px 40px rgba(46,34,8,0.12)" }}>
        <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 28, marginBottom: 4, color: "#2E2208" }}>BatchCraft</h1>
        <p style={{ fontSize: 14, color: "#8B6914", marginBottom: 28 }}>{mode === "login" ? "Sign in to your workshop" : "Create your workspace"}</p>

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

        {error && <div style={{ background: "#FFF0EB", border: "1px solid #C97B5A40", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#8F4A2C", marginBottom: 16 }}>{error}</div>}

        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", background: "#6B5010", color: "#FDFBF7", border: "none", borderRadius: 10, padding: "12px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>
          {loading ? "…" : mode === "login" ? "Sign In" : "Create Account"}
        </button>
        <p style={{ fontSize: 13, color: "#8B6914", textAlign: "center" }}>
          {mode === "login" ? "New to BatchCraft? " : "Already have an account? "}
          <button onClick={() => setMode(m => m === "login" ? "register" : "login")} style={{ background: "none", border: "none", color: "#6B5010", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
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
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#6B5010", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { width: "100%", background: "#FDFBF7", border: "1px solid #E8D5B4", borderRadius: 8, padding: "9px 12px", fontSize: 14, color: "#2E2208", outline: "none", fontFamily: "inherit" };

// ─── Placeholder pages (replace with full implementations) ────────────────────

const Placeholder = ({ title }) => (
  <div style={{ padding: "40px", color: "#8B6914", fontFamily: "'Playfair Display'", fontSize: 24 }}>
    {title} <span style={{ fontSize: 14, fontFamily: "'DM Sans'" }}>(coming soon)</span>
  </div>
);

// ─── App ──────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ style: { fontFamily: "'DM Sans'", fontSize: 14 } }} />
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
