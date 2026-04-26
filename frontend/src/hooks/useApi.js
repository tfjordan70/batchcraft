import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../utils/api";
import toast from "react-hot-toast";

// ─── Ingredients ──────────────────────────────────────────────────────────────

export function useIngredients(params = {}) {
  return useQuery({
    queryKey: ["ingredients", params],
    queryFn: () => api.get("/ingredients/", { params }).then(r => r.data),
  });
}

export function useIngredient(id) {
  return useQuery({
    queryKey: ["ingredients", id],
    queryFn: () => api.get(`/ingredients/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post("/ingredients/", data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ingredients"] }); toast.success("Ingredient added"); },
    onError: (e) => toast.error(e.response?.data?.error || "Failed to add ingredient"),
  });
}

export function useUpdateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/ingredients/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ingredients"] }); toast.success("Ingredient updated"); },
    onError: (e) => toast.error(e.response?.data?.error || "Update failed"),
  });
}

export function useAddLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ingredientId, ...data }) => api.post(`/ingredients/${ingredientId}/lots`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ingredients"] }); qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Lot received — inventory updated"); },
    onError: (e) => toast.error(e.response?.data?.error || "Failed to add lot"),
  });
}

export function useInventoryTransactions(ingredientId) {
  return useQuery({
    queryKey: ["transactions", ingredientId],
    queryFn: () => api.get(`/ingredients/${ingredientId}/transactions`).then(r => r.data),
    enabled: !!ingredientId,
  });
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export function useRecipes(params = {}) {
  return useQuery({
    queryKey: ["recipes", params],
    queryFn: () => api.get("/recipes/", { params }).then(r => r.data),
  });
}

export function useRecipe(id) {
  return useQuery({
    queryKey: ["recipes", id],
    queryFn: () => api.get(`/recipes/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post("/recipes/", data).then(r => r.data),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["recipes"] }); toast.success(`Recipe "${data.name}" created`); },
    onError: (e) => toast.error(e.response?.data?.error || "Failed to create recipe"),
  });
}

export function useUpdateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/recipes/${id}`, data).then(r => r.data),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["recipes"] }); toast.success("Recipe saved"); },
    onError: (e) => toast.error(e.response?.data?.error || "Failed to save recipe"),
  });
}

export function useScaleRecipe() {
  return useMutation({
    mutationFn: ({ id, ...params }) => api.post(`/recipes/${id}/scale`, params).then(r => r.data),
  });
}

// ─── Batches ──────────────────────────────────────────────────────────────────

export function useBatches(params = {}) {
  return useQuery({
    queryKey: ["batches", params],
    queryFn: () => api.get("/batches/", { params }).then(r => r.data),
  });
}

export function useBatch(id) {
  return useQuery({
    queryKey: ["batches", id],
    queryFn: () => api.get(`/batches/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post("/batches/", data).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      toast.success(`Batch ${data.batch_number} created`);
    },
    onError: (e) => toast.error(e.response?.data?.error || "Failed to create batch"),
  });
}

export function useCompleteBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.post(`/batches/${id}/complete`, data).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success(`Batch ${data.batch_number} completed — inventory updated`);
    },
    onError: (e) => toast.error(e.response?.data?.error || "Failed to complete batch"),
  });
}

export function useBatchTraceability(id) {
  return useQuery({
    queryKey: ["traceability", id],
    queryFn: () => api.get(`/batches/${id}/traceability`).then(r => r.data),
    enabled: !!id,
  });
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export function useInventory() {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get("/inventory/").then(r => r.data),
  });
}

export function useAdjustInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post("/inventory/adjust", data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); qc.invalidateQueries({ queryKey: ["ingredients"] }); toast.success("Inventory adjusted"); },
  });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/reports/dashboard").then(r => r.data),
    refetchInterval: 60_000,
  });
}
