/**
 * Monvixx — Settings page: preferences, backup import/export, category CRUD. Danger zone removed.
 */

import { el, flashHint } from "../dom.js";
import { moveCategoryToOther, slugIdFromName, uniqueCategoryId } from "../data.js";
import { ensureOtherCategory, loadState, mergeState, saveState } from "../state.js";
import { populateCategoriesSelect, renderCategories } from "../render.js";
import { OTHER_CATEGORY_ID, todayISO } from "../utils.js";

/** Refresh category dropdowns (if present) and the category list. */
function syncCategoryUI(state) {
  for (const id of ["quickAddCategory", "txCategory", "budgetCategory", "txDialogCategory"]) {
    const node = document.getElementById(id);
    if (node && node.tagName === "SELECT") populateCategoriesSelect(node, state, { includeAll: id === "txCategory" });
  }
  renderCategories(state);
}

function setupSettings() {
  let state = loadState();
  ensureOtherCategory(state);

  el("currency").value = state.prefs.currency;
  el("weekStart").value = String(state.prefs.weekStart ?? 1);

  syncCategoryUI(state);

  el("savePrefs").addEventListener("click", () => {
    const currency = el("currency").value;
    const weekStart = Number(el("weekStart").value);
    state.prefs.currency = currency;
    state.prefs.weekStart = weekStart === 0 ? 0 : 1;
    saveState(state);
    flashHint(el("prefsHint"), "Saved.");
  });

  el("categoryForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const hint = el("categoryHint");
    const rawName = String(el("categoryName").value ?? "").trim();
    const name = rawName.replace(/\s+/g, " ");
    if (!name) return flashHint(hint, "Name is required.");
    if (name.length > 24) return flashHint(hint, "Name is too long.");

    const exists = state.categories.some((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) return flashHint(hint, "That category already exists.");

    const id = uniqueCategoryId(state, slugIdFromName(name));
    state.categories.push({ id, name });
    ensureOtherCategory(state);
    saveState(state);
    el("categoryName").value = "";
    flashHint(hint, "Added.");
    syncCategoryUI(state);
  });

  el("categoryList").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!action || !id) return;

    if (action === "rename") {
      const input = el("categoryList").querySelector(`input[data-action="rename-input"][data-id="${CSS.escape(id)}"]`);
      const next = String(input?.value ?? "").trim().replace(/\s+/g, " ");
      if (!next) return flashHint(el("categoryHint"), "Name is required.");
      const exists = state.categories.some((c) => c.id !== id && c.name.toLowerCase() === next.toLowerCase());
      if (exists) return flashHint(el("categoryHint"), "That name is already used.");
      const cat = state.categories.find((c) => c.id === id);
      if (!cat) return;
      cat.name = next.slice(0, 24);
      saveState(state);
      flashHint(el("categoryHint"), "Renamed.");
      syncCategoryUI(state);
      return;
    }

    if (action === "delete-category") {
      if (id === OTHER_CATEGORY_ID) return flashHint(el("categoryHint"), "“Other” can’t be deleted.");
      const cat = state.categories.find((c) => c.id === id);
      if (!cat) return;
      const ok = window.confirm(`Delete category "${cat.name}"?\n\nTransactions and budgets will move to "Other".`);
      if (!ok) return;
      ensureOtherCategory(state);
      moveCategoryToOther(state, id);
      state.categories = state.categories.filter((c) => c.id !== id);
      saveState(state);
      flashHint(el("categoryHint"), "Deleted.");
      syncCategoryUI(state);
    }
  });

  el("exportJson").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `monvixx-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  });

  el("importJson").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const incoming = JSON.parse(text);
      state = mergeState(state, incoming);
      ensureOtherCategory(state);
      saveState(state);
      syncCategoryUI(state);
      flashHint(el("prefsHint"), "Imported (merged).");
    } catch {
      flashHint(el("prefsHint"), "Import failed (invalid JSON).");
    } finally {
      e.target.value = "";
    }
  });
}

document.addEventListener("DOMContentLoaded", setupSettings);

