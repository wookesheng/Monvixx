import { el, flashHint } from "../dom.js";
import { getCategoryName } from "../data.js";
import { ensureOtherCategory, loadState, saveState } from "../state.js";
import { populateCategoriesSelect, renderBudgets } from "../render.js";
import { monthKeyFromISO, parseAmount, todayISO, uid } from "../utils.js";

function setupBudgets() {
  let state = loadState();
  ensureOtherCategory(state);

  populateCategoriesSelect(el("budgetCategory"), state);

  const monthKey = monthKeyFromISO(todayISO());

  function refresh() {
    populateCategoriesSelect(el("budgetCategory"), state);
    renderBudgets(state, monthKey);
  }

  el("budgetForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const hint = el("budgetHint");
    const categoryId = el("budgetCategory").value;
    const amount = parseAmount(el("budgetAmount").value);
    if (!categoryId) return flashHint(hint, "Choose a category.");
    if (!Number.isFinite(amount) || amount <= 0) return flashHint(hint, "Monthly limit must be > 0.");

    const existing = state.budgets.find((b) => b.categoryId === categoryId);
    if (existing) existing.monthlyLimit = amount;
    else state.budgets.push({ id: uid(), categoryId, monthlyLimit: amount });

    saveState(state);
    el("budgetAmount").value = "";
    flashHint(hint, "Budget saved.");
    refresh();
  });

  el("budgetList").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (action !== "delete-budget" || !id) return;
    const b = state.budgets.find((x) => x.id === id);
    if (!b) return;
    const ok = window.confirm(`Delete budget for "${getCategoryName(state, b.categoryId)}"?`);
    if (!ok) return;
    state.budgets = state.budgets.filter((x) => x.id !== id);
    saveState(state);
    refresh();
  });

  refresh();
}

document.addEventListener("DOMContentLoaded", setupBudgets);

