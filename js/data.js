/**
 * Monvixx — data helpers: filters, summaries, category id generation. Category IDs use prefix ctg_.
 */

import { OTHER_CATEGORY_ID, clamp, escapeHtml, formatMoney, monthKeyFromISO, parseAmount, todayISO, uid } from "./utils.js";

/** Unique month keys from transactions plus current month, sorted newest first. */
export function getMonthOptions(state) {
  const months = new Set(state.transactions.map((t) => monthKeyFromISO(t.date)));
  months.add(monthKeyFromISO(todayISO()));
  const arr = Array.from(months).sort().reverse();
  return arr.map((m) => ({ key: m, label: m }));
}

/** Display name for a category id. */
export function getCategoryName(state, categoryId) {
  return state.categories.find((c) => c.id === categoryId)?.name ?? "Unknown";
}

/** Filter and sort transactions by query, type, category, month. */
export function getFilteredTransactions(state, { q, type, categoryId, monthKey }) {
  const query = (q ?? "").trim().toLowerCase();
  return state.transactions
    .filter((t) => {
      if (type && type !== "all" && t.type !== type) return false;
      if (categoryId && categoryId !== "all" && t.categoryId !== categoryId) return false;
      if (monthKey && monthKey !== "all" && monthKeyFromISO(t.date) !== monthKey) return false;
      if (!query) return true;
      const cat = getCategoryName(state, t.categoryId).toLowerCase();
      const note = (t.note ?? "").toLowerCase();
      return cat.includes(query) || note.includes(query);
    })
    .sort((a, b) => (b.date === a.date ? (b.createdAt ?? 0) - (a.createdAt ?? 0) : b.date.localeCompare(a.date)));
}

/** Income, expenses, net and list of tx for a given month. */
export function monthSummary(state, monthKey) {
  const tx = state.transactions.filter((t) => monthKeyFromISO(t.date) === monthKey);
  let income = 0;
  let expenses = 0;
  for (const t of tx) {
    if (t.type === "income") income += t.amount;
    else expenses += t.amount;
  }
  return { income, expenses, net: income - expenses, tx };
}

/** Per-budget usage and totals for a month. */
export function computeBudgetUsage(state, monthKey) {
  const expenseByCat = new Map();
  for (const t of state.transactions) {
    if (t.type !== "expense") continue;
    if (monthKeyFromISO(t.date) !== monthKey) continue;
    expenseByCat.set(t.categoryId, (expenseByCat.get(t.categoryId) ?? 0) + t.amount);
  }
  const budgets = state.budgets.map((b) => {
    const used = expenseByCat.get(b.categoryId) ?? 0;
    const limit = b.monthlyLimit;
    const pct = limit > 0 ? used / limit : 0;
    return { ...b, used, limit, pct };
  });

  const totalLimit = budgets.reduce((sum, b) => sum + (b.limit ?? 0), 0);
  const totalUsed = budgets.reduce((sum, b) => sum + (b.used ?? 0), 0);
  const totalPct = totalLimit > 0 ? totalUsed / totalLimit : 0;
  return { budgets, totalLimit, totalUsed, totalPct };
}

/** Generate a safe category id from display name; prefix is ctg_ (not cat). */
export function slugIdFromName(name) {
  const cleaned = String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 18);
  return cleaned ? `ctg_${cleaned}` : `ctg_${uid().toLowerCase()}`;
}

/** Return baseId if unused, otherwise baseId_2, baseId_3, … */
export function uniqueCategoryId(state, baseId) {
  const exists = new Set(state.categories.map((c) => c.id));
  if (!exists.has(baseId)) return baseId;
  let i = 2;
  while (exists.has(`${baseId}_${i}`)) i++;
  return `${baseId}_${i}`;
}

/** Append a new transaction to state.transactions. */
export function addTransaction(state, { type, amount, categoryId, note, date, method }) {
  state.transactions.push({ id: uid(), type, amount, categoryId, note, date, method, createdAt: Date.now() });
}

/** Validate quick-add / dialog fields; returns error string or "". */
export function validateTransactionInput({ type, amount, categoryId, date }) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Please choose a valid date.";
  if (!categoryId) return "Please choose a category.";
  if (!Number.isFinite(amount) || amount <= 0) return "Amount must be a number greater than 0.";
  if (type !== "income" && type !== "expense") return "Type is invalid.";
  return "";
}

/** Reassign all transactions and budgets from categoryId to ctg_other. */
export function moveCategoryToOther(state, categoryId) {
  for (const t of state.transactions) {
    if (t.categoryId === categoryId) t.categoryId = OTHER_CATEGORY_ID;
  }
  for (const b of state.budgets) {
    if (b.categoryId === categoryId) b.categoryId = OTHER_CATEGORY_ID;
  }
}

export { clamp, escapeHtml, formatMoney, parseAmount };

