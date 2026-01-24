// --- CONFIGURATION ---
const SUPABASE_URL = "https://ahvfdteobwmrqkiorhpv.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodmZkdGVvYndtcnFraW9yaHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNzI5NzMsImV4cCI6MjA4Mzg0ODk3M30.2K314udaXPAKiWalxXLNmZHqvv9YQ7iQnUtYyONTPrI";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- CATEGORY COLORS (for viz bars - saturated) ---
const CATEGORY_COLORS = {
  "Housing": "#5c4033",       // Dark Brown
  "Groceries": "#228b22",     // Forest Green
  "Transportation": "#4169e1", // Royal Blue
  "Subscriptions": "#9932cc", // Purple
  "Health": "#dc143c",        // Crimson
  "Shopping": "#daa520",      // Goldenrod
  "Entertainment": "#ff8c00", // Dark Orange
  "Savings": "#20b2aa",       // Light Sea Green
  "Other": "#708090",         // Slate Gray
  "Dining": "#db7093",        // Pale Violet Red
  "Travel": "#00ced1",        // Dark Turquoise
  "Gifts": "#ba55d3",         // Medium Orchid
  "Income": "#2e8b57",        // Sea Green
  "Uncategorized": "#a9a9a9", // Dark Gray
};

// --- CATEGORY PILL COLORS (lighter backgrounds for pills) ---
const CATEGORY_PILL_COLORS = {
  "Housing": { bg: "#d4c4bc", text: "#5c4033" },
  "Groceries": { bg: "#c8e6c9", text: "#1b5e20" },
  "Transportation": { bg: "#bbdefb", text: "#1565c0" },
  "Subscriptions": { bg: "#e1bee7", text: "#7b1fa2" },
  "Health": { bg: "#ffcdd2", text: "#b71c1c" },
  "Shopping": { bg: "#fff3cd", text: "#856404" },
  "Entertainment": { bg: "#ffe0b2", text: "#e65100" },
  "Savings": { bg: "#b2dfdb", text: "#00695c" },
  "Other": { bg: "#cfd8dc", text: "#455a64" },
  "Dining": { bg: "#f8bbd9", text: "#880e4f" },
  "Travel": { bg: "#b2ebf2", text: "#00838f" },
  "Gifts": { bg: "#e1bee7", text: "#6a1b9a" },
  "Income": { bg: "#c8e6c9", text: "#2e7d32" },
  "Uncategorized": { bg: "#e0e0e0", text: "#616161" },
};

function getCategoryColor(categoryName) {
  return CATEGORY_COLORS[categoryName] || CATEGORY_COLORS["Other"];
}

function getCategoryPillStyle(categoryName) {
  const pill = CATEGORY_PILL_COLORS[categoryName] || CATEGORY_PILL_COLORS["Other"];
  return `background-color: ${pill.bg}; color: ${pill.text};`;
}

// --- HELPER: TOAST NOTIFICATIONS ---
const toastEl = document.getElementById("status-toast");
const toastText = document.getElementById("status-text");
let toastTimer;

function showToast(msg, type = "loading") {
  if (!toastText || !toastEl) return;
  toastText.innerText = msg;
  toastEl.className = "";
  toastEl.classList.add(type, "show");
  clearTimeout(toastTimer);
  if (type !== "loading") {
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, 3000);
  }
}

// --- HELPER: LOADING OVERLAY ---
function toggleAppLoading(show) {
  const overlay = document.getElementById("loading-overlay");
  if (show) overlay.classList.remove("hidden");
  else overlay.classList.add("hidden");
}

// --- HELPER: FORMATTING ---
function formatCurrency(amount) {
  const num = parseFloat(amount);
  const isNeg = num < 0;
  const absVal = Math.abs(num).toFixed(2);
  return (isNeg ? "-$" : "$") + absVal;
}

