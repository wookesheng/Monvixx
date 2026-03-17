/* Monvixx — Plain HTML/JS money tracker (local-first) */

const STORAGE_KEY = "monvixx:v1";
const OTHER_CATEGORY_ID = "cat_other";

function uid() {
  // 16 chars url-safe
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthKeyFromISO(isoDate) {
  // YYYY-MM
  return isoDate.slice(0, 7);
}

function parseAmount(input) {
  if (typeof input === "number") return Number.isFinite(input) ? input : NaN;
  const cleaned = String(input).trim().replace(/,/g, "");
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    return hydrateState(parsed);
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function defaultState() {
  const now = todayISO();
  return {
    prefs: { currency: "USD", weekStart: 1 },
    categories: [
      { id: "cat_food", name: "Food" },
      { id: "cat_transport", name: "Transport" },
      { id: "cat_rent", name: "Rent" },
      { id: "cat_bills", name: "Bills" },
      { id: "cat_shopping", name: "Shopping" },
      { id: "cat_health", name: "Health" },
      { id: "cat_entertainment", name: "Entertainment" },
      { id: "cat_salary", name: "Salary" },
      { id: "cat_other", name: "Other" },
    ],
    transactions: [
      // sample starter (light)
      { id: uid(), type: "income", amount: 1200, categoryId: "cat_salary", note: "Starter income", date: now, method: "transfer", createdAt: Date.now() },
      { id: uid(), type: "expense", amount: 32.5, categoryId: "cat_food", note: "Groceries", date: now, method: "card", createdAt: Date.now() },
    ],
    budgets: [
      // { id, categoryId, monthlyLimit }
    ],
  };
}

function hydrateState(s) {
  const base = defaultState();
  const prefs = s?.prefs && typeof s.prefs === "object" ? { ...base.prefs, ...s.prefs } : base.prefs;
  const categories = Array.isArray(s?.categories) ? s.categories : base.categories;
  const transactions = Array.isArray(s?.transactions) ? s.transactions : base.transactions;
  const budgets = Array.isArray(s?.budgets) ? s.budgets : base.budgets;
  return { prefs, categories, transactions, budgets };
}

function currencyFormatter(code) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code, maximumFractionDigits: 2 });
  } catch {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }
}

function formatMoney(amount, prefs) {
  const fmt = currencyFormatter(prefs.currency);
  return fmt.format(amount);
}

function getMonthOptions(state) {
  const months = new Set(state.transactions.map((t) => monthKeyFromISO(t.date)));
  months.add(monthKeyFromISO(todayISO()));
  const arr = Array.from(months).sort().reverse();
  return arr.map((m) => ({ key: m, label: m }));
}

function getCategoryName(state, categoryId) {
  return state.categories.find((c) => c.id === categoryId)?.name ?? "Unknown";
}

function ensureOtherCategory(state) {
  if (state.categories.some((c) => c.id === OTHER_CATEGORY_ID)) return;
  state.categories.push({ id: OTHER_CATEGORY_ID, name: "Other" });
}

function slugIdFromName(name) {
  const cleaned = String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 18);
  return cleaned ? `cat_${cleaned}` : `cat_${uid().toLowerCase()}`;
}

function uniqueCategoryId(state, baseId) {
  const exists = new Set(state.categories.map((c) => c.id));
  if (!exists.has(baseId)) return baseId;
  let i = 2;
  while (exists.has(`${baseId}_${i}`)) i++;
  return `${baseId}_${i}`;
}

