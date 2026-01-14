// public/app.js

// --- CONFIGURATION ---
const SUPABASE_URL = "https://ahvfdteobwmrqkiorhpv.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodmZkdGVvYndtcnFraW9yaHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNzI5NzMsImV4cCI6MjA4Mzg0ODk3M30.2K314udaXPAKiWalxXLNmZHqvv9YQ7iQnUtYyONTPrI";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- STATE ---
let allCategories = [];

// --- HELPERS ---
function formatCurrency(amount) {
  const num = parseFloat(amount);
  const isNeg = num < 0;
  const absVal = Math.abs(num).toFixed(2);
  return (isNeg ? "-$" : "$") + absVal;
}

function formatDate(dateString) {
  // Returns "Jan 12, 2026"
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// --- CORE FETCH LOGIC ---
async function fetchTransactions() {
  // 1. Categories
  const { data: cats } = await client.from("categories").select("*").order("name");
  allCategories = cats || [];

  // 2. Transactions
  const { data, error } = await client
    .from("transactions")
    .select(`*, categories ( id, name )`)
    .order("date", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const formattedData = data.map((tx) => ({
    ...tx,
    categoryName: tx.categories ? tx.categories.name : "Miscellaneous",
    categoryId: tx.category_id,
  }));

  renderDashboard(formattedData);
}

// --- RENDER LOGIC ---
function renderDashboard(transactions) {
  // 1. Totals
  let income = 0;
  let expense = 0;
  const catTotals = {};

  transactions.forEach((tx) => {
    const amt = parseFloat(tx.amount);
    if (amt > 0) income += amt;
    else {
      expense += amt;
      const catName = tx.categoryName;
      if (!catTotals[catName]) catTotals[catName] = 0;
      catTotals[catName] += Math.abs(amt);
    }
  });

  // Update Cards
  document.getElementById("sum-income").innerText = formatCurrency(income);
  document.getElementById("sum-expense").innerText = formatCurrency(expense);
  const net = income + expense;
  document.getElementById("sum-net").innerText = formatCurrency(net);
  document.getElementById("sum-net").className = net >= 0 ? "positive" : "negative";

  // 2. Categories
  const catContainer = document.getElementById("category-list");
  catContainer.innerHTML = "";
  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const maxSpend = sortedCats.length > 0 ? sortedCats[0][1] : 1;

  // Minimal Icons for Dark Mode
  const getIcon = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes("food") || lower.includes("dining")) return "🍔";
    if (lower.includes("tech") || lower.includes("utility")) return "⚡️";
    if (lower.includes("transport") || lower.includes("gas")) return "⛽️";
    if (lower.includes("home") || lower.includes("rent")) return "🏠";
    return "📦";
  };

  sortedCats.slice(0, 4).forEach(([name, total]) => {
    const percent = (total / maxSpend) * 100;
    catContainer.innerHTML += `
            <div class="cat-item">
                <div class="cat-icon">${getIcon(name)}</div>
                <div class="cat-details">
                    <div class="cat-row">
                        <span style="color:#f3f4f6">${name}</span>
                        <span style="font-family:monospace">${formatCurrency(total * -1)}</span>
                    </div>
                    <div class="cat-bar-bg">
                        <div class="cat-bar-fill" style="width: ${percent}%;"></div>
                    </div>
                </div>
            </div>`;
  });

  // 3. Transactions Grouped by Month
  const container = document.getElementById("tx-table-container");
  container.innerHTML = "";

  const grouped = {};
  transactions.forEach((tx) => {
    const [y, m, d] = tx.date.split("-");
    const dateObj = new Date(y, m - 1, d);
    const monthKey = dateObj.toLocaleString("default", { month: "long", year: "numeric" }).toUpperCase();

    if (!grouped[monthKey]) grouped[monthKey] = [];
    grouped[monthKey].push(tx);
  });

  for (const [month, txs] of Object.entries(grouped)) {
    const monthTotal = txs.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const groupHtml = `
            <div class="month-group">
                <div class="month-header" onclick="toggleMonth(this)">
                    <span>${month} <span style="font-size:0.8rem; opacity:0.5; margin-left:8px;">[${
      txs.length
    }]</span></span>
                    <span class="${monthTotal >= 0 ? "positive" : "negative"}">
                        ${formatCurrency(monthTotal)}
                    </span>
                </div>
                <div class="month-content">
                    <table>
                        <tbody>${txs.map(renderRow).join("")}</tbody>
                    </table>
                </div>
            </div>
        `;
    container.innerHTML += groupHtml;
  }
}