function formatDate(dateString) {
  const [y, m, d] = dateString.split("-");
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// --- CORE LOGIC ---
let allCategories = [];
let allTransactions = [];

async function fetchTransactions() {
  const { data: cats } = await client.from("categories").select("*").order("name");
  allCategories = cats || [];

  const filterSelect = document.getElementById("filter-category");
  const currentVal = filterSelect.value;

  filterSelect.innerHTML =
    '<option value="all">All</option>' +
    allCategories.map((c) => `<option value="${c.name}">${c.name}</option>`).join("");

  filterSelect.value = currentVal;

  const { data, error } = await client
    .from("transactions")
    .select(`*, categories ( id, name )`)
    .order("date", { ascending: false });

  if (error) {
    console.error(error);
    showToast("Error loading data", "error");
    return;
  }

  allTransactions = data.map((tx) => ({
    ...tx,
    categoryName: tx.categories ? tx.categories.name : "Uncategorized",
    categoryId: tx.category_id,
  }));

  applyFilters();
}

function applyFilters() {
  const search = document.getElementById("filter-search").value.toLowerCase();
  const cat = document.getElementById("filter-category").value;

  const filtered = allTransactions.filter((tx) => {
    const matchesSearch = tx.description.toLowerCase().includes(search);
    const matchesCat = cat === "all" || tx.categoryName === cat;
    return matchesSearch && matchesCat;
  });

  renderDashboard(filtered);
}

document.getElementById("filter-search").addEventListener("input", debounce(applyFilters, 300));
document.getElementById("filter-category").addEventListener("change", applyFilters);

// --- MONTHLY VIZ LOGIC ---
let vizMonthsData = {}; // Global store for month data
let vizSortedMonthKeys = []; // Sorted month keys
let vizCurrentMonthIndex = 0; // Track currently selected month
let vizAllTransactions = []; // Store all transactions for income/expense calculations

function renderMonthlyViz(transactions) {
  const container = document.getElementById("monthly-viz");
  if (!container) return;

  vizAllTransactions = transactions; // Store for income/expense calculations

  // 1. Filter Expenses Only & Sort by Date Descending
  const expenses = transactions
    .filter((t) => parseFloat(t.amount) < 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (expenses.length === 0) {
    container.classList.add("hidden");
    return;
  }

  // 2. Group by Month (YYYY-MM) + All Time
  vizMonthsData = { "all": [] };
  expenses.forEach((t) => {
    const key = t.date.substring(0, 7); // "2023-10"
    if (!vizMonthsData[key]) vizMonthsData[key] = [];
    vizMonthsData[key].push(t);
    vizMonthsData["all"].push(t); // Also add to all time
  });

  // Sort keys with "all" first, then months descending
  const monthKeys = Object.keys(vizMonthsData).filter(k => k !== "all").sort().reverse();
  vizSortedMonthKeys = ["all", ...monthKeys];
  vizCurrentMonthIndex = 0; // Start with All Time
  
  renderVizForMonth(vizCurrentMonthIndex);
  container.classList.remove("hidden");
}

function renderVizForMonth(monthIndex) {
  const container = document.getElementById("monthly-viz");
  if (!container) return;

  const currentKey = vizSortedMonthKeys[monthIndex];
  const isAllTime = currentKey === "all";
  
  // For comparison: if All Time, no comparison. Otherwise compare to previous month
  const prevKey = isAllTime ? null : vizSortedMonthKeys[monthIndex + 1];

  // 3. Current Period Stats (expenses)
  const currentTxs = vizMonthsData[currentKey];
  const currentTotal = currentTxs.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

  // Calculate Income/Expense/Net for selected period
  let periodIncome = 0, periodExpense = 0;
  const periodTransactions = isAllTime 
    ? vizAllTransactions 
    : vizAllTransactions.filter(t => t.date.startsWith(currentKey));
  
  periodTransactions.forEach(tx => {
    const amt = parseFloat(tx.amount);
    if (amt > 0) periodIncome += amt;
    else periodExpense += Math.abs(amt);
  });
  const periodNet = periodIncome - periodExpense;

  // 4. Previous Month Stats (for delta)
  let prevTotal = 0;
  let prevCatTotals = {};
  if (prevKey && prevKey !== "all") {
    const prevTxs = vizMonthsData[prevKey];
    if (prevTxs) {
      prevTotal = prevTxs.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
      prevTxs.forEach((t) => {
        prevCatTotals[t.categoryName] = (prevCatTotals[t.categoryName] || 0) + Math.abs(parseFloat(t.amount));
      });
    }
  }

  // 5. Total Delta
  let totalDeltaPct = 0;
  if (prevTotal > 0) {
    totalDeltaPct = ((currentTotal - prevTotal) / prevTotal) * 100;
  }

  // 6. Category Breakdown for Current Period
  const currentCatTotals = {};
  currentTxs.forEach((t) => {
    currentCatTotals[t.categoryName] = (currentCatTotals[t.categoryName] || 0) + Math.abs(parseFloat(t.amount));
  });

  // Prepare Array for sorting
  let catStats = Object.keys(currentCatTotals).map((name) => {
    const amt = currentCatTotals[name];
    const prevAmt = prevCatTotals[name] || 0;
    let deltaPct = 0;
    if (prevAmt > 0) deltaPct = ((amt - prevAmt) / prevAmt) * 100;
    
    return {
      name,
      amount: amt,
      pctOfTotal: (amt / currentTotal) * 100,
      delta: deltaPct,
      prevAmount: prevAmt
    };
  });

  // Sort by Amount Descending
  catStats.sort((a, b) => b.amount - a.amount);

  // 7. Generate HTML
  // Build month dropdown options
  const monthDropdownOptions = vizSortedMonthKeys.map((key, idx) => {
    let displayName;
    if (key === "all") {
      displayName = "All Time";
    } else {
      const [y, m] = key.split("-");
      displayName = new Date(parseInt(y), parseInt(m) - 1).toLocaleString("default", { month: "long", year: "numeric" });
    }
    return `<option value="${idx}" ${idx === monthIndex ? 'selected' : ''}>${displayName}</option>`;
  }).join("");

  // Calculate deltas for all 3 stats (only for specific months, not All Time)
  let prevIncome = 0, prevExpense = 0, prevNet = 0;
  if (prevKey && prevKey !== "all") {
    const prevPeriodTxs = vizAllTransactions.filter(t => t.date.startsWith(prevKey));
    prevPeriodTxs.forEach(tx => {
      const amt = parseFloat(tx.amount);
      if (amt > 0) prevIncome += amt;
      else prevExpense += Math.abs(amt);
    });
    prevNet = prevIncome - prevExpense;
  }

  // Helper to generate ticker HTML
  // Helper to generate ticker HTML
  function getTickerHtml(current, prev, invertColors = false) {
    if (isAllTime) return ''; 
    
    // Handle new case
    if (prev === 0) {
      if (current > 0) return `<span class="stat-card-ticker" style="color: var(--text-muted)">New</span>`;
      return '';
    }

    const deltaPct = ((current - prev) / prev) * 100;
    if (Math.abs(deltaPct) < 0.1) return '';
    const isUp = deltaPct > 0;
    // For expenses: up is bad (red), down is good (green)
    // For income/net: up is good (green), down is bad (red)
    const upColor = invertColors ? 'var(--accent-red)' : 'var(--accent-green)';
    const downColor = invertColors ? 'var(--accent-green)' : 'var(--accent-red)';
    const color = isUp ? upColor : downColor;
    const arrow = isUp ? '▲' : '▼';
    return `<span class="stat-card-ticker" style="color: ${color}">${arrow} ${Math.abs(deltaPct).toFixed(1)}%</span>`;
  }

  const expenseTickerHtml = getTickerHtml(periodExpense, prevExpense, true); // Invert: up is bad
  const incomeTickerHtml = getTickerHtml(periodIncome, prevIncome, false);
  const netTickerHtml = getTickerHtml(periodNet, prevNet, false);

  // Bars HTML: Show Top 6 for visual clarity
  const barsHtml = catStats
    .slice(0, 6)
    .map((c) => {
      const color = getCategoryColor(c.name);
      return `<div class="viz-segment" style="width: ${c.pctOfTotal}%; background: ${color}" title="${c.name}"></div>`;
    })
    .join("");

  // Legend/Grid HTML: Show ALL categories
  const legendHtml = catStats
    .map((c, i) => {
      const color = getCategoryColor(c.name);
      
      // Determine delta display
      let deltaStr, deltaColor;
      if (isAllTime) {
         deltaStr = ""; // No badges for All Time
         deltaColor = "transparent";
      } else if (c.prevAmount === 0) {
        deltaStr = "New";
        deltaColor = "var(--text-muted)";
      } else if (Math.abs(c.delta) < 0.1) {
        deltaStr = "—";
        deltaColor = "var(--text-muted)";
      } else if (c.delta > 0) {
        deltaStr = `▲ ${c.delta.toFixed(1)}%`;
        deltaColor = "var(--accent-red)";
      } else {
        deltaStr = `▼ ${Math.abs(c.delta).toFixed(1)}%`;
        deltaColor = "var(--accent-green)";
      }

      // Always use the category color for the pill (not gray)
      const pillStyle = `background: ${color}`;

      return `
        <div class="viz-item">
          <div class="viz-color-pill" style="${pillStyle}"></div>
          <div class="viz-info">
            <div class="viz-row-top">
              <span class="viz-cat-name">${c.name}</span>
              <span class="viz-cat-pct">${c.pctOfTotal.toFixed(1)}%</span>
            </div>
            <div class="viz-row-bot">
              <span class="viz-cat-amt">${formatCurrency(c.amount)}</span>
              <span class="viz-cat-change" style="color: ${deltaColor}">${deltaStr}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  const html = `
    <div class="viz-card">
      <div class="viz-header">
        <div class="viz-month-container">
          <select id="viz-month-dropdown" class="viz-month-select" onchange="onVizMonthChange(this.value)">
            ${monthDropdownOptions}
          </select>
          <svg class="viz-month-arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      <div class="stat-cards-row">
        <div class="stat-card">
          <span class="stat-card-label">Expenses</span>
          <span class="stat-card-value">${formatCurrency(periodExpense)}</span>
          ${expenseTickerHtml}
        </div>
        <div class="stat-card">
          <span class="stat-card-label">Income</span>
          <span class="stat-card-value positive">${formatCurrency(periodIncome)}</span>
          ${incomeTickerHtml}
        </div>
        <div class="stat-card">
          <span class="stat-card-label">Net</span>
          <span class="stat-card-value ${periodNet >= 0 ? 'positive' : 'negative'}">${periodNet >= 0 ? '+' : '-'}${formatCurrency(Math.abs(periodNet))}</span>
          ${netTickerHtml}
        </div>
      </div>

      <div class="viz-breakdown-header">
        <span class="viz-breakdown-title">Spending Breakdown</span>
      </div>

      <div class="viz-bar-container">
        ${barsHtml}
        <div class="viz-segment" style="flex:1; background: #e7e5e4;" title="Other"></div>
      </div>

      <div class="viz-legend">
        ${legendHtml}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function onVizMonthChange(monthIndexStr) {
  vizCurrentMonthIndex = parseInt(monthIndexStr, 10);
  renderVizForMonth(vizCurrentMonthIndex);
}

function renderDashboard(transactions) {
  // Render the monthly viz (includes summary stats now)
  renderMonthlyViz(allTransactions);

  // Table
  const container = document.getElementById("tx-table-container");
  const grouped = {};

  transactions.forEach((tx) => {
    const [y, m, d] = tx.date.split("-");
    const dateObj = new Date(y, m - 1, d);
    const k = dateObj.toLocaleString("default", { month: "long", year: "numeric" });
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(tx);
  });

  if (Object.keys(grouped).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>No transactions found.</p>
      </div>`;
    return;
  }

  // Render months with collapsible headers (default collapsed, persisted per-month)
  container.innerHTML = Object.entries(grouped)
    .map(([month, txs]) => {
      const total = txs.reduce((s, t) => s + parseFloat(t.amount), 0);
      const rows = txs.map(renderRow).join("");
      
      // Check localStorage for saved state, default to collapsed
      const monthKey = month.replace(/\s+/g, '-');
      const savedState = localStorage.getItem(`month-${monthKey}`);
      const isExpanded = savedState === 'true'; // Default false (collapsed)
      const hiddenClass = isExpanded ? '' : 'hidden';

      return `
      <div class="month-group">
        <button class="month-header" onclick="toggleMonth(this, '${monthKey}')" aria-expanded="${isExpanded}">
          <span>${month}</span>
          <span style="color: ${total >= 0 ? "var(--accent-green)" : "var(--text-main)"}">
            ${formatCurrency(Math.abs(total))}
          </span>
        </button>
        <div class="month-content ${hiddenClass}">
          <table>
             <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
             <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
    })
    .join("");
}

function renderRow(tx) {
  const isNeg = tx.amount < 0;
  const desc = tx.description.length > 60 ? tx.description.substring(0, 58) + "..." : tx.description;
  const pillStyle = getCategoryPillStyle(tx.categoryName);
  const categoryColor = getCategoryColor(tx.categoryName);
  // Tappable row - opens edit modal, with category color for mobile dot
  return `
    <tr onclick="openEdit(${tx.id})" style="cursor: pointer; --category-color: ${categoryColor};" tabindex="0" role="button" aria-label="Edit ${desc}">
      <td>${formatDate(tx.date)}</td>
      <td>${desc}</td>
      <td><span class="category-badge" style="${pillStyle}">${tx.categoryName}</span></td>
      <td style="color:${isNeg ? "var(--text-main)" : "var(--accent-green)"}">${formatCurrency(Math.abs(tx.amount))}</td>
    </tr>`;
}

function toggleMonth(btn, monthKey) {
  const content = btn.nextElementSibling;
  const isHidden = content.classList.toggle("hidden");
  const isExpanded = !isHidden;
  btn.setAttribute("aria-expanded", isExpanded);
  // Save state to localStorage
  localStorage.setItem(`month-${monthKey}`, isExpanded.toString());
}

// --- CONFIRMATION MODAL LOGIC ---
let pendingDeleteId = null;

function initiateDelete(id) {
  pendingDeleteId = id;
  const modal = document.getElementById("confirm-modal");
  modal.classList.remove("hidden");

  // Set up the Yes button specifically for this action
  const yesBtn = document.getElementById("confirm-yes-btn");
  yesBtn.onclick = () => {
    confirmDelete();
    closeConfirm();
  };
}

function closeConfirm() {
  document.getElementById("confirm-modal").classList.add("hidden");
  pendingDeleteId = null;
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;

  // Optimistic Delete
  const originalTxs = [...allTransactions];
  allTransactions = allTransactions.filter((t) => t.id !== id);
  applyFilters();
  showToast("Transaction deleted", "success");

  const { error } = await client.from("transactions").delete().eq("id", id);
  if (error) {
    console.error("Delete failed", error);
    allTransactions = originalTxs;
    applyFilters();
    showToast("Failed to delete", "error");
  }
}

// --- MODAL LOGIC ---
let currentEditId = null;
let currentTxType = "expense";

document.getElementById("edit-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});

document.getElementById("confirm-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeConfirm();
});

function setTxType(type) {
  currentTxType = type;
  document.getElementById("type-expense").className = `type-btn ${type === "expense" ? "active" : ""}`;
  document.getElementById("type-income").className = `type-btn ${type === "income" ? "active" : ""}`;
}

function openAddModal() {
  currentEditId = null;
  document.getElementById("modal-title").innerText = "New Transaction";
  document.getElementById("edit-desc").value = "";
  document.getElementById("edit-amount").value = "";
  document.getElementById("edit-date").value = new Date().toISOString().split("T")[0];
  setTxType("expense");
  renderCats();
  // Hide delete button for new transactions
  document.getElementById("delete-tx-btn").classList.add("hidden");
  document.getElementById("edit-modal").classList.remove("hidden");
  document.getElementById("edit-amount").focus();
}

function openEdit(id, event) {
  // Prevent row click bubbling if clicking specific elements
  if (event) event.stopPropagation();
  
  const tx = allTransactions.find((t) => t.id == id);
  if (!tx) return;
  currentEditId = id;
  document.getElementById("modal-title").innerText = "Edit Transaction";
  document.getElementById("edit-desc").value = tx.description;
  const rawAmt = parseFloat(tx.amount);
  document.getElementById("edit-amount").value = Math.abs(rawAmt).toFixed(2);
  setTxType(rawAmt >= 0 ? "income" : "expense");
  document.getElementById("edit-date").value = tx.date;
  renderCats(tx.category_id);
  // Show delete button for existing transactions
  document.getElementById("delete-tx-btn").classList.remove("hidden");
  document.getElementById("edit-modal").classList.remove("hidden");
}

function renderCats(sel) {
  document.getElementById("edit-category").innerHTML = allCategories
    .map((c) => `<option value="${c.id}" ${c.id == sel ? "selected" : ""}>${c.name}</option>`)
    .join("");
}

function closeModal() {
  document.getElementById("edit-modal").classList.add("hidden");
}

// Delete directly from modal without confirmation
async function deleteFromModal() {
  if (!currentEditId) return;
  const id = currentEditId;
  
  closeModal();
  
  // Optimistic Delete
  const originalTxs = [...allTransactions];
  allTransactions = allTransactions.filter((t) => t.id !== id);
  applyFilters();
  showToast("Transaction deleted", "success");

  const { error } = await client.from("transactions").delete().eq("id", id);
  if (error) {
    console.error("Delete failed", error);
    allTransactions = originalTxs;
    applyFilters();
    showToast("Failed to delete", "error");
  }
}

async function saveEdit() {
  const desc = document.getElementById("edit-desc").value;
  const rawAmt = parseFloat(document.getElementById("edit-amount").value);
  const date = document.getElementById("edit-date").value;
  const cat = document.getElementById("edit-category").value;
  const {
    data: { session },
  } = await client.auth.getSession();

  if (!rawAmt) {
    showToast("Please enter an amount", "error");
    return;
  }

  const finalAmt = currentTxType === "expense" ? -Math.abs(rawAmt) : Math.abs(rawAmt);
  const payload = { description: desc, amount: finalAmt, date: date, category_id: cat };

  closeModal();
  showToast("Saving...", "loading");

  let error;
  if (currentEditId) {
    const res = await client.from("transactions").update(payload).eq("id", currentEditId);
    error = res.error;
  } else {
    const res = await client.from("transactions").insert({ ...payload, user_id: session.user.id });
    error = res.error;
  }

  if (error) {
    console.error(error);
    showToast("Error saving", "error");
  } else {
    await fetchTransactions();
    showToast("Saved successfully", "success");
  }
}

// --- PDF UPLOAD ---
async function extractTextFromPDF(file) {
  try {
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(ab).promise;
    let txt = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const p = await pdf.getPage(i);
      const c = await p.getTextContent();
      txt += c.items.map((s) => s.str).join(" ") + "\n";
    }
    return txt;
  } catch (e) {
    return null;
  }
}

const trigger = document.getElementById("trigger-upload-btn");
const input = document.getElementById("file-input");

if (trigger && input) {
  trigger.onclick = () => input.click();
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    showToast("Reading PDF...", "loading");

    const {
      data: { session },
    } = await client.auth.getSession();
    const txt = await extractTextFromPDF(f);

    const fd = new FormData();
    if (txt && txt.length > 50) fd.append("text", txt);
    else fd.append("file", f);
    fd.append("filename", f.name);

    showToast("AI Analyzing...", "loading");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());

      await fetchTransactions();
      showToast("Import successful!", "success");
      input.value = "";
    } catch (e) {
      showToast("Error: " + e.message, "error");
    }
  };
}

