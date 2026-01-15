// public/app.js

// --- CONFIGURATION ---
const SUPABASE_URL = "https://ahvfdteobwmrqkiorhpv.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodmZkdGVvYndtcnFraW9yaHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNzI5NzMsImV4cCI6MjA4Mzg0ODk3M30.2K314udaXPAKiWalxXLNmZHqvv9YQ7iQnUtYyONTPrI";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- HELPERS ---
function formatCurrency(amount) {
  const num = parseFloat(amount);
  const isNeg = num < 0;
  const absVal = Math.abs(num).toFixed(2);
  return (isNeg ? "-$" : "$") + absVal;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// --- CORE FETCH LOGIC ---
let allCategories = [];
let allTransactions = []; // Store raw data for filtering

async function fetchTransactions() {
  // Fetch Categories
  const { data: cats } = await client.from("categories").select("*").order("name");
  allCategories = cats || [];

  // Populate Filter Dropdown
  const filterSelect = document.getElementById("filter-category");
  filterSelect.innerHTML =
    '<option value="all">All Categories</option>' +
    allCategories.map((c) => `<option value="${c.name}">${c.name}</option>`).join("");

  // Fetch Transactions
  const { data, error } = await client
    .from("transactions")
    .select(`*, categories ( id, name )`)
    .order("date", { ascending: false });
  if (error) {
    console.error(error);
    return;
  }

  // Format Data
  allTransactions = data.map((tx) => ({
    ...tx,
    categoryName: tx.categories ? tx.categories.name : "Uncategorized",
    categoryId: tx.category_id,
  }));

  renderDashboard(allTransactions);
}

// --- FILTERING LOGIC ---
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
document.getElementById("filter-search").addEventListener("input", applyFilters);
document.getElementById("filter-category").addEventListener("change", applyFilters);

// --- RENDER ---
function renderDashboard(transactions) {
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
  document.getElementById("sum-expense").innerText = formatCurrency(expense);
  const net = income + expense;
  document.getElementById("sum-net").innerText = formatCurrency(net);
  document.getElementById("sum-net").className = net >= 0 ? "positive" : "negative";

  // Categories Chart
  const catContainer = document.getElementById("category-list");
  catContainer.innerHTML = "";
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

  sorted.slice(0, 5).forEach(([name, total]) => {
    const pct = (total / max) * 100;
    catContainer.innerHTML += `
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
  });

  // Transactions Table (Month Grouped)
  const container = document.getElementById("tx-table-container");
  container.innerHTML = "";
  const grouped = {};
  transactions.forEach((tx) => {
    const d = new Date(tx.date.split("-"));
    const k = d.toLocaleString("default", { month: "long", year: "numeric" });
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(tx);
  });

  for (const [month, txs] of Object.entries(grouped)) {
    const total = txs.reduce((s, t) => s + parseFloat(t.amount), 0);
    const html = `
            <div class="month-group">
                <div class="month-header" onclick="toggleMonth(this)">
                    <span>${month}</span>
                    <span style="color: ${total >= 0 ? "var(--accent-green)" : "var(--text-main)"}">${formatCurrency(
      total
    )}</span>
                </div>
                <div class="month-content">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Category</th>
                                <th>Amount</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>${txs.map(renderRow).join("")}</tbody>
                    </table>
                </div>
            </div>`;
    container.innerHTML += html;
  }
}

function renderRow(tx) {
  const isNeg = tx.amount < 0;
  const desc = tx.description.length > 40 ? tx.description.substring(0, 38) + "..." : tx.description;

  return `
        <tr>
            <td>${formatDate(tx.date)}</td>
            <td>${desc}</td>
            <td><span>${tx.categoryName}</span></td>
            <td style="color:${isNeg ? "var(--text-main)" : "var(--accent-green)"}">
                ${formatCurrency(tx.amount)}
            </td>
            <td>
                <div class="actions">
                    <button class="btn-action btn-edit" onclick="openEdit(${tx.id})">Edit</button>
                    <button class="btn-action btn-del" onclick="deleteTx(${tx.id})">Del</button>
                </div>
            </td>
        </tr>`;
}

// ... [Keep existing Toggle, Delete, Modal, Upload, Auth Logic below] ...

function toggleMonth(el) {
  el.nextElementSibling.classList.toggle("collapsed");
}
async function deleteTx(id) {
  if (!confirm("Delete this transaction?")) return;
  await client.from("transactions").delete().eq("id", id);
  fetchTransactions();
}

let currentEditId = null;
function openAddModal() {
  currentEditId = null;
  document.getElementById("modal-title").innerText = "New Transaction";
  document.getElementById("edit-desc").value = "";
  document.getElementById("edit-amount").value = "";
  document.getElementById("edit-date").value = new Date().toISOString().split("T")[0];
  renderCats();
  document.getElementById("edit-modal").classList.remove("hidden");
}
function openEdit(id) {
  client
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single()
    .then(({ data }) => {
      currentEditId = id;
      document.getElementById("modal-title").innerText = "Edit Transaction";
      document.getElementById("edit-desc").value = data.description;
      document.getElementById("edit-amount").value = data.amount;
      document.getElementById("edit-date").value = data.date;
      renderCats(data.category_id);
      document.getElementById("edit-modal").classList.remove("hidden");
    });
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
  const amt = document.getElementById("edit-amount").value;
  const date = document.getElementById("edit-date").value;
  const cat = document.getElementById("edit-category").value;
  const {
    data: { session },
  } = await client.auth.getSession();

  const payload = { description: desc, amount: amt, date: date, category_id: cat };
  if (currentEditId) await client.from("transactions").update(payload).eq("id", currentEditId);
  else await client.from("transactions").insert({ ...payload, user_id: session.user.id });

  closeModal();
  fetchTransactions();
}

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
    const st = document.getElementById("status");
    const {
      data: { session },
    } = await client.auth.getSession();

    st.innerHTML = "Reading PDF...";
    const txt = await extractTextFromPDF(f);
    const fd = new FormData();
    if (txt && txt.length > 50) fd.append("text", txt);
    else fd.append("file", f);
    fd.append("filename", f.name);

    st.innerHTML = "Analyzing...";
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchTransactions();
      st.innerHTML = "Done";
      input.value = "";
    } catch (e) {
      st.innerHTML = "Error: " + e.message;
    }
  };
}

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
  else alert("Account created! Check your email to confirm.");
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
checkUser();
