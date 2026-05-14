const STORAGE_KEY = "personal-finance-tracker-v1";

const defaultCategories = {
  expense: ["Еда", "Транспорт", "Дом", "Здоровье", "Развлечения", "Покупки", "Другое"],
  income: ["Зарплата", "Фриланс", "Подарок", "Возврат", "Другое"],
};

const state = {
  transactions: [],
  customCategories: {
    expense: [],
    income: [],
  },
  type: "expense",
  month: getLocalMonthValue(),
};

const elements = {
  themeToggle: document.querySelector("#themeToggle"),
  menuToggle: document.querySelector("#menuToggle"),
  dataMenu: document.querySelector("#dataMenu"),
  monthPicker: document.querySelector("#monthPicker"),
  monthBalance: document.querySelector("#monthBalance"),
  monthDelta: document.querySelector("#monthDelta"),
  todayTotal: document.querySelector("#todayTotal"),
  averageExpense: document.querySelector("#averageExpense"),
  categoryCount: document.querySelector("#categoryCount"),
  categoryBars: document.querySelector("#categoryBars"),
  transactionList: document.querySelector("#transactionList"),
  transactionForm: document.querySelector("#transactionForm"),
  categoryForm: document.querySelector("#categoryForm"),
  amountInput: document.querySelector("#amountInput"),
  categoryInput: document.querySelector("#categoryInput"),
  newCategoryInput: document.querySelector("#newCategoryInput"),
  customCategoryList: document.querySelector("#customCategoryList"),
  noteInput: document.querySelector("#noteInput"),
  dateInput: document.querySelector("#dateInput"),
  clearMonth: document.querySelector("#clearMonth"),
  clearAll: document.querySelector("#clearAll"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  segments: document.querySelectorAll(".segment"),
};

function formatMoney(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(value);
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalMonthValue(date = new Date()) {
  return getLocalDateInputValue(date).slice(0, 7);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
}

function normalizeCategory(value) {
  return value.trim().replace(/\s+/g, " ");
}

function getCategories(type = state.type) {
  const withoutOther = defaultCategories[type].filter((category) => category.toLowerCase() !== "другое");
  const customWithoutOther = state.customCategories[type].filter((category) => category.toLowerCase() !== "другое");
  return [...withoutOther, ...customWithoutOther, "Другое"];
}

function cleanCategoryList(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeCategory)
    .filter(Boolean)
    .filter((category, index, list) => list.findIndex((item) => item.toLowerCase() === category.toLowerCase()) === index);
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    state.transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
    state.customCategories.expense = cleanCategoryList(parsed.customCategories?.expense);
    state.customCategories.income = cleanCategoryList(parsed.customCategories?.income);
    state.month = parsed.month || state.month;
    document.documentElement.dataset.theme = parsed.theme || "";
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      transactions: state.transactions,
      customCategories: state.customCategories,
      month: state.month,
      theme: document.documentElement.dataset.theme || "",
    }),
  );
}

function setType(type) {
  state.type = type;
  elements.segments.forEach((button) => button.classList.toggle("active", button.dataset.type === type));
  elements.categoryInput.innerHTML = getCategories(type)
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");
  renderCustomCategories();
}

