/**
 * Monvixx — state load/save, default and merged state. Category IDs use prefix ctg_ (not cat).
 */

import { OTHER_CATEGORY_ID, STORAGE_KEY, parseAmount, todayISO, uid } from "./utils.js";

/** Default app state: MYR currency, ctg_* categories, sample transactions. */
export function defaultState() {
  const now = todayISO();
  return {
    prefs: { currency: "MYR", weekStart: 1 },
    categories: [
      { id: "ctg_food", name: "Food" },
      { id: "ctg_transport", name: "Transport" },
      { id: "ctg_rent", name: "Rent" },
      { id: "ctg_bills", name: "Bills" },
      { id: "ctg_shopping", name: "Shopping" },
      { id: "ctg_health", name: "Health" },
      { id: "ctg_entertainment", name: "Entertainment" },
      { id: "ctg_salary", name: "Salary" },
      { id: OTHER_CATEGORY_ID, name: "Other" },
    ],
    transactions: [
      { id: uid(), type: "income", amount: 1200, categoryId: "ctg_salary", note: "Starter income", date: now, method: "transfer", createdAt: Date.now() },
      { id: uid(), type: "expense", amount: 32.5, categoryId: "ctg_food", note: "Groceries", date: now, method: "card", createdAt: Date.now() },
    ],
    budgets: [],
  };
}

/** Normalise loaded JSON into valid state; ensures "Other" category exists. */
export function hydrateState(s) {
  const base = defaultState();
  const prefs = s?.prefs && typeof s.prefs === "object" ? { ...base.prefs, ...s.prefs } : base.prefs;
  const categories = Array.isArray(s?.categories) ? s.categories : base.categories;
  const transactions = Array.isArray(s?.transactions) ? s.transactions : base.transactions;
  const budgets = Array.isArray(s?.budgets) ? s.budgets : base.budgets;
  const out = { prefs, categories, transactions, budgets };
  ensureOtherCategory(out);
  return out;
}

/** Ensure state has the reserved "Other" category (id = ctg_other). */
export function ensureOtherCategory(state) {
  if (state.categories.some((c) => c.id === OTHER_CATEGORY_ID)) return;
  state.categories.push({ id: OTHER_CATEGORY_ID, name: "Other" });
}

/** Load state from localStorage; returns defaultState if missing or invalid. */
export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    return hydrateState(parsed);
  } catch {
    return defaultState();
  }
}

/** Persist state to localStorage. */
export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Merge incoming backup/import into current state by id; dedupes and validates. */
export function mergeState(current, incoming) {
  const out = hydrateState(current);
  const inc = hydrateState(incoming);

  out.prefs = { ...out.prefs, ...inc.prefs };

  const catById = new Map(out.categories.map((c) => [c.id, c]));
  for (const c of inc.categories) {
    if (!c?.id) continue;
    catById.set(c.id, { id: c.id, name: String(c.name ?? "Unnamed") });
  }
  out.categories = Array.from(catById.values());

  const txById = new Map(out.transactions.map((t) => [t.id, t]));
  for (const t of inc.transactions) {
    if (!t?.id) continue;
    const amount = parseAmount(t.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const date = String(t.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const type = t.type === "income" ? "income" : "expense";
    const categoryId = String(t.categoryId ?? OTHER_CATEGORY_ID);
    txById.set(t.id, {
      id: t.id,
      type,
      amount,
      categoryId,
      note: String(t.note ?? ""),
      date,
      method: String(t.method ?? "card"),
      createdAt: Number(t.createdAt ?? Date.now()),
    });
  }
  out.transactions = Array.from(txById.values());

  const bById = new Map(out.budgets.map((b) => [b.id, b]));
  for (const b of inc.budgets) {
    if (!b?.id) continue;
    const monthlyLimit = parseAmount(b.monthlyLimit);
    if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) continue;
    const categoryId = String(b.categoryId ?? "");
    if (!categoryId) continue;
    bById.set(b.id, { id: b.id, categoryId, monthlyLimit });
  }
  out.budgets = Array.from(bById.values());

  ensureOtherCategory(out);
  return out;
}

