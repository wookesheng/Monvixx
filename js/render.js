import { el } from "./dom.js";
import { clamp, escapeHtml, formatMoney, monthKeyFromISO } from "./utils.js";
import { computeBudgetUsage, getCategoryName, getFilteredTransactions, getMonthOptions, monthSummary } from "./data.js";

export function populateCategoriesSelect(select, state, { includeAll = false } = {}) {
  const current = select.value;
  select.innerHTML = "";
  if (includeAll) {
    const opt = document.createElement("option");
    opt.value = "all";
    opt.textContent = "All";
    select.appendChild(opt);
  }
  for (const c of state.categories) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  }
  if (current && [...select.options].some((o) => o.value === current)) select.value = current;
}

export function populateMonthsSelect(select, state, { includeAll = false, selected } = {}) {
  const months = getMonthOptions(state);
  select.innerHTML = "";
  if (includeAll) {
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "All";
    select.appendChild(all);
  }
  for (const m of months) {
    const opt = document.createElement("option");
    opt.value = m.key;
    opt.textContent = m.label;
    select.appendChild(opt);
  }
  if (selected && [...select.options].some((o) => o.value === selected)) select.value = selected;
}

export function renderDashboard(state, monthKey) {
  const { income, expenses, net } = monthSummary(state, monthKey);
  el("statIncome").textContent = formatMoney(income, state.prefs);
  el("statExpenses").textContent = formatMoney(expenses, state.prefs);
  el("statNet").textContent = formatMoney(net, state.prefs);

  const budget = computeBudgetUsage(state, monthKey);
  const meta = el("budgetMeta");
  const pill = el("budgetPill");
  const bar = el("budgetBar");
  const progressEl = bar.closest(".bar");

  if (budget.totalLimit <= 0) {
    meta.textContent = "No budgets yet";
    pill.textContent = "—";
    bar.style.width = "0%";
    progressEl?.setAttribute("aria-valuenow", "0");
  } else {
    const pct = clamp(budget.totalPct, 0, 9);
    const pctDisplay = Math.round(clamp(pct, 0, 1.5) * 100);
    meta.textContent = `${formatMoney(budget.totalUsed, state.prefs)} of ${formatMoney(budget.totalLimit, state.prefs)}`;
    pill.textContent = `${pctDisplay}%`;
    bar.style.width = `${clamp(pct, 0, 1) * 100}%`;
    progressEl?.setAttribute("aria-valuenow", String(pctDisplay));

    if (pct >= 1) bar.style.background = `linear-gradient(90deg, rgba(255,77,109,.95), rgba(255,204,102,.95))`;
    else bar.style.background = `linear-gradient(90deg, rgba(124,92,255,.95), rgba(77,225,255,.95))`;
  }

  const topWrap = el("topSpending");
  const empty = el("topSpendingEmpty");
  const byCat = new Map();
  for (const t of state.transactions) {
    if (t.type !== "expense") continue;
    if (monthKeyFromISO(t.date) !== monthKey) continue;
    byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
  }
  const rows = Array.from(byCat.entries())
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  topWrap.innerHTML = "";
  if (rows.length === 0) {
    empty.classList.add("is-visible");
    return;
  }
  empty.classList.remove("is-visible");
  for (const r of rows) {
    const div = document.createElement("div");
    div.className = "row";
    div.innerHTML = `
      <div class="row__left">
        <div class="row__title">${escapeHtml(getCategoryName(state, r.categoryId))}</div>
        <div class="row__meta">${escapeHtml(monthKey)}</div>
      </div>
      <div class="row__right">
        <div class="num">${escapeHtml(formatMoney(r.total, state.prefs))}</div>
      </div>
    `;
    topWrap.appendChild(div);
  }
}

