// --- CONFIGURATION ---
const SUPABASE_URL = "https://ahvfdteobwmrqkiorhpv.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodmZkdGVvYndtcnFraW9yaHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNzI5NzMsImV4cCI6MjA4Mzg0ODk3M30.2K314udaXPAKiWalxXLNmZHqvv9YQ7iQnUtYyONTPrI";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
function renderMonthlyViz(transactions) {
  const container = document.getElementById("monthly-viz");
  if (!container) return;

  // 1. Filter Expenses Only & Sort by Date Descending
  const expenses = transactions
    .filter((t) => parseFloat(t.amount) < 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (expenses.length === 0) {
    container.classList.add("hidden");
    return;
  }

  // 2. Group by Month (YYYY-MM)
  const months = {};
  expenses.forEach((t) => {
    const key = t.date.substring(0, 7); // "2023-10"
    if (!months[key]) months[key] = [];
    months[key].push(t);
  });

  const sortedMonthKeys = Object.keys(months).sort().reverse(); // ["2023-10", "2023-09"]
  const currentKey = sortedMonthKeys[0];
  const prevKey = sortedMonthKeys[1]; // Might be undefined

  // 3. Current Month Stats
  const currentTxs = months[currentKey];
  const currentTotal = currentTxs.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

  // 4. Previous Month Stats (for delta)
  let prevTotal = 0;
  let prevCatTotals = {};
  if (prevKey) {
    const prevTxs = months[prevKey];
    prevTotal = prevTxs.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
    prevTxs.forEach((t) => {
      prevCatTotals[t.categoryName] = (prevCatTotals[t.categoryName] || 0) + Math.abs(parseFloat(t.amount));
    });
  }

  // 5. Total Delta
  let totalDeltaPct = 0;
  if (prevTotal > 0) {
    totalDeltaPct = ((currentTotal - prevTotal) / prevTotal) * 100;
  }

  // 6. Category Breakdown for Current Month
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

  // Colors for visualization (Cocoa/Pastel Theme)
  const colors = [
    "#4a3b32", // Deep Espresso
    "#9e644b", // Terra Cotta
    "#7c866b", // Sage Green
    "#a99282", // Clay
    "#6e5b53", // Taupe
    "#c3b091", // Sand
    "#57534e", // Stone
    "#8c6e63", // Cocoa
  ];

  // 7. Generate HTML
  // Current Month Name
  const [y, m] = currentKey.split("-");
  const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleString("default", { month: "long" });

  const totalDeltaHtml = prevKey
    ? `<span class="viz-trend ${totalDeltaPct > 0 ? "up" : "down"}">
         ${totalDeltaPct > 0 ? "▲" : "▼"} ${Math.abs(totalDeltaPct).toFixed(1)}%
       </span>`
    : `<span class="viz-trend" style="color:var(--text-muted)">New</span>`;

  // Bars HTML: Show Top 6 for visual clarity
  const barsHtml = catStats
    .slice(0, 6)
    .map((c, i) => {
      const color = colors[i % colors.length];
      return `<div class="viz-segment" style="width: ${c.pctOfTotal}%; background: ${color}" title="${c.name}"></div>`;
    })
    .join("");

  // Legend/Grid HTML: Show ALL categories
  const legendHtml = catStats
    .map((c, i) => {
      // Create a faded color for items beyond the top 6 to show they aren't in the bar? 
      // Or just cycle colors. Let's cycle.
      const color = colors[i % colors.length];
      const arrow = c.delta > 0 ? "▲" : "▼";
      const deltaStr = c.prevAmount > 0 ? `${arrow} ${Math.abs(c.delta).toFixed(1)}%` : "New";
      const deltaColor = c.prevAmount > 0 ? (c.delta > 0 ? "var(--accent-red)" : "var(--accent-green)") : "var(--text-muted)";

      // Simple indicator if it's in the bar chart
      const isHiddenInBar = i >= 6;
      const pillStyle = isHiddenInBar ? `background: #e7e5e4` : `background: ${color}`;

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
        <div class="viz-month-selector">
          <span class="viz-month active">${monthName}</span>
        </div>
        <div class="viz-total-section">
          <span class="viz-label">Total Spent</span>
          <div class="viz-big-number">${formatCurrency(currentTotal)}</div>
          ${totalDeltaHtml}
        </div>
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
  container.classList.remove("hidden");
}

function renderDashboard(transactions) {
  // Always render the monthly viz using global data (most recent month)
  // regardless of the current search results
  renderMonthlyViz(allTransactions);

  let income = 0;
  let expense = 0;
  const catTotals = {};

  transactions.forEach((tx) => {
    const amt = parseFloat(tx.amount);
    if (amt > 0) income += amt;
    else {
      expense += amt;
      const c = tx.categoryName;
      catTotals[c] = (catTotals[c] || 0) + Math.abs(amt);
    }
  });

  document.getElementById("sum-income").innerText = formatCurrency(income);
  document.getElementById("sum-expense").innerText = formatCurrency(Math.abs(expense));
  const net = income + expense;
  const sumNet = document.getElementById("sum-net");
  sumNet.innerText = formatCurrency(Math.abs(net)); // Display Positive
  sumNet.className = net >= 0 ? "positive" : "negative";

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

  // A11y Fix: Changed div.month-header to button
  container.innerHTML = Object.entries(grouped)
    .map(([month, txs]) => {
      const total = txs.reduce((s, t) => s + parseFloat(t.amount), 0);
      const rows = txs.map(renderRow).join("");

      return `
      <div class="month-group">
        <button class="month-header" onclick="toggleMonth(this)" aria-expanded="true">
          <span>${month}</span>
          <span style="color: ${total >= 0 ? "var(--accent-green)" : "var(--text-main)"}">
            ${formatCurrency(Math.abs(total))}
          </span>
        </button>
        <div class="month-content">
          <table>
             <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Action</th></tr></thead>
             <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
    })
    .join("");
}

function renderRow(tx) {
  const isNeg = tx.amount < 0;
  const desc = tx.description.length > 40 ? tx.description.substring(0, 38) + "..." : tx.description;
  // Always positive amount
  return `
    <tr>
      <td>${formatDate(tx.date)}</td>
      <td>${desc}</td>
      <td><span>${tx.categoryName}</span></td>
      <td style="color:${isNeg ? "var(--text-main)" : "var(--accent-green)"}">${formatCurrency(Math.abs(tx.amount))}</td>
      <td>
        <div class="actions">
          <button class="btn-action btn-edit" onclick="openEdit(${tx.id})" aria-label="Edit transaction">Edit</button>
          <button class="btn-action btn-del" onclick="initiateDelete(${
            tx.id
          })" aria-label="Delete transaction">Del</button>
        </div>
      </td>
    </tr>`;
}

function toggleMonth(btn) {
  const content = btn.nextElementSibling;
  const isHidden = content.classList.toggle("hidden");
  btn.setAttribute("aria-expanded", !isHidden);
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
  document.getElementById("edit-modal").classList.remove("hidden");
  document.getElementById("edit-amount").focus();
}

function openEdit(id) {
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

async function checkUser() {
  toggleAppLoading(true);
  const {
    data: { session },
  } = await client.auth.getSession();
  updateUI(session);
  if (session) await fetchTransactions();
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
