/**
 * Monvixx — shared constants and pure helpers (no DOM).
 */

/** localStorage key for app data */
export const STORAGE_KEY = "monvixx:v1";

/** Reserved category id for "Other" (cannot be deleted). Prefix is ctg_ = category, not cat. */
export const OTHER_CATEGORY_ID = "ctg_other";

/** Generate a short random id (e.g. for transactions, budgets). */
export function uid() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Today's date as YYYY-MM-DD. */
export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Extract YYYY-MM from an ISO date string. */
export function monthKeyFromISO(isoDate) {
  return isoDate.slice(0, 7);
}

/** Parse user input into a number; returns NaN if invalid. */
export function parseAmount(input) {
  if (typeof input === "number") return Number.isFinite(input) ? input : NaN;
  const cleaned = String(input).trim().replace(/,/g, "");
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/** Clamp value between min and max. */
export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Escape string for safe use in HTML. */
export function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Intl formatter for a given currency code; fallback to MYR if invalid. */
export function currencyFormatter(code) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code, maximumFractionDigits: 2 });
  } catch {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "MYR", maximumFractionDigits: 2 });
  }
}

/** Format amount using prefs.currency. */
export function formatMoney(amount, prefs) {
  const fmt = currencyFormatter(prefs.currency);
  return fmt.format(amount);
}

