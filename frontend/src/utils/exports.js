/**
 * CSV Export Utilities
 * Call from any component — triggers browser download.
 */

function downloadCSV(filename, rows, headers) {
  const escape = (val) => {
    if (val == null) return "";
    const str = String(val);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const csvContent = [
    headers.join(","),
    ...rows.map(row => headers.map(h => escape(row[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportBatches(batches) {
  const headers = [
    "batch_number", "soap_name", "recipe_name", "status", "scale_factor",
    "yield_actual", "yield_unit", "unit_count", "made_at",
    "cure_started_at", "cure_weeks_min", "cure_weeks_max", "cure_ready_from", "cure_ready_until",
    "cure_complete_at", "notes",
  ];
  const rows = batches.map(b => ({
    batch_number: b.batch_number,
    soap_name: b.soap_name || "",
    recipe_name: b.recipe_name,
    status: b.status,
    scale_factor: b.scale_factor,
    yield_actual: b.yield_actual,
    yield_unit: b.yield_unit,
    unit_count: b.unit_count,
    made_at: b.made_at ? new Date(b.made_at).toLocaleDateString() : "",
    cure_started_at: b.cure_started_at ? new Date(b.cure_started_at).toLocaleString() : "",
    cure_weeks_min: b.cure_weeks_min ?? "",
    cure_weeks_max: b.cure_weeks_max ?? "",
    cure_ready_from: b.cure_ready_from ? new Date(b.cure_ready_from).toLocaleString() : "",
    cure_ready_until: b.cure_ready_until ? new Date(b.cure_ready_until).toLocaleString() : "",
    cure_complete_at: b.cure_complete_at ? new Date(b.cure_complete_at).toLocaleString() : "",
    notes: b.notes,
  }));
  downloadCSV(`batches-${new Date().toISOString().slice(0, 10)}.csv`, rows, headers);
}

export function exportIngredients(ingredients) {
  const headers = [
    "name", "inci_name", "category", "supplier", "unit",
    "cost_per_unit", "stock_on_hand", "cas_number", "sap_value_naoh", "max_usage_pct",
  ];
  const rows = ingredients.map(i => ({ ...i }));
  downloadCSV(`ingredients-${new Date().toISOString().slice(0, 10)}.csv`, rows, headers);
}

export function exportRecipe(recipe) {
  const headers = ["phase", "ingredient_name", "inci_name", "amount", "unit", "pct_of_batch"];
  const totalWeight = recipe.ingredients.reduce((s, i) => s + Number(i.amount), 0);
  const rows = recipe.ingredients.map(ri => ({
    phase: ri.phase || "",
    ingredient_name: ri.ingredient_name,
    inci_name: ri.inci_name || "",
    amount: ri.amount,
    unit: ri.unit,
    pct_of_batch: totalWeight ? ((ri.amount / totalWeight) * 100).toFixed(2) + "%" : "",
  }));
  downloadCSV(`recipe-${recipe.name.replace(/\s+/g, "-").toLowerCase()}.csv`, rows, headers);
}

export function exportBatchTraceability(batch, traceability) {
  const headers = [
    "batch_number", "recipe_name", "recipe_version", "ingredient_name",
    "inci_name", "amount_used", "unit", "lot_number",
  ];
  const rows = (traceability.ingredients_used || []).map(bi => ({
    batch_number: traceability.batch_number || batch.batch_number,
    recipe_name: batch.recipe_name,
    recipe_version: traceability.recipe_snapshot?.version || "",
    ingredient_name: bi.ingredient_name,
    inci_name: "",
    amount_used: bi.amount_used,
    unit: bi.unit,
    lot_number: bi.lot_number || "",
  }));
  downloadCSV(`traceability-${batch.batch_number}.csv`, rows, headers);
}

export function exportInventoryLedger(transactions) {
  const headers = [
    "date", "ingredient_name", "lot_id", "quantity_delta", "reason",
    "reference_type", "reference_id", "notes",
  ];
  const rows = transactions.map(t => ({
    date: new Date(t.created_at).toLocaleDateString(),
    ingredient_name: t.ingredient_name,
    lot_id: t.lot_id || "",
    quantity_delta: t.quantity_delta,
    reason: t.reason,
    reference_type: t.reference_type || "",
    reference_id: t.reference_id || "",
    notes: t.notes || "",
  }));
  downloadCSV(`inventory-ledger-${new Date().toISOString().slice(0, 10)}.csv`, rows, headers);
}
