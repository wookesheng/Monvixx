/**
 * Monvixx — Transactions page: list, filter, add/edit/delete via dialog.
 */

import { el, flashHint } from "../dom.js";
import { getCategoryName, validateTransactionInput } from "../data.js";
import { ensureOtherCategory, loadState, saveState } from "../state.js";
import { populateCategoriesSelect, populateMonthsSelect, renderTransactions } from "../render.js";
import { OTHER_CATEGORY_ID, formatMoney, monthKeyFromISO, parseAmount, todayISO, uid } from "../utils.js";

/** Open the transaction dialog for create or edit; prefill form from tx if editing. */
function openTxDialog(state, tx) {
  const dlg = el("txDialog");
  const form = el("txDialogForm");
  el("txDialogHint").textContent = "";
  el("txDialogTitle").textContent = tx ? "Edit transaction" : "New transaction";

  form.id.value = tx?.id ?? "";
  form.type.value = tx?.type ?? "expense";
  form.amount.value = tx?.amount != null ? String(tx.amount) : "";
  populateCategoriesSelect(el("txDialogCategory"), state);
  form.category.value = tx?.categoryId ?? state.categories[0]?.id ?? OTHER_CATEGORY_ID;
  form.note.value = tx?.note ?? "";
  form.date.value = tx?.date ?? todayISO();
  form.method.value = tx?.method ?? "card";

  dlg.showModal();
}

function setupTransactions() {
  let state = loadState();
  ensureOtherCategory(state);

  const txMonth = el("txMonth");
  const initialMonth = monthKeyFromISO(todayISO());
  populateMonthsSelect(txMonth, state, { includeAll: true, selected: initialMonth });
  populateCategoriesSelect(el("txCategory"), state, { includeAll: true });

  const filters = { q: "", type: "all", categoryId: "all", monthKey: initialMonth };

  function refresh() {
    populateMonthsSelect(txMonth, state, { includeAll: true, selected: filters.monthKey || initialMonth });
    populateCategoriesSelect(el("txCategory"), state, { includeAll: true });
    renderTransactions(state, filters);
  }

  el("txSearch").addEventListener("input", (e) => {
    filters.q = e.target.value;
    renderTransactions(state, filters);
  });
  el("txType").addEventListener("change", (e) => {
    filters.type = e.target.value;
    renderTransactions(state, filters);
  });
  el("txCategory").addEventListener("change", (e) => {
    filters.categoryId = e.target.value;
    renderTransactions(state, filters);
  });
  txMonth.addEventListener("change", (e) => {
    filters.monthKey = e.target.value;
    renderTransactions(state, filters);
  });
  el("txClearFilters").addEventListener("click", () => {
    filters.q = "";
    filters.type = "all";
    filters.categoryId = "all";
    filters.monthKey = initialMonth;
    el("txSearch").value = "";
    el("txType").value = "all";
    el("txCategory").value = "all";
    txMonth.value = filters.monthKey;
    renderTransactions(state, filters);
  });

  el("txNew").addEventListener("click", () => openTxDialog(state, null));

  el("txTableBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");
    if (!id || !action) return;

    if (action === "edit") {
      const tx = state.transactions.find((t) => t.id === id);
      if (!tx) return;
      openTxDialog(state, tx);
      return;
    }
    if (action === "delete") {
      const tx = state.transactions.find((t) => t.id === id);
      if (!tx) return;
      const ok = window.confirm(`Delete this transaction?\n\n${tx.date} • ${getCategoryName(state, tx.categoryId)} • ${formatMoney(tx.amount, state.prefs)}`);
      if (!ok) return;
      state.transactions = state.transactions.filter((t) => t.id !== id);
      saveState(state);
      refresh();
    }
  });

  const txDialog = el("txDialog");

  el("txDialogClose").addEventListener("click", () => txDialog.close());
  el("txDialogCancel").addEventListener("click", () => txDialog.close());

  el("txDialogForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const hint = el("txDialogHint");
    const id = String(form.id.value ?? "");
    const type = String(form.type.value ?? "expense");
    const amount = parseAmount(form.amount.value);
    const categoryId = String(form.category.value ?? "");
    const note = String(form.note.value ?? "").trim();
    const date = String(form.date.value ?? "");
    const method = String(form.method.value ?? "card");

    const error = validateTransactionInput({ type, amount, categoryId, date });
    if (error) return flashHint(hint, error);

    if (id) {
      const idx = state.transactions.findIndex((t) => t.id === id);
      if (idx === -1) return flashHint(hint, "Transaction not found.");
      state.transactions[idx] = { ...state.transactions[idx], type, amount, categoryId, note, date, method };
    } else {
      state.transactions.push({ id: uid(), type, amount, categoryId, note, date, method, createdAt: Date.now() });
    }
    saveState(state);
    txDialog.close();
    refresh();
  });

  refresh();
}

document.addEventListener("DOMContentLoaded", setupTransactions);

