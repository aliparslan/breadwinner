// public/app.js

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://ahvfdteobwmrqkiorhpv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodmZkdGVvYndtcnFraW9yaHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNzI5NzMsImV4cCI6MjA4Mzg0ODk3M30.2K314udaXPAKiWalxXLNmZHqvv9YQ7iQnUtYyONTPrI';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- STATE ---
let allCategories = []; // Store categories here so we can populate the dropdown

// --- HELPERS ---
function formatCurrency(amount) {
    const num = parseFloat(amount);
    const isNeg = num < 0;
    const absVal = Math.abs(num).toFixed(2);
    return (isNeg ? '-$' : '$') + absVal;
}

function formatDate(dateString) {
    const opts = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, opts);
}

// --- DATA FETCHING ---
async function fetchTransactions() {
    // 1. Fetch Categories first (for the edit dropdown)
    const { data: cats } = await client.from('categories').select('*').order('name');
    allCategories = cats || [];

    // 2. Fetch Transactions
    const { data, error } = await client
        .from('transactions')
        .select(`*, categories ( id, name )`)
        .order('date', { ascending: false }); // Newest first

    if (error) { console.error(error); return; }

    // Flatten data
    const formattedData = data.map(tx => ({
        ...tx,
        categoryName: tx.categories ? tx.categories.name : 'Miscellaneous',
        categoryId: tx.category_id // Keep ID for editing
    }));

    renderDashboard(formattedData);
}

