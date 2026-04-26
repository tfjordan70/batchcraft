import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "../utils/api";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      tenant: null,
      accessToken: null,
      refreshToken: null,

      login: async (email, password, tenantSlug) => {
        const res = await api.post("/auth/login", { email, password, tenant_slug: tenantSlug });
        const { user, tenant, access_token, refresh_token } = res.data;
        set({ user, tenant, accessToken: access_token, refreshToken: refresh_token });
        return { user, tenant };
      },

      register: async (data) => {
        const res = await api.post("/auth/register", data);
        const { user, tenant, access_token, refresh_token } = res.data;
        set({ user, tenant, accessToken: access_token, refreshToken: refresh_token });
        return { user, tenant };
      },

      logout: () => set({ user: null, tenant: null, accessToken: null, refreshToken: null }),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
    }),
    { name: "batchcraft-auth", partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user, tenant: s.tenant }) }
  )
);
