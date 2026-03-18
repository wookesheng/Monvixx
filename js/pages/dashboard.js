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

    const { income, expenses } = monthSummary(state, monthKey);
    const { totalLimit, totalUsed } = computeBudgetUsage(state, monthKey);
    const budgetPct = totalLimit > 0 ? clamp(totalUsed / totalLimit, 0, 1.5) : 0;

    const items = [
      { label: "Income", value: income, valueLabel: formatMoney(income, state.prefs), color: "rgba(77,225,255,.85)" },
      { label: "Expenses", value: expenses, valueLabel: formatMoney(expenses, state.prefs), color: "rgba(255,77,109,.85)" },
      {
        label: "Budget used",
        value: Math.round(clamp(budgetPct, 0, 1) * 100),
        valueLabel: totalLimit > 0 ? `${Math.round(clamp(budgetPct, 0, 1.5) * 100)}%` : "—",
        color: "rgba(124,92,255,.85)",
        isPercent: true,
      },
    ];

    const padding = 16;
    const w = cssWidth;
    const h = cssHeight;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.fillRect(0, 0, w, h);

    const chartTop = 14;
    const chartBottom = h - 22;
    const chartHeight = chartBottom - chartTop;
    const chartLeft = padding;
    const chartRight = w - padding;
    const chartWidth = chartRight - chartLeft;

    // grid lines
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = chartTop + (chartHeight * i) / 3;
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
    }

    const maxAmount = Math.max(1, income, expenses);
    const barGap = 14;
    const barWidth = (chartWidth - barGap * (items.length - 1)) / items.length;

    ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";

    items.forEach((item, idx) => {
      const x = chartLeft + idx * (barWidth + barGap);
      const baseY = chartBottom;
      const normalized = item.isPercent ? clamp(item.value / 100, 0, 1) : clamp(item.value / maxAmount, 0, 1);
      const barH = Math.round(chartHeight * normalized);
      const y = baseY - barH;

      // bar
      ctx.fillStyle = item.color;
      const radius = 10;
      const bw = Math.max(8, barWidth);
      roundRect(ctx, x, y, bw, barH, radius);
      ctx.fill();

      // value label
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.fillText(item.valueLabel, x + bw / 2, y - 6);

      // x label
      ctx.fillStyle = "rgba(255,255,255,.65)";
      ctx.fillText(item.label, x + bw / 2, h - 6);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
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

