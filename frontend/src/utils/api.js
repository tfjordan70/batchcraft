import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Inject auth token on every request
api.interceptors.request.use((config) => {
  try {
    const auth = JSON.parse(localStorage.getItem("batchcraft-auth") || "{}");
    const token = auth?.state?.accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

// Handle 401 — attempt refresh
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const auth = JSON.parse(localStorage.getItem("batchcraft-auth") || "{}");
        const refreshToken = auth?.state?.refreshToken;
        if (refreshToken) {
          const res = await axios.post("/api/auth/refresh", {}, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });
          const newToken = res.data.access_token;
          // Update store
          const stored = JSON.parse(localStorage.getItem("batchcraft-auth"));
          stored.state.accessToken = newToken;
          localStorage.setItem("batchcraft-auth", JSON.stringify(stored));
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch {}
      // Refresh failed — clear auth
      localStorage.removeItem("batchcraft-auth");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