// --- AUTH LOGIC ---
function handleLoginEnter(e) {
  if (e.key === "Enter") document.getElementById("login-btn").click();
}
document.getElementById("email")?.addEventListener("keypress", handleLoginEnter);
document.getElementById("password")?.addEventListener("keypress", handleLoginEnter);

document.getElementById("login-btn").onclick = async () => {
  const e = document.getElementById("email").value;
  const p = document.getElementById("password").value;
  toggleAppLoading(true);
  const { error } = await client.auth.signInWithPassword({ email: e, password: p });
  if (error) {
    document.getElementById("msg").innerText = error.message;
    toggleAppLoading(false);
  } else {
    checkUser();
  }
};

document.getElementById("signup-btn").onclick = async () => {
  const e = document.getElementById("email").value;
  const p = document.getElementById("password").value;
  toggleAppLoading(true);
  const { error } = await client.auth.signUp({ email: e, password: p });
  toggleAppLoading(false);
  if (error) document.getElementById("msg").innerText = error.message;
  else alert("Check your email for the confirmation link.");
};

document.getElementById("logout-btn").onclick = async () => {
  toggleAppLoading(true);
  await client.auth.signOut();
  updateUI(null);
  toggleAppLoading(false);
};

// --- AI INSIGHTS ---
async function fetchInsights(forceRefresh = false) {
  const container = document.getElementById("ai-insights");
  const textEl = document.getElementById("insights-text");
  const refreshBtn = document.getElementById("refresh-insights-btn");
  
  if (!container || !textEl) return;
  
  container.classList.remove("hidden");
  textEl.innerText = "Loading insights...";
  textEl.classList.add("loading");
  if (refreshBtn) refreshBtn.disabled = true;
  
  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    
    const url = forceRefresh ? "/api/insights?refresh=true" : "/api/insights";
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    
    const data = await res.json();
    textEl.innerText = data.insight;
    textEl.classList.remove("loading");
    
    if (data.error) {
      textEl.classList.add("error");
    } else {
      textEl.classList.remove("error");
    }
  } catch (e) {
    textEl.innerText = "Unable to load insights right now.";
    textEl.classList.remove("loading");
    textEl.classList.add("error");
  }
  
  if (refreshBtn) refreshBtn.disabled = false;
}