// --- RENDER LOGIC (GROUP BY MONTH) ---
function renderDashboard(transactions) {
    // 1. Calculate Totals (Same as before)
    let income = 0;
    let expense = 0;
    const catTotals = {};

    transactions.forEach(tx => {
        const amt = parseFloat(tx.amount);
        if (amt > 0) income += amt;
        else {
            expense += amt;
            const catName = tx.categoryName;
            if (!catTotals[catName]) catTotals[catName] = 0;
            catTotals[catName] += Math.abs(amt);
        }
    });

    // Update Summary UI
    document.getElementById('sum-income').innerText = formatCurrency(income);
    document.getElementById('sum-expense').innerText = formatCurrency(expense);
    const net = income + expense;
    document.getElementById('sum-net').innerText = formatCurrency(net);
    document.getElementById('sum-net').className = net >= 0 ? 'positive' : 'negative';

    // Update Category Bars
    const catContainer = document.getElementById('category-list');
    catContainer.innerHTML = '';
    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const maxSpend = sortedCats.length > 0 ? sortedCats[0][1] : 1;

    sortedCats.slice(0, 5).forEach(([name, total]) => { // Show top 5
        const percent = (total / maxSpend) * 100;
        catContainer.innerHTML += `
            <div style="margin-bottom: 12px;">
                <div class="cat-row"><span>${name}</span><span>$${total.toFixed(2)}</span></div>
                <div class="cat-bar-bg"><div class="cat-bar-fill" style="width: ${percent}%;"></div></div>
            </div>`;
    });

    // 2. GROUP BY MONTH
    const resultsArea = document.getElementById('results-area');
    const tableContainer = document.getElementById('tx-table-container'); // We will inject groups here
    
    // Clear previous
    if(tableContainer) tableContainer.innerHTML = '';
    else {
        // Create container if missing (replace old table)
        const oldTable = document.getElementById('tx-table');
        if(oldTable) oldTable.remove();
        const div = document.createElement('div');
        div.id = 'tx-table-container';
        document.getElementById('results-area').appendChild(div);
    }

    const grouped = {};
    transactions.forEach(tx => {
        // Key: "January 2026"
        const monthKey = new Date(tx.date + 'T12:00:00').toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!grouped[monthKey]) grouped[monthKey] = [];
        grouped[monthKey].push(tx);
    });

    // Render Groups
    const container = document.getElementById('tx-table-container');
    
    for (const [month, txs] of Object.entries(grouped)) {
        // Calculate month total
        const monthTotal = txs.reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        const groupHtml = `
            <div class="month-group">
                <div class="month-header" onclick="toggleMonth(this)">
                    <span>${month} (${txs.length})</span>
                    <span class="${monthTotal >= 0 ? 'positive' : 'negative'}">
                        ${formatCurrency(monthTotal)} ▼
                    </span>
                </div>
                <div class="month-content">
                    <table>
                        <tbody>
                            ${txs.map(tx => renderRow(tx)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML += groupHtml;
    }

    document.getElementById('results-area').classList.remove('hidden');
}

function renderRow(tx) {
    const colorClass = tx.amount < 0 ? 'negative' : 'positive';
    return `
        <tr>
            <td data-label="Date" style="width:15%">${formatDate(tx.date)}</td>
            <td data-label="Description" style="width:35%">${tx.description}</td>
            <td data-label="Category" style="width:20%">${tx.categoryName}</td>
            <td data-label="Amount" class="amount ${colorClass}" style="width:15%">${formatCurrency(tx.amount)}</td>
            <td style="width:15%; text-align:right;">
                <div class="actions">
                    <button class="btn-icon btn-edit" onclick="openEdit(${tx.id})">✎</button>
                    <button class="btn-icon btn-del" onclick="deleteTx(${tx.id})">🗑</button>
                </div>
            </td>
        </tr>
    `;
}

// --- INTERACTIVITY ---

function toggleMonth(header) {
    const content = header.nextElementSibling;
    content.classList.toggle('collapsed');
}

// DELETE
async function deleteTx(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    
    const { error } = await client.from('transactions').delete().eq('id', id);
    if (error) alert("Error deleting: " + error.message);
    else fetchTransactions(); // Refresh
}

// EDIT MODAL
let currentEditId = null;

function openEdit(id) {
    // 1. Find the transaction data from the DOM or fetch it. 
    // Since we don't have global state easily accessible, let's just fetch this one row or filter.
    // Hack: We stored data in memory implicitly? No. Let's just grab it from Supabase for safety.
    // Actually, faster way: We pass the ID, we filter the list we already fetched.
    // But since 'formattedData' isn't global, let's just fetch the single row for accuracy.
    
    client.from('transactions').select('*').eq('id', id).single().then(({ data }) => {
        currentEditId = id;
        document.getElementById('edit-desc').value = data.description;
        document.getElementById('edit-amount').value = data.amount;
        
        // Populate Categories
        const catSelect = document.getElementById('edit-category');
        catSelect.innerHTML = allCategories.map(c => 
            `<option value="${c.id}" ${c.id === data.category_id ? 'selected' : ''}>${c.name}</option>`
        ).join('');

        document.getElementById('edit-modal').classList.remove('hidden');
    });
}

function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

async function saveEdit() {
    const desc = document.getElementById('edit-desc').value;
    const amount = document.getElementById('edit-amount').value;
    const catId = document.getElementById('edit-category').value;

    const { error } = await client.from('transactions').update({
        description: desc,
        amount: amount,
        category_id: catId
    }).eq('id', currentEditId);

    if (error) alert("Error updating: " + error.message);
    else {
        closeModal();
        fetchTransactions(); // Refresh UI
    }
}

// --- AUTH & INIT ---
// (Keep your existing checkUser, updateUI, upload logic, login logic here)
// ... Just make sure checkUser calls fetchTransactions() if logged in ...

// RE-PASTE YOUR UPLOAD LOGIC HERE (It hasn't changed)
const uploadBtn = document.getElementById('upload-btn');
if (uploadBtn) {
    uploadBtn.onclick = async () => {
        const fileInput = document.getElementById('file-input');
        const file = fileInput.files[0];
        const status = document.getElementById('status');

        if (!file) { alert("Please select a PDF!"); return; }

        const { data: { session } } = await client.auth.getSession();
        if (!session) { alert("Please log in!"); return; }

        status.innerHTML = 'Analyzing... <div class="loader"></div>';
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: formData
            });
            if (!response.ok) throw new Error(await response.text());
            await fetchTransactions(); // Refresh
            status.innerText = "✅ Done!";
        } catch (error) { status.innerText = "Error: " + error.message; }
    };
}

// RE-PASTE AUTH LOGIC HERE (Standard Stuff)
async function checkUser() {
    const { data: { session } } = await client.auth.getSession();
    updateUI(session);
    if(session) fetchTransactions();
}
// ... Add loginBtn, signupBtn, logoutBtn listeners here ...
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.onclick = async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) document.getElementById('msg').innerText = error.message;
        else checkUser();
    };
}
// ...
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        await client.auth.signOut();
        updateUI(null);
    };
}
function updateUI(session) {
    const authSection = document.getElementById('auth-section');
    const appSection = document.getElementById('app-section');
    if (session) {
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        document.getElementById('user-email').innerText = session.user.email;
    } else {
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
        document.getElementById('results-area').classList.add('hidden');
    }
}
checkUser();