export function renderTransactions(state, filters) {
  const tbody = el("txTableBody");
  const empty = el("txEmpty");
  const tx = getFilteredTransactions(state, filters);
  tbody.innerHTML = "";

  if (tx.length === 0) {
    empty.classList.add("is-visible");
    return;
  }
  empty.classList.remove("is-visible");

  for (const t of tx) {
    const tr = document.createElement("tr");
    const typeLabel = t.type === "income" ? "Income" : "Expense";
    const amount = t.type === "income" ? t.amount : -t.amount;
    const amountLabel = formatMoney(amount, state.prefs);
    tr.innerHTML = `
      <td>${escapeHtml(t.date)}</td>
      <td>${escapeHtml(typeLabel)}</td>
      <td>${escapeHtml(getCategoryName(state, t.categoryId))}</td>
      <td>${escapeHtml(t.note || "")}</td>
      <td class="num">${escapeHtml(amountLabel)}</td>
      <td class="num">
        <button class="iconbtn" data-action="edit" data-id="${escapeHtml(t.id)}" aria-label="Edit">✎</button>
        <button class="iconbtn" data-action="delete" data-id="${escapeHtml(t.id)}" aria-label="Delete">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

export function renderBudgets(state, monthKey) {
  const wrap = el("budgetList");
  const empty = el("budgetEmpty");
  const { budgets } = computeBudgetUsage(state, monthKey);

  wrap.innerHTML = "";
  if (state.budgets.length === 0) {
    empty.classList.add("is-visible");
    return;
  }
  empty.classList.remove("is-visible");

  const items = [...budgets].sort((a, b) => getCategoryName(state, a.categoryId).localeCompare(getCategoryName(state, b.categoryId)));
  for (const b of items) {
    const pct = b.limit > 0 ? clamp(b.used / b.limit, 0, 9) : 0;
    const pctDisplay = Math.round(clamp(pct, 0, 1.5) * 100);
    const warn = pct >= 1 ? "danger" : pct >= 0.85 ? "warn" : "ok";
    const badge =
      warn === "danger"
        ? `<span class="pill" style="color: rgba(255,77,109,.95)">Over</span>`
        : warn === "warn"
          ? `<span class="pill" style="color: rgba(255,204,102,.95)">Near</span>`
          : `<span class="pill" style="color: rgba(69,240,166,.95)">OK</span>`;

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row__left">
        <div class="row__title">${escapeHtml(getCategoryName(state, b.categoryId))}</div>
        <div class="row__meta">${escapeHtml(formatMoney(b.used, state.prefs))} used of ${escapeHtml(formatMoney(b.limit, state.prefs))} (${pctDisplay}%)</div>
      </div>
      <div class="row__right">
        ${badge}
        <button class="iconbtn" data-action="delete-budget" data-id="${escapeHtml(b.id)}" aria-label="Delete budget">🗑</button>
      </div>
    `;
    wrap.appendChild(row);
  }
}

export function renderCategories(state) {
  const wrap = el("categoryList");
  const empty = el("categoryEmpty");
  const items = [...state.categories].sort((a, b) => a.name.localeCompare(b.name));
  wrap.innerHTML = "";

  if (items.length === 0) {
    empty.classList.add("is-visible");
    return;
  }
  empty.classList.remove("is-visible");

  for (const c of items) {
    const row = document.createElement("div");
    row.className = "row catrow";
    row.innerHTML = `
      <div class="row__left">
        <div class="row__title">${escapeHtml(c.name)}</div>
        <div class="row__meta">${escapeHtml(c.id)}</div>
      </div>
      <div class="row__right">
        <input class="row__input" value="${escapeHtml(c.name)}" data-action="rename-input" data-id="${escapeHtml(c.id)}" aria-label="Rename category ${escapeHtml(c.name)}" />
        <button class="btn btn--ghost" data-action="rename" data-id="${escapeHtml(c.id)}" type="button">Rename</button>
        <button class="iconbtn" data-action="delete-category" data-id="${escapeHtml(c.id)}" aria-label="Delete category">🗑</button>
      </div>
    `;
    wrap.appendChild(row);
  }
}