function renderRow(tx) {
  const colorClass = tx.amount < 0 ? "negative" : "positive";
  const desc = tx.description.length > 35 ? tx.description.substring(0, 32) + "..." : tx.description;

  return `
        <tr>
            <td style="width:15%; font-size:0.85rem;">${formatDate(tx.date)}</td>
            
            <td style="width:30%; color: #f3f4f6; font-weight:600;">${desc}</td>
            
            <td style="width:20%">
                <span style="border:1px solid #374151; color:#9ca3af; padding:4px 8px; border-radius:4px; font-size:0.75rem; text-transform:uppercase;">
                    ${tx.categoryName}
                </span>
            </td>
            
            <td class="amount ${colorClass}" style="width:15%; text-align:right;">${formatCurrency(tx.amount)}</td>
            
            <td style="width:20%; text-align:right;">
                <div class="actions">
                    <button class="btn-action btn-edit" onclick="openEdit(${tx.id})">[EDIT]</button>
                    <button class="btn-action btn-del" onclick="deleteTx(${tx.id})">[DEL]</button>
                </div>
            </td>
        </tr>
    `;
}

// --- UI INTERACTIONS ---
function toggleMonth(header) {
  header.nextElementSibling.classList.toggle("collapsed");
}

async function deleteTx(id) {
  if (!confirm("Confirm deletion of record?")) return;
  const { error } = await client.from("transactions").delete().eq("id", id);
  if (error) alert(error.message);
  else fetchTransactions();
}

// --- MODAL LOGIC (ADD / EDIT) ---
let currentEditId = null;

function openAddModal() {
  currentEditId = null;
  document.getElementById("modal-title").innerText = "NEW TRANSACTION";
  document.getElementById("edit-desc").value = "";
  document.getElementById("edit-amount").value = "";
  document.getElementById("edit-date").value = new Date().toISOString().split("T")[0];
  renderCategoryOptions();
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
      document.getElementById("modal-title").innerText = "EDIT RECORD";
      document.getElementById("edit-desc").value = data.description;
      document.getElementById("edit-amount").value = data.amount;
      document.getElementById("edit-date").value = data.date;
      renderCategoryOptions(data.category_id);
      document.getElementById("edit-modal").classList.remove("hidden");
    });
}

function renderCategoryOptions(selectedId = null) {
  const select = document.getElementById("edit-category");
  select.innerHTML = allCategories
    .map((c) => `<option value="${c.id}" ${c.id == selectedId ? "selected" : ""}>${c.name.toUpperCase()}</option>`)
    .join("");
}

function closeModal() {
  document.getElementById("edit-modal").classList.add("hidden");
}

async function saveEdit() {
  const desc = document.getElementById("edit-desc").value;
  const amount = document.getElementById("edit-amount").value;
  const date = document.getElementById("edit-date").value;
  const catId = document.getElementById("edit-category").value;
  const {
    data: { session },
  } = await client.auth.getSession();

  let error;
  if (currentEditId) {
    const res = await client
      .from("transactions")
      .update({
        description: desc,
        amount: amount,
        category_id: catId,
        date: date,
      })
      .eq("id", currentEditId);
    error = res.error;
  } else {
    const res = await client.from("transactions").insert({
      user_id: session.user.id,
      description: desc,
      amount: amount,
      category_id: catId,
      date: date,
      statement_id: null,
    });
    error = res.error;
  }

  if (error) alert("Error: " + error.message);
  else {
    closeModal();
    fetchTransactions();
  }
}

// --- INIT ---
const triggerBtn = document.getElementById("trigger-upload-btn");
const fileInput = document.getElementById("file-input");

if (triggerBtn && fileInput) {
  triggerBtn.onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const status = document.getElementById("status");
    const {
      data: { session },
    } = await client.auth.getSession();

    status.innerHTML = 'PROCESSING... <div class="loader"></div>';
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      if (!response.ok) throw new Error(await response.text());
      await fetchTransactions();
      status.innerText = ">> UPLOAD COMPLETE";
      fileInput.value = "";
    } catch (error) {
      status.innerText = "ERROR: " + error.message;
    }
  };
}

// Login Enter Key
document.getElementById("email")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") document.getElementById("login-btn").click();
});
document.getElementById("password")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") document.getElementById("login-btn").click();
});

// Auth
const loginBtn = document.getElementById("login-btn");
if (loginBtn)
  loginBtn.onclick = async () => {
    const { error } = await client.auth.signInWithPassword({
      email: document.getElementById("email").value,
      password: document.getElementById("password").value,
    });
    if (error) document.getElementById("msg").innerText = error.message;
    else checkUser();
  };

const signupBtn = document.getElementById("signup-btn");
if (signupBtn) {
  signupBtn.onclick = async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const { error } = await client.auth.signUp({ email, password });
    if (error) document.getElementById("msg").innerText = error.message;
    else alert("Account created!");
  };
}

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

function updateUI(session) {
  if (session) {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
    document.getElementById("user-email").innerText = `USER: ${session.user.email.toUpperCase()}`;
  } else {
    document.getElementById("auth-section").classList.remove("hidden");
    document.getElementById("app-section").classList.add("hidden");
  }
}

checkUser();
