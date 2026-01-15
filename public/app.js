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
  // Types: 'loading', 'success', 'error'
  if (!toastText || !toastEl) return;

  toastText.innerText = msg;
  // Remove old classes and add new ones
  toastEl.className = "";
  toastEl.classList.add(type, "show");

  clearTimeout(toastTimer); // Reset hide timer

  if (type !== "loading") {
    // Auto-hide after 3 seconds if not loading
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, 3000);
  }
}

// --- HELPER: FORMATTING ---
function formatCurrency(amount) {
  const num = parseFloat(amount);
  const isNeg = num < 0;
  const absVal = Math.abs(num).toFixed(2);
  return (isNeg ? "-$" : "$") + absVal;
}

function formatDate(dateString) {
  // Fix for timezone offset issues: treat YYYY-MM-DD as local
  const [y, m, d] = dateString.split("-");
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// --- HELPER: DEBOUNCE (For snappy search) ---
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
  // Preserve current selection if refreshing
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

// Attach listeners
document.getElementById("filter-search").addEventListener("input", debounce(applyFilters, 300));
document.getElementById("filter-category").addEventListener("change", applyFilters);

function renderDashboard(transactions) {
  let income = 0;
  let expense = 0;
  const catTotals = {};

  // 1. Calculate Totals
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
  document.getElementById("sum-expense").innerText = formatCurrency(expense);
  const net = income + expense;
  const sumNet = document.getElementById("sum-net");
  sumNet.innerText = formatCurrency(net);
  sumNet.className = net >= 0 ? "positive" : "negative"; // This might need a CSS class for 'negative' if not exists, default color is fine.

  // 2. Render Categories (Optimized)
  const catContainer = document.getElementById("category-list");
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const max = sorted.length > 0 ? sorted[0][1] : 1;

  const getIcon = (n) => {
    const l = n.toLowerCase();
    if (l.includes("savings") || l.includes("invest")) return "📈";
    if (l.includes("debt") || l.includes("loan")) return "💳";
    if (l.includes("fee") || l.includes("bank")) return "🏦";
    if (l.includes("food") || l.includes("restaurant")) return "🍔";
    if (l.includes("tech") || l.includes("software")) return "💻";
    if (l.includes("transport") || l.includes("gas")) return "⛽️";
    if (l.includes("home") || l.includes("rent")) return "🏠";
    if (l.includes("income") || l.includes("paycheck")) return "💰";
    return "📦";
  };

  catContainer.innerHTML = sorted
    .slice(0, 5)
    .map(([name, total]) => {
      const pct = (total / max) * 100;
      return `
      <div class="cat-item">
        <div class="cat-icon">${getIcon(name)}</div>
        <div class="cat-details">
          <div class="cat-row">
            <span class="cat-name">${name}</span>
            <span class="cat-amount">${formatCurrency(total * -1)}</span>
          </div>
          <div class="cat-bar-bg"><div class="cat-bar-fill" style="width: ${pct}%;"></div></div>
        </div>
      </div>`;
    })
    .join("");

  // 3. Render Table (Optimized)
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
    container.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted);">No transactions found.</div>`;
    return;
  }

  container.innerHTML = Object.entries(grouped)
    .map(([month, txs]) => {
      const total = txs.reduce((s, t) => s + parseFloat(t.amount), 0);
      const rows = txs.map(renderRow).join("");

      return `
      <div class="month-group">
        <div class="month-header" onclick="toggleMonth(this)">
          <span>${month}</span>
          <span style="color: ${total >= 0 ? "var(--accent-green)" : "var(--text-main)"}">
            ${formatCurrency(total)}
          </span>
        </div>
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
  // NOTE: On mobile, CSS transforms this row into a card.
  return `
    <tr>
      <td>${formatDate(tx.date)}</td>
      <td>${desc}</td>
      <td><span>${tx.categoryName}</span></td>
      <td style="color:${isNeg ? "var(--text-main)" : "var(--accent-green)"}">${formatCurrency(tx.amount)}</td>
      <td>
        <div class="actions">
          <button class="btn-action btn-edit" onclick="openEdit(${tx.id})">Edit</button>
          <button class="btn-action btn-del" onclick="deleteTx(${tx.id})">Del</button>
        </div>
      </td>
    </tr>`;
}

function toggleMonth(el) {
  // Requires CSS: .collapsed { display: none; } or similar logic for the next sibling
  // Since original CSS didn't have .collapsed class explicitly defined for content,
  // we toggle the 'hidden' class on the month-content div.
  const content = el.nextElementSibling;
  content.classList.toggle("hidden");
}

// --- OPTIMISTIC DELETE ---
async function deleteTx(id) {
  if (!confirm("Delete transaction?")) return;

  // 1. Snapshot for rollback
  const originalTxs = [...allTransactions];

  // 2. UI Update (Instant)
  allTransactions = allTransactions.filter((t) => t.id !== id);
  applyFilters();
  showToast("Transaction deleted", "success");

  // 3. Database Update
  const { error } = await client.from("transactions").delete().eq("id", id);

  if (error) {
    console.error("Delete failed", error);
    allTransactions = originalTxs; // Revert
    applyFilters();
    showToast("Failed to delete", "error");
  }
}

// --- MODAL LOGIC ---
let currentEditId = null;
let currentTxType = "expense";

// Modal Click Outside Listener
document.getElementById("edit-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    closeModal();
  }
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

  if (!rawAmt) return alert("Please enter an amount");

  const finalAmt = currentTxType === "expense" ? -Math.abs(rawAmt) : Math.abs(rawAmt);
  const payload = { description: desc, amount: finalAmt, date: date, category_id: cat };

  // Optimistic UI: Close modal immediately and show status
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
    // Optionally re-open modal here
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
  const { error } = await client.auth.signInWithPassword({ email: e, password: p });
  if (error) document.getElementById("msg").innerText = error.message;
  else checkUser();
};

document.getElementById("signup-btn").onclick = async () => {
  const e = document.getElementById("email").value;
  const p = document.getElementById("password").value;
  const { error } = await client.auth.signUp({ email: e, password: p });
  if (error) document.getElementById("msg").innerText = error.message;
  else alert("Check your email for the confirmation link.");
};

document.getElementById("logout-btn").onclick = async () => {
  await client.auth.signOut();
  updateUI(null);
};

async function checkUser() {
  const {
    data: { session },
  } = await client.auth.getSession();
  updateUI(session);
  if (session) fetchTransactions();
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
