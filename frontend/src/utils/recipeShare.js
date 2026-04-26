/**
 * Plain text, print, mailto, and sms helpers for sharing a recipe from the client.
 */

const CATEGORY_LABELS = {
  soap: "Soap",
  lotion: "Lotion / Cream",
  lip_balm: "Lip Balm",
  candle: "Candle",
  other: "Other",
};

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category || "—";
}

function humanizePhase(phase) {
  if (!phase) return "Ingredients";
  return phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {Record<string, unknown>} recipe
 * @param {{ omitTitle?: boolean }} [options]
 */
export function formatRecipePlainText(recipe, options = {}) {
  const lines = [];
  if (!options.omitTitle) {
    lines.push(recipe.name || "Recipe");
    lines.push("—".repeat(Math.min(40, (recipe.name || "").length + 5)));
  }
  lines.push(`Category: ${categoryLabel(recipe.category)}`);
  lines.push(`Version: ${recipe.version ?? "—"}`);
  if (recipe.yield_amount != null) {
    lines.push(
      `Yield: ${recipe.yield_amount}${recipe.yield_unit || ""}` +
        (recipe.yield_count ? ` · ${recipe.yield_count} units` : "")
    );
  }
  lines.push("");
  if (recipe.description) {
    lines.push("Description");
    lines.push(recipe.description);
    lines.push("");
  }
  const ings = recipe.ingredients || [];
  const total = ings.reduce((s, i) => s + Number(i.amount || 0), 0);
  if (ings.length) {
    const byPhase = new Map();
    for (const ri of ings) {
      const p = ri.phase || "_default";
      if (!byPhase.has(p)) byPhase.set(p, []);
      byPhase.get(p).push(ri);
    }
    for (const [phase, list] of byPhase) {
      lines.push(phase === "_default" ? "Ingredients" : humanizePhase(phase));
      lines.push("-".repeat(24));
      for (const ri of list) {
        const pct = total ? ((Number(ri.amount) / total) * 100).toFixed(1) : "";
        const inci = ri.inci_name ? ` (${ri.inci_name})` : "";
        const pctStr = pct ? ` — ${pct}%` : "";
        lines.push(`  • ${ri.ingredient_name || "?"}${inci}: ${ri.amount} ${ri.unit || ""}${pctStr}`);
        if (ri.notes) lines.push(`    Note: ${ri.notes}`);
      }
      lines.push("");
    }
  }
  if (recipe.notes) {
    lines.push("Notes");
    lines.push(recipe.notes);
    lines.push("");
  }
  return lines.join("\n").trim();
}

const MAILTO_BODY_MAX = 1900;
const SMS_BODY_MAX = 900;

function truncateForChannel(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 80)}\n\n… (truncated — open the full recipe in BatchCraft for complete details.)`;
}

/** @param {Record<string, unknown>} recipe */
export function printRecipe(recipe, options = {}) {
  const title = escapeHtml(recipe.name || "Recipe");
  const plain = formatRecipePlainText(recipe, { omitTitle: true });
  const bodyHtml = escapeHtml(plain).replace(/\n/g, "<br/>");
  const app = escapeHtml(options.appName || "BatchCraft");
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1410; max-width: 640px; margin: 24px auto; padding: 0 16px; line-height: 1.45; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .meta { font-size: 0.85rem; color: #5c3d1a; margin-bottom: 1.25rem; }
    .footer { margin-top: 2rem; font-size: 0.75rem; color: #888; }
    @media print { body { margin: 0; max-width: none; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">${escapeHtml(categoryLabel(recipe.category))} · v${escapeHtml(String(recipe.version ?? ""))}</div>
  <div>${bodyHtml}</div>
  <div class="footer">Printed from ${app}</div>
</body>
</html>`;

  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  const runPrint = () => {
    w.addEventListener(
      "afterprint",
      () => {
        w.close();
      },
      { once: true }
    );
    w.print();
  };
  if (w.document.readyState === "complete") {
    setTimeout(runPrint, 250);
  } else {
    w.addEventListener("load", () => setTimeout(runPrint, 100));
  }
  return true;
}

/** @param {Record<string, unknown>} recipe */
export function emailRecipe(recipe) {
  const subject = encodeURIComponent(`Recipe: ${recipe.name || "Formula"}`);
  const body = encodeURIComponent(truncateForChannel(formatRecipePlainText(recipe), MAILTO_BODY_MAX));
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

/** @param {Record<string, unknown>} recipe */
export function smsRecipe(recipe) {
  const body = encodeURIComponent(truncateForChannel(formatRecipePlainText(recipe), SMS_BODY_MAX));
  window.location.href = `sms:?&body=${body}`;
}
