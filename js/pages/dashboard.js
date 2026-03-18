/**
 * Monvixx — Dashboard page: month summary, quick-add form, top spending. "View all" goes to transactions.
 */

import { el, flashHint } from "../dom.js";
import { addTransaction, computeBudgetUsage, monthSummary, validateTransactionInput } from "../data.js";
import { ensureOtherCategory, loadState, saveState } from "../state.js";
import { populateCategoriesSelect, populateMonthsSelect, renderDashboard } from "../render.js";
import { clamp, formatMoney, monthKeyFromISO, parseAmount, todayISO } from "../utils.js";

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

  function renderSummaryChart(monthKey) {
    const canvas = document.getElementById("summaryChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || canvas.width;
    const cssHeight = canvas.height;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { totalLimit, totalUsed } = computeBudgetUsage(state, monthKey);
    const budgetPct = totalLimit > 0 ? clamp(totalUsed / totalLimit, 0, 9) : 0;
    const pctDisplay = totalLimit > 0 ? Math.round(clamp(budgetPct, 0, 1.5) * 100) : null;

    const w = cssWidth;
    const h = cssHeight;
    ctx.clearRect(0, 0, w, h);

    // soft panel background
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + 2;
    const outerR = Math.min(w, h) * 0.32;
    const thickness = Math.max(10, outerR * 0.28);
    const innerR = Math.max(2, outerR - thickness);

    const start = -Math.PI / 2;
    const pctClamped = clamp(budgetPct, 0, 1);
    const end = start + 2 * Math.PI * pctClamped;

    // track
    ctx.lineCap = "round";
    ctx.lineWidth = thickness;
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.beginPath();
    ctx.arc(cx, cy, (outerR + innerR) / 2, 0, 2 * Math.PI);
    ctx.stroke();

    // progress ring
    const ringColor =
      budgetPct >= 1 ? "rgba(255,77,109,.92)" : budgetPct >= 0.85 ? "rgba(255,204,102,.92)" : "rgba(124,92,255,.92)";
    ctx.strokeStyle = ringColor;
    ctx.beginPath();
    ctx.arc(cx, cy, (outerR + innerR) / 2, start, end);
    ctx.stroke();

    // center text
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "700 26px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(pctDisplay == null ? "—" : `${pctDisplay}%`, cx, cy + 6);

    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Budget used", cx, cy + 26);

    // bottom meta line
    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const meta =
      totalLimit > 0 ? `${formatMoney(totalUsed, state.prefs)} of ${formatMoney(totalLimit, state.prefs)}` : "No budgets yet";
    ctx.fillText(meta, cx, h - 10);
  }

  function refresh() {
    const monthKey = monthSelect.value || initialMonth;
    populateMonthsSelect(monthSelect, state, { selected: monthKey });
    populateCategoriesSelect(el("quickAddCategory"), state);
    renderDashboard(state, monthKey);
    renderSummaryChart(monthKey);
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