function getMonthTransactions() {
  return state.transactions
    .filter((item) => item.date.startsWith(state.month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

function renderSummary(monthItems) {
  const income = monthItems.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = monthItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const today = getLocalDateInputValue();
  const todayExpense = state.transactions
    .filter((item) => item.type === "expense" && item.date === today)
    .reduce((sum, item) => sum + item.amount, 0);
  const expenseDays = new Set(monthItems.filter((item) => item.type === "expense").map((item) => item.date)).size || 1;

  elements.monthBalance.textContent = formatMoney(income - expense);
  elements.monthDelta.textContent = `Доходы ${formatMoney(income)} · Расходы ${formatMoney(expense)}`;
  elements.todayTotal.textContent = formatMoney(todayExpense);
  elements.averageExpense.textContent = formatMoney(expense / expenseDays);
}

function renderCategories(monthItems) {
  const totals = monthItems
    .filter((item) => item.type === "expense")
    .reduce((result, item) => {
      result[item.category] = (result[item.category] || 0) + item.amount;
      return result;
    }, {});

  const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...rows.map(([, value]) => value), 1);

  elements.categoryCount.textContent = rows.length;
  elements.categoryBars.innerHTML = rows.length
    ? rows
        .map(
          ([category, amount]) => `
            <div class="bar-row">
              <div class="bar-label">
                <span>${escapeHtml(category)}</span>
                <strong>${formatMoney(amount)}</strong>
              </div>
              <div class="bar-track"><div class="bar-fill" style="width: ${(amount / max) * 100}%"></div></div>
            </div>
          `,
        )
        .join("")
    : `<p class="empty-state">Расходов за этот месяц пока нет.</p>`;
}

function renderCustomCategories() {
  const customCategories = state.customCategories[state.type];
  elements.customCategoryList.innerHTML = customCategories.length
    ? customCategories
        .map(
          (category) => `
            <button class="category-chip" type="button" data-category="${escapeHtml(category)}" title="Удалить категорию">
              <span>${escapeHtml(category)}</span>
              <strong aria-hidden="true">×</strong>
            </button>
          `,
        )
        .join("")
    : `<p class="category-hint">Свои категории для выбранного типа появятся здесь.</p>`;
}

function renderTransactions(monthItems) {
  elements.transactionList.innerHTML = monthItems.length
    ? monthItems
        .map(
          (item) => `
            <div class="transaction">
              <div>
                <div class="transaction-title">${escapeHtml(item.note || item.category)}</div>
                <div class="transaction-meta">${escapeHtml(item.category)} · ${new Date(item.date).toLocaleDateString("ru-RU")}</div>
              </div>
              <div class="transaction-amount ${item.type}">${item.type === "income" ? "+" : "-"}${formatMoney(item.amount)}</div>
              <button class="delete-button" type="button" data-id="${item.id}" aria-label="Удалить">×</button>
            </div>
          `,
        )
        .join("")
    : `<p class="empty-state">Добавьте первую операцию за выбранный месяц.</p>`;
}

function render() {
  const monthItems = getMonthTransactions();
  elements.monthPicker.value = state.month;
  renderSummary(monthItems);
  renderCategories(monthItems);
  renderTransactions(monthItems);
  saveState();
}

function addTransaction(event) {
  event.preventDefault();
  const amount = Number(elements.amountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) return;

  state.transactions.push({
    id: crypto.randomUUID(),
    type: state.type,
    amount,
    category: elements.categoryInput.value,
    note: elements.noteInput.value.trim(),
    date: elements.dateInput.value,
    createdAt: Date.now(),
  });

  elements.transactionForm.reset();
  elements.dateInput.value = getLocalDateInputValue();
  setType(state.type);
  render();
}

function addCustomCategory(event) {
  event.preventDefault();
  const category = normalizeCategory(elements.newCategoryInput.value);
  if (!category) return;

  const existing = getCategories().map((item) => item.toLowerCase());
  if (existing.includes(category.toLowerCase())) {
    elements.newCategoryInput.value = "";
    return;
  }

  state.customCategories[state.type].push(category);
  elements.newCategoryInput.value = "";
  setType(state.type);
  elements.categoryInput.value = category;
  render();
}

function setMenuOpen(isOpen) {
  elements.dataMenu.hidden = !isOpen;
  elements.menuToggle.setAttribute("aria-expanded", String(isOpen));
}

function deleteCustomCategory(category) {
  const isUsed = state.transactions.some((item) => item.type === state.type && item.category === category);
  if (isUsed && !confirm("Категория уже используется в операциях. Удалить ее из списка новых операций?")) return;

  state.customCategories[state.type] = state.customCategories[state.type].filter((item) => item !== category);
  setType(state.type);
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify({ transactions: state.transactions, customCategories: state.customCategories }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `finances-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed.transactions)) throw new Error("Bad file");
      state.transactions = parsed.transactions;
      if (parsed.customCategories) {
        state.customCategories.expense = cleanCategoryList(parsed.customCategories.expense);
        state.customCategories.income = cleanCategoryList(parsed.customCategories.income);
      }
      setType(state.type);
      render();
    } catch {
      alert("Не получилось импортировать файл. Проверьте, что это экспорт из трекера.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

elements.segments.forEach((button) => button.addEventListener("click", () => setType(button.dataset.type)));
elements.transactionForm.addEventListener("submit", addTransaction);
elements.categoryForm.addEventListener("submit", addCustomCategory);
elements.monthPicker.addEventListener("change", (event) => {
  state.month = event.target.value;
  render();
});
elements.transactionList.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) return;
  state.transactions = state.transactions.filter((item) => item.id !== button.dataset.id);
  render();
});
elements.customCategoryList.addEventListener("click", (event) => {
  const button = event.target.closest(".category-chip");
  if (!button) return;
  deleteCustomCategory(button.dataset.category);
});
elements.clearMonth.addEventListener("click", () => {
  if (!confirm("Удалить операции выбранного месяца?")) return;
  state.transactions = state.transactions.filter((item) => !item.date.startsWith(state.month));
  render();
});
elements.clearAll.addEventListener("click", () => {
  if (!confirm("Удалить все сохраненные данные в этом браузере?")) return;
  state.transactions = [];
  setMenuOpen(false);
  render();
});
elements.exportData.addEventListener("click", () => {
  exportData();
  setMenuOpen(false);
});
elements.importData.addEventListener("change", (event) => {
  importData(event);
  setMenuOpen(false);
});
elements.menuToggle.addEventListener("click", () => setMenuOpen(elements.dataMenu.hidden));
document.addEventListener("click", (event) => {
  const clickedInsideMenu = elements.dataMenu.contains(event.target);
  const clickedToggle = elements.menuToggle.contains(event.target);
  if (!clickedInsideMenu && !clickedToggle) setMenuOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenuOpen(false);
});
elements.themeToggle.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme;
  document.documentElement.dataset.theme = current === "dark" ? "" : "dark";
  saveState();
});

loadState();
elements.dateInput.value = getLocalDateInputValue();
setType(state.type);
render();