// Bind refresh button
document.getElementById("refresh-insights-btn")?.addEventListener("click", () => {
  fetchInsights(true);
});

async function checkUser() {
  toggleAppLoading(true);
  const {
    data: { session },
  } = await client.auth.getSession();
  updateUI(session);
  if (session) {
    await fetchTransactions();
    fetchInsights(); // Non-blocking, load in background
  }
  toggleAppLoading(false);
}

function updateUI(s) {
  if (s) {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
    document.getElementById("user-email").innerText = s.user.email;
  } else {
    document.getElementById("auth-section").classList.remove("hidden");
    document.getElementById("app-section").classList.add("hidden");
  }
}

// Init
checkUser();

// --- USER DROPDOWN ---
function toggleUserDropdown() {
  const menu = document.getElementById("user-dropdown-menu");
  menu.classList.toggle("hidden");
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const dropdown = document.querySelector(".user-dropdown");
  const menu = document.getElementById("user-dropdown-menu");
  if (dropdown && menu && !dropdown.contains(e.target)) {
    menu.classList.add("hidden");
  }
});

// Close modal and dropdown on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    if (typeof closeConfirm === 'function') closeConfirm(false);
    const menu = document.getElementById("user-dropdown-menu");
    if (menu) menu.classList.add("hidden");
  }
});
