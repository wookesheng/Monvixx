/**
 * Monvixx — Dashboard page: month summary, quick-add form, top spending. "View all" goes to transactions.
 */

import { el, flashHint } from "../dom.js";
import { addTransaction, validateTransactionInput } from "../data.js";
import { ensureOtherCategory, loadState, saveState } from "../state.js";
import { populateCategoriesSelect, populateMonthsSelect, renderDashboard } from "../render.js";
import { monthKeyFromISO, parseAmount, todayISO } from "../utils.js";

/** Wire month select, quick-add form, and "View all" link; run initial render. */
function setupDashboard() {
  let state = loadState();
  ensureOtherCategory(state);

  const monthSelect = el("monthSelect");
  const initialMonth = monthKeyFromISO(todayISO());
  populateMonthsSelect(monthSelect, state, { selected: initialMonth });

  populateCategoriesSelect(el("quickAddCategory"), state);

  const quickForm = el("quickAddForm");
  quickForm.date.value = todayISO();

  function refresh() {
    const monthKey = monthSelect.value || initialMonth;
    populateMonthsSelect(monthSelect, state, { selected: monthKey });
    populateCategoriesSelect(el("quickAddCategory"), state);
    renderDashboard(state, monthKey);
  }

  monthSelect.addEventListener("change", refresh);

  quickForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(quickForm);
    const type = String(form.get("type") ?? "expense");
    const amount = parseAmount(form.get("amount"));
    const categoryId = String(form.get("category") ?? "");
    const note = String(form.get("note") ?? "").trim();
    const date = String(form.get("date") ?? "");
    const method = String(form.get("method") ?? "card");

    const error = validateTransactionInput({ type, amount, categoryId, date });
    if (error) return flashHint(el("quickAddHint"), error);

    addTransaction(state, { type, amount, categoryId, note, date, method });
    saveState(state);
    quickForm.amount.value = "";
    quickForm.note.value = "";
    flashHint(el("quickAddHint"), "Added.");
    refresh();
  });

  el("quickAddToTransactions").addEventListener("click", () => {
    window.location.href = "./transactions.html";
  });

  refresh();
}

document.addEventListener("DOMContentLoaded", setupDashboard);