function getFilteredTransactions(state, { q, type, categoryId, monthKey }) {
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

function monthSummary(state, monthKey) {
  const tx = state.transactions.filter((t) => monthKeyFromISO(t.date) === monthKey);
  let income = 0;
  let expenses = 0;
  for (const t of tx) {
    if (t.type === "income") income += t.amount;
    else expenses += t.amount;
  }
  return { income, expenses, net: income - expenses, tx };
}

function computeBudgetUsage(state, monthKey) {
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

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

function setAriaCurrentRoute(route) {
  document.querySelectorAll(".tab").forEach((btn) => {
    const r = btn.getAttribute("data-route");
    if (r === route) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
}

function showRoute(route) {
  document.querySelectorAll(".route").forEach((view) => {
    const name = view.getAttribute("data-view");
    view.hidden = name !== route;
  });
  setAriaCurrentRoute(route);
}

function flashHint(node, message) {
  node.textContent = message;
  if (!message) return;
  window.clearTimeout(flashHint._t);
  flashHint._t = window.setTimeout(() => (node.textContent = ""), 2500);
}

function populateCategoriesSelect(select, state, { includeAll = false } = {}) {
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

function renderCategories(state) {
  const wrap = el("categoryList");
  const empty = el("categoryEmpty");
  ensureOtherCategory(state);

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

function syncCategoryUI(state) {
  populateCategoriesSelect(el("quickAddCategory"), state);
  populateCategoriesSelect(el("txCategory"), state, { includeAll: true });
  populateCategoriesSelect(el("budgetCategory"), state);
  populateCategoriesSelect(el("txDialogCategory"), state);
  renderCategories(state);
}

function populateMonthsSelect(select, state, { includeAll = false, selected } = {}) {
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

function renderDashboard(state, monthKey) {
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

  // top spending
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

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openTxDialog(state, tx) {
  const dlg = el("txDialog");
  const form = el("txDialogForm");
  el("txDialogHint").textContent = "";
  el("txDialogTitle").textContent = tx ? "Edit transaction" : "New transaction";

  form.id.value = tx?.id ?? "";
  form.type.value = tx?.type ?? "expense";
  form.amount.value = tx?.amount != null ? String(tx.amount) : "";
  populateCategoriesSelect(el("txDialogCategory"), state);
  form.category.value = tx?.categoryId ?? state.categories[0]?.id ?? "cat_other";
  form.note.value = tx?.note ?? "";
  form.date.value = tx?.date ?? todayISO();
  form.method.value = tx?.method ?? "card";

  dlg.showModal();
}

function renderTransactions(state, filters) {
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

function renderBudgets(state, monthKey) {
  const wrap = el("budgetList");
  const empty = el("budgetEmpty");
  const { budgets } = computeBudgetUsage(state, monthKey);

  wrap.innerHTML = "";
  if (state.budgets.length === 0) {
    empty.classList.add("is-visible");
    return;
  }
  empty.classList.remove("is-visible");

  // stable order by category name
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

function setup() {
  let state = loadState();
  ensureOtherCategory(state);

  // month selects
  const monthSelect = el("monthSelect");
  const txMonth = el("txMonth");
  const initialMonth = monthKeyFromISO(todayISO());
  populateMonthsSelect(monthSelect, state, { selected: initialMonth });
  populateMonthsSelect(txMonth, state, { includeAll: true, selected: initialMonth });

  // categories selects
  syncCategoryUI(state);

  // prefs
  el("currency").value = state.prefs.currency;
  el("weekStart").value = String(state.prefs.weekStart ?? 1);

  // quick add defaults
  const quickForm = el("quickAddForm");
  quickForm.date.value = todayISO();

  const filters = {
    q: "",
    type: "all",
    categoryId: "all",
    monthKey: initialMonth,
  };

  function refreshAll() {
    // keep selects in sync if new months appear
    const currentMonth = monthSelect.value || initialMonth;
    populateMonthsSelect(monthSelect, state, { selected: currentMonth });
    populateMonthsSelect(txMonth, state, { includeAll: true, selected: filters.monthKey || currentMonth });

    renderDashboard(state, monthSelect.value || initialMonth);
    renderTransactions(state, filters);
    renderBudgets(state, monthSelect.value || initialMonth);
    renderCategories(state);
  }

  // routing
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const route = btn.getAttribute("data-route");
      if (!route) return;
      showRoute(route);
      if (route === "transactions") {
        // nudge focus
        el("txSearch").focus();
      }
    });
  });

  el("quickAddToTransactions").addEventListener("click", () => {
    showRoute("transactions");
    setAriaCurrentRoute("transactions");
  });

  // dashboard month select
  monthSelect.addEventListener("change", refreshAll);

  // quick add submit
  quickForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(quickForm);
    const type = String(form.get("type") ?? "expense");
    const amount = parseAmount(form.get("amount"));
    const categoryId = String(form.get("category") ?? "");
    const note = String(form.get("note") ?? "").trim();
    const date = String(form.get("date") ?? "");
    const method = String(form.get("method") ?? "card");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return flashHint(el("quickAddHint"), "Please choose a valid date.");
    if (!categoryId) return flashHint(el("quickAddHint"), "Please choose a category.");
    if (!Number.isFinite(amount) || amount <= 0) return flashHint(el("quickAddHint"), "Amount must be a number greater than 0.");
    if (type !== "income" && type !== "expense") return flashHint(el("quickAddHint"), "Type is invalid.");

    state.transactions.push({ id: uid(), type, amount, categoryId, note, date, method, createdAt: Date.now() });
    saveState(state);
    quickForm.amount.value = "";
    quickForm.note.value = "";
    flashHint(el("quickAddHint"), "Added.");
    refreshAll();
  });

  // transactions filters
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
    filters.monthKey = monthSelect.value || initialMonth;
    el("txSearch").value = "";
    el("txType").value = "all";
    el("txCategory").value = "all";
    txMonth.value = filters.monthKey;
    renderTransactions(state, filters);
  });

  // tx dialog open
  el("txNew").addEventListener("click", () => openTxDialog(state, null));

  // tx table actions
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
      refreshAll();
    }
  });

  // tx dialog save
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

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return flashHint(hint, "Please choose a valid date.");
    if (!categoryId) return flashHint(hint, "Please choose a category.");
    if (!Number.isFinite(amount) || amount <= 0) return flashHint(hint, "Amount must be a number greater than 0.");
    if (type !== "income" && type !== "expense") return flashHint(hint, "Type is invalid.");

    if (id) {
      const idx = state.transactions.findIndex((t) => t.id === id);
      if (idx === -1) return flashHint(hint, "Transaction not found.");
      state.transactions[idx] = { ...state.transactions[idx], type, amount, categoryId, note, date, method };
    } else {
      state.transactions.push({ id: uid(), type, amount, categoryId, note, date, method, createdAt: Date.now() });
    }
    saveState(state);
    el("txDialog").close();
    refreshAll();
  });

  // budgets save
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
    refreshAll();
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
    refreshAll();
  });

  // settings: save prefs
  el("savePrefs").addEventListener("click", () => {
    const currency = el("currency").value;
    const weekStart = Number(el("weekStart").value);
    state.prefs.currency = currency;
    state.prefs.weekStart = weekStart === 0 ? 0 : 1;
    saveState(state);
    flashHint(el("prefsHint"), "Saved.");
    refreshAll();
  });

  // settings: categories
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
    refreshAll();
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
      refreshAll();
      return;
    }

    if (action === "delete-category") {
      if (id === OTHER_CATEGORY_ID) return flashHint(el("categoryHint"), "“Other” can’t be deleted.");
      const cat = state.categories.find((c) => c.id === id);
      if (!cat) return;
      const ok = window.confirm(`Delete category "${cat.name}"?\n\nTransactions and budgets will move to "Other".`);
      if (!ok) return;
      ensureOtherCategory(state);
      for (const t of state.transactions) {
        if (t.categoryId === id) t.categoryId = OTHER_CATEGORY_ID;
      }
      for (const b of state.budgets) {
        if (b.categoryId === id) b.categoryId = OTHER_CATEGORY_ID;
      }
      state.categories = state.categories.filter((c) => c.id !== id);
      saveState(state);
      flashHint(el("categoryHint"), "Deleted.");
      syncCategoryUI(state);
      refreshAll();
    }
  });

  // backup: export/import
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
      const incoming = hydrateState(JSON.parse(text));
      state = mergeState(state, incoming);
      ensureOtherCategory(state);
      saveState(state);
      // refresh selects due to possible new categories/months
      syncCategoryUI(state);
      refreshAll();
      flashHint(el("prefsHint"), "Imported (merged).");
    } catch {
      flashHint(el("prefsHint"), "Import failed (invalid JSON).");
    } finally {
      e.target.value = "";
    }
  });

  // wipe
  el("wipeAll").addEventListener("click", () => {
    const ok = window.confirm("Wipe ALL Monvixx data from this browser?\n\nThis cannot be undone.");
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    ensureOtherCategory(state);
    saveState(state);
    el("currency").value = state.prefs.currency;
    el("weekStart").value = String(state.prefs.weekStart);
    syncCategoryUI(state);
    populateMonthsSelect(monthSelect, state, { selected: monthKeyFromISO(todayISO()) });
    populateMonthsSelect(txMonth, state, { includeAll: true, selected: monthKeyFromISO(todayISO()) });
    refreshAll();
    flashHint(el("wipeHint"), "Wiped.");
  });

  // initial render
  refreshAll();
  showRoute("dashboard");
}

function mergeState(current, incoming) {
  const out = hydrateState(current);
  const inc = hydrateState(incoming);

  out.prefs = { ...out.prefs, ...inc.prefs };

  // merge categories by id
  const catById = new Map(out.categories.map((c) => [c.id, c]));
  for (const c of inc.categories) {
    if (!c?.id) continue;
    catById.set(c.id, { id: c.id, name: String(c.name ?? "Unnamed") });
  }
  out.categories = Array.from(catById.values());

  // merge transactions by id
  const txById = new Map(out.transactions.map((t) => [t.id, t]));
  for (const t of inc.transactions) {
    if (!t?.id) continue;
    const amount = parseAmount(t.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const date = String(t.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const type = t.type === "income" ? "income" : "expense";
    const categoryId = String(t.categoryId ?? "cat_other");
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

  // merge budgets by id
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

  return out;
}

document.addEventListener("DOMContentLoaded", setup);

