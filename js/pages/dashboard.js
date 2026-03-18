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

    const cx = w / 2;
    const cy = h / 2 + 2;
    const outerR = Math.min(w, h) * 0.36;
    const thickness = Math.max(12, outerR * 0.22);
    const innerR = Math.max(2, outerR - thickness);

    const start = -Math.PI / 2;
    const pctClamped = clamp(budgetPct, 0, 1);
    const end = start + 2 * Math.PI * pctClamped;

    // subtle spotlight behind ring
    const spot = ctx.createRadialGradient(cx, cy - outerR * 0.2, 6, cx, cy, outerR * 1.2);
    spot.addColorStop(0, "rgba(255,255,255,.06)");
    spot.addColorStop(0.5, "rgba(255,255,255,.02)");
    spot.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR * 1.25, 0, 2 * Math.PI);
    ctx.fill();

    // track
    ctx.lineCap = "round";
    ctx.lineWidth = thickness;
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.beginPath();
    ctx.arc(cx, cy, (outerR + innerR) / 2, 0, 2 * Math.PI);
    ctx.stroke();

    // progress ring
    const ringBase =
      budgetPct >= 1 ? [255, 77, 109] : budgetPct >= 0.85 ? [255, 204, 102] : [124, 92, 255];
    const grad = ctx.createLinearGradient(cx - outerR, cy - outerR, cx + outerR, cy + outerR);
    grad.addColorStop(0, `rgba(${ringBase[0]},${ringBase[1]},${ringBase[2]},.55)`);
    grad.addColorStop(0.55, `rgba(${ringBase[0]},${ringBase[1]},${ringBase[2]},.95)`);
    grad.addColorStop(1, "rgba(77,225,255,.55)");
    ctx.strokeStyle = grad;
    ctx.shadowColor = `rgba(${ringBase[0]},${ringBase[1]},${ringBase[2]},.22)`;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, (outerR + innerR) / 2, start, end);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // center text
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "800 30px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(pctDisplay == null ? "—" : `${pctDisplay}%`, cx, cy + 8);

    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Budget used", cx, cy + 30);

    // bottom meta line
    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const meta =
      totalLimit > 0 ? `${formatMoney(totalUsed, state.prefs)} of ${formatMoney(totalLimit, state.prefs)}` : "No budgets yet";
    ctx.fillText(meta, cx, h - 12);
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